import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCode,
  Globe,
  Mail,
  MessageCircle,
  Pencil,
  Pin,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import type { SocialCategory, SocialLink, SocialPlatform } from '../types/models';

interface PlatformMeta {
  id: SocialPlatform;
  label: string;
  short: string;
  color: string;
  defaultCategory: SocialCategory;
  placeholder: string;
}

const PLATFORMS: PlatformMeta[] = [
  { id: 'github', label: 'GitHub', short: 'GH', color: '#24292F', defaultCategory: 'dev', placeholder: 'https://github.com/username' },
  { id: 'instagram', label: 'Instagram', short: 'IG', color: '#E1306C', defaultCategory: 'social', placeholder: 'https://instagram.com/username' },
  { id: 'linkedin', label: 'LinkedIn', short: 'IN', color: '#0A66C2', defaultCategory: 'contact', placeholder: 'https://linkedin.com/in/username' },
  { id: 'x', label: 'X (Twitter)', short: 'X', color: '#18181B', defaultCategory: 'social', placeholder: 'https://x.com/username' },
  { id: 'tiktok', label: 'TikTok', short: 'TT', color: '#0F172A', defaultCategory: 'social', placeholder: 'https://tiktok.com/@username' },
  { id: 'youtube', label: 'YouTube', short: 'YT', color: '#DC2626', defaultCategory: 'social', placeholder: 'https://youtube.com/@channel' },
  { id: 'website', label: 'Portfolio / Website', short: 'WEB', color: '#0F766E', defaultCategory: 'dev', placeholder: 'https://yourdomain.com' },
  { id: 'email', label: 'Email', short: '@', color: '#0284C7', defaultCategory: 'contact', placeholder: 'you@example.com' },
  { id: 'whatsapp', label: 'WhatsApp', short: 'WA', color: '#16A34A', defaultCategory: 'contact', placeholder: 'https://wa.me/628123456789' },
  { id: 'discord', label: 'Discord', short: 'DC', color: '#5865F2', defaultCategory: 'social', placeholder: 'https://discord.com/users/...' },
  { id: 'dribbble', label: 'Dribbble', short: 'DR', color: '#EA4C89', defaultCategory: 'design', placeholder: 'https://dribbble.com/username' },
  { id: 'behance', label: 'Behance', short: 'BE', color: '#1769FF', defaultCategory: 'design', placeholder: 'https://behance.net/username' },
  { id: 'threads', label: 'Threads', short: 'TH', color: '#27272A', defaultCategory: 'social', placeholder: 'https://threads.net/@username' },
  { id: 'facebook', label: 'Facebook', short: 'FB', color: '#1877F2', defaultCategory: 'social', placeholder: 'https://facebook.com/username' },
  { id: 'other', label: 'Custom Link', short: 'URL', color: '#64748B', defaultCategory: 'other', placeholder: 'https://...' },
];

const PLATFORM_MAP = new Map(PLATFORMS.map((p) => [p.id, p]));

type ExportFormat = 'json' | 'ts' | 'html' | 'markdown' | 'plain';

