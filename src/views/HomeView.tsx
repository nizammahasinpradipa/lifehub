import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CheckSquare,
  Eye,
  EyeOff,
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

const MOOD_LABELS: Record<number, string> = {
  1: 'Tough',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

export const HomeView: React.FC<HomeViewProps> = ({ onQuickAdd, onOpenAI, onOpenReceipt }) => {
  const {
    data,
    activeTasks,
    activeTransactions,
    activeBudgets,
    activeWallets,
    activeNotes,
    getWalletBalance,
    toggleTaskStatus,
    setActiveTab,
    loadSampleDataset,
  } = useLifeHub();

  const [hideBalance, setHideBalance] = useState(false);

  const today = getLocalDateString(new Date(), data.user.timezone);
  const currentMonth = getLocalMonthString(new Date(), data.user.timezone);

  const isBrandNew =
    activeTasks.length === 0 && activeTransactions.length === 0 && activeNotes.length === 0;

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

  const spendingSummary = useMemo(() => {
    const monthExpenses = activeTransactions.filter(
      (tx) => tx.type === 'expense' && tx.date.startsWith(currentMonth)
    );
    const totalSpent = monthExpenses.reduce((sum, tx) => sum + tx.amount, 0);
    const totalBudget = activeBudgets
      .filter((b) => b.month === currentMonth)
      .reduce((sum, b) => sum + b.amount, 0);
    const totalBalance = activeWallets.reduce((s, w) => s + getWalletBalance(w.id), 0);

    return { totalSpent, totalBudget, totalBalance };
  }, [activeTransactions, activeBudgets, activeWallets, currentMonth, getWalletBalance]);

  const journalSummary = useMemo(() => {
    const journals = activeNotes.filter((n) => n.type === 'journal');
    const byDate = new Map(journals.map((j) => [j.journal_date || '', j]));
    const todayEntry = byDate.get(today) || null;
    const last7 = getLastNDays(7, data.user.timezone).map((d) => ({
      date: d,
      logged: Boolean(byDate.get(d)?.mood || byDate.get(d)?.body),
    }));
    const streak = last7.filter((d) => d.logged).length;
    return { todayEntry, last7, streak };
  }, [activeNotes, today, data.user.timezone]);

  const budgetPct =
    spendingSummary.totalBudget > 0
      ? Math.min(100, Math.round((spendingSummary.totalSpent / spendingSummary.totalBudget) * 100))
      : 0;

  const focusList = [...overdueTasks, ...todayTasks];

  return (
    <div className="space-y-5">
      {/* Calm Minimal Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight">
            {getGreeting(data.user.timezone)}
            {data.user.display_name && data.user.display_name !== 'Owner'
              ? `, ${data.user.display_name}`
              : ''}
          </h1>
          <p className="text-xs font-medium text-[var(--text-muted)] mt-1">{formatFullDate(today)}</p>
        </div>
      </div>

      {/* Calm Balance Card with subtle pastel ambient wash */}
      <section className="card-balance p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Total balance · {activeWallets.length} {activeWallets.length === 1 ? 'wallet' : 'wallets'}
          </span>
          <button
            type="button"
            onClick={() => setHideBalance((h) => !h)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
          >
            {hideBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        <p className="hero-amount text-3xl sm:text-4xl leading-none">
          {hideBalance ? 'Rp ••••••••' : formatIDR(spendingSummary.totalBalance)}
        </p>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onQuickAdd('task')}
            className="bento-wisteria rounded-[14px] min-h-[42px] px-4 inline-flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm cursor-pointer transition-transform active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Task
          </button>
          <button
            type="button"
            onClick={() => onQuickAdd('expense')}
            className="rounded-[14px] min-h-[42px] px-4 inline-flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm cursor-pointer transition-transform active:scale-[0.98]"
            style={{
              backgroundColor: 'rgba(218, 147, 93, 0.22)',
              color: 'var(--text-primary)',
            }}
          >
            <Receipt className="w-4 h-4 shrink-0 text-[#DA935D]" />
            Log Expense
          </button>
        </div>
      </section>

      {/* Signature 2x2 Matte Pastel Bento Grid (matching all 4 reference phone accents) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Tile 1: Tasks Today (Soft Lavender) */}
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className="bento-tile bento-lavender flex flex-col justify-between min-h-[132px]"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold opacity-80">Tasks</span>
            <CheckSquare className="w-4 h-4 opacity-75" />
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold tracking-tight tabular-nums leading-none">
              {focusList.length}
            </p>
            <p className="text-xs font-medium opacity-75 mt-1.5">
              {overdueTasks.length > 0
                ? `${overdueTasks.length} overdue`
                : focusList.length === 0
                ? 'All clear today'
                : 'Due today'}
            </p>
          </div>
        </button>

        {/* Tile 2: Monthly Spending (Persian Orange) */}
        <button
          type="button"
          onClick={() => setActiveTab('spending')}
          className="bento-tile bento-orange flex flex-col justify-between min-h-[132px]"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold opacity-80">Spent</span>
            <Wallet className="w-4 h-4 opacity-75" />
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none">
              {formatIDR(spendingSummary.totalSpent, { compact: true })}
            </p>
            {spendingSummary.totalBudget > 0 ? (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-[#202230]/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#202230]"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <p className="text-[11px] font-medium opacity-75 tabular-nums">{budgetPct}% of budget</p>
              </div>
            ) : (
              <p className="text-xs font-medium opacity-75">This month</p>
            )}
          </div>
        </button>

        {/* Tile 3: Daily Journal & Mood (Succulent Lime) */}
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className="bento-tile bento-lime flex flex-col justify-between min-h-[132px]"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold opacity-80">Journal</span>
            <BookOpen className="w-4 h-4 opacity-75" />
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-xl sm:text-2xl font-bold tracking-tight leading-none">
              {journalSummary.todayEntry?.mood
                ? MOOD_LABELS[journalSummary.todayEntry.mood]
                : `${journalSummary.streak}/7`}
            </p>
            <div className="flex items-center gap-1">
              {journalSummary.last7.map((d) => (
                <span
                  key={d.date}
                  className="h-1.5 flex-1 rounded-full"
                  style={{
                    backgroundColor: d.logged ? '#202230' : 'rgba(32, 34, 48, 0.18)',
                  }}
                />
              ))}
            </div>
          </div>
        </button>

        {/* Tile 4: Quick Capture / AI & Receipt (Soft Sky) */}
        <div className="bento-tile bento-sky flex flex-col justify-between min-h-[132px] !cursor-default">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold opacity-80">Capture</span>
            <button
              type="button"
              onClick={onOpenReceipt}
              className="p-1.5 -m-1.5 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
              aria-label="Scan receipt"
              title="Scan receipt"
            >
              <Camera className="w-4 h-4 opacity-80" />
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenAI}
            className="mt-3 text-left cursor-pointer group"
          >
            <p className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-1.5 leading-snug">
              <Sparkles className="w-4 h-4 shrink-0" />
              Ask AI
            </p>
            <p className="text-[11px] font-medium opacity-75 mt-1 leading-snug">
              &ldquo;spent 50k lunch&rdquo;
            </p>
          </button>
        </div>
      </div>

      {/* Gentle first-run prompt */}
      {isBrandNew && (
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Start fresh or try sample data</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Load example tasks, IDR budgets, and journal entries to explore.
            </p>
          </div>
          <button type="button" onClick={loadSampleDataset} className="btn-secondary shrink-0 !min-h-[38px] !text-xs">
            Load Sample Data
          </button>
        </div>
      )}

      {/* Calm "Up Next" Activity List (echoing reference right-hand list) */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Up Next</h2>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className="btn-ghost !text-xs !px-2 text-[var(--text-muted)]"
          >
            All tasks
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {focusList.length === 0 ? (
          <div className="py-6 text-center space-y-2.5">
            <p className="text-sm text-[var(--text-muted)]">Nothing due right now.</p>
            <button
              type="button"
              onClick={() => onQuickAdd('task')}
              className="btn-tinted !min-h-[36px] !text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add task
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {focusList.slice(0, 5).map((task) => {
              const overdue = isTaskOverdue(task.due_at, task.status);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors"
                  style={{
                    backgroundColor: overdue ? 'var(--state-danger-bg)' : 'var(--bg-subtle)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleTaskStatus(task.id)}
                    className="w-5 h-5 rounded-full border-[1.75px] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    style={{
                      borderColor: overdue ? 'var(--state-danger)' : 'var(--border-strong)',
                    }}
                    aria-label={`Mark ${task.title} complete`}
                  >
                    {task.status === 'done' && <Check className="w-3 h-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.due_at && (
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-state-danger font-medium' : 'text-[var(--text-muted)]'}`}>
                        {overdue ? 'Overdue · ' : ''}
                        {formatDueAt(task.due_at, data.user.timezone)}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize shrink-0"
                    style={{
                      backgroundColor:
                        task.priority === 'high'
                          ? 'rgba(232, 154, 162, 0.22)'
                          : task.priority === 'medium'
                          ? 'rgba(218, 147, 93, 0.22)'
                          : 'rgba(154, 217, 242, 0.20)',
                      color:
                        task.priority === 'high'
                          ? 'var(--state-danger)'
                          : task.priority === 'medium'
                          ? 'var(--state-warning)'
                          : 'var(--state-info)',
                    }}
                  >
                    {task.priority}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
