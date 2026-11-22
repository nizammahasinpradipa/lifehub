import React, { useState } from 'react';
import { Sparkles, Send, Check, X, AlertCircle, CheckSquare, Receipt, FileText } from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import { parseNaturalLanguage, type AIParseResult } from '../lib/nlp';
import { formatIDR, parseIDRAmount } from '../lib/idr';
import { isoToLocalDate, isoToLocalTimeInput, localDateTimeToUtcIso } from '../lib/dates';
import type { Priority, TransactionType } from '../types/models';
import { NativeSelect } from './NativeSelect';

interface AIAssistantModalProps {
  open: boolean;
  onClose: () => void;
}

const EXAMPLES = [
  'spent 50k on lunch with GoPay',
  'remind me to pay rent on the 1st',
  'bought coffee 35rb cash',
  'how much did I spend on food this month?',
];

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ open, onClose }) => {
  const { data, activeWallets, activeCategories, addTask, addTransaction, addNote, notify } = useLifeHub();

  const [input, setInput] = useState('');
  const [result, setResult] = useState<AIParseResult | null>(null);

  // Editable draft form fields
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategoryId, setTxCategoryId] = useState('');
  const [txWalletId, setTxWalletId] = useState('');
  const [txDestWalletId, setTxDestWalletId] = useState('');
  const [txDate, setTxDate] = useState('');
  const [txMerchant, setTxMerchant] = useState('');
  const [txNote, setTxNote] = useState('');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskReminder, setTaskReminder] = useState<string>('');

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  if (!open) return null;

  const runParse = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const parsed = parseNaturalLanguage(trimmed, data);
    setResult(parsed);

    if (parsed.kind === 'transaction') {
      setTxType(parsed.type);
      setTxAmount(parsed.amount !== null ? String(parsed.amount) : '');
      setTxCategoryId(parsed.category_id || '');
      setTxWalletId(parsed.wallet_id || '');
      setTxDestWalletId('');
      setTxDate(parsed.date);
      setTxMerchant(parsed.merchant);
      setTxNote(parsed.note);
    } else if (parsed.kind === 'task') {
      setTaskTitle(parsed.title);
      setTaskDate(isoToLocalDate(parsed.due_at) || '');
      setTaskTime(isoToLocalTimeInput(parsed.due_at));
      setTaskPriority(parsed.priority);
      setTaskReminder(parsed.reminder_minutes_before !== null ? String(parsed.reminder_minutes_before) : '');
    } else if (parsed.kind === 'note') {
      setNoteTitle(parsed.title);
      setNoteBody(parsed.body);
    }
  };

  const handleSubmitInput = (e: React.FormEvent) => {
    e.preventDefault();
    runParse(input);
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || result.kind === 'answer') return;

    if (result.kind === 'transaction') {
      const amount = parseIDRAmount(txAmount);
      if (!amount || amount <= 0) {
        notify('Please enter a valid IDR amount', 'warning');
        return;
      }
      if (!txWalletId) {
        notify('Please select a wallet', 'warning');
        return;
      }
      if (txType === 'transfer' && (!txDestWalletId || txDestWalletId === txWalletId)) {
        notify('Please choose a different destination wallet', 'warning');
        return;
      }
      addTransaction({
        amount,
        type: txType,
        date: txDate,
        wallet_id: txWalletId,
        destination_wallet_id: txType === 'transfer' ? txDestWalletId : null,
        category_id: txType === 'transfer' ? null : txCategoryId || null,
        merchant: txMerchant,
        note: txNote,
      });
      notify(`Saved ${formatIDR(amount)} ${txType}`, 'success');
      setInput('');
      setResult(null);
      onClose();
      return;
    }

    if (result.kind === 'task') {
      if (!taskTitle.trim()) {
        notify('Task title is required', 'warning');
        return;
      }
      addTask({
        title: taskTitle.trim(),
        due_at: taskDate ? localDateTimeToUtcIso(taskDate, taskTime || undefined) : null,
        reminder_minutes_before: taskReminder !== '' ? Number(taskReminder) : null,
        priority: taskPriority,
      });
      notify('Task saved', 'success');
      setInput('');
      setResult(null);
      onClose();
      return;
    }

    if (result.kind === 'note') {
      addNote({ title: noteTitle || 'Quick note', body: noteBody });
      notify('Note saved', 'success');
      setInput('');
      setResult(null);
      onClose();
    }
  };

  const uncertain = result && result.kind !== 'answer' ? result.uncertainFields : [];
  const filteredCategories = activeCategories.filter((c) => c.kind === (txType === 'income' ? 'income' : 'expense'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[3px] p-0 md:p-4"
      onClick={onClose}
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
        aria-label="Quick Assistant"
      >
        <div className="md:hidden w-9 h-1 rounded-full bg-[var(--border-strong)] mx-auto mt-3" />
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h2 className="text-base font-semibold leading-tight">Quick Assistant</h2>
              <p className="text-xs text-zinc-500">Natural-language capture & read-only Q&A</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !p-2" aria-label="Close assistant">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <form onSubmit={handleSubmitInput} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Try "spent 50k on lunch with GoPay" or ask a question...'
              className="input-field"
              autoFocus
            />
            <button type="submit" className="btn-primary !px-3.5 shrink-0" aria-label="Parse input">
              <Send className="w-4 h-4" />
            </button>
          </form>

          {!result && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500">Examples</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setInput(ex);
                      runParse(ex);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer hover:border-teal-500"
                    style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-400 pt-1">
                Understands 50k, 50rb, 1.5jt, wallets, and dates. Drafts are never saved until you confirm.
              </p>
            </div>
          )}

          {result?.kind === 'answer' && (
            <div
              className="p-4 rounded-xl border space-y-2 animate-modal"
              style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
            >
              <p className="text-sm font-medium leading-relaxed">{result.answer}</p>
              {result.details && result.details.length > 0 && (
                <div className="space-y-1 pt-1 border-t text-xs text-zinc-500" style={{ borderColor: 'var(--border-subtle)' }}>
                  {result.details.map((line, i) => (
                    <p key={i} className="tabular-nums">
                      {line}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-zinc-400 pt-1">Read-only lookup from your LifeHub records.</p>
            </div>
          )}

          {result && result.kind !== 'answer' && (
            <form onSubmit={handleSaveDraft} className="space-y-4 pt-1 animate-modal">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                  {result.kind === 'transaction' && <Receipt className="w-3.5 h-3.5" />}
                  {result.kind === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                  {result.kind === 'note' && <FileText className="w-3.5 h-3.5" />}
                  Draft {result.kind} — Review before saving
                </div>
              </div>

              {uncertain.length > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Highlighted fields could not be determined automatically. Please review or fill them in.</span>
                </div>
              )}

              {result.kind === 'transaction' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTxType(t)}
                        className={`py-2 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors ${
                          txType === t ? 'bg-white dark:bg-zinc-800 shadow-sm text-teal-700 dark:text-teal-300' : 'text-zinc-500'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Amount (IDR)</label>
                      <input
                        type="text"
                        value={txAmount}
                        onChange={(e) => setTxAmount(e.target.value)}
                        placeholder="e.g. 50000 or 50k"
                        className={`input-field tabular-nums ${uncertain.includes('amount') && !txAmount ? '!border-amber-500 !ring-2 !ring-amber-500/20' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
                      <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} className="input-field" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Wallet</label>
                      <NativeSelect
                        title="Select Wallet"
                        value={txWalletId}
                        onChange={setTxWalletId}
                        placeholder="Select wallet..."
                        highlightWarning={uncertain.includes('wallet_id') && !txWalletId}
                        options={activeWallets.map((w) => ({ value: w.id, label: w.name, subtitle: w.type }))}
                      />
                    </div>
                    {txType === 'transfer' ? (
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">To Wallet</label>
                        <NativeSelect
                          title="Destination Wallet"
                          value={txDestWalletId}
                          onChange={setTxDestWalletId}
                          placeholder="Select destination..."
                          highlightWarning={!txDestWalletId}
                          options={activeWallets
                            .filter((w) => w.id !== txWalletId)
                            .map((w) => ({ value: w.id, label: w.name, subtitle: w.type }))}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Category</label>
                        <NativeSelect
                          title="Select Category"
                          value={txCategoryId}
                          onChange={setTxCategoryId}
                          placeholder="Select category..."
                          highlightWarning={uncertain.includes('category_id') && !txCategoryId}
                          options={filteredCategories.map((c) => ({ value: c.id, label: c.name, dotColor: c.color }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Merchant / Item</label>
                      <input type="text" value={txMerchant} onChange={(e) => setTxMerchant(e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Note</label>
                      <input type="text" value={txNote} onChange={(e) => setTxNote(e.target.value)} className="input-field" />
                    </div>
                  </div>
                </div>
              )}

              {result.kind === 'task' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Task title</label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className={`input-field ${uncertain.includes('title') && !taskTitle ? '!border-amber-500' : ''}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Due date</label>
                      <input
                        type="date"
                        value={taskDate}
                        onChange={(e) => setTaskDate(e.target.value)}
                        className={`input-field ${uncertain.includes('due_at') && !taskDate ? '!border-amber-500/70' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Time (optional)</label>
                      <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} className="input-field" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Priority</label>
                      <NativeSelect
                        title="Select Priority"
                        value={taskPriority}
                        onChange={(v) => setTaskPriority(v as Priority)}
                        options={[
                          { value: 'low', label: 'Low', dotColor: '#A5B2EB' },
                          { value: 'medium', label: 'Medium', dotColor: '#DA935D' },
                          { value: 'high', label: 'High', dotColor: '#E08A92' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Reminder</label>
                      <NativeSelect
                        title="Reminder Time"
                        value={taskReminder}
                        onChange={setTaskReminder}
                        options={[
                          { value: '', label: 'No reminder' },
                          { value: '0', label: 'At due time' },
                          { value: '15', label: '15 min before' },
                          { value: '30', label: '30 min before' },
                          { value: '60', label: '1 hour before' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {result.kind === 'note' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Title</label>
                    <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Note</label>
                    <textarea rows={4} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} className="input-field resize-none" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setResult(null)} className="btn-secondary">
                  Clear
                </button>
                <button type="submit" className="btn-primary">
                  <Check className="w-4 h-4" />
                  Confirm & Save
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
