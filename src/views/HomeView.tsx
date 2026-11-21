import React, { useMemo } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CheckSquare,
  Plus,
  Receipt,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import {
  formatDueAt,
  formatFullDate,
  getGreeting,
  getLastNDays,
  getLocalDateString,
  getLocalMonthString,
  isTaskDueToday,
  isTaskOverdue,
} from '../lib/dates';
import { formatIDR } from '../lib/idr';
import type { QuickAddTab } from '../components/QuickAddModal';

interface HomeViewProps {
  onQuickAdd: (tab?: QuickAddTab) => void;
  onOpenAI: () => void;
  onOpenReceipt: () => void;
}

const MOOD_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Tough', color: '#e11d48' },
  2: { label: 'Low', color: '#f97316' },
  3: { label: 'Okay', color: '#eab308' },
  4: { label: 'Good', color: '#14b8a6' },
  5: { label: 'Great', color: '#059669' },
};

export const HomeView: React.FC<HomeViewProps> = ({ onQuickAdd, onOpenAI, onOpenReceipt }) => {
  const {
    data,
    activeTasks,
    activeTransactions,
    activeBudgets,
    activeCategories,
    activeWallets,
    activeNotes,
    getWalletBalance,
    toggleTaskStatus,
    setActiveTab,
    loadSampleDataset,
  } = useLifeHub();

  const today = getLocalDateString(new Date(), data.user.timezone);
  const currentMonth = getLocalMonthString(new Date(), data.user.timezone);

  const isBrandNew =
    activeTasks.length === 0 && activeTransactions.length === 0 && activeNotes.length === 0;

  // Overdue + Today's parent tasks (overdue sorted above today's)
  const { overdueTasks, todayTasks } = useMemo(() => {
    const parents = activeTasks.filter((t) => !t.parent_task_id && t.status === 'todo');
    const overdue = parents
      .filter((t) => isTaskOverdue(t.due_at, t.status))
      .sort((a, b) => (a.due_at || '').localeCompare(b.due_at || ''));
    const dueToday = parents
      .filter((t) => !isTaskOverdue(t.due_at, t.status) && isTaskDueToday(t.due_at, data.user.timezone))
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[a.priority] - rank[b.priority];
      });
    return { overdueTasks: overdue, todayTasks: dueToday };
  }, [activeTasks, data.user.timezone]);

  // Monthly spending & budget summary + top 3 categories
  const spendingSummary = useMemo(() => {
    const monthExpenses = activeTransactions.filter(
      (tx) => tx.type === 'expense' && tx.date.startsWith(currentMonth)
    );
    const totalSpent = monthExpenses.reduce((sum, tx) => sum + tx.amount, 0);
    const totalBudget = activeBudgets
      .filter((b) => b.month === currentMonth)
      .reduce((sum, b) => sum + b.amount, 0);

    const byCat = new Map<string, number>();
    for (const tx of monthExpenses) {
      const key = tx.category_id || 'uncategorized';
      byCat.set(key, (byCat.get(key) || 0) + tx.amount);
    }

    const catMap = new Map(activeCategories.map((c) => [c.id, c]));
    const topCategories = Array.from(byCat.entries())
      .map(([catId, amount]) => ({
        id: catId,
        name: catMap.get(catId)?.name || 'Other',
        color: catMap.get(catId)?.color || '#64748b',
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const totalBalance = activeWallets.reduce((s, w) => s + getWalletBalance(w.id), 0);

    return { totalSpent, totalBudget, topCategories, totalBalance };
  }, [activeTransactions, activeBudgets, activeCategories, activeWallets, currentMonth, getWalletBalance]);

  // Journal today + last 7 days mood
  const journalSummary = useMemo(() => {
    const journals = activeNotes.filter((n) => n.type === 'journal');
    const byDate = new Map(journals.map((j) => [j.journal_date || '', j]));
    const todayEntry = byDate.get(today) || null;
    const last7 = getLastNDays(7, data.user.timezone).map((d) => ({
      date: d,
      dayShort: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(
        new Date(`${d}T12:00:00Z`)
      ),
      entry: byDate.get(d) || null,
    }));
    return { todayEntry, last7 };
  }, [activeNotes, today, data.user.timezone]);

  const budgetPct =
    spendingSummary.totalBudget > 0
      ? Math.min(100, Math.round((spendingSummary.totalSpent / spendingSummary.totalBudget) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Greeting & Quick AI Entry */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {formatFullDate(today)}
          </p>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight mt-0.5">
            {getGreeting(data.user.timezone)}
            {data.user.display_name && data.user.display_name !== 'Owner'
              ? `, ${data.user.display_name}`
              : ''}
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenAI}
          className="btn-secondary !justify-start sm:!justify-center text-left !min-h-[42px]"
        >
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="truncate text-zinc-500 dark:text-zinc-400 font-normal text-xs sm:text-sm">
            Try &ldquo;spent 50k on lunch with GoPay&rdquo;...
          </span>
        </button>
      </div>

      {/* Desktop Fast Capture Strip (mobile uses the clean floating + button) */}
      <div className="hidden md:grid md:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => onQuickAdd('task')}
          className="card p-3.5 flex items-center gap-3 text-left hover:border-teal-500/60 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Add Task</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">1-tap capture</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onQuickAdd('expense')}
          className="card p-3.5 flex items-center gap-3 text-left hover:border-teal-500/60 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Log Expense</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">IDR rupiah</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenReceipt}
          className="card p-3.5 flex items-center gap-3 text-left hover:border-teal-500/60 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Scan Receipt</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Review & save</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onQuickAdd('note')}
          className="card p-3.5 flex items-center gap-3 text-left hover:border-teal-500/60 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Quick Note</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Auto-saved</p>
          </div>
        </button>
      </div>

      {/* Gentle first-run prompt */}
      {isBrandNew && (
        <div
          className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-dashed"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <div>
            <p className="text-sm font-semibold">Welcome to LifeHub</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-lg leading-relaxed">
              Everything you add saves automatically so closing and reopening the app keeps all your data safe on PC and Android. Start adding your own items above, or load sample data to explore reports and budgets.
            </p>
          </div>
          <button type="button" onClick={loadSampleDataset} className="btn-secondary shrink-0">
            Load Sample Data
          </button>
        </div>
      )}

      {/* Main 3-Module Daily Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Today's Tasks & Overdue */}
        <section className="card p-5 lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Today&apos;s Focus</h2>
              {overdueTasks.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-3 h-3" />
                  {overdueTasks.length} overdue
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className="btn-ghost !text-xs text-teal-700 dark:text-teal-400"
            >
              All tasks
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {overdueTasks.length === 0 && todayTasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-zinc-500">No tasks due today. Capture a task whenever something comes up.</p>
              <button type="button" onClick={() => onQuickAdd('task')} className="btn-secondary mt-3 !text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add a task
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...overdueTasks, ...todayTasks].slice(0, 7).map((task) => {
                const overdue = isTaskOverdue(task.due_at, task.status);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
                    style={{
                      backgroundColor: overdue ? 'rgba(225, 29, 72, 0.04)' : 'var(--bg-subtle)',
                      borderColor: overdue ? 'rgba(225, 29, 72, 0.25)' : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTaskStatus(task.id)}
                      className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer hover:border-teal-600 transition-colors"
                      style={{ borderColor: overdue ? '#e11d48' : 'var(--border-strong)' }}
                      aria-label={`Mark ${task.title} complete`}
                    >
                      {task.status === 'done' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      {task.due_at && (
                        <p className={`text-xs ${overdue ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-zinc-500'}`}>
                          {overdue ? 'Overdue · ' : ''}
                          {formatDueAt(task.due_at, data.user.timezone)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        task.priority === 'high'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : task.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Spending & Monthly Budget */}
        <section className="card p-5 lg:col-span-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">This Month&apos;s Spending</h2>
              <button
                type="button"
                onClick={() => setActiveTab('spending')}
                className="btn-ghost !text-xs text-teal-700 dark:text-teal-400"
              >
                Details
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {formatIDR(spendingSummary.totalSpent)}
              </p>
              {spendingSummary.totalBudget > 0 && (
                <p className="text-xs text-zinc-500 tabular-nums">
                  of {formatIDR(spendingSummary.totalBudget)}
                </p>
              )}
            </div>

            {spendingSummary.totalBudget > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${budgetPct}%`,
                      backgroundColor:
                        spendingSummary.totalSpent >= spendingSummary.totalBudget
                          ? '#e11d48'
                          : budgetPct >= 80
                          ? '#d97706'
                          : 'var(--accent)',
                    }}
                  />
                </div>
                <p className="text-xs text-zinc-500 tabular-nums">
                  {spendingSummary.totalBudget - spendingSummary.totalSpent >= 0
                    ? `${formatIDR(spendingSummary.totalBudget - spendingSummary.totalSpent)} remaining`
                    : `${formatIDR(spendingSummary.totalSpent - spendingSummary.totalBudget)} over total budget`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 mt-1.5">No monthly budgets set yet.</p>
            )}

            {/* Top 3 Categories */}
            {spendingSummary.topCategories.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-xs font-medium text-zinc-500">Top categories</p>
                {spendingSummary.topCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span>{cat.name}</span>
                    </span>
                    <span className="font-medium tabular-nums">{formatIDR(cat.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--bg-subtle)' }}
          >
            <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
              <Wallet className="w-3.5 h-3.5" />
              Total wallet balance
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatIDR(spendingSummary.totalBalance)}</span>
          </div>
        </section>

        {/* Daily Journal & Last 7 Days Mood */}
        <section className="card p-5 lg:col-span-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold">Daily Journal &amp; Mood</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {journalSummary.todayEntry && (journalSummary.todayEntry.body || journalSummary.todayEntry.mood)
                  ? `Today's entry updated${journalSummary.todayEntry.mood ? ` · Mood: ${MOOD_META[journalSummary.todayEntry.mood].label}` : ''}`
                  : 'No entry written for today yet.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className="btn-secondary !min-h-[38px] !text-xs self-start sm:self-auto"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {journalSummary.todayEntry ? "Continue today's journal" : "Write today's journal"}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {journalSummary.last7.map((d) => {
              const mood = d.entry?.mood || null;
              const isToday = d.date === today;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-colors cursor-pointer hover:border-teal-500/60"
                  style={{
                    backgroundColor: isToday ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                    borderColor: isToday ? 'var(--accent)' : 'transparent',
                  }}
                  title={mood ? `${d.date}: ${mood}/5 (${MOOD_META[mood].label})` : `${d.date}: No mood logged`}
                >
                  <span className="text-[11px] font-medium text-zinc-500">{d.dayShort}</span>
                  <div
                    className="w-7 h-7 rounded-full mt-1.5 flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: mood ? MOOD_META[mood].color : 'var(--border-subtle)',
                      color: mood ? '#ffffff' : 'var(--text-muted)',
                    }}
                  >
                    {mood ?? '–'}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
