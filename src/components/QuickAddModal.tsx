import React, { useEffect, useRef, useState } from 'react';
import { CheckSquare, FileText, Receipt, Sparkles, X, Camera } from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import { getLocalDateString, localDateTimeToUtcIso } from '../lib/dates';
import { formatIDR, parseIDRAmount } from '../lib/idr';
import type { Priority, Recurrence, TransactionType } from '../types/models';
import { TagPicker } from './TagPicker';

export type QuickAddTab = 'task' | 'expense' | 'note';

interface QuickAddModalProps {
  open: boolean;
  initialTab?: QuickAddTab;
  onClose: () => void;
  onOpenAI: () => void;
  onOpenReceipt: () => void;
}

const AMOUNT_PRESETS = [15_000, 25_000, 50_000, 100_000];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  open,
  initialTab = 'task',
  onClose,
  onOpenAI,
  onOpenReceipt,
}) => {
  const {
    data,
    activeProjects,
    activeWallets,
    activeCategories,
    addTask,
    addTransaction,
    addNote,
    notify,
  } = useLifeHub();

  const [tab, setTab] = useState<QuickAddTab>(initialTab);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(getLocalDateString());
  const [taskTime, setTaskTime] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskReminder, setTaskReminder] = useState('');
  const [taskRecurrence, setTaskRecurrence] = useState<Recurrence>('none');
  const [taskTagIds, setTaskTagIds] = useState<string[]>([]);
  const [showTaskMore, setShowTaskMore] = useState(false);

  // Expense / Income / Transfer state
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(getLocalDateString());
  const [txWalletId, setTxWalletId] = useState(data.preferences.default_wallet_id || activeWallets[0]?.id || '');
  const [txDestWalletId, setTxDestWalletId] = useState(activeWallets[1]?.id || '');
  const [txCategoryId, setTxCategoryId] = useState(
    data.preferences.default_category_id || activeCategories.find((c) => c.kind === 'expense')?.id || ''
  );
  const [txMerchant, setTxMerchant] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txTagIds, setTxTagIds] = useState<string[]>([]);

  // Note state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteTagIds, setNoteTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setTaskDate(getLocalDateString());
      setTxDate(getLocalDateString());
      setTxWalletId(data.preferences.default_wallet_id || activeWallets[0]?.id || '');
      const defaultExpCat =
        data.preferences.default_category_id || activeCategories.find((c) => c.kind === 'expense')?.id || '';
      setTxCategoryId(defaultExpCat);
      window.setTimeout(() => firstInputRef.current?.focus(), 60);
    }
  }, [open, initialTab, data.preferences.default_wallet_id, data.preferences.default_category_id, activeWallets, activeCategories]);

  if (!open) return null;

  const filteredCategories = activeCategories.filter((c) => c.kind === (txType === 'income' ? 'income' : 'expense'));

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    addTask({
      title: taskTitle.trim(),
      due_at: taskDate ? localDateTimeToUtcIso(taskDate, taskTime || undefined) : null,
      reminder_minutes_before: taskReminder !== '' ? Number(taskReminder) : null,
      priority: taskPriority,
      project_id: taskProjectId || null,
      recurrence: taskRecurrence,
      tagIds: taskTagIds,
    });
    notify('Task added', 'success');
    setTaskTitle('');
    setTaskTime('');
    setTaskTagIds([]);
    onClose();
  };

  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseIDRAmount(txAmount);
    if (!amount || amount <= 0) {
      notify('Enter a valid IDR amount (e.g. 50000 or 50k)', 'warning');
      return;
    }
    if (!txWalletId) {
      notify('Select a wallet', 'warning');
      return;
    }
    if (txType === 'transfer') {
      if (!txDestWalletId || txDestWalletId === txWalletId) {
        notify('Select a different destination wallet', 'warning');
        return;
      }
    }
    addTransaction({
      amount,
      type: txType,
      date: txDate,
      wallet_id: txWalletId,
      destination_wallet_id: txType === 'transfer' ? txDestWalletId : null,
      category_id: txType === 'transfer' ? null : txCategoryId || filteredCategories[0]?.id || null,
      merchant: txMerchant,
      note: txNote,
      tagIds: txTagIds,
    });
    notify(`Recorded ${formatIDR(amount)}`, 'success');
    setTxAmount('');
    setTxMerchant('');
    setTxNote('');
    setTxTagIds([]);
    onClose();
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteBody.trim()) return;
    addNote({
      title: noteTitle.trim() || noteBody.trim().split('\n')[0].slice(0, 50) || 'Untitled note',
      body: noteBody,
      tagIds: noteTagIds,
    });
    notify('Note saved', 'success');
    setNoteTitle('');
    setNoteBody('');
    setNoteTagIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 md:p-4">
      <div
        className="w-full max-w-lg rounded-t-2xl md:rounded-2xl border shadow-2xl max-h-[92vh] overflow-y-auto animate-modal"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-1 retro-segmented">
            {(
              [
                { id: 'task', label: 'Task', Icon: CheckSquare },
                { id: 'expense', label: 'Spending', Icon: Receipt },
                { id: 'note', label: 'Note', Icon: FileText },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`retro-segmented-btn inline-flex items-center gap-1.5 !px-3 !py-1.5 ${
                  tab === id ? 'active' : ''
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAI();
              }}
              className="btn-ghost !text-xs !px-2.5 text-teal-700 dark:text-teal-300"
              title="Use AI natural language input"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI
            </button>
            <button type="button" onClick={onClose} className="btn-ghost !p-2" aria-label="Close quick add">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {tab === 'task' && (
            <form onSubmit={handleSaveTask} className="space-y-3.5">
              <input
                ref={firstInputRef}
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="input-field !text-base !py-3 font-medium"
                required
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Due date</label>
                  <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="input-field !py-2 !text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Time</label>
                  <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} className="input-field !py-2 !text-sm" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as Priority)}
                    className="input-field !py-2 !text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTaskMore((s) => !s)}
                className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                {showTaskMore ? 'Hide extra options' : '+ Project, reminder, repeat, tags'}
              </button>

              {showTaskMore && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">Project</label>
                      <select value={taskProjectId} onChange={(e) => setTaskProjectId(e.target.value)} className="input-field !py-2 !text-sm">
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
                      <select value={taskReminder} onChange={(e) => setTaskReminder(e.target.value)} className="input-field !py-2 !text-sm">
                        <option value="">None</option>
                        <option value="0">At due time</option>
                        <option value="15">15 min before</option>
                        <option value="30">30 min before</option>
                        <option value="60">1 hr before</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">Repeat</label>
                      <select
                        value={taskRecurrence}
                        onChange={(e) => setTaskRecurrence(e.target.value as Recurrence)}
                        className="input-field !py-2 !text-sm"
                      >
                        <option value="none">One-time</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                  <TagPicker selectedTagIds={taskTagIds} onChange={setTaskTagIds} compact />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Task
                </button>
              </div>
            </form>
          )}

          {tab === 'expense' && (
            <form onSubmit={handleSaveTx} className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl flex-1" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTxType(t);
                        if (t !== 'transfer') {
                          const firstCat = activeCategories.find((c) => c.kind === t);
                          if (firstCat) setTxCategoryId(firstCat.id);
                        }
                      }}
                      className={`py-2 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors ${
                        txType === t ? 'bg-white dark:bg-zinc-800 shadow-sm text-teal-700 dark:text-teal-300' : 'text-zinc-500'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReceipt();
                  }}
                  className="btn-secondary !min-h-[38px] !px-3 !text-xs shrink-0"
                  title="Scan receipt photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Scan
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Amount (IDR)</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  inputMode="decimal"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="50000 or 50k"
                  className="input-field !text-xl !py-3 font-semibold tabular-nums"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {AMOUNT_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTxAmount(String(amt))}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums border cursor-pointer transition-colors hover:border-teal-500"
                      style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
                    >
                      {formatIDR(amt, { compact: true })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    {txType === 'transfer' ? 'From wallet' : 'Wallet'}
                  </label>
                  <select value={txWalletId} onChange={(e) => setTxWalletId(e.target.value)} className="input-field !py-2 !text-sm">
                    {activeWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                {txType === 'transfer' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">To wallet</label>
                    <select value={txDestWalletId} onChange={(e) => setTxDestWalletId(e.target.value)} className="input-field !py-2 !text-sm">
                      <option value="">Choose wallet...</option>
                      {activeWallets
                        .filter((w) => w.id !== txWalletId)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">Category</label>
                    <select value={txCategoryId} onChange={(e) => setTxCategoryId(e.target.value)} className="input-field !py-2 !text-sm">
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Date</label>
                  <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} className="input-field !py-2 !text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Merchant / Note</label>
                  <input
                    type="text"
                    value={txMerchant}
                    onChange={(e) => setTxMerchant(e.target.value)}
                    placeholder="Lunch, Gojek, PLN..."
                    className="input-field !py-2 !text-sm"
                  />
                </div>
              </div>

              <input
                type="text"
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                placeholder="Optional details..."
                className="input-field !py-2 !text-sm"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save {txType === 'expense' ? 'Expense' : txType === 'income' ? 'Income' : 'Transfer'}
                </button>
              </div>
            </form>
          )}

          {tab === 'note' && (
            <form onSubmit={handleSaveNote} className="space-y-3.5">
              <input
                ref={firstInputRef}
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title"
                className="input-field !text-base font-medium"
              />
              <textarea
                rows={5}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write a quick plain-text note..."
                className="input-field resize-none"
                required
              />
              <TagPicker selectedTagIds={noteTagIds} onChange={setNoteTagIds} compact />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Note
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
