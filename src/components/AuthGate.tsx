import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import { getLockoutStatus } from '../lib/security';

export const AuthGate: React.FC = () => {
  const {
    needsAuthSetup,
    authHint,
    setupPasscode,
    finishSetupUnlock,
    verifyPasscode,
    recoverWithKey,
    notify,
  } = useLifeHub();

  const [mode, setMode] = useState<'unlock' | 'setup' | 'recover'>(() =>
    needsAuthSetup ? 'setup' : 'unlock'
  );

  // Sync mode if needsAuthSetup changes after hydration
  useEffect(() => {
    if (mode !== 'recover') {
      setMode(needsAuthSetup ? 'setup' : 'unlock');
    }
  }, [needsAuthSetup, mode]);

  // Unlock fields
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [busy, setBusy] = useState(false);

  // Setup fields
  const [ownerName, setOwnerName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [hint, setHint] = useState('');
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState<string | null>(null);
  const [savedKeyConfirmed, setSavedKeyConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Recovery fields
  const [recoveryInput, setRecoveryInput] = useState('');

  // Check active cooldown on mount and tick down every second
  useEffect(() => {
    const syncCooldown = () => {
      const status = getLockoutStatus();
      setCooldownSec(status.cooldownMs > 0 ? Math.ceil(status.cooldownMs / 1000) : 0);
    };
    syncCooldown();
    const timer = window.setInterval(syncCooldown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode || cooldownSec > 0) return;
    setError(null);
    setBusy(true);
    const res = await verifyPasscode(passcode);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Incorrect passcode.');
      setPasscode('');
      if (res.cooldownMs) {
        setCooldownSec(Math.ceil(res.cooldownMs / 1000));
      }
    }
  };

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPass.length < 4) {
      setError('Passcode must be at least 4 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Passcodes do not match.');
      return;
    }
    const { recoveryKey } = setupPasscode(newPass, hint, ownerName);
    setGeneratedRecoveryKey(recoveryKey);
    setNewPass('');
    setConfirmPass('');
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!recoveryInput.trim()) {
      setError('Enter your recovery key.');
      return;
    }
    if (newPass.length < 4) {
      setError('New passcode must be at least 4 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setError('New passcodes do not match.');
      return;
    }
    setBusy(true);
    const res = await recoverWithKey(recoveryInput, newPass, hint);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Invalid recovery key.');
      return;
    }
    setGeneratedRecoveryKey(res.newRecoveryKey || null);
    setSavedKeyConfirmed(false);
    setRecoveryInput('');
    setNewPass('');
    setConfirmPass('');
  };

  const handleCopyRecovery = () => {
    if (!generatedRecoveryKey) return;
    navigator.clipboard?.writeText(generatedRecoveryKey);
    setCopiedKey(true);
    notify('Recovery key copied', 'success');
    window.setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div className="w-full max-w-md space-y-6 animate-modal">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center mb-4 relative">
            <img src="/favicon.svg" alt="LifeHub" className="w-14 h-14 rounded-2xl" />
            <span
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--bg-canvas)',
              }}
            >
              <Lock className="w-3 h-3 text-teal-700 dark:text-teal-400" />
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LifeHub</h1>
          <p className="text-xs text-zinc-500 mt-1">Private personal workspace</p>
        </div>

        {/* Recovery Key Confirmation Step (after Setup or Recovery Reset) */}
        {generatedRecoveryKey ? (
          <div className="card p-6 space-y-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Save your Recovery Key</h2>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Your verification lock is active. Keep this one-time key somewhere safe in case you ever forget your passcode — it won&apos;t be shown again.
                </p>
              </div>
            </div>

            <div
              className="p-4 rounded-xl border flex items-center justify-between gap-2"
              style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
            >
              <code className="text-base font-mono font-bold tracking-wider select-all">
                {generatedRecoveryKey}
              </code>
              <button
                type="button"
                onClick={handleCopyRecovery}
                className="btn-secondary !min-h-[36px] !px-3 !text-xs shrink-0"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={savedKeyConfirmed}
                onChange={(e) => setSavedKeyConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 accent-teal-600 w-4 h-4"
              />
              <span>I have copied or written down my recovery key.</span>
            </label>

            <button
              type="button"
              disabled={!savedKeyConfirmed}
              onClick={finishSetupUnlock}
              className="btn-primary w-full"
            >
              Continue to Dashboard
            </button>
          </div>
        ) : mode === 'setup' ? (
          /* FIRST-TIME LOCK SETUP */
          <form onSubmit={handleSetup} className="card p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold">Set up verification</h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Create a personal passcode or password so only you can view your tasks, expenses, and journal.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Your name (optional)</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Dippa"
                  className="input-field"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Passcode or password (min 4 characters) *
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Enter PIN or password"
                    className="input-field !pr-11"
                    autoComplete="new-password"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Confirm passcode *</label>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Re-enter passcode"
                  className="input-field"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Hint (optional)</label>
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="A clue only you understand"
                  className="input-field"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-2">
              <ShieldCheck className="w-4 h-4" />
              Create Lock &amp; Protect Data
            </button>
          </form>
        ) : mode === 'recover' ? (
          /* RECOVERY KEY RESET */
          <form onSubmit={handleRecover} className="card p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('unlock');
                }}
                className="btn-ghost !p-1.5 -ml-1.5"
                aria-label="Back to unlock"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base font-semibold">Reset with Recovery Key</h2>
                <p className="text-xs text-zinc-500">All your saved tasks, expenses, and notes remain intact.</p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Recovery Key *</label>
                <input
                  type="text"
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                  placeholder="LH-XXXX-XXXX-XXXX"
                  className="input-field font-mono uppercase tracking-wider"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">New passcode (min 4 chars) *</label>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new passcode"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Confirm new passcode *</label>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Re-enter new passcode"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">New hint (optional)</label>
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="Optional hint"
                  className="input-field"
                />
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-primary w-full">
              <KeyRound className="w-4 h-4" />
              {busy ? 'Verifying...' : 'Verify Key & Set New Passcode'}
            </button>
          </form>
        ) : (
          /* STANDARD LOCKED VERIFICATION SCREEN */
          <form onSubmit={handleUnlock} className="card p-6 space-y-4 shadow-sm">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Verify to unlock</h2>
              <p className="text-xs text-zinc-500">
                Enter your passcode to access your tasks, spending, and journal.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode"
                  className="input-field !py-3 !pr-11 !text-base"
                  autoComplete="current-password"
                  disabled={cooldownSec > 0 || busy}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {authHint && (
                <p className="text-xs text-zinc-500 px-1">
                  Hint: <span className="font-medium text-zinc-700 dark:text-zinc-300">{authHint}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!passcode || cooldownSec > 0 || busy}
              className="btn-primary w-full"
            >
              <Lock className="w-4 h-4" />
              {cooldownSec > 0
                ? `Try again in ${cooldownSec}s`
                : busy
                ? 'Verifying...'
                : 'Unlock LifeHub'}
            </button>

            <div className="pt-2 text-center border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('recover');
                }}
                className="text-xs text-zinc-500 hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
              >
                Forgot passcode? Use Recovery Key
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-[11px] text-zinc-400">
          Protected locally &amp; across PC–Android sync. Nothing loads until verified.
        </p>
      </div>
    </div>
  );
};
