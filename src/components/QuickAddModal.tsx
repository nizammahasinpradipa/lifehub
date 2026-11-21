import React, { useEffect, useRef, useState } from 'react';
import { CheckSquare, FileText, Receipt, Sparkles, X, Camera } from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import { getLocalDateString, localDateTimeToUtcIso } from '../lib/dates';
import { formatIDR, parseIDRAmount } from '../lib/idr';
import type { Priority, Recurrence, TransactionType } from '../types/models';
import { TagPicker } from './TagPicker';
import { NativeSelect } from './NativeSelect';
import { haptic } from '../lib/haptics';

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
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl md:rounded-3xl border shadow-2xl max-h-[88dvh] overflow-y-auto animate-sheet md:animate-modal pb-safe"
        style={{ backgroundColor: 'var(--bg-surface-solid)', borderColor: 'var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden w-10 h-1 rounded-full bg-black/15 dark:bg-white/20 mx-auto mt-3" />
        <div className="flex items-center justify-between px-5 pt-3.5 md:pt-4 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
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
                enterKeyHint="done"
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
                  <NativeSelect
                    title="Select Priority"
                    value={taskPriority}
                    onChange={(v) => setTaskPriority(v as Priority)}
                    className="!py-2 !text-sm"
                    options={[
                      { value: 'low', label: 'Low', dotColor: '#8B947D' },
                      { value: 'medium', label: 'Medium', dotColor: '#709446' },
                      { value: 'high', label: 'High', dotColor: '#E59A38' },
                    ]}
                  />
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
                      <NativeSelect
                        title="Select Project"
                        value={taskProjectId}
                        onChange={setTaskProjectId}
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
                        value={taskReminder}
                        onChange={setTaskReminder}
                        className="!py-2 !text-sm"
                        options={[
                          { value: '', label: 'None' },
                          { value: '0', label: 'At due time' },
                          { value: '15', label: '15 min before' },
                          { value: '30', label: '30 min before' },
                          { value: '60', label: '1 hr before' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">Repeat</label>
                      <NativeSelect
                        title="Repeat Schedule"
                        value={taskRecurrence}
                        onChange={(v) => setTaskRecurrence(v as Recurrence)}
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
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="50000"
                  className="input-field !text-2xl !py-3 hero-amount"
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {AMOUNT_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        haptic('tap');
                        setTxAmount(String(amt));
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold tabular-nums border cursor-pointer transition-colors hover:border-teal-500"
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
                  <NativeSelect
                    title={txType === 'transfer' ? 'From Wallet' : 'Select Wallet'}
                    value={txWalletId}
                    onChange={setTxWalletId}
                    className="!py-2 !text-sm"
                    options={activeWallets.map((w) => ({
                      value: w.id,
                      label: w.name,
                      subtitle: w.type,
                    }))}
                  />
                </div>

                {txType === 'transfer' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">To wallet</label>
                    <NativeSelect
                      title="Destination Wallet"
                      value={txDestWalletId}
                      onChange={setTxDestWalletId}
                      placeholder="Choose wallet..."
                      className="!py-2 !text-sm"
                      options={activeWallets
                        .filter((w) => w.id !== txWalletId)
                        .map((w) => ({
                          value: w.id,
                          label: w.name,
                          subtitle: w.type,
                        }))}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">Category</label>
                    <NativeSelect
                      title="Select Category"
                      value={txCategoryId}
                      onChange={setTxCategoryId}
                      className="!py-2 !text-sm"
                      options={filteredCategories.map((c) => ({
                        value: c.id,
                        label: c.name,
                        dotColor: c.color,
                      }))}
                    />
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
