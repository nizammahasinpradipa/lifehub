import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  FolderPlus,
  Hash,
  Plus,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import {
  formatDueAt,
  getLocalDateString,
  isTaskDueToday,
  isTaskOverdue,
  isoToLocalDate,
  isoToLocalTimeInput,
  localDateTimeToUtcIso,
} from '../lib/dates';
import type { Priority, Recurrence, Task } from '../types/models';
import { TagPicker } from '../components/TagPicker';
import { LinkPicker } from '../components/LinkPicker';

type TaskFilter = 'today' | 'upcoming' | 'overdue' | 'all' | 'completed';

const PROJECT_COLORS = ['#0F766E', '#2563EB', '#D97706', '#7C3AED', '#E11D48', '#475569'];

export const TasksView: React.FC = () => {
  const {
    data,
    activeTasks,
    activeProjects,
    activeTags,
    focusTarget,
    clearFocusTarget,
    getTagsForItem,
    addTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    addProject,
    deleteProject,
    setItemTags,
    notify,
  } = useLifeHub();

  const [filter, setFilter] = useState<TaskFilter>('today');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [subtaskInput, setSubtaskInput] = useState('');

  // PRD: Completing last subtask asks before completing parent
  const [parentCompletePromptId, setParentCompletePromptId] = useState<string | null>(null);

  // Add project inline state
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);

  useEffect(() => {
    if (focusTarget?.tab === 'tasks' && focusTarget.itemId) {
      setFilter('all');
      setSelectedProjectId(null);
      setSelectedTagId(null);
      setEditingTaskId(focusTarget.itemId);
      clearFocusTarget();
    }
  }, [focusTarget, clearFocusTarget]);

  const parentTasks = useMemo(() => activeTasks.filter((t) => !t.parent_task_id), [activeTasks]);

  const subtasksByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of activeTasks) {
      if (!t.parent_task_id) continue;
      const list = map.get(t.parent_task_id) || [];
      list.push(t);
      map.set(t.parent_task_id, list);
    }
    return map;
  }, [activeTasks]);

  const projectMap = useMemo(() => new Map(activeProjects.map((p) => [p.id, p])), [activeProjects]);

  const todayStr = getLocalDateString(new Date(), data.user.timezone);

  const visibleTasks = useMemo(() => {
    let list = parentTasks.filter((t) => {
      if (selectedProjectId && t.project_id !== selectedProjectId) return false;
      if (selectedTagId) {
        const tags = getTagsForItem('task', t.id);
        if (!tags.some((tg) => tg.id === selectedTagId)) return false;
      }

      if (filter === 'completed') return t.status === 'done';
      if (t.status === 'done') return false;

      if (filter === 'overdue') return isTaskOverdue(t.due_at, t.status);
      if (filter === 'today') {
        // Default view: Overdue + Today (plus undated tasks if user has no dated ones? PRD: "see only today's and overdue tasks by default")
        return isTaskOverdue(t.due_at, t.status) || isTaskDueToday(t.due_at, data.user.timezone) || !t.due_at;
      }
      if (filter === 'upcoming') {
        const localDate = isoToLocalDate(t.due_at, data.user.timezone);
        return Boolean(localDate && localDate > todayStr);
      }
      return true;
    });

    // Sort: Overdue first, then high priority, then due date
    const priorityRank = { high: 0, medium: 1, low: 2 };
    list = [...list].sort((a, b) => {
      if (filter === 'completed') {
        return (b.completed_at || '').localeCompare(a.completed_at || '');
      }
      const aOver = isTaskOverdue(a.due_at, a.status) ? 0 : 1;
      const bOver = isTaskOverdue(b.due_at, b.status) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[a.priority] - priorityRank[b.priority];
      }
      return (a.due_at || '9999').localeCompare(b.due_at || '9999');
    });

    return list;
  }, [parentTasks, filter, selectedProjectId, selectedTagId, getTagsForItem, data.user.timezone, todayStr]);

  const overdueCount = useMemo(
    () => parentTasks.filter((t) => isTaskOverdue(t.due_at, t.status)).length,
    [parentTasks]
  );

  const editingTask = useMemo(
    () => activeTasks.find((t) => t.id === editingTaskId) || null,
    [activeTasks, editingTaskId]
  );

  const handleQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    addTask({
      title: quickTitle.trim(),
      due_at: filter === 'today' ? localDateTimeToUtcIso(todayStr) : null,
      project_id: selectedProjectId,
      tagIds: selectedTagId ? [selectedTagId] : [],
    });
    setQuickTitle('');
    notify('Task added', 'success');
  };

  const handleToggle = (taskId: string) => {
    const res = toggleTaskStatus(taskId);
    if (res.allSubtasksDoneParentId) {
      setParentCompletePromptId(res.allSubtasksDoneParentId);
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !subtaskInput.trim()) return;
    addTask({
      title: subtaskInput.trim(),
      parent_task_id: editingTask.id,
      project_id: editingTask.project_id,
    });
    setSubtaskInput('');
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    addProject(newProjectName.trim(), newProjectColor);
    setNewProjectName('');
    setShowAddProject(false);
    notify('Project created', 'success');
  };

  const parentPromptTask = parentCompletePromptId
    ? activeTasks.find((t) => t.id === parentCompletePromptId)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Capture in one step, organize by project, and focus on today.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddProject((s) => !s)}
          className="btn-secondary !min-h-[38px] !text-xs"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          New Project
        </button>
      </div>

      {/* Inline New Project Form */}
      {showAddProject && (
        <form onSubmit={handleCreateProject} className="card p-4 flex flex-wrap items-center gap-3 animate-modal">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name (e.g. Health, Side Project)"
            className="input-field flex-1 min-w-[180px]"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewProjectColor(c)}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                  newProjectColor === c ? 'ring-2 ring-offset-2 ring-teal-600 scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowAddProject(false)} className="btn-ghost !text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary !min-h-[38px] !text-xs">
              Create
            </button>
          </div>
        </form>
      )}

      {/* One-Step Quick-Add Bar (T1) */}
      <form onSubmit={handleQuickCreate} className="flex items-center gap-2">
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task and press Enter..."
          className="input-field !py-3"
        />
        <button type="submit" disabled={!quickTitle.trim()} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>

      {/* Filter Views & Projects/Tags Strip */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'overdue', label: `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}` },
              { id: 'all', label: 'All Open' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                filter === item.id
                  ? 'bg-teal-600 text-white dark:bg-teal-400 dark:text-zinc-950'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {(activeProjects.length > 0 || activeTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeProjects.map((p) => {
              const active = selectedProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProjectId(active ? null : p.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                    active
                      ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-300'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                  style={{ borderColor: active ? undefined : 'var(--border-subtle)' }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </button>
              );
            })}

            {activeTags.map((tg) => {
              const active = selectedTagId === tg.id;
              return (
                <button
                  key={tg.id}
                  type="button"
                  onClick={() => setSelectedTagId(active ? null : tg.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                    active
                      ? 'bg-teal-600/15 text-teal-700 dark:text-teal-300 font-medium'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {tg.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
        {visibleTasks.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium">No tasks in this view</p>
            <p className="text-xs text-zinc-500">
              {filter === 'today'
                ? 'Type in the quick-add box above to capture a task for today.'
                : 'Switch filters or add a new task above.'}
            </p>
          </div>
        ) : (
          visibleTasks.map((task) => {
            const overdue = isTaskOverdue(task.due_at, task.status);
            const subs = subtasksByParent.get(task.id) || [];
            const doneSubs = subs.filter((s) => s.status === 'done').length;
            const proj = task.project_id ? projectMap.get(task.project_id) : null;
            const tags = getTagsForItem('task', task.id);

            return (
              <div
                key={task.id}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30"
                style={{
                  backgroundColor: overdue ? 'rgba(225, 29, 72, 0.035)' : undefined,
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(task.id)}
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    task.status === 'done'
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : overdue
                      ? 'border-rose-500 hover:bg-rose-500/10'
                      : 'border-zinc-300 dark:border-zinc-600 hover:border-teal-600'
                  }`}
                  aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                >
                  {task.status === 'done' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setEditingTaskId(task.id)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <p
                    className={`text-sm font-medium leading-snug ${
                      task.status === 'done' ? 'line-through text-zinc-400' : ''
                    }`}
                  >
                    {task.title}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {task.due_at && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs ${
                          overdue ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-zinc-500'
                        }`}
                      >
                        {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                        {overdue ? 'Overdue · ' : ''}
                        {formatDueAt(task.due_at, data.user.timezone)}
                      </span>
                    )}

                    {task.reminder_minutes_before !== null && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                        <Bell className="w-3 h-3" />
                        {task.reminder_minutes_before === 0 ? 'At due' : `${task.reminder_minutes_before}m`}
                      </span>
                    )}

                    {task.recurrence !== 'none' && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-400 capitalize">
                        <Repeat className="w-3 h-3" />
                        {task.recurrence}
                      </span>
                    )}

                    {subs.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 tabular-nums">
                        {doneSubs} of {subs.length}
                      </span>
                    )}

                    {proj && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: proj.color }} />
                        {proj.name}
                      </span>
                    )}

                    {tags.map((tg) => (
                      <span key={tg.id} className="text-[11px] text-teal-700 dark:text-teal-400">
                        #{tg.name}
                      </span>
                    ))}
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                      task.priority === 'high'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : task.priority === 'medium'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {task.priority}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingTaskId(task.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    aria-label="Edit task details"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Project management hint when filtered */}
      {selectedProjectId && (
        <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
          <span>Filtering by project: {projectMap.get(selectedProjectId)?.name}</span>
          <button
            type="button"
            onClick={() => {
              deleteProject(selectedProjectId);
              setSelectedProjectId(null);
              notify('Project removed (tasks kept)', 'neutral');
            }}
            className="text-rose-600 hover:underline cursor-pointer"
          >
            Delete project
          </button>
        </div>
      )}

      {/* PRD Acceptance Criterion: Ask before auto-completing parent task when last subtask finishes */}
      {parentPromptTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4 animate-modal"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div>
              <h3 className="text-base font-semibold">All subtasks completed</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Do you also want to mark <span className="font-medium text-zinc-800 dark:text-zinc-200">&ldquo;{parentPromptTask.title}&rdquo;</span> as complete?
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setParentCompletePromptId(null)}
                className="btn-secondary !min-h-[40px] !text-xs"
              >
                Keep Open
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleTaskStatus(parentPromptTask.id);
                  setParentCompletePromptId(null);
                  notify('Parent task completed', 'success');
                }}
                className="btn-primary !min-h-[40px] !text-xs"
              >
                Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail / Edit Drawer Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 md:p-4">
          <div
            className="w-full max-w-xl rounded-t-2xl md:rounded-2xl border shadow-2xl max-h-[92vh] overflow-y-auto animate-modal"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => handleToggle(editingTask.id)}
                className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <Check className={`w-3.5 h-3.5 ${editingTask.status === 'done' ? 'text-teal-600' : 'text-zinc-400'}`} />
                {editingTask.status === 'done' ? 'Completed' : 'Mark complete'}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    deleteTask(editingTask.id);
                    setEditingTaskId(null);
                    notify('Task deleted', 'neutral');
                  }}
                  className="btn-ghost !p-2 text-rose-600 hover:bg-rose-500/10"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setEditingTaskId(null)} className="btn-ghost !p-2" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <input
                type="text"
                value={editingTask.title}
                onChange={(e) => updateTask(editingTask.id, { title: e.target.value })}
                className="input-field !text-base font-semibold"
                placeholder="Task title"
              />

              <textarea
                rows={3}
                value={editingTask.notes}
                onChange={(e) => updateTask(editingTask.id, { notes: e.target.value })}
                placeholder="Add notes or context..."
                className="input-field resize-none !text-sm"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Due date</label>
                  <input
                    type="date"
                    value={isoToLocalDate(editingTask.due_at, data.user.timezone) || ''}
                    onChange={(e) => {
                      const d = e.target.value;
                      const currentTime = isoToLocalTimeInput(editingTask.due_at, data.user.timezone);
                      updateTask(editingTask.id, {
                        due_at: d ? localDateTimeToUtcIso(d, currentTime || undefined) : null,
                        reminder_fired_at: null,
                      });
                    }}
                    className="input-field !py-2 !text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Due time</label>
                  <input
                    type="time"
                    value={isoToLocalTimeInput(editingTask.due_at, data.user.timezone)}
                    onChange={(e) => {
                      const baseDate = isoToLocalDate(editingTask.due_at, data.user.timezone) || todayStr;
                      updateTask(editingTask.id, {
                        due_at: localDateTimeToUtcIso(baseDate, e.target.value || undefined),
                        reminder_fired_at: null,
                      });
                    }}
                    className="input-field !py-2 !text-sm"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => updateTask(editingTask.id, { priority: e.target.value as Priority })}
                    className="input-field !py-2 !text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Project</label>
                  <select
                    value={editingTask.project_id || ''}
                    onChange={(e) => updateTask(editingTask.id, { project_id: e.target.value || null })}
                    className="input-field !py-2 !text-sm"
                  >
                    <option value="">No project</option>
                    {activeProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Reminder</label>
                  <select
                    value={editingTask.reminder_minutes_before !== null ? String(editingTask.reminder_minutes_before) : ''}
                    onChange={(e) =>
                      updateTask(editingTask.id, {
                        reminder_minutes_before: e.target.value === '' ? null : Number(e.target.value),
                        reminder_fired_at: null,
                      })
                    }
                    className="input-field !py-2 !text-sm"
                  >
                    <option value="">No reminder</option>
                    <option value="0">At due time</option>
                    <option value="15">15 min before</option>
                    <option value="30">30 min before</option>
                    <option value="60">1 hour before</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Repeat</label>
                  <select
                    value={editingTask.recurrence}
                    onChange={(e) => updateTask(editingTask.id, { recurrence: e.target.value as Recurrence })}
                    className="input-field !py-2 !text-sm"
                  >
                    <option value="none">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Subtasks (T6) */}
              <div className="pt-2 border-t space-y-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Subtasks</p>
                  {(() => {
                    const subs = subtasksByParent.get(editingTask.id) || [];
                    if (subs.length === 0) return null;
                    const done = subs.filter((s) => s.status === 'done').length;
                    return (
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {done} of {subs.length}
                      </span>
                    );
                  })()}
                </div>

                <div className="space-y-1.5">
                  {(subtasksByParent.get(editingTask.id) || []).map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-subtle)' }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggle(sub.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                          sub.status === 'done'
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-zinc-400'
                        }`}
                        aria-label={`Toggle subtask ${sub.title}`}
                      >
                        {sub.status === 'done' && <Check className="w-3 h-3" />}
                      </button>
                      <span className={`text-sm flex-1 ${sub.status === 'done' ? 'line-through text-zinc-400' : ''}`}>
                        {sub.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTask(sub.id)}
                        className="p-1 text-zinc-400 hover:text-rose-500 cursor-pointer"
                        aria-label="Delete subtask"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    placeholder="Add a subtask..."
                    className="input-field !py-2 !text-sm"
                  />
                  <button type="submit" disabled={!subtaskInput.trim()} className="btn-secondary !min-h-[38px] !text-xs">
                    Add
                  </button>
                </form>
              </div>

              {/* Tags */}
              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tags</p>
                <TagPicker
                  selectedTagIds={getTagsForItem('task', editingTask.id).map((t) => t.id)}
                  onChange={(ids) => setItemTags('task', editingTask.id, ids)}
                  compact
                />
              </div>

              {/* Cross-module Links (X2) */}
              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Linked Items</p>
                <LinkPicker itemType="task" itemId={editingTask.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
