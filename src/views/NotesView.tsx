import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Hash,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLifeHub } from '../store/LifeHubContext';
import {
  addDaysToDateString,
  formatFullDate,
  formatShortDate,
  getLastNDays,
  getLocalDateString,
} from '../lib/dates';
import type { MoodRating } from '../types/models';
import { TagPicker } from '../components/TagPicker';
import { LinkPicker } from '../components/LinkPicker';

type NotesTab = 'journal' | 'notes' | 'mood';

const MOODS: Array<{ value: MoodRating; label: string; colorVar: string; bgVar: string }> = [
  { value: 1, label: 'Tough', colorVar: 'var(--state-danger)', bgVar: 'var(--state-danger-bg)' },
  { value: 2, label: 'Low', colorVar: 'var(--primary)', bgVar: 'var(--accent-soft)' },
  { value: 3, label: 'Okay', colorVar: 'var(--state-warning)', bgVar: 'var(--state-warning-bg)' },
  { value: 4, label: 'Good', colorVar: 'var(--state-info)', bgVar: 'var(--state-info-bg)' },
  { value: 5, label: 'Great', colorVar: 'var(--state-success)', bgVar: 'var(--state-success-bg)' },
];

export const NotesView: React.FC = () => {
  const {
    data,
    activeNotes,
    activeTags,
    focusTarget,
    clearFocusTarget,
    getTagsForItem,
    addNote,
    updateNote,
    deleteNote,
    upsertJournalEntry,
    setItemTags,
    notify,
  } = useLifeHub();

  const today = getLocalDateString(new Date(), data.user.timezone);

  const [subTab, setSubTab] = useState<NotesTab>('journal');
  const [journalDate, setJournalDate] = useState(today);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saved'>('idle');

  // If the day rolls over while app stays open, keep today fresh
  useEffect(() => {
    if (focusTarget?.tab === 'notes' && focusTarget.itemId) {
      const target = activeNotes.find((n) => n.id === focusTarget.itemId);
      if (target) {
        if (target.type === 'journal' && target.journal_date) {
          setSubTab('journal');
          setJournalDate(target.journal_date);
        } else {
          setSubTab('notes');
          setSelectedNoteId(target.id);
        }
      }
      clearFocusTarget();
    }
  }, [focusTarget, activeNotes, clearFocusTarget]);

  const markSaved = () => {
    setAutoSaveState('saved');
    window.setTimeout(() => setAutoSaveState('idle'), 1500);
  };

  // Current day's journal entry — returns null on a brand new day (never yesterday's!)
  const journalEntry = useMemo(
    () => activeNotes.find((n) => n.type === 'journal' && n.journal_date === journalDate) || null,
    [activeNotes, journalDate]
  );

  // Regular plain-text notes
  const regularNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeNotes
      .filter((n) => n.type === 'note')
      .filter((n) => {
        if (dateFilter && !n.updated_at.startsWith(dateFilter) && !n.created_at.startsWith(dateFilter)) {
          return false;
        }
        const tags = getTagsForItem('note', n.id);
        if (selectedTagId && !tags.some((t) => t.id === selectedTagId)) return false;
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          tags.some((t) => t.name.includes(q))
        );
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [activeNotes, searchQuery, selectedTagId, dateFilter, getTagsForItem]);

  const selectedNote = useMemo(
    () => regularNotes.find((n) => n.id === selectedNoteId) || activeNotes.find((n) => n.id === selectedNoteId && n.type === 'note') || null,
    [regularNotes, activeNotes, selectedNoteId]
  );

  // 30-day mood history dataset (N4)
  const moodHistory = useMemo(() => {
    const journals = activeNotes.filter((n) => n.type === 'journal');
    const byDate = new Map(journals.map((j) => [j.journal_date || '', j]));
    const days30 = getLastNDays(30, data.user.timezone).map((d) => {
      const entry = byDate.get(d);
      return {
        date: d,
        label: d.slice(5), // MM-DD
        mood: entry?.mood ?? null,
        reason: entry?.mood_reason || '',
      };
    });
    const rated = days30.filter((d) => d.mood !== null);
    const avg =
      rated.length > 0
        ? (rated.reduce((sum, d) => sum + (d.mood || 0), 0) / rated.length).toFixed(1)
        : null;
    const recentEntries = journals
      .filter((j) => j.body || j.mood)
      .sort((a, b) => (b.journal_date || '').localeCompare(a.journal_date || ''));
    return { days30, avg, ratedCount: rated.length, recentEntries };
  }, [activeNotes, data.user.timezone]);

  const handleCreateNote = () => {
    const created = addNote({ title: '', body: '' });
    setSubTab('notes');
    setSelectedNoteId(created.id);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="hidden md:flex sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notes &amp; Journal</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Plain-text notes and daily reflections — auto-saved as you type.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {autoSaveState === 'saved' && (
            <span className="inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          <button type="button" onClick={handleCreateNote} className="btn-primary !min-h-[40px] !text-xs">
            <Plus className="w-4 h-4" />
            New Note
          </button>
        </div>
      </div>

      {/* Sub-Tabs (Apple Segmented Control) */}
      <div className="flex items-center justify-between gap-2">
        <div className="grid grid-cols-3 sm:flex items-center gap-1 apple-segmented flex-1 sm:flex-none">
          {(
            [
              { id: 'journal', label: 'Journal', Icon: BookOpen },
              { id: 'notes', label: 'Notes', Icon: FileText },
              { id: 'mood', label: 'Mood', Icon: TrendingUp },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`apple-segmented-btn inline-flex items-center justify-center gap-1.5 !px-2.5 sm:!px-4 ${
                subTab === id ? 'active' : ''
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {subTab === 'notes' && (
          <button type="button" onClick={handleCreateNote} className="md:hidden btn-primary !min-h-[38px] !px-3 !text-xs shrink-0">
            <Plus className="w-4 h-4" />
            New
          </button>
        )}
      </div>

      {/* SUB-TAB 1: DAILY JOURNAL (N2, N3) */}
      {subTab === 'journal' && (
        <div className="card p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">
              {journalDate === today ? `Today · ${formatFullDate(journalDate)}` : formatFullDate(journalDate)}
            </h2>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setJournalDate((d) => addDaysToDateString(d, -1))}
                className="btn-secondary !min-h-[40px] !px-2.5 shrink-0"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={journalDate}
                max={today}
                onChange={(e) => e.target.value && setJournalDate(e.target.value)}
                className="input-field !w-auto !py-1.5 !text-xs flex-1 sm:flex-none"
                aria-label="Choose journal date"
              />
              <button
                type="button"
                onClick={() => {
                  const next = addDaysToDateString(journalDate, 1);
                  if (next <= today) setJournalDate(next);
                }}
                disabled={journalDate >= today}
                className="btn-secondary !min-h-[40px] !px-2.5 disabled:opacity-40 shrink-0"
                aria-label="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {journalDate !== today && (
                <button
                  type="button"
                  onClick={() => setJournalDate(today)}
                  className="btn-ghost !text-xs text-teal-700 dark:text-teal-400 shrink-0"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          {/* 5-Point Mood Rating */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-zinc-500">How did today feel? (1–5)</p>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((m) => {
                const active = journalEntry?.mood === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => {
                      upsertJournalEntry(journalDate, { mood: active ? null : m.value });
                      markSaved();
                    }}
                    className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all cursor-pointer"
                    style={{
                      backgroundColor: active ? m.bgVar : 'var(--bg-surface-elevated)',
                      borderColor: active ? m.colorVar : 'var(--border-subtle)',
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: active ? m.colorVar : 'var(--bg-subtle)',
                        color: active ? 'var(--primary-fg)' : 'var(--text-secondary)',
                      }}
                    >
                      {m.value}
                    </span>
                    <span className="text-[11px] font-medium mt-1.5">{m.label}</span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={journalEntry?.mood_reason || ''}
              onChange={(e) => {
                upsertJournalEntry(journalDate, { mood_reason: e.target.value });
                markSaved();
              }}
              placeholder="Optional one-line reason for your mood..."
              className="input-field !text-sm"
            />
          </div>

          {/* Plain-text Auto-Saved Journal Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Reflection</label>
            <textarea
              rows={9}
              value={journalEntry?.body || ''}
              onChange={(e) => {
                upsertJournalEntry(journalDate, { body: e.target.value });
                markSaved();
              }}
              placeholder="Write a few honest lines about your day — wins, thoughts, or what you want to carry into tomorrow..."
              className="input-field resize-y leading-relaxed"
            />
          </div>

          {journalEntry && (
            <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Linked Items</p>
              <LinkPicker itemType="note" itemId={journalEntry.id} />
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: PLAIN-TEXT NOTES (N1, N5, N6, N7) */}
      {subTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Searchable Notes List */}
          <div className={`lg:col-span-5 space-y-3 ${selectedNote ? 'hidden lg:block' : 'block'}`}>
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search note titles and text..."
                  className="input-field !pl-10 !py-2.5 !text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="input-field !w-auto !py-1 !px-2 !text-xs"
                  />
                  {dateFilter && (
                    <button type="button" onClick={() => setDateFilter('')} className="text-xs text-zinc-500 hover:underline cursor-pointer">
                      Clear
                    </button>
                  )}
                </div>

                {activeTags.map((tg) => (
                  <button
                    key={tg.id}
                    type="button"
                    onClick={() => setSelectedTagId(selectedTagId === tg.id ? null : tg.id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer ${
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
            </div>

            <div className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              {regularNotes.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm font-medium">No notes yet</p>
                  <p className="text-xs text-zinc-500">Create a note to capture ideas, checklists, or trip plans.</p>
                  <button type="button" onClick={handleCreateNote} className="btn-secondary mt-2 !text-xs">
                    <Plus className="w-3.5 h-3.5" />
                    Create first note
                  </button>
                </div>
              ) : (
                regularNotes.map((note) => {
                  const active = selectedNote?.id === note.id;
                  const tags = getTagsForItem('note', note.id);
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                        active
                          ? 'bg-teal-600/10 dark:bg-teal-400/10'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <p className="text-sm font-semibold truncate">{note.title || 'Untitled note'}</p>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-1">
                        {note.body || 'Empty note...'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-zinc-400">
                        <span>{formatShortDate(note.updated_at.slice(0, 10))}</span>
                        {tags.slice(0, 3).map((t) => (
                          <span key={t.id} className="text-teal-700 dark:text-teal-400">
                            #{t.name}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Auto-Save Plain-Text Editor */}
          <div className={`lg:col-span-7 ${selectedNote ? 'block' : 'hidden lg:block'}`}>
            {selectedNote ? (
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNoteId(null)}
                    className="lg:hidden btn-ghost !px-2 !text-xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    All notes
                  </button>
                  <span className="text-xs text-zinc-400">Auto-saves on every keystroke</span>
                  <button
                    type="button"
                    onClick={() => {
                      deleteNote(selectedNote.id);
                      setSelectedNoteId(null);
                      notify('Note deleted', 'neutral');
                    }}
                    className="btn-ghost !p-2 text-rose-600 hover:bg-rose-500/10"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) => {
                    updateNote(selectedNote.id, { title: e.target.value });
                    markSaved();
                  }}
                  placeholder="Note title"
                  className="input-field !text-lg font-semibold"
                />

                <textarea
                  rows={11}
                  value={selectedNote.body}
                  onChange={(e) => {
                    updateNote(selectedNote.id, { body: e.target.value });
                    markSaved();
                  }}
                  placeholder="Start typing..."
                  className="input-field resize-y leading-relaxed"
                />

                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tags</p>
                  <TagPicker
                    selectedTagIds={getTagsForItem('note', selectedNote.id).map((t) => t.id)}
                    onChange={(ids) => setItemTags('note', selectedNote.id, ids)}
                    compact
                  />
                </div>

                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Linked Items</p>
                  <LinkPicker itemType="note" itemId={selectedNote.id} />
                </div>
              </div>
            ) : (
              <div className="card p-10 text-center flex flex-col items-center justify-center min-h-[320px]">
                <FileText className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-3" />
                <p className="text-sm font-medium">Select a note to edit</p>
                <p className="text-xs text-zinc-500 mt-1">Or create a new plain-text note in one click.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: 30-DAY MOOD HISTORY (N4) */}
      {subTab === 'mood' && (
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">30-Day Mood Trend</h2>
                <p className="text-xs text-zinc-500">
                  {moodHistory.ratedCount > 0
                    ? `${moodHistory.ratedCount} days logged · Average ${moodHistory.avg} / 5`
                    : 'Log your daily mood in the Journal tab to see trends over time.'}
                </p>
              </div>
            </div>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moodHistory.days30}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="label" fontSize={11} interval={4} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} width={28} />
                  <Tooltip
                    formatter={(val: number) => {
                      const m = MOODS.find((x) => x.value === val);
                      return m ? `${val}/5 (${m.label})` : val;
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-solid)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '14px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'var(--accent)' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3.5">
              <h3 className="text-sm font-semibold">Recent Journal Entries</h3>
            </div>
            {moodHistory.recentEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">No journal entries yet.</div>
            ) : (
              moodHistory.recentEntries.slice(0, 15).map((entry) => {
                const moodMeta = MOODS.find((m) => m.value === entry.mood);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      if (entry.journal_date) {
                        setJournalDate(entry.journal_date);
                        setSubTab('journal');
                      }
                    }}
                    className="w-full text-left px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{entry.journal_date}</span>
                      {moodMeta && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: moodMeta.bgVar, color: moodMeta.colorVar }}
                        >
                          {moodMeta.value}/5 · {moodMeta.label}
                        </span>
                      )}
                    </div>
                    {entry.mood_reason && <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-1">{entry.mood_reason}</p>}
                    {entry.body && <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{entry.body}</p>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
