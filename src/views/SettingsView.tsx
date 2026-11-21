import React, { useRef, useState } from 'react';
import {
  Bell,
  Cloud,
  Copy,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  Wifi,
} from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import { exportTransactionsToCsv } from '../lib/csv';
import type { AutoLockMode, ThemePreference } from '../types/models';

interface SettingsViewProps {
  canInstallPwa: boolean;
  onInstallPwa: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ canInstallPwa, onInstallPwa }) => {
  const {
    data,
    account,
    syncStatus,
    lanUrls,
    activeTransactions,
    activeWallets,
    activeCategories,
    setTheme,
    updateUserProfile,
    enableNotifications,
    triggerManualSync,
    exportFullJsonBackup,
    importFullJsonBackup,
    loadSampleDataset,
    resetAllData,
    supabaseConfig,
    saveCloudConfig,
    signInCloud,
    signUpCloud,
    signOutCloud,
    changeAccountPassword,
    setAutoLockMode,
    lockNow,
    notify,
  } = useLifeHub();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [displayName, setDisplayName] = useState(data.user.display_name);
  const [sbUrl, setSbUrl] = useState(supabaseConfig?.url || '');
  const [sbKey, setSbKey] = useState(supabaseConfig?.anonKey || '');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Change account password state
  const [currentPass, setCurrentPass] = useState('');
  const [nextPass, setNextPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [freshRecoveryKey, setFreshRecoveryKey] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nextPass.length < 6) {
      notify('New password must be at least 6 characters', 'warning');
      return;
    }
    setPassBusy(true);
    const res = await changeAccountPassword(currentPass, nextPass);
    setPassBusy(false);
    if (!res.ok) {
      notify(res.error || 'Could not update password', 'warning');
      return;
    }
    setCurrentPass('');
    setNextPass('');
    setFreshRecoveryKey(res.newRecoveryKey || null);
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbUrl.trim() || !sbKey.trim()) {
      saveCloudConfig(null);
      notify('Cleared cloud sync settings', 'neutral');
      return;
    }
    saveCloudConfig({ url: sbUrl.trim(), anonKey: sbKey.trim() });
    notify('Saved Supabase connection. Now sign in below.', 'success');
  };

  const handleCloudAuth = async (mode: 'signin' | 'signup') => {
    if (!authEmail.trim() || !authPassword) {
      notify('Enter email and password', 'warning');
      return;
    }
    setAuthBusy(true);
    const res =
      mode === 'signin'
        ? await signInCloud(authEmail.trim(), authPassword)
        : await signUpCloud(authEmail.trim(), authPassword);
    setAuthBusy(false);
    if (!res.ok) {
      notify(res.error || 'Authentication failed', 'warning');
    } else if (mode === 'signup') {
      notify('Account created — check your email to verify, then sign in.', 'success');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    notify(`Copied ${text}`, 'success');
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importFullJsonBackup(String(reader.result || ''));
    };
    reader.readAsText(file);
  };

  const notifStatus =
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings &amp; Sync</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Manage local persistence, PC ↔ Android syncing, appearance, reminders, and backups.
        </p>
      </div>

      {/* Signed-in Account & Security */}
      <section className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {account ? account.email : 'Account & Security'}
              </h2>
              <p className="text-xs text-zinc-500">
                {account?.provider === 'cloud'
                  ? 'Cloud Account · Real-time sync between PC & Android anywhere'
                  : account?.provider === 'lan'
                  ? 'Wi-Fi Account · Real-time sync between PC & Android on same network'
                  : 'Device Account · Connect Supabase Cloud below to sync PC & Android over internet'}
              </p>
            </div>
          </div>
          <button type="button" onClick={lockNow} className="btn-secondary !min-h-[38px] !text-xs">
            <Lock className="w-3.5 h-3.5" />
            Sign Out / Lock
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">Auto-lock behavior</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: 'on-close', label: 'On close / reopen' },
                { id: '5m', label: '5 min idle' },
                { id: '15m', label: '15 min idle' },
                { id: '30m', label: '30 min idle' },
              ] as Array<{ id: AutoLockMode; label: string }>
            ).map((opt) => {
              const active = (data.security?.auto_lock || 'on-close') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAutoLockMode(opt.id)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                    active
                      ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-300'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                  style={{ borderColor: active ? undefined : 'var(--border-subtle)' }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            Change account password
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="password"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              placeholder="Current password"
              className="input-field !py-2 !text-xs"
              required
            />
            <input
              type="password"
              value={nextPass}
              onChange={(e) => setNextPass(e.target.value)}
              placeholder="New password (min 6)"
              className="input-field !py-2 !text-xs"
              required
            />
          </div>
          <button type="submit" disabled={passBusy} className="btn-secondary !min-h-[36px] !text-xs">
            {passBusy ? 'Updating...' : 'Update Password'}
          </button>

          {freshRecoveryKey && (
            <div
              className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 mt-2"
              style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300">New Recovery Key (save this safely):</p>
                <code className="text-sm font-mono font-bold tracking-wider">{freshRecoveryKey}</code>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(freshRecoveryKey)}
                className="btn-secondary !min-h-[32px] !px-2.5 !text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Persistence & Sync Status Card */}
      <section className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              {syncStatus.cloudUserEmail ? (
                <Cloud className="w-5 h-5" />
              ) : syncStatus.lanConnected ? (
                <Wifi className="w-5 h-5" />
              ) : (
                <HardDrive className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold">Auto-Save &amp; Storage</h2>
              <p className="text-xs text-zinc-500">
                {syncStatus.cloudUserEmail
                  ? `Cloud synced as ${syncStatus.cloudUserEmail} + saved offline locally`
                  : syncStatus.lanConnected
                  ? 'Saved on this device (IndexedDB) + synced to PC disk (data/lifehub-db.json)'
                  : 'Saved automatically on this device (IndexedDB + localStorage)'}
              </p>
            </div>
          </div>

          <button type="button" onClick={triggerManualSync} className="btn-secondary !min-h-[38px] !text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Save &amp; Sync Now
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="p-3.5 rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Laptop className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              PC App (Installable)
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Everything saves immediately on every change. Closing the browser or restarting your PC keeps all tasks, expenses, and journal entries intact.
            </p>
          </div>

          <div className="p-3.5 rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Smartphone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Android App (PWA + Wi-Fi Sync)
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Open the address below in Chrome on Android, tap the menu (⋮) → <strong>Install app</strong>. It runs full-screen offline and syncs with your PC.
            </p>
          </div>
        </div>

        {canInstallPwa && (
          <button type="button" onClick={onInstallPwa} className="btn-primary !text-xs">
            <Smartphone className="w-4 h-4" />
            Install LifeHub App on this Device
          </button>
        )}

        {lanUrls.length > 0 && (
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-medium text-zinc-500">
              Open on your Android phone (same Wi-Fi) for live PC ↔ Android sync:
            </p>
            <div className="flex flex-wrap gap-2">
              {lanUrls.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => handleCopy(url)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono border cursor-pointer hover:border-teal-500"
                  style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
                >
                  <span>{url}</span>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Appearance & Profile */}
      <section className="card p-5 space-y-4">
        <h2 className="text-base font-semibold">Appearance &amp; Profile</h2>

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'system', label: 'System', Icon: Monitor },
                { id: 'light', label: 'Light', Icon: Sun },
                { id: 'dark', label: 'Dark', Icon: Moon },
              ] as Array<{ id: ThemePreference; label: string; Icon: React.FC<{ className?: string }> }>
            ).map(({ id, label, Icon }) => {
              const active = data.preferences.theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                    active
                      ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-300'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                  style={{ borderColor: active ? undefined : 'var(--border-subtle)' }}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Display name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field !py-2 !text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  updateUserProfile({ display_name: displayName.trim() || 'Owner' });
                  notify('Profile updated', 'success');
                }}
                className="btn-secondary !min-h-[38px] !text-xs shrink-0"
              >
                Save
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Locale &amp; Currency</label>
            <input
              type="text"
              value={`English · IDR (Rp) · ${data.user.timezone}`}
              readOnly
              className="input-field !py-2 !text-sm text-zinc-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Task Reminders
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Status: <span className="capitalize font-medium">{notifStatus}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const status = await enableNotifications();
              notify(
                status === 'granted'
                  ? 'Task reminders enabled'
                  : 'Notification permission not granted by browser',
                status === 'granted' ? 'success' : 'warning'
              );
            }}
            className="btn-secondary !min-h-[38px] !text-xs"
          >
            {notifStatus === 'granted' ? 'Reminders Active' : 'Enable Reminders'}
          </button>
        </div>
      </section>

      {/* Optional Supabase Cloud Sync */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Cloud className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Optional Cloud Sync (Supabase)
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Sync PC and Android from anywhere over mobile data. Run <code className="font-mono">supabase/schema.sql</code> in your Supabase project first.
            </p>
          </div>
          {syncStatus.cloudUserEmail && (
            <button type="button" onClick={signOutCloud} className="btn-secondary !min-h-[36px] !text-xs">
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          )}
        </div>

        <form onSubmit={handleSaveSupabase} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="url"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              className="input-field !py-2 !text-xs"
            />
            <input
              type="password"
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              placeholder="Supabase anon public key"
              className="input-field !py-2 !text-xs"
            />
          </div>
          <button type="submit" className="btn-secondary !min-h-[36px] !text-xs">
            Save Cloud Keys
          </button>
        </form>

        {supabaseConfig && !syncStatus.cloudUserEmail && (
          <div className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-medium text-zinc-500">Sign in with your Supabase account</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email"
                className="input-field !py-2 !text-xs"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                className="input-field !py-2 !text-xs"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={authBusy}
                onClick={() => handleCloudAuth('signin')}
                className="btn-primary !min-h-[36px] !text-xs"
              >
                Sign In &amp; Sync
              </button>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => handleCloudAuth('signup')}
                className="btn-secondary !min-h-[36px] !text-xs"
              >
                Create Account
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Backup, Export & Sample Data */}
      <section className="card p-5 space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          Data &amp; Backups
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportFullJsonBackup} className="btn-secondary !min-h-[40px] !text-xs">
            <Download className="w-3.5 h-3.5" />
            Export Full JSON Backup
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary !min-h-[40px] !text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            Restore JSON Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleImportFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => {
              exportTransactionsToCsv(activeTransactions, activeWallets, activeCategories);
              notify('Exported transactions CSV', 'success');
            }}
            className="btn-secondary !min-h-[40px] !text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Transactions CSV
          </button>
          <button type="button" onClick={loadSampleDataset} className="btn-secondary !min-h-[40px] !text-xs">
            Load Sample Data
          </button>
        </div>

        <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs text-zinc-500">Clear all local tasks, transactions, budgets, and notes.</p>
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="btn-ghost !text-xs text-rose-600 hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset Workspace
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setConfirmReset(false)} className="btn-secondary !min-h-[34px] !text-xs">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAllData();
                  setConfirmReset(false);
                }}
                className="btn-primary !min-h-[34px] !text-xs !bg-rose-600 hover:!bg-rose-700"
              >
                Confirm Reset
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
