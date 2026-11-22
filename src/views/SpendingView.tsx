import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Trash2,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLifeHub } from '../store/LifeHubContext';
import {
  addMonthsToMonthString,
  formatMonthLabel,
  formatShortDate,
  getLastNMonths,
  getLocalMonthString,
} from '../lib/dates';
import { formatIDR, parseIDRAmount } from '../lib/idr';
import { exportTransactionsToCsv } from '../lib/csv';
import type { Category, CategoryKind, Transaction, TransactionType, WalletType } from '../types/models';
import { TagPicker } from '../components/TagPicker';
import { LinkPicker } from '../components/LinkPicker';
import { NativeSelect } from '../components/NativeSelect';

interface SpendingViewProps {
  onQuickAddExpense: () => void;
  onOpenReceipt: () => void;
}

type SpendingTab = 'transactions' | 'budgets' | 'reports' | 'manage';

const CAT_COLORS = ['#233E1E', '#709446', '#E59A38', '#C3834C', '#B94E48', '#527A34', '#6B6E5C'];

export const SpendingView: React.FC<SpendingViewProps> = ({ onQuickAddExpense, onOpenReceipt }) => {
  const {
    data,
    activeWallets,
    activeCategories,
    activeTransactions,
    activeBudgets,
    focusTarget,
    clearFocusTarget,
    getWalletBalance,
    getTagsForItem,
    updateTransaction,
    deleteTransaction,
    setBudget,
    deleteBudget,
    addWallet,
    updateWallet,
    deleteWallet,
    addCategory,
    deleteCategory,
    setItemTags,
    notify,
  } = useLifeHub();

  const [subTab, setSubTab] = useState<SpendingTab>('transactions');
  const [month, setMonth] = useState(() => getLocalMonthString(new Date(), data.user.timezone));
  const [walletFilter, setWalletFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // Budget inline editor
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});

  // Manage Wallets & Categories forms
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<WalletType>('e-wallet');
  const [newWalletStart, setNewWalletStart] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [newCatKind, setNewCatKind] = useState<CategoryKind>('expense');
  const [newCatColor, setNewCatColor] = useState(CAT_COLORS[0]);

  // PRD Acceptance Criterion: Reassign modal when deleting category with existing transactions
  const [reassignTargetCat, setReassignTargetCat] = useState<Category | null>(null);
  const [reassignToId, setReassignToId] = useState<string>('');

  // Edit wallet starting balance inline
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editWalletStart, setEditWalletStart] = useState('');

  useEffect(() => {
    if (focusTarget?.tab === 'spending' && focusTarget.itemId) {
      const tx = activeTransactions.find((t) => t.id === focusTarget.itemId);
      if (tx) {
        setMonth(tx.date.slice(0, 7));
        setSubTab('transactions');
        setEditingTxId(tx.id);
      }
      clearFocusTarget();
    }
  }, [focusTarget, activeTransactions, clearFocusTarget]);

  const walletMap = useMemo(() => new Map(activeWallets.map((w) => [w.id, w])), [activeWallets]);
  const catMap = useMemo(() => new Map(activeCategories.map((c) => [c.id, c])), [activeCategories]);
  const expenseCategories = useMemo(
    () => activeCategories.filter((c) => c.kind === 'expense'),
    [activeCategories]
  );

  const monthTransactions = useMemo(() => {
    return activeTransactions
      .filter((tx) => tx.date.startsWith(month))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [activeTransactions, month]);

  const filteredTransactions = useMemo(() => {
    return monthTransactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (walletFilter !== 'all' && tx.wallet_id !== walletFilter && tx.destination_wallet_id !== walletFilter) {
        return false;
      }
      return true;
    });
  }, [monthTransactions, typeFilter, walletFilter]);

  const monthTotals = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const tx of monthTransactions) {
      if (tx.type === 'expense') expense += tx.amount;
      if (tx.type === 'income') income += tx.amount;
    }
    return { expense, income, net: income - expense };
  }, [monthTransactions]);

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of monthTransactions) {
      if (tx.type !== 'expense' || !tx.category_id) continue;
      map.set(tx.category_id, (map.get(tx.category_id) || 0) + tx.amount);
    }
    return map;
  }, [monthTransactions]);

  const budgetsForMonth = useMemo(() => {
    const map = new Map<string, { id: string; amount: number }>();
    for (const b of activeBudgets) {
      if (b.month === month) map.set(b.category_id, { id: b.id, amount: b.amount });
    }
    return map;
  }, [activeBudgets, month]);

  // Reports datasets (E6)
  const reportsData = useMemo(() => {
    const byCategory = expenseCategories
      .map((cat) => ({
        name: cat.name,
        amount: spentByCategory.get(cat.id) || 0,
        color: cat.color,
      }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const byWalletMap = new Map<string, number>();
    for (const tx of monthTransactions) {
      if (tx.type !== 'expense') continue;
      byWalletMap.set(tx.wallet_id, (byWalletMap.get(tx.wallet_id) || 0) + tx.amount);
    }
    const byWallet = activeWallets
      .map((w) => ({
        name: w.name,
        amount: byWalletMap.get(w.id) || 0,
      }))
      .filter((d) => d.amount > 0);

    const last6 = getLastNMonths(6, data.user.timezone).map((m) => {
      let exp = 0;
      let inc = 0;
      for (const tx of activeTransactions) {
        if (!tx.date.startsWith(m)) continue;
        if (tx.type === 'expense') exp += tx.amount;
        if (tx.type === 'income') inc += tx.amount;
      }
      return {
        month: formatMonthLabel(m).split(' ')[0],
        Expense: exp,
        Income: inc,
      };
    });

    return { byCategory, byWallet, last6 };
  }, [expenseCategories, spentByCategory, monthTransactions, activeWallets, activeTransactions, data.user.timezone]);

  const editingTx = useMemo(
    () => activeTransactions.find((t) => t.id === editingTxId) || null,
    [activeTransactions, editingTxId]
  );

  const handleSaveBudget = (categoryId: string) => {
    const raw = budgetDrafts[categoryId];
    if (raw === undefined) return;
    const parsed = parseIDRAmount(raw);
    if (parsed === null || parsed < 0) {
      notify('Enter a valid IDR amount', 'warning');
      return;
    }
    if (parsed === 0) {
      const existing = budgetsForMonth.get(categoryId);
      if (existing) deleteBudget(existing.id);
      notify('Budget cleared', 'neutral');
    } else {
      setBudget(categoryId, month, parsed);
      notify('Budget updated', 'success');
    }
    setBudgetDrafts((prev) => {
      const copy = { ...prev };
      delete copy[categoryId];
      return copy;
    });
  };

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    const startBal = parseIDRAmount(newWalletStart) ?? 0;
    addWallet(newWalletName.trim(), newWalletType, startBal);
    setNewWalletName('');
    setNewWalletStart('');
    notify('Wallet added', 'success');
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory(newCatName.trim(), newCatKind, newCatColor);
    setNewCatName('');
    notify('Category created', 'success');
  };

  const handleRequestDeleteCategory = (cat: Category) => {
    const txCount = activeTransactions.filter((t) => t.category_id === cat.id).length;
    if (txCount > 0) {
      const alternative = activeCategories.find((c) => c.kind === cat.kind && c.id !== cat.id);
      setReassignTargetCat(cat);
      setReassignToId(alternative?.id || '');
    } else {
      deleteCategory(cat.id);
      notify(`Deleted "${cat.name}"`, 'neutral');
    }
  };

  const handleConfirmReassignDelete = () => {
    if (!reassignTargetCat || !reassignToId) return;
    deleteCategory(reassignTargetCat.id, reassignToId);
    notify(`Reassigned transactions and deleted "${reassignTargetCat.name}"`, 'success');
    setReassignTargetCat(null);
    setReassignToId('');
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header (desktop shows full title; mobile header already shows "Spending") */}
      <div className="flex items-center justify-between gap-2">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight">Spending</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track Indonesian rupiah (IDR) across wallets, budgets, and reports.
          </p>
        </div>

        {/* Mobile Month Switcher on the left, clean actions on the right */}
        <div className="flex md:hidden items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonthsToMonthString(m, -1))}
            className="btn-secondary !min-h-[38px] !px-2.5"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[78px] text-center">{formatMonthLabel(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonthsToMonthString(m, 1))}
            className="btn-secondary !min-h-[38px] !px-2.5"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenReceipt}
            className="btn-secondary !min-h-[38px] !px-2.5 sm:!px-3 !text-xs"
            title="Scan Receipt"
          >
            <Camera className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Scan Receipt</span>
          </button>
          <button
            type="button"
            onClick={() => {
              exportTransactionsToCsv(activeTransactions, activeWallets, activeCategories);
              notify('Exported transactions CSV', 'success');
            }}
            className="btn-secondary !min-h-[38px] !px-2.5 sm:!px-3 !text-xs"
            title="Export CSV"
          >
            <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button type="button" onClick={onQuickAddExpense} className="btn-primary !min-h-[38px] !px-3 !text-xs">
            <Plus className="w-4 h-4" />
            <span>Log</span>
          </button>
        </div>
      </div>

      {/* Wallets Balance Strip: 1 compact horizontal row on Android, grid on PC */}
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
        {activeWallets.map((w) => {
          const bal = getWalletBalance(w.id);
          return (
            <div
              key={w.id}
              className="card p-3.5 sm:p-4 flex flex-col justify-between gap-1.5 min-w-[165px] sm:min-w-0 shrink-0 snap-start"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-500 truncate">{w.name}</span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 shrink-0">
                  {w.type}
                </span>
              </div>
              <p className="text-base sm:text-lg font-bold tabular-nums tracking-tight">{formatIDR(bal)}</p>
            </div>
          );
        })}
      </div>

      {/* Clean Single-Row Sub-Tabs + Desktop Month Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-4 sm:flex items-center gap-1 retro-segmented w-full sm:w-auto">
          {(
            [
              { id: 'transactions', label: 'Log' },
              { id: 'budgets', label: 'Budgets' },
              { id: 'reports', label: 'Reports' },
              { id: 'manage', label: 'Wallets' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`retro-segmented-btn text-center !px-2 sm:!px-4 ${
                subTab === t.id ? 'active' : ''
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonthsToMonthString(m, -1))}
            className="btn-secondary !min-h-[36px] !px-2.5"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[92px] text-center">{formatMonthLabel(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonthsToMonthString(m, 1))}
            className="btn-secondary !min-h-[36px] !px-2.5"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: TRANSACTIONS */}
      {subTab === 'transactions' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="card-chartreuse p-4">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Spent</p>
              <p className="text-base sm:text-lg font-extrabold tabular-nums mt-0.5 text-[#A64B3C] dark:text-[#E8927C]">
                {formatIDR(monthTotals.expense)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">Income</p>
              <p className="text-base sm:text-lg font-extrabold tabular-nums mt-0.5 text-[#2D5A27] dark:text-[#B8CF7A]">
                {formatIDR(monthTotals.income)}
              </p>
            </div>
            <div className="hidden sm:block card p-4">
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">Net</p>
              <p className="text-base sm:text-lg hero-amount mt-0.5">
                {formatIDR(monthTotals.net, { signed: true })}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <div className="sm:w-40">
              <NativeSelect
                title="Filter by Type"
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as 'all' | TransactionType)}
                className="!py-2 !text-xs"
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'expense', label: 'Expenses', dotColor: '#A64B3C' },
                  { value: 'income', label: 'Income', dotColor: '#2D5A27' },
                  { value: 'transfer', label: 'Transfers', dotColor: '#E59A38' },
                ]}
              />
            </div>
            <div className="sm:w-44">
              <NativeSelect
                title="Filter by Wallet"
                value={walletFilter}
                onChange={setWalletFilter}
                className="!py-2 !text-xs"
                options={[
                  { value: 'all', label: 'All wallets' },
                  ...activeWallets.map((w) => ({ value: w.id, label: w.name, subtitle: w.type })),
                ]}
              />
            </div>
          </div>

          <div className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            {filteredTransactions.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-medium">No transactions in {formatMonthLabel(month)}</p>
                <p className="text-xs text-zinc-500">
                  Log an expense, income, or wallet transfer to track your balances and budgets.
                </p>
                <button type="button" onClick={onQuickAddExpense} className="btn-secondary mt-2 !text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Log first transaction
                </button>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const wallet = walletMap.get(tx.wallet_id);
                const destWallet = tx.destination_wallet_id ? walletMap.get(tx.destination_wallet_id) : null;
                const cat = tx.category_id ? catMap.get(tx.category_id) : null;
                const tags = getTagsForItem('transaction', tx.id);

                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setEditingTxId(tx.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#F4F0C8] dark:bg-[#2B3C23]"
                    >
                      {tx.type === 'expense' && <ArrowUpRight className="w-4 h-4 text-[#A64B3C] dark:text-[#E8927C]" />}
                      {tx.type === 'income' && <ArrowDownLeft className="w-4 h-4 text-[#2D5A27] dark:text-[#B8CF7A]" />}
                      {tx.type === 'transfer' && <ArrowLeftRight className="w-4 h-4 text-[#B87822] dark:text-[#F4C95D]" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {tx.type === 'transfer'
                          ? `${wallet?.name || 'Wallet'} → ${destWallet?.name || 'Wallet'}`
                          : tx.merchant || cat?.name || 'Transaction'}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                        <span>{formatShortDate(tx.date)}</span>
                        {cat && (
                          <>
                            <span>·</span>
                            <span>{cat.name}</span>
                          </>
                        )}
                        {tx.type !== 'transfer' && wallet && (
                          <>
                            <span>·</span>
                            <span>{wallet.name}</span>
                          </>
                        )}
                        {tx.note && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[180px]">{tx.note}</span>
                          </>
                        )}
                        {tags.map((tg) => (
                          <span key={tg.id} className="text-[11px] text-teal-700 dark:text-teal-400">
                            #{tg.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <span
                      className={`text-sm font-bold tabular-nums shrink-0 ${
                        tx.type === 'income'
                          ? 'text-[#2D5A27] dark:text-[#B8CF7A]'
                          : tx.type === 'transfer'
                          ? 'text-[#B87822] dark:text-[#F4C95D]'
                          : 'text-[#A64B3C] dark:text-[#E8927C]'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                      {formatIDR(tx.amount)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BUDGETS (E5 with 80% and 100% alerts) */}
      {subTab === 'budgets' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Set monthly IDR limits per expense category. Calm alerts appear at 80% and 100%.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {expenseCategories.map((cat) => {
              const spent = spentByCategory.get(cat.id) || 0;
              const budget = budgetsForMonth.get(cat.id);
              const budgetAmt = budget?.amount || 0;
              const pct = budgetAmt > 0 ? Math.round((spent / budgetAmt) * 100) : 0;
              const barPct = Math.min(100, pct);
              const isOver = budgetAmt > 0 && spent >= budgetAmt;
              const isWarn = budgetAmt > 0 && pct >= 80 && !isOver;
              const draft = budgetDrafts[cat.id];

              return (
                <div key={cat.id} className="card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm font-semibold">{cat.name}</span>
                    </div>
                    {isOver && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#B94E48]/15 text-[#A64B3C] dark:text-[#E8927C]">
                        <AlertTriangle className="w-3 h-3" />
                        {pct}% · Over budget
                      </span>
                    )}
                    {isWarn && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F4C95D]/35 text-[#6E470A] dark:text-[#F4C95D]">
                        <AlertTriangle className="w-3 h-3" />
                        {pct}% · Approaching limit
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-sm tabular-nums">{formatIDR(spent)} spent</span>
                    <span className="text-zinc-500 tabular-nums">
                      {budgetAmt > 0 ? `Budget: ${formatIDR(budgetAmt)}` : 'No budget set'}
                    </span>
                  </div>

                  {budgetAmt > 0 && (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: isOver ? '#B94E48' : isWarn ? '#E59A38' : cat.color,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 tabular-nums">
                        {budgetAmt - spent >= 0
                          ? `${formatIDR(budgetAmt - spent)} left`
                          : `${formatIDR(spent - budgetAmt)} over`}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={draft !== undefined ? draft : budgetAmt > 0 ? String(budgetAmt) : ''}
                      onChange={(e) => setBudgetDrafts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveBudget(cat.id);
                        }
                      }}
                      placeholder="Set monthly IDR (e.g. 1.5jt)"
                      className="input-field !py-1.5 !text-xs tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveBudget(cat.id)}
                      disabled={draft === undefined}
                      className="btn-secondary !min-h-[34px] !px-3 !text-xs shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: REPORTS (E6 Charts) */}
      {subTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Spending by Category */}
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Spending by Category</h2>
              <p className="text-xs text-zinc-500">{formatMonthLabel(month)}</p>
            </div>
            {reportsData.byCategory.length === 0 ? (
              <p className="text-sm text-zinc-500 py-10 text-center">No expenses logged for this month yet.</p>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportsData.byCategory}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={86}
                        paddingAngle={2}
                      >
                        {reportsData.byCategory.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => formatIDR(val)}
                        contentStyle={{
                          backgroundColor: 'var(--bg-surface-solid)',
                          borderColor: 'var(--border-subtle)',
                          borderRadius: '14px',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                        }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {reportsData.byCategory.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatIDR(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Spending by Wallet */}
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Spending by Wallet</h2>
              <p className="text-xs text-zinc-500">{formatMonthLabel(month)}</p>
            </div>
            {reportsData.byWallet.length === 0 ? (
              <p className="text-sm text-zinc-500 py-10 text-center">No wallet spending for this month yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportsData.byWallet} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                    <XAxis type="number" tickFormatter={(v) => formatIDR(v, { compact: true })} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={90} fontSize={12} />
                    <Tooltip
                      formatter={(val: number) => formatIDR(val)}
                      contentStyle={{
                        backgroundColor: 'var(--bg-surface-solid)',
                        borderColor: 'var(--border-subtle)',
                        borderRadius: '14px',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Bar dataKey="amount" fill="#233E1E" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 6-Month Trend */}
          <div className="card p-5 lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Month-over-Month Trend</h2>
              <p className="text-xs text-zinc-500">Last 6 months — Expenses vs Income (IDR)</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportsData.last6}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis tickFormatter={(v) => formatIDR(v, { compact: true })} fontSize={11} width={72} />
                  <Tooltip
                    formatter={(val: number) => formatIDR(val)}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-solid)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '14px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="Expense" fill="#233E1E" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Income" fill="#C3D48E" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: MANAGE WALLETS & CATEGORIES */}
      {subTab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Wallets */}
          <div className="card p-5 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <WalletIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Wallets
            </h2>
            <div className="space-y-2">
              {activeWallets.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-subtle)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-zinc-500 tabular-nums">
                      Start: {formatIDR(w.starting_balance)} · Live: {formatIDR(getWalletBalance(w.id))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {editingWalletId === w.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editWalletStart}
                          onChange={(e) => setEditWalletStart(e.target.value)}
                          className="input-field !w-28 !py-1 !text-xs tabular-nums"
                          placeholder="Start IDR"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = parseIDRAmount(editWalletStart);
                            if (val !== null) {
                              updateWallet(w.id, { starting_balance: val });
                              notify('Updated starting balance', 'success');
                            }
                            setEditingWalletId(null);
                          }}
                          className="btn-primary !min-h-[30px] !px-2.5 !text-xs"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWalletId(w.id);
                          setEditWalletStart(String(w.starting_balance));
                        }}
                        className="btn-ghost !p-1.5"
                        title="Edit starting balance"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {activeWallets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          deleteWallet(w.id);
                          notify(`Deleted wallet "${w.name}"`, 'neutral');
                        }}
                        className="btn-ghost !p-1.5 text-rose-500"
                        aria-label={`Delete ${w.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddWallet} className="pt-2 border-t space-y-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="text-xs font-medium text-zinc-500">Add new wallet</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  placeholder="OVO, Mandiri..."
                  className="input-field !py-2 !text-sm"
                  required
                />
                <NativeSelect
                  title="Wallet Type"
                  value={newWalletType}
                  onChange={(v) => setNewWalletType(v as WalletType)}
                  className="!py-2 !text-sm"
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'bank', label: 'Bank' },
                    { value: 'e-wallet', label: 'E-Wallet' },
                  ]}
                />
                <input
                  type="text"
                  value={newWalletStart}
                  onChange={(e) => setNewWalletStart(e.target.value)}
                  placeholder="Start balance (0)"
                  className="input-field !py-2 !text-sm tabular-nums"
                />
              </div>
              <button type="submit" className="btn-secondary !min-h-[38px] !text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Wallet
              </button>
            </form>
          </div>

          {/* Categories */}
          <div className="card p-5 space-y-4">
            <h2 className="text-base font-semibold">Categories</h2>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {activeCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-subtle)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">{cat.kind}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRequestDeleteCategory(cat)}
                    className="btn-ghost !p-1.5 text-zinc-400 hover:text-rose-500"
                    aria-label={`Delete category ${cat.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCategory} className="pt-2 border-t space-y-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="text-xs font-medium text-zinc-500">Add custom category</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  className="input-field !py-2 !text-sm"
                  required
                />
                <NativeSelect
                  title="Category Kind"
                  value={newCatKind}
                  onChange={(v) => setNewCatKind(v as CategoryKind)}
                  className="!py-2 !text-sm"
                  options={[
                    { value: 'expense', label: 'Expense', dotColor: '#A64B3C' },
                    { value: 'income', label: 'Income', dotColor: '#2D5A27' },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {CAT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatColor(c)}
                      className={`w-5 h-5 rounded-full cursor-pointer ${newCatColor === c ? 'ring-2 ring-offset-2 ring-teal-600' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button type="submit" className="btn-secondary !min-h-[38px] !text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Delete Reassignment Modal (PRD Acceptance Criterion) */}
      {reassignTargetCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4 animate-modal"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div>
              <h3 className="text-base font-semibold">Reassign existing transactions</h3>
              <p className="text-xs text-zinc-500 mt-1">
                &ldquo;{reassignTargetCat.name}&rdquo; has transactions attached. Choose a replacement category before deleting it.
              </p>
            </div>
            <NativeSelect
              title="Replacement Category"
              value={reassignToId}
              onChange={setReassignToId}
              options={activeCategories
                .filter((c) => c.kind === reassignTargetCat.kind && c.id !== reassignTargetCat.id)
                .map((c) => ({ value: c.id, label: c.name, dotColor: c.color }))}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReassignTargetCat(null)} className="btn-secondary !min-h-[40px] !text-xs">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignDelete}
                disabled={!reassignToId}
                className="btn-primary !min-h-[40px] !text-xs !bg-rose-600 hover:!bg-rose-700"
              >
                Reassign &amp; Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Drawer Modal */}
      {editingTx && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 md:p-4"
          onClick={() => setEditingTxId(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl md:rounded-3xl border shadow-2xl max-h-[88dvh] overflow-y-auto animate-sheet md:animate-modal pb-safe"
            style={{ backgroundColor: 'var(--bg-surface-solid)', borderColor: 'var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden w-10 h-1 rounded-full bg-black/15 dark:bg-white/20 mx-auto mt-3" />
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-base font-semibold capitalize">Edit {editingTx.type}</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    deleteTransaction(editingTx.id);
                    setEditingTxId(null);
                    notify('Transaction deleted', 'neutral');
                  }}
                  className="btn-ghost !p-2 text-rose-600 hover:bg-rose-500/10"
                  aria-label="Delete transaction"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setEditingTxId(null)} className="btn-ghost !p-2" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Amount (IDR)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editingTx.amount}
                    onChange={(e) => updateTransaction(editingTx.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                    className="input-field tabular-nums font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={editingTx.date}
                    onChange={(e) => updateTransaction(editingTx.id, { date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    {editingTx.type === 'transfer' ? 'From wallet' : 'Wallet'}
                  </label>
                  <NativeSelect
                    title={editingTx.type === 'transfer' ? 'From Wallet' : 'Select Wallet'}
                    value={editingTx.wallet_id}
                    onChange={(v) => updateTransaction(editingTx.id, { wallet_id: v })}
                    options={activeWallets.map((w) => ({ value: w.id, label: w.name, subtitle: w.type }))}
                  />
                </div>

                {editingTx.type === 'transfer' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">To wallet</label>
                    <NativeSelect
                      title="Destination Wallet"
                      value={editingTx.destination_wallet_id || ''}
                      onChange={(v) => updateTransaction(editingTx.id, { destination_wallet_id: v || null })}
                      options={activeWallets
                        .filter((w) => w.id !== editingTx.wallet_id)
                        .map((w) => ({ value: w.id, label: w.name, subtitle: w.type }))}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">Category</label>
                    <NativeSelect
                      title="Select Category"
                      value={editingTx.category_id || ''}
                      onChange={(v) => updateTransaction(editingTx.id, { category_id: v || null })}
                      options={activeCategories
                        .filter((c) => c.kind === editingTx.type)
                        .map((c) => ({ value: c.id, label: c.name, dotColor: c.color }))}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Merchant</label>
                <input
                  type="text"
                  value={editingTx.merchant}
                  onChange={(e) => updateTransaction(editingTx.id, { merchant: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Note</label>
                <input
                  type="text"
                  value={editingTx.note}
                  onChange={(e) => updateTransaction(editingTx.id, { note: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tags</p>
                <TagPicker
                  selectedTagIds={getTagsForItem('transaction', editingTx.id).map((t) => t.id)}
                  onChange={(ids) => setItemTags('transaction', editingTx.id, ids)}
                  compact
                />
              </div>

              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Linked Items</p>
                <LinkPicker itemType="transaction" itemId={editingTx.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
