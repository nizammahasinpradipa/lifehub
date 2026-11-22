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
import { NativeSelect } from '../components/NativeSelect';

type TaskFilter = 'today' | 'upcoming' | 'overdue' | 'all' | 'completed';

const PROJECT_COLORS = ['#A5B2EB', '#DDDE68', '#DA935D', '#676386', '#E08A92', '#494C65'];

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

  // Add project & filter drawer state
  const [showAddProject, setShowAddProject] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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

  const openCount = useMemo(() => parentTasks.filter((t) => t.status === 'todo').length, [parentTasks]);
  const doneCount = useMemo(() => parentTasks.filter((t) => t.status === 'done').length, [parentTasks]);

  const parentPromptTask = parentCompletePromptId
    ? activeTasks.find((t) => t.id === parentCompletePromptId)
    : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="hidden md:flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <button
          type="button"
          onClick={() => setShowAddProject((s) => !s)}
          className="btn-secondary !min-h-[38px] !text-xs"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-8 space-y-4">

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

      {/* Clean Single-Row Filter Strip */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {(
            [
              { id: 'today', label: 'Today', swatch: '#A5B2EB' },
              { id: 'upcoming', label: 'Upcoming', swatch: '#9AD9F2' },
              { id: 'overdue', label: `Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}`, swatch: '#E89AA2' },
              { id: 'all', label: 'All', swatch: '#C6A8F5' },
              { id: 'completed', label: 'Done', swatch: '#DDDE68' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0"
              style={{
                backgroundColor: filter === item.id ? item.swatch : 'var(--bg-surface)',
                color: filter === item.id ? '#1D1F2A' : 'var(--text-secondary)',
              }}
            >
              {item.label}
            </button>
          ))}

          {(activeProjects.length > 0 || activeTags.length > 0) && (
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={`md:hidden px-3 py-1.5 rounded-xl text-xs font-medium border shrink-0 cursor-pointer ${
                selectedProjectId || selectedTagId || showFilters
                  ? 'border-teal-600 text-teal-700 dark:text-teal-300 bg-teal-600/10'
                  : 'text-zinc-500'
              }`}
              style={{ borderColor: selectedProjectId || selectedTagId || showFilters ? undefined : 'var(--border-subtle)' }}
            >
              Projects{selectedProjectId || selectedTagId ? ' •' : ''}
            </button>
          )}
        </div>

        {(activeProjects.length > 0 || activeTags.length > 0) && (
          <div className={`${showFilters || selectedProjectId || selectedTagId ? 'flex' : 'hidden md:flex'} flex-wrap items-center gap-1.5`}>
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

            <button
              type="button"
              onClick={() => setShowAddProject((s) => !s)}
              className="md:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-teal-700 dark:text-teal-400"
            >
              <Plus className="w-3 h-3" />
              Project
            </button>
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
                  backgroundColor: overdue ? 'var(--state-danger-bg)' : undefined,
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(task.id)}
                  className="mt-0.5 w-5 h-5 rounded-full border-[1.75px] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: task.status === 'done' ? 'var(--primary)' : 'transparent',
                    borderColor:
                      task.status === 'done'
                        ? 'var(--primary)'
                        : overdue
                        ? 'var(--state-danger)'
                        : 'var(--border-strong)',
                    color: 'var(--primary-fg)',
                  }}
                  aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                >
                  {task.status === 'done' && <Check className="w-3 h-3" strokeWidth={2.5} />}
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
      </div>

      {/* Desktop Right Summary & Projects Column */}
      <aside className="hidden lg:block lg:col-span-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bento-lavender rounded-[20px] p-4">
            <p className="text-[11px] font-semibold opacity-75">Open</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{openCount}</p>
          </div>
          <div className="bento-lime rounded-[20px] p-4">
            <p className="text-[11px] font-semibold opacity-75">Completed</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{doneCount}</p>
          </div>
        </div>

        <div className="card p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--text-muted)]">Projects</h2>
            <button
              type="button"
              onClick={() => setShowAddProject((s) => !s)}
              className="text-xs font-semibold hover:underline cursor-pointer"
              style={{ color: 'var(--primary)' }}
            >
              + New
            </button>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setSelectedProjectId(null)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: selectedProjectId === null ? 'var(--accent-soft)' : 'transparent',
                color: selectedProjectId === null ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <span>All Projects</span>
              <span className="tabular-nums text-[var(--text-muted)]">{openCount}</span>
            </button>
            {activeProjects.map((p) => {
              const active = selectedProjectId === p.id;
              const count = parentTasks.filter((t) => t.status === 'todo' && t.project_id === p.id).length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProjectId(active ? null : p.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="tabular-nums text-[var(--text-muted)]">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
      </div>

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
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[3px] p-0 md:p-4"
          onClick={() => setEditingTaskId(null)}
        >
          <div
            className="w-full max-w-xl rounded-t-[24px] md:rounded-[20px] border max-h-[88dvh] overflow-y-auto animate-sheet md:animate-modal pb-safe"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-modal)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Edit task"
          >
            <div className="md:hidden w-9 h-1 rounded-full bg-[var(--border-strong)] mx-auto mt-3" />
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
                  <NativeSelect
                    title="Select Priority"
                    value={editingTask.priority}
                    onChange={(v) => updateTask(editingTask.id, { priority: v as Priority })}
                    className="!py-2 !text-sm"
                    options={[
                      { value: 'low', label: 'Low', dotColor: '#A5B2EB' },
                      { value: 'medium', label: 'Medium', dotColor: '#DA935D' },
                      { value: 'high', label: 'High', dotColor: '#E08A92' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Project</label>
                  <NativeSelect
                    title="Select Project"
                    value={editingTask.project_id || ''}
                    onChange={(v) => updateTask(editingTask.id, { project_id: v || null })}
                    className="!py-2 !text-sm"
                    options={[
                      { value: '', label: 'No project' },
                      ...activeProjects.map((p) => ({ value: p.id, label: p.name, dotColor: p.color })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Reminder</label>
                  <NativeSelect
                    title="Reminder Time"
                    value={editingTask.reminder_minutes_before !== null ? String(editingTask.reminder_minutes_before) : ''}
                    onChange={(v) =>
                      updateTask(editingTask.id, {
                        reminder_minutes_before: v === '' ? null : Number(v),
                        reminder_fired_at: null,
                      })
                    }
                    className="!py-2 !text-sm"
                    options={[
                      { value: '', label: 'No reminder' },
                      { value: '0', label: 'At due time' },
                      { value: '15', label: '15 min before' },
                      { value: '30', label: '30 min before' },
                      { value: '60', label: '1 hour before' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Repeat</label>
                  <NativeSelect
                    title="Repeat Schedule"
                    value={editingTask.recurrence}
                    onChange={(v) => updateTask(editingTask.id, { recurrence: v as Recurrence })}
                    className="!py-2 !text-sm"
                    options={[
                      { value: 'none', label: 'One-time' },
                      { value: 'daily', label: 'Daily' },
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'monthly', label: 'Monthly' },
                    ]}
                  />
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
