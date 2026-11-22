import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
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

const MOOD_META: Record<number, { label: string; colorVar: string }> = {
  1: { label: 'Tough', colorVar: 'var(--state-danger)' },
  2: { label: 'Low', colorVar: 'var(--primary)' },
  3: { label: 'Okay', colorVar: 'var(--state-warning)' },
  4: { label: 'Good', colorVar: 'var(--state-info)' },
  5: { label: 'Great', colorVar: 'var(--state-success)' },
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
        color: catMap.get(catId)?.color || '#E04E0C',
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const totalBalance = activeWallets.reduce((s, w) => s + getWalletBalance(w.id), 0);

    return { totalSpent, totalBudget, topCategories, totalBalance };
  }, [activeTransactions, activeBudgets, activeCategories, activeWallets, currentMonth, getWalletBalance]);

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

  const formattedBalanceDigits = Math.abs(Math.round(spendingSummary.totalBalance))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Calm Apple Greeting */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.025em] leading-tight">
            {getGreeting(data.user.timezone)}
            {data.user.display_name && data.user.display_name !== 'Owner'
              ? `, ${data.user.display_name}`
              : ''}
          </h1>
          <p className="text-xs font-medium text-[var(--text-muted)] mt-1">{formatFullDate(today)}</p>
        </div>
      </div>

      {/* Apple Wallet Hero Card */}
      <section className="card-hero p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Total Balance · {activeWallets.length} {activeWallets.length === 1 ? 'wallet' : 'wallets'}
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('spending')}
            className="text-xs font-semibold hover:underline cursor-pointer"
            style={{ color: 'var(--primary)' }}
          >
            All wallets →
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold" style={{ color: 'var(--accent)' }}>
              {spendingSummary.totalBalance < 0 ? '-Rp' : 'Rp'}
            </span>
            <span className="hero-amount text-3xl sm:text-[38px] leading-none">
              {hideBalance ? '••••••••' : formattedBalanceDigits}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setHideBalance((h) => !h)}
            className="w-8 h-8 rounded-full flex items-center justify-center border cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
            title={hideBalance ? 'Show balance' : 'Hide balance'}
          >
            {hideBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        {/* Balanced Apple Action Controls */}
        <div className="grid grid-cols-[1fr_1fr_auto] sm:flex sm:items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onQuickAdd('task')}
            className="btn-primary !h-11 !min-h-[44px] !px-3.5 sm:!px-5 whitespace-nowrap !text-xs sm:!text-[13.5px]"
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            <span>Add Task</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAdd('expense')}
            className="btn-tinted !h-11 !min-h-[44px] !px-3.5 sm:!px-5 whitespace-nowrap !text-xs sm:!text-[13.5px]"
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Expense</span>
          </button>
          <button
            type="button"
            onClick={onOpenReceipt}
            className="w-11 h-11 rounded-xl flex items-center justify-center border cursor-pointer transition-colors active:scale-95 shrink-0"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            aria-label="Scan receipt"
            title="Scan receipt"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Clean Apple Quick AI Strip */}
      <button
        type="button"
        onClick={onOpenAI}
        className="card w-full p-3.5 sm:px-5 flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.995]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--primary)' }}
          >
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Quick Natural Capture</p>
            <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
              Type &ldquo;spent 50k on lunch with GoPay&rdquo; or ask your spending
            </p>
          </div>
        </div>
        <span
          className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
          style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--primary)' }}
        >
          Ask AI
        </span>
      </button>

      {/* Gentle first-run prompt */}
      {isBrandNew && (
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Welcome to LifeHub</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
              Start adding your own items above, or load sample data to preview charts and budgets.
            </p>
          </div>
          <button type="button" onClick={loadSampleDataset} className="btn-secondary shrink-0">
            Load Sample Data
          </button>
        </div>
      )}

      {/* Main 3-Module Daily Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Today's Tasks & Overdue */}
        <section className="card p-5 lg:col-span-7 flex flex-col">
          <div
            className="flex items-center justify-between pb-3 mb-3 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight">Today&apos;s Focus</h2>
              {overdueTasks.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold badge-danger">
                  <AlertCircle className="w-3 h-3" />
                  {overdueTasks.length} overdue
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className="btn-ghost !text-xs !px-2"
              style={{ color: 'var(--primary)' }}
            >
              See all
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {overdueTasks.length === 0 && todayTasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-7 text-center">
              <p className="text-sm text-[var(--text-secondary)]">No tasks due today.</p>
              <button
                type="button"
                onClick={() => onQuickAdd('task')}
                className="btn-tinted mt-3 !min-h-[36px] !text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add a task
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {[...overdueTasks, ...todayTasks].slice(0, 6).map((task) => {
                const overdue = isTaskOverdue(task.due_at, task.status);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors"
                    style={{
                      backgroundColor: overdue ? 'var(--state-danger-bg)' : 'var(--bg-surface-elevated)',
                      borderColor: overdue ? 'transparent' : 'var(--border-subtle)',
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
                      {task.status === 'done' && (
                        <Check className="w-3 h-3" style={{ color: 'var(--primary)' }} />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      {task.due_at && (
                        <p
                          className={`text-xs ${
                            overdue ? 'text-state-danger font-medium' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {overdue ? 'Overdue · ' : ''}
                          {formatDueAt(task.due_at, data.user.timezone)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                        task.priority === 'high'
                          ? 'badge-danger'
                          : task.priority === 'medium'
                          ? 'badge-warning'
                          : 'badge-info'
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

        {/* Monthly Spending Summary Card */}
        <section className="card p-5 lg:col-span-5 flex flex-col justify-between gap-4">
          <div>
            <div
              className="flex items-center justify-between pb-3 mb-3 border-b"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <h2 className="text-[15px] font-semibold tracking-tight">This Month&apos;s Spending</h2>
              <button
                type="button"
                onClick={() => setActiveTab('spending')}
                className="text-xs font-semibold hover:underline cursor-pointer"
                style={{ color: 'var(--primary)' }}
              >
                Details →
              </button>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <p className="hero-amount text-2xl sm:text-[28px]">
                {formatIDR(spendingSummary.totalSpent)}
              </p>
              {spendingSummary.totalBudget > 0 && (
                <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                  of {formatIDR(spendingSummary.totalBudget)}
                </p>
              )}
            </div>

            {spendingSummary.totalBudget > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div
                  className="h-2 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-subtle)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${budgetPct}%`,
                      backgroundColor:
                        spendingSummary.totalSpent >= spendingSummary.totalBudget
                          ? 'var(--state-danger)'
                          : budgetPct >= 80
                          ? 'var(--state-warning)'
                          : 'var(--primary)',
                    }}
                  />
                </div>
                <p className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
                  {spendingSummary.totalBudget - spendingSummary.totalSpent >= 0
                    ? `${formatIDR(spendingSummary.totalBudget - spendingSummary.totalSpent)} remaining`
                    : `${formatIDR(spendingSummary.totalSpent - spendingSummary.totalBudget)} over budget`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] mt-1.5">No monthly budgets set yet.</p>
            )}

            {spendingSummary.topCategories.length > 0 && (
              <div
                className="mt-4 pt-3.5 border-t space-y-2.5"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <p className="text-xs font-medium text-[var(--text-muted)]">Top categories</p>
                {spendingSummary.topCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span>{cat.name}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatIDR(cat.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Daily Journal & Last 7 Days Mood */}
        <section className="card p-5 lg:col-span-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Daily Journal &amp; Mood</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {journalSummary.todayEntry && (journalSummary.todayEntry.body || journalSummary.todayEntry.mood)
                  ? `Today's entry updated${journalSummary.todayEntry.mood ? ` · Mood: ${MOOD_META[journalSummary.todayEntry.mood].label}` : ''}`
                  : 'No reflection written for today yet.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className="btn-secondary !min-h-[36px] !text-xs self-start sm:self-auto"
            >
              <BookOpen className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
              {journalSummary.todayEntry ? "Open today's journal" : "Write today's journal"}
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
                  className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: isToday ? 'var(--accent-soft)' : 'var(--bg-surface-elevated)',
                    borderColor: isToday ? 'var(--primary)' : 'var(--border-subtle)',
                  }}
                  title={mood ? `${d.date}: ${mood}/5 (${MOOD_META[mood].label})` : `${d.date}: No mood logged`}
                >
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">{d.dayShort}</span>
                  <div
                    className="w-7 h-7 rounded-full mt-1.5 flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: mood ? MOOD_META[mood].colorVar : 'var(--bg-subtle)',
                      color: mood ? 'var(--primary-fg)' : 'var(--text-muted)',
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
