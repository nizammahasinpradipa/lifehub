import React, { useMemo, useState } from 'react';
import { CheckSquare, FileText, Link2, Plus, Receipt, Search, X } from 'lucide-react';
import type { ItemType } from '../types/models';
import { useLifeHub } from '../store/LifeHubContext';
import { formatIDR } from '../lib/idr';

interface LinkPickerProps {
  itemType: ItemType;
  itemId: string;
}

export const LinkPicker: React.FC<LinkPickerProps> = ({ itemType, itemId }) => {
  const {
    activeTasks,
    activeTransactions,
    activeNotes,
    getLinksForItem,
    addLink,
    removeLink,
    navigateToItem,
  } = useLifeHub();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const links = getLinksForItem(itemType, itemId);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Array<{ type: ItemType; id: string; title: string; subtitle: string }> = [];

    for (const t of activeTasks) {
      if (t.parent_task_id) continue;
      if (itemType === 'task' && t.id === itemId) continue;
      if (!q || t.title.toLowerCase().includes(q)) {
        list.push({ type: 'task', id: t.id, title: t.title, subtitle: t.status === 'done' ? 'Done task' : 'Task' });
      }
    }

    for (const tx of activeTransactions) {
      if (itemType === 'transaction' && tx.id === itemId) continue;
      const label = tx.merchant || tx.note || `${tx.type} transaction`;
      if (!q || label.toLowerCase().includes(q) || tx.date.includes(q)) {
        list.push({ type: 'transaction', id: tx.id, title: label, subtitle: `${tx.date} · ${formatIDR(tx.amount)}` });
      }
    }

    for (const n of activeNotes) {
      if (itemType === 'note' && n.id === itemId) continue;
      const label = n.type === 'journal' ? `Journal · ${n.journal_date}` : n.title || 'Untitled note';
      if (!q || label.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) {
        list.push({ type: 'note', id: n.id, title: label, subtitle: n.type === 'journal' ? 'Journal' : 'Note' });
      }
    }

    const linkedSet = new Set(links.map((l) => `${l.targetType}:${l.targetId}`));
    return list.filter((c) => !linkedSet.has(`${c.type}:${c.id}`)).slice(0, 12);
  }, [activeTasks, activeTransactions, activeNotes, itemType, itemId, query, links]);

  const iconFor = (t: ItemType) => {
    if (t === 'task') return <CheckSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />;
    if (t === 'transaction') return <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    return <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {links.map((entry) => (
          <div
            key={entry.link.id}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs border transition-colors"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <button
              type="button"
              onClick={() => navigateToItem(entry.targetType, entry.targetId)}
              className="inline-flex items-center gap-1.5 hover:underline cursor-pointer"
              title={`Open ${entry.subtitle}`}
            >
              {iconFor(entry.targetType)}
              <span className="max-w-[160px] truncate font-medium">{entry.label}</span>
            </button>
            <button
              type="button"
              onClick={() => removeLink(entry.link.id)}
              className="p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 cursor-pointer"
              aria-label={`Remove link to ${entry.label}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed transition-colors cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <Link2 className="w-3 h-3" />
          Link item
        </button>
      </div>

      {open && (
        <div
          className="p-3 rounded-xl border space-y-2 animate-modal"
          style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, expenses, or notes to link..."
              className="input-field !pl-8 !py-1.5 !text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {candidates.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2 text-center">No matching items to link.</p>
            ) : (
              candidates.map((c) => (
                <button
                  key={`${c.type}:${c.id}`}
                  type="button"
                  onClick={() => {
                    addLink(itemType, itemId, c.type, c.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {iconFor(c.type)}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{c.title}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{c.subtitle}</p>
                    </div>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