function formatExport(items: SocialLink[], format: ExportFormat): string {
  if (format === 'json') {
    return JSON.stringify(
      items.map((s) => ({
        platform: s.platform,
        label: s.label,
        handle: s.handle || undefined,
        url: s.url,
      })),
      null,
      2
    );
  }
  if (format === 'ts') {
    const entries = items
      .map(
        (s) =>
          `  { platform: '${s.platform}', label: '${s.label.replace(/'/g, "\\'")}', handle: '${s.handle.replace(/'/g, "\\'")}', url: '${s.url}' },`
      )
      .join('\n');
    return `export const socialLinks = [\n${entries}\n] as const;`;
  }
  if (format === 'html') {
    return items
      .map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label}</a>`)
      .join('\n');
  }
  if (format === 'markdown') {
    return items
      .map((s) => `- [${s.label}${s.handle ? ` (${s.handle})` : ''}](${s.url})`)
      .join('\n');
  }
  return items.map((s) => `${s.label}: ${s.url}`).join('\n');
}

export const SocialsView: React.FC = () => {
  const {
    activeSocialLinks,
    addSocialLink,
    updateSocialLink,
    deleteSocialLink,
    togglePinSocialLink,
    notify,
  } = useLifeHub();

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'pinned' | SocialCategory>('all');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SocialLink | null>(null);
  const [platform, setPlatform] = useState<SocialPlatform>('github');
  const [label, setLabel] = useState('GitHub');
  const [handle, setHandle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<SocialCategory>('dev');
  const [notes, setNotes] = useState('');
  const [pinned, setPinned] = useState(false);

  const visibleLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeSocialLinks.filter((s) => {
      if (categoryFilter === 'pinned' && !s.pinned) return false;
      if (categoryFilter !== 'all' && categoryFilter !== 'pinned' && s.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.label.toLowerCase().includes(q) ||
        s.handle.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
      );
    });
  }, [activeSocialLinks, categoryFilter, query]);

  const exportTargets = useMemo(() => {
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds);
      return activeSocialLinks.filter((s) => set.has(s.id));
    }
    return visibleLinks;
  }, [selectedIds, activeSocialLinks, visibleLinks]);

  const openAddModal = (presetPlatform: SocialPlatform = 'github') => {
    const meta = PLATFORM_MAP.get(presetPlatform) || PLATFORMS[0];
    setEditingItem(null);
    setPlatform(meta.id);
    setLabel(meta.label);
    setHandle('');
    setUrl('');
    setCategory(meta.defaultCategory);
    setNotes('');
    setPinned(false);
    setModalOpen(true);
  };

  const openEditModal = (item: SocialLink) => {
    setEditingItem(item);
    setPlatform(item.platform);
    setLabel(item.label);
    setHandle(item.handle);
    setUrl(item.url);
    setCategory(item.category);
    setNotes(item.notes);
    setPinned(item.pinned);
    setModalOpen(true);
  };

  const handlePlatformChange = (nextPlatform: SocialPlatform) => {
    const prevMeta = PLATFORM_MAP.get(platform);
    const nextMeta = PLATFORM_MAP.get(nextPlatform) || PLATFORMS[0];
    setPlatform(nextPlatform);
    if (!label.trim() || label === prevMeta?.label) {
      setLabel(nextMeta.label);
    }
    setCategory(nextMeta.defaultCategory);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !url.trim()) {
      notify('Label and URL are required', 'warning');
      return;
    }
    if (editingItem) {
      updateSocialLink(editingItem.id, {
        platform,
        label: label.trim(),
        handle: handle.trim(),
        url: url.trim(),
        category,
        notes: notes.trim(),
        pinned,
      });
      notify('Social link updated', 'success');
    } else {
      addSocialLink({
        platform,
        label: label.trim(),
        handle: handle.trim(),
        url: url.trim(),
        category,
        notes: notes.trim(),
        pinned,
      });
      notify('Social link added', 'success');
    }
    setModalOpen(false);
  };

  const copyText = (text: string, idKey: string, toastMsg: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(idKey);
    notify(toastMsg, 'success');
    window.setTimeout(() => setCopiedId((prev) => (prev === idKey ? null : prev)), 1800);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const displayUrl = (raw: string) => raw.replace(/^https?:\/\/(www\.)?/i, '').replace(/^mailto:/i, '');

  const currentMeta = PLATFORM_MAP.get(platform) || PLATFORMS[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Socials</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Store your social media &amp; contact links once — copy individual links or project-ready snippets in one tap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSocialLinks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowExportPanel((s) => !s)}
              className={`btn-secondary !min-h-[40px] !text-xs ${
                showExportPanel ? '!border-teal-600 text-teal-700 dark:text-teal-300' : ''
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Project Copy Kit
            </button>
          )}
          <button type="button" onClick={() => openAddModal('github')} className="btn-primary !min-h-[40px] !text-xs">
            <Plus className="w-4 h-4" />
            Add Link
          </button>
        </div>
      </div>

      {/* Project Copy Kit Drawer */}
      {showExportPanel && activeSocialLinks.length > 0 && (
        <div className="card p-5 space-y-3.5 animate-modal">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FileCode className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Copy for Projects ({exportTargets.length}{' '}
                {selectedIds.length > 0 ? 'selected' : 'visible'})
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {selectedIds.length > 0
                  ? 'Exporting your checked links. Uncheck to include all visible links.'
                  : 'Check specific cards below to export a subset, or copy all visible links now.'}
              </p>
            </div>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="btn-ghost !text-xs text-teal-700 dark:text-teal-400"
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-subtle)' }}>
              {(
                [
                  { id: 'json', label: 'JSON' },
                  { id: 'ts', label: 'TypeScript' },
                  { id: 'html', label: 'HTML <a>' },
                  { id: 'markdown', label: 'Markdown' },
                  { id: 'plain', label: 'Plain List' },
                ] as Array<{ id: ExportFormat; label: string }>
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setExportFormat(fmt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    exportFormat === fmt.id
                      ? 'bg-white dark:bg-zinc-800 shadow-sm text-teal-700 dark:text-teal-300'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={exportTargets.length === 0}
              onClick={() =>
                copyText(
                  formatExport(exportTargets, exportFormat),
                  `export-${exportFormat}`,
                  `Copied ${exportTargets.length} links as ${exportFormat.toUpperCase()}`
                )
              }
              className="btn-primary !min-h-[36px] !text-xs"
            >
              {copiedId === `export-${exportFormat}` ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy {exportFormat.toUpperCase()}
            </button>
          </div>

          <pre
            className="p-3.5 rounded-xl border text-xs font-mono overflow-x-auto max-h-52 leading-relaxed"
            style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
          >
            {exportTargets.length > 0
              ? formatExport(exportTargets, exportFormat)
              : '// No links match the current filter'}
          </pre>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search platform, handle, or URL..."
            className="input-field !pl-10 !py-2 !text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'pinned', label: 'Pinned' },
              { id: 'social', label: 'Social' },
              { id: 'dev', label: 'Dev' },
              { id: 'design', label: 'Design' },
              { id: 'contact', label: 'Contact' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCategoryFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                categoryFilter === f.id
                  ? 'bg-teal-600 text-white dark:bg-teal-400 dark:text-zinc-950'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Links Grid */}
      {visibleLinks.length === 0 ? (
        <div className="card p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl mx-auto bg-teal-600/10 text-teal-700 dark:text-teal-300 flex items-center justify-center">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {activeSocialLinks.length === 0 ? 'No social links saved yet' : 'No links match this filter'}
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
              Save your GitHub, Instagram, LinkedIn, Portfolio, and contact links here so you can copy them into any project in seconds.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {(['github', 'instagram', 'linkedin', 'x', 'website', 'email'] as SocialPlatform[]).map((p) => {
              const meta = PLATFORM_MAP.get(p)!;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => openAddModal(p)}
                  className="btn-secondary !min-h-[36px] !text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {visibleLinks.map((item) => {
            const meta = PLATFORM_MAP.get(item.platform) || PLATFORMS[PLATFORMS.length - 1];
            const isSelected = selectedIds.includes(item.id);
            const isUrlCopied = copiedId === `url-${item.id}`;
            const isHandleCopied = copiedId === `handle-${item.id}`;

            return (
              <div
                key={item.id}
                className={`card p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isSelected ? '!border-teal-600' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: meta.color }}
                    >
                      {item.platform === 'email' ? (
                        <Mail className="w-4 h-4" />
                      ) : item.platform === 'website' ? (
                        <Globe className="w-4 h-4" />
                      ) : item.platform === 'whatsapp' ? (
                        <MessageCircle className="w-4 h-4" />
                      ) : (
                        meta.short
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">{item.label}</h3>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          {item.category}
                        </span>
                      </div>
                      {item.handle && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{item.handle}</p>
                      )}
                      <p className="text-xs text-teal-700 dark:text-teal-400 truncate mt-1 font-mono">
                        {displayUrl(item.url)}
                      </p>
                      {item.notes && (
                        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{item.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {showExportPanel && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 mr-1 accent-teal-600 cursor-pointer"
                        aria-label={`Select ${item.label} for export`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => togglePinSocialLink(item.id)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                        item.pinned
                          ? 'text-teal-600 dark:text-teal-400 bg-teal-600/10'
                          : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                      }`}
                      aria-label={item.pinned ? 'Unpin link' : 'Pin link'}
                      title={item.pinned ? 'Pinned' : 'Pin to top'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={`Edit ${item.label}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteSocialLink(item.id);
                        notify(`Deleted ${item.label}`, 'neutral');
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 cursor-pointer"
                      aria-label={`Delete ${item.label}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Fast 1-Click Actions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => copyText(item.url, `url-${item.id}`, `Copied ${item.label} URL`)}
                    className="btn-secondary !min-h-[34px] !px-3 !text-xs flex-1"
                  >
                    {isUrlCopied ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {isUrlCopied ? 'Copied URL' : 'Copy URL'}
                  </button>

                  {item.handle && (
                    <button
                      type="button"
                      onClick={() => copyText(item.handle, `handle-${item.id}`, `Copied ${item.handle}`)}
                      className="btn-secondary !min-h-[34px] !px-2.5 !text-xs"
                    >
                      {isHandleCopied ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                      Handle
                    </button>
                  )}

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary !min-h-[34px] !px-2.5 !text-xs"
                    aria-label={`Open ${item.label}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 md:p-4">
          <div
            className="w-full max-w-lg rounded-t-2xl md:rounded-2xl border shadow-2xl max-h-[92vh] overflow-y-auto animate-modal"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-base font-semibold">{editingItem ? 'Edit Social Link' : 'Add Social Link'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost !p-2" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => handlePlatformChange(e.target.value as SocialPlatform)}
                    className="input-field !py-2 !text-sm"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Group</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SocialCategory)}
                    className="input-field !py-2 !text-sm"
                  >
                    <option value="social">Social</option>
                    <option value="dev">Dev</option>
                    <option value="design">Design</option>
                    <option value="contact">Contact</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Display label *</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. GitHub, Personal IG"
                    className="input-field !py-2 !text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Username / Handle</label>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@dippa"
                    className="input-field !py-2 !text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Link URL *</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={currentMeta.placeholder}
                  className="input-field !py-2.5 !text-sm font-mono"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Use for portfolio footer & client projects"
                  className="input-field !py-2 !text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 rounded"
                />
                Pin to top for quick project access
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingItem ? 'Save Changes' : 'Save Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
