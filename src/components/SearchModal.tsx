import React, { useMemo, useState } from 'react';
import { CheckSquare, FileText, Hash, Receipt, Search, Share2, X } from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import { formatIDR } from '../lib/idr';
import type { ItemType } from '../types/models';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ open, onClose }) => {
  const {
    activeTasks,
    activeTransactions,
    activeNotes,
    activeSocialLinks,
    activeTags,
    getTagsForItem,
    navigateToItem,
    setActiveTab,
    notify,
  } = useLifeHub();
  const [query, setQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType | 'social'>('all');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: Array<{
      type: ItemType | 'social';
      id: string;
      title: string;
      subtitle: string;
      tags: string[];
      copyUrl?: string;
    }> = [];

    if (typeFilter === 'all' || typeFilter === 'task') {
      for (const t of activeTasks) {
        if (t.parent_task_id) continue;
        const tags = getTagsForItem('task', t.id);
        if (selectedTagId && !tags.some((tg) => tg.id === selectedTagId)) continue;
        if (!q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q) || tags.some((tg) => tg.name.includes(q))) {
          items.push({
            type: 'task',
            id: t.id,
            title: t.title,
            subtitle: `${t.status === 'done' ? 'Done' : 'Open'} · ${t.priority} priority`,
            tags: tags.map((tg) => tg.name),
          });
        }
      }
    }

    if (typeFilter === 'all' || typeFilter === 'transaction') {
      for (const tx of activeTransactions) {
        const tags = getTagsForItem('transaction', tx.id);
        if (selectedTagId && !tags.some((tg) => tg.id === selectedTagId)) continue;
        const label = tx.merchant || tx.note || tx.type;
        if (
          !q ||
          label.toLowerCase().includes(q) ||
          tx.note.toLowerCase().includes(q) ||
          tx.date.includes(q) ||
          String(tx.amount).includes(q) ||
          tags.some((tg) => tg.name.includes(q))
        ) {
          items.push({
            type: 'transaction',
            id: tx.id,
            title: label,
            subtitle: `${tx.date} · ${formatIDR(tx.amount)} (${tx.type})`,
            tags: tags.map((tg) => tg.name),
          });
        }
      }
    }

    if (typeFilter === 'all' || typeFilter === 'note') {
      for (const n of activeNotes) {
        const tags = getTagsForItem('note', n.id);
        if (selectedTagId && !tags.some((tg) => tg.id === selectedTagId)) continue;
        const label = n.type === 'journal' ? `Journal · ${n.journal_date}` : n.title || 'Untitled note';
        if (
          !q ||
          label.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.mood_reason.toLowerCase().includes(q) ||
          tags.some((tg) => tg.name.includes(q))
        ) {
          items.push({
            type: 'note',
            id: n.id,
            title: label,
            subtitle: n.body.slice(0, 75) || (n.type === 'journal' ? 'Daily journal' : 'Empty note'),
            tags: tags.map((tg) => tg.name),
          });
        }
      }
    }

    if ((typeFilter === 'all' || typeFilter === 'social') && !selectedTagId) {
      for (const s of activeSocialLinks) {
        if (
          !q ||
          s.label.toLowerCase().includes(q) ||
          s.handle.toLowerCase().includes(q) ||
          s.url.toLowerCase().includes(q) ||
          s.platform.toLowerCase().includes(q)
        ) {
          items.push({
            type: 'social',
            id: s.id,
            title: s.label,
            subtitle: `${s.handle ? `${s.handle} · ` : ''}${s.url}`,
            tags: [],
            copyUrl: s.url,
          });
        }
      }
    }

    return items.slice(0, 30);
  }, [activeTasks, activeTransactions, activeNotes, activeSocialLinks, getTagsForItem, query, selectedTagId, typeFilter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 backdrop-blur-[2px] pt-10 md:pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden animate-modal"
        style={{ backgroundColor: 'var(--bg-surface-solid)', borderColor: 'var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global Search"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, expenses, notes, journal, or #tags..."
            className="w-full bg-transparent outline-none text-sm"
            autoFocus
          />
          <button type="button" onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close search">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 flex flex-wrap items-center gap-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {(['all', 'task', 'transaction', 'note', 'social'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTypeFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors ${
                typeFilter === f
                  ? 'bg-teal-600 text-white dark:bg-teal-400 dark:text-zinc-950'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
              }`}
            >
              {f === 'transaction' ? 'Spending' : f === 'all' ? 'All' : `${f}s`}
            </button>
          ))}

          {activeTags.slice(0, 6).map((tg) => (
            <button
              key={tg.id}
              type="button"
              onClick={() => setSelectedTagId(selectedTagId === tg.id ? null : tg.id)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                selectedTagId === tg.id
                  ? 'bg-teal-600/15 text-teal-700 dark:text-teal-300 font-medium'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Hash className="w-3 h-3" />
              {tg.name}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">No matching items found.</div>
          ) : (
            results.map((item) => (
              <button
                key={`${item.type}:${item.id}`}
                type="button"
                onClick={() => {
                  if (item.type === 'social') {
                    if (item.copyUrl) {
                      navigator.clipboard?.writeText(item.copyUrl);
                      notify(`Copied ${item.title} URL`, 'success');
                    }
                    setActiveTab('socials');
                  } else {
                    navigateToItem(item.type, item.id);
                  }
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  {item.type === 'task' && <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                  {item.type === 'transaction' && <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  {item.type === 'note' && <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
                  {item.type === 'social' && <Share2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{item.subtitle}</p>
                </div>
                {item.tags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {item.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
