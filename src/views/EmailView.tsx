import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckSquare,
  ChevronLeft,
  ExternalLink,
  FileText,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  MailOpen,
  Receipt,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings2,
  Star,
  X,
} from 'lucide-react';
import {
  clearGmailCache,
  clearSessionGmailToken,
  fetchGmailMessages,
  fetchGmailProfile,
  getSavedGmailAccount,
  getSavedGmailClientId,
  getSessionGmailToken,
  loadCachedGmailMessages,
  modifyGmailLabels,
  requestGmailAccessToken,
  saveCachedGmailMessages,
  saveGmailClientId,
  sendGmailMessage,
  type GmailFolder,
  type GmailMessage,
} from '../lib/gmail';
import { useLifeHub } from '../store/LifeHubContext';
import { extractIDRAmountFromText, formatIDR } from '../lib/idr';
import { formatDueAt, getLocalDateString } from '../lib/dates';
import { sendLocalNotification } from '../lib/reminders';

export const EmailView: React.FC = () => {
  const {
    data,
    activeWallets,
    activeCategories,
    addTask,
    addNote,
    addTransaction,
    notify,
  } = useLifeHub();

  const [clientId, setClientId] = useState(() => getSavedGmailClientId());
  const [clientIdInput, setClientIdInput] = useState(() => getSavedGmailClientId());
  const [accountEmail, setAccountEmail] = useState<string | null>(() => getSavedGmailAccount());
  const [accessToken, setAccessToken] = useState<string | null>(() => getSessionGmailToken());
  const [messages, setMessages] = useState<GmailMessage[]>(() => loadCachedGmailMessages());
  const [folder, setFolder] = useState<GmailFolder>('INBOX');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // Compose / Reply Modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const knownIdsRef = useRef<Set<string>>(new Set(messages.map((m) => m.id)));

  const syncInbox = useCallback(
    async (
      token: string,
      opts?: { targetFolder?: GmailFolder; q?: string; silent?: boolean }
    ) => {
      const targetFolder = opts?.targetFolder ?? folder;
      const q = opts?.q ?? searchQuery;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const fetched = await fetchGmailMessages(token, { folder: targetFolder, query: q, maxResults: 25 });
        // Notify if a brand-new unread email arrives during background poll
        if (opts?.silent && targetFolder === 'INBOX') {
          const freshUnread = fetched.filter((m) => m.unread && !knownIdsRef.current.has(m.id));
          if (freshUnread.length > 0) {
            const first = freshUnread[0];
            notify(`New email from ${first.fromName}: ${first.subject}`, 'neutral');
            sendLocalNotification(`Email: ${first.fromName}`, first.subject);
          }
        }
        knownIdsRef.current = new Set(fetched.map((m) => m.id));
        setMessages(fetched);
        if (targetFolder === 'INBOX' && !q.trim()) {
          saveCachedGmailMessages(fetched);
        }
      } catch (err: any) {
        const msg = err?.message || 'Could not load Gmail messages.';
        setError(msg);
        if (msg.includes('expired')) {
          setAccessToken(null);
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [folder, searchQuery, notify]
  );

  // Fetch on connect or folder change
  useEffect(() => {
    if (accessToken) {
      void syncInbox(accessToken, { targetFolder: folder, q: searchQuery });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, folder]);

  // Auto-poll Gmail every 60s when connected so user receives new emails live
  useEffect(() => {
    if (!accessToken) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncInbox(accessToken, { targetFolder: folder, q: searchQuery, silent: true });
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [accessToken, folder, searchQuery, syncInbox]);

  const handleConnectGmail = async () => {
    const activeId = clientIdInput.trim() || clientId.trim();
    if (!activeId) {
      setError('Paste your Google OAuth Client ID first.');
      setShowSetup(true);
      return;
    }
    saveGmailClientId(activeId);
    setClientId(activeId);
    setError(null);
    setLoading(true);
    try {
      const { accessToken: token } = await requestGmailAccessToken(activeId, 'select_account');
      setAccessToken(token);
      const email = await fetchGmailProfile(token);
      setAccountEmail(email);
      setShowSetup(false);
      notify(`Connected Gmail (${email})`, 'success');
      await syncInbox(token, { targetFolder: 'INBOX', q: '' });
    } catch (err: any) {
      setError(err?.message || 'Failed to connect Gmail.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearSessionGmailToken();
    clearGmailCache();
    setAccessToken(null);
    setAccountEmail(null);
    setMessages([]);
    setSelectedId(null);
    notify('Disconnected Gmail from this device', 'neutral');
  };

  const selectedMessage = useMemo(
    () => messages.find((m) => m.id === selectedId) || null,
    [messages, selectedId]
  );

  const detectedAmount = useMemo(() => {
    if (!selectedMessage) return null;
    return extractIDRAmountFromText(`${selectedMessage.subject} ${selectedMessage.bodyText.slice(0, 800)}`);
  }, [selectedMessage]);

  const handleSelectMessage = async (msg: GmailMessage) => {
    setSelectedId(msg.id);
    if (msg.unread && accessToken) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, unread: false } : m)));
      try {
        await modifyGmailLabels(accessToken, msg.id, [], ['UNREAD']);
      } catch {
        // ignore silent failure
      }
    }
  };

  const handleToggleStar = async (msg: GmailMessage) => {
    if (!accessToken) {
      notify('Connect Gmail to modify labels', 'warning');
      return;
    }
    const nextStar = !msg.starred;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, starred: nextStar } : m)));
    try {
      await modifyGmailLabels(
        accessToken,
        msg.id,
        nextStar ? ['STARRED'] : [],
        nextStar ? [] : ['STARRED']
      );
    } catch (err: any) {
      notify(err?.message || 'Could not update star', 'warning');
    }
  };

  const handleToggleUnread = async (msg: GmailMessage) => {
    if (!accessToken) return;
    const nextUnread = !msg.unread;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, unread: nextUnread } : m)));
    try {
      await modifyGmailLabels(
        accessToken,
        msg.id,
        nextUnread ? ['UNREAD'] : [],
        nextUnread ? [] : ['UNREAD']
      );
    } catch (err: any) {
      notify(err?.message || 'Could not update status', 'warning');
    }
  };

  const handleArchive = async (msg: GmailMessage) => {
    if (!accessToken) return;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    if (selectedId === msg.id) setSelectedId(null);
    try {
      await modifyGmailLabels(accessToken, msg.id, [], ['INBOX']);
      notify('Archived email', 'success');
    } catch (err: any) {
      notify(err?.message || 'Archive failed', 'warning');
    }
  };

  const handleCreateTaskFromEmail = (msg: GmailMessage) => {
    addTask({
      title: msg.subject,
      notes: `From: ${msg.fromName} <${msg.fromEmail}>\n\n${msg.snippet}`,
      priority: 'medium',
    });
    notify('Added email as a Task', 'success');
  };

  const handleSaveEmailToNotes = (msg: GmailMessage) => {
    addNote({
      title: msg.subject,
      body: `From: ${msg.from}\nDate: ${formatDueAt(msg.date, data.user.timezone)}\n\n${msg.bodyText}`,
    });
    notify('Saved email to Notes', 'success');
  };

  const handleLogExpenseFromEmail = (msg: GmailMessage, amount: number) => {
    const defaultWallet = data.preferences.default_wallet_id || activeWallets[0]?.id;
    const defaultCat =
      data.preferences.default_category_id ||
      activeCategories.find((c) => c.kind === 'expense')?.id ||
      null;
    if (!defaultWallet) return;
    addTransaction({
      amount,
      type: 'expense',
      date: msg.date.slice(0, 10) || getLocalDateString(),
      wallet_id: defaultWallet,
      category_id: defaultCat,
      merchant: msg.fromName,
      note: `From Gmail: ${msg.subject}`,
    });
    notify(`Logged ${formatIDR(amount)} expense from email`, 'success');
  };

  const openCompose = (replyTo?: GmailMessage) => {
    if (replyTo) {
      setComposeTo(replyTo.fromEmail);
      setComposeSubject(
        replyTo.subject.toLowerCase().startsWith('re:') ? replyTo.subject : `Re: ${replyTo.subject}`
      );
      setComposeBody('');
      setComposeThreadId(replyTo.threadId);
    } else {
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeThreadId(undefined);
    }
    setComposeOpen(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      notify('Connect Gmail first', 'warning');
      return;
    }
    if (!composeTo.trim() || !composeSubject.trim()) {
      notify('Recipient and subject are required', 'warning');
      return;
    }
    setSending(true);
    try {
      await sendGmailMessage(accessToken, {
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        threadId: composeThreadId,
      });
      notify('Email sent via Gmail', 'success');
      setComposeOpen(false);
    } catch (err: any) {
      notify(err?.message || 'Failed to send email', 'warning');
    } finally {
      setSending(false);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const unreadCount = messages.filter((m) => m.unread).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            Email
            {unreadCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-600/15 text-teal-700 dark:text-teal-300 tabular-nums">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {accountEmail
              ? `Connected to ${accountEmail}${accessToken ? ' · Live sync every 60s' : ' · Showing cached emails (reconnect to refresh)'}`
              : 'Receive and read your Gmail directly inside LifeHub, and turn emails into tasks, notes, or expenses.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {accessToken ? (
            <>
              <button
                type="button"
                onClick={() => syncInbox(accessToken)}
                disabled={loading}
                className="btn-secondary !min-h-[40px] !text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => openCompose()}
                className="btn-primary !min-h-[40px] !text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                Compose
              </button>
              <button
                type="button"
                onClick={() => setShowSetup((s) => !s)}
                className="btn-ghost !p-2"
                title="Gmail connection settings"
                aria-label="Gmail settings"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => (clientId ? handleConnectGmail() : setShowSetup(true))}
              disabled={loading}
              className="btn-primary !min-h-[40px] !text-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {accountEmail ? 'Reconnect Gmail' : 'Connect Gmail'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Setup / Connection Drawer (shown when not yet configured or toggled) */}
      {(showSetup || (!accessToken && messages.length === 0)) && (
        <div className="card p-5 space-y-4 animate-modal">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Connect your Gmail Account</h2>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Uses official Google OAuth 2.0 directly in your browser — your Google password is never stored in LifeHub.
                </p>
              </div>
            </div>
            {accessToken && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="btn-ghost !text-xs text-rose-600 hover:bg-rose-500/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-500">
              Google OAuth 2.0 Web Client ID
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="1234567890-xxxxxxxx.apps.googleusercontent.com"
                className="input-field !py-2.5 !text-xs font-mono flex-1"
              />
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={loading}
                className="btn-primary !min-h-[40px] !text-xs shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Sign in with Google
              </button>
            </div>
          </div>

          <details className="text-xs text-zinc-500 space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <summary className="cursor-pointer font-medium text-teal-700 dark:text-teal-400">
              How to get your free Google OAuth Client ID (takes 2 minutes)
            </summary>
            <ol className="list-decimal pl-5 space-y-1.5 pt-2 leading-relaxed">
              <li>
                Open{' '}
                <a
                  href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 dark:text-teal-400 underline"
                >
                  Google Cloud Console → Gmail API
                </a>{' '}
                and click <strong>Enable</strong>.
              </li>
              <li>
                Go to <strong>Google Auth Platform → Audience</strong>, choose <strong>External</strong>, and add your Gmail address under <strong>Test users</strong>.
              </li>
              <li>
                Go to <strong>Clients → Create Client → Web application</strong>, and add this exact URL under <strong>Authorized JavaScript origins</strong>:{' '}
                <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px]">
                  {currentOrigin}
                </code>
              </li>
              <li>
                Copy the generated <strong>Client ID</strong>, paste it above, and click <strong>Sign in with Google</strong>.
              </li>
            </ol>
          </details>
        </div>
      )}

      {/* Folder Tabs & Search */}
      {(accessToken || messages.length > 0) && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="flex items-center gap-1 apple-segmented overflow-x-auto no-scrollbar max-w-full">
              {(
                [
                  { id: 'INBOX', label: 'Inbox' },
                  { id: 'UNREAD', label: 'Unread' },
                  { id: 'STARRED', label: 'Starred' },
                  { id: 'SENT', label: 'Sent' },
                  { id: 'ALL', label: 'All' },
                ] as Array<{ id: GmailFolder; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolder(f.id)}
                  className={`apple-segmented-btn shrink-0 !px-3.5 !py-1.5 ${
                    folder === f.id ? 'active' : ''
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (accessToken) void syncInbox(accessToken, { targetFolder: folder, q: searchQuery });
              }}
              className="relative flex-1"
            >
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Gmail (press Enter)..."
                className="input-field !pl-10 !py-2 !text-sm"
              />
            </form>
          </div>

          {/* Master-Detail Email Inbox */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Message List */}
            <div
              className={`lg:col-span-5 card divide-y overflow-hidden ${
                selectedMessage ? 'hidden lg:block' : 'block'
              }`}
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              {loading && messages.length === 0 ? (
                <div className="p-10 flex flex-col items-center gap-2 text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                  <p className="text-xs">Loading Gmail...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Inbox className="w-7 h-7 text-zinc-300 dark:text-zinc-600 mx-auto" />
                  <p className="text-sm font-medium">No emails in this folder</p>
                  <p className="text-xs text-zinc-500">Try refreshing or switching folders.</p>
                </div>
              ) : (
                <div className="max-h-[68vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {messages.map((msg) => {
                    const active = selectedMessage?.id === msg.id;
                    return (
                      <button
                        key={msg.id}
                        type="button"
                        onClick={() => handleSelectMessage(msg)}
                        className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                          active
                            ? 'bg-teal-600/10 dark:bg-teal-400/10'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-sm truncate ${
                              msg.unread ? 'font-bold' : 'font-medium text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {msg.unread && (
                              <span className="inline-block w-2 h-2 rounded-full bg-teal-600 mr-2 align-middle" />
                            )}
                            {msg.fromName}
                          </span>
                          <span className="text-[11px] text-zinc-400 shrink-0 tabular-nums">
                            {formatDueAt(msg.date, data.user.timezone)}
                          </span>
                        </div>
                        <p
                          className={`text-xs truncate mt-1 ${
                            msg.unread ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {msg.subject}
                        </p>
                        <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{msg.snippet}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Email Reader + LifeHub Actions */}
            <div className={`lg:col-span-7 ${selectedMessage ? 'block' : 'hidden lg:block'}`}>
              {selectedMessage ? (
                <div className="card p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="lg:hidden btn-ghost !px-2 !text-xs"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>

                    <div className="flex flex-wrap items-center gap-1 ml-auto">
                      {accessToken && (
                        <>
                          <button
                            type="button"
                            onClick={() => openCompose(selectedMessage)}
                            className="btn-secondary !min-h-[34px] !px-2.5 !text-xs"
                          >
                            <Reply className="w-3.5 h-3.5" />
                            Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStar(selectedMessage)}
                            className={`btn-ghost !p-2 ${selectedMessage.starred ? 'text-amber-500' : ''}`}
                            title={selectedMessage.starred ? 'Unstar' : 'Star'}
                            aria-label="Toggle star"
                          >
                            <Star className="w-4 h-4" fill={selectedMessage.starred ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleUnread(selectedMessage)}
                            className="btn-ghost !p-2"
                            title={selectedMessage.unread ? 'Mark as read' : 'Mark as unread'}
                            aria-label="Toggle unread"
                          >
                            <MailOpen className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(selectedMessage)}
                            className="btn-ghost !p-2"
                            title="Archive email"
                            aria-label="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${selectedMessage.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost !p-2"
                        title="Open in Gmail"
                        aria-label="Open in Gmail"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold leading-snug">{selectedMessage.subject}</h2>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-zinc-500">
                      <div>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{selectedMessage.fromName}</span>{' '}
                        <span>&lt;{selectedMessage.fromEmail}&gt;</span>
                      </div>
                      <span className="tabular-nums">{formatDueAt(selectedMessage.date, data.user.timezone)}</span>
                    </div>
                  </div>

                  {/* Turn Email into LifeHub Items */}
                  <div
                    className="flex flex-wrap items-center gap-2 p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--bg-subtle)' }}
                  >
                    <span className="text-[11px] font-medium text-zinc-500 mr-1">Save to LifeHub:</span>
                    <button
                      type="button"
                      onClick={() => handleCreateTaskFromEmail(selectedMessage)}
                      className="btn-secondary !min-h-[32px] !px-2.5 !text-xs"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      Create Task
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEmailToNotes(selectedMessage)}
                      className="btn-secondary !min-h-[32px] !px-2.5 !text-xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      Save to Notes
                    </button>
                    {detectedAmount !== null && detectedAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleLogExpenseFromEmail(selectedMessage, detectedAmount)}
                        className="btn-secondary !min-h-[32px] !px-2.5 !text-xs"
                      >
                        <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Log {formatIDR(detectedAmount)}
                      </button>
                    )}
                  </div>

                  {/* Plain-text Email Body */}
                  <div className="prose-measure selectable text-sm leading-[1.65] whitespace-pre-wrap break-words max-h-[48vh] overflow-y-auto pr-1 text-[var(--text-primary)]">
                    {selectedMessage.bodyText}
                  </div>
                </div>
              ) : (
                <div className="card p-10 text-center flex flex-col items-center justify-center min-h-[360px]">
                  <Mail className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-3" />
                  <p className="text-sm font-medium">Select an email to read</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Turn important emails into tasks, notes, or IDR expenses in one tap.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Compose / Reply Modal */}
      {composeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[3px] p-0 md:p-4"
          onClick={() => setComposeOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-[24px] md:rounded-[20px] border animate-sheet md:animate-modal pb-safe"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-modal)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compose email"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-base font-semibold">{composeThreadId ? 'Reply via Gmail' : 'New Email'}</h2>
              <button type="button" onClick={() => setComposeOpen(false)} className="btn-ghost !p-2" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendEmail} className="p-5 space-y-3">
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="To (recipient@example.com)"
                className="input-field !py-2 !text-sm"
                required
              />
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject"
                className="input-field !py-2 !text-sm"
                required
              />
              <textarea
                rows={7}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your message..."
                className="input-field resize-none !text-sm"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setComposeOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={sending} className="btn-primary">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
