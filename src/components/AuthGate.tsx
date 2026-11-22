import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Cloud,
  Copy,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
  Wifi,
} from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import { getLockoutStatus } from '../lib/security';
import { AppLogo } from './AppLogo';

export const AuthGate: React.FC = () => {
  const {
    availableProvider,
    hasExistingAccount,
    supabaseConfig,
    saveCloudConfig,
    signInAccount,
    signUpAccount,
    recoverLocalAccount,
    notify,
  } = useLifeHub();

  const [mode, setMode] = useState<'signin' | 'signup' | 'recover'>(() =>
    hasExistingAccount ? 'signin' : 'signup'
  );

  useEffect(() => {
    if (mode !== 'recover') {
      setMode(hasExistingAccount ? 'signin' : 'signup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExistingAccount]);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [recoveryBanner, setRecoveryBanner] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [showCloudSetup, setShowCloudSetup] = useState(false);
  const [sbUrl, setSbUrl] = useState(supabaseConfig?.url || '');
  const [sbKey, setSbKey] = useState(supabaseConfig?.anonKey || '');

  useEffect(() => {
    const syncCooldown = () => {
      const status = getLockoutStatus();
      setCooldownSec(status.cooldownMs > 0 ? Math.ceil(status.cooldownMs / 1000) : 0);
    };
    syncCooldown();
    const timer = window.setInterval(syncCooldown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || cooldownSec > 0) return;
    setError(null);
    setInfoMsg(null);
    setBusy(true);
    const res = await signInAccount({ email, password, remember });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Incorrect email or password.');
      setPassword('');
      if (res.cooldownMs) {
        setCooldownSec(Math.ceil(res.cooldownMs / 1000));
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const res = await signUpAccount({ email, password, displayName, remember });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Could not create account.');
      return;
    }
    if (res.needsEmailConfirm) {
      setInfoMsg('Account created! Check your email inbox to confirm your address, then sign in.');
      setMode('signin');
      setPassword('');
      setConfirmPassword('');
      return;
    }
    if (res.recoveryKey) {
      setRecoveryBanner(res.recoveryKey);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const res = await recoverLocalAccount({
      email,
      recoveryKey: recoveryKeyInput,
      newPassword: password,
      remember,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Recovery failed.');
      return;
    }
    if (res.newRecoveryKey) {
      setRecoveryBanner(res.newRecoveryKey);
    }
  };

  const handleSaveCloud = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbUrl.trim() || !sbKey.trim()) {
      saveCloudConfig(null);
      notify('Disconnected Cloud Sync server', 'neutral');
      setShowCloudSetup(false);
      return;
    }
    saveCloudConfig({ url: sbUrl.trim(), anonKey: sbKey.trim() });
    notify('Cloud Sync connected — sign in or create your account below', 'success');
    setShowCloudSetup(false);
  };

  const renderProviderBadge = () => {
    if (availableProvider === 'cloud') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium badge-success">
          <Cloud className="w-3.5 h-3.5" />
          Cloud Account · Syncs PC &amp; Android anywhere
        </span>
      );
    }
    if (availableProvider === 'lan') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium badge-info">
          <Wifi className="w-3.5 h-3.5" />
          Wi-Fi Account · Syncs PC &amp; Android on same network
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        <HardDrive className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
        Device Account · Connect Cloud below to sync
      </span>
    );
  };

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div className="w-full max-w-md space-y-5 animate-modal">
        {/* Clean Apple-Style Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="relative">
            <AppLogo className="w-16 h-16 rounded-[18px] shadow-md" />
            <span
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--bg-canvas)',
                color: 'var(--primary)',
              }}
            >
              <Lock className="w-3 h-3" />
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">LifeHub</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              One private account for your PC and Android
            </p>
          </div>
          <div className="pt-0.5">{renderProviderBadge()}</div>
        </div>

        {/* Recovery Key Notice */}
        {recoveryBanner && (
          <div className="card p-5 space-y-3" style={{ borderColor: 'var(--primary)' }}>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-state-success" />
              <div>
                <p className="text-sm font-semibold">Save your Recovery Key</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Keep this code safe in case you forget your password on this device.
                </p>
              </div>
            </div>
            <div
              className="p-3 rounded-xl border flex items-center justify-between gap-2"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
            >
              <code className="text-sm font-mono font-bold tracking-wider">{recoveryBanner}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(recoveryBanner);
                  setCopiedKey(true);
                  notify('Recovery key copied', 'success');
                }}
                className="btn-secondary !min-h-[32px] !px-2.5 !text-xs"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-state-success" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Main Account Card */}
        <div className="card p-6 space-y-4">
          {mode !== 'recover' && (
            <div className="grid grid-cols-2 gap-1 apple-segmented" style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setInfoMsg(null);
                }}
                className={`apple-segmented-btn ${mode === 'signin' ? 'active' : ''}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setInfoMsg(null);
                }}
                className={`apple-segmented-btn ${mode === 'signup' ? 'active' : ''}`}
              >
                Create Account
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl badge-danger text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl badge-info text-xs">
              <Mail className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-field !pr-11"
                    autoComplete="current-password"
                    disabled={cooldownSec > 0 || busy}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>Keep me signed in on this device</span>
              </label>

              <button
                type="submit"
                disabled={!email.trim() || !password || cooldownSec > 0 || busy}
                className="btn-primary w-full"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {cooldownSec > 0
                  ? `Try again in ${cooldownSec}s`
                  : busy
                  ? 'Signing in...'
                  : 'Sign In & Sync'}
              </button>

              {availableProvider === 'local' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('recover');
                    }}
                    className="text-xs text-[var(--text-muted)] hover:underline cursor-pointer"
                  >
                    Forgot password? Use Recovery Key
                  </button>
                </div>
              )}
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Dippa"
                  className="input-field"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Password (min 6 characters) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="input-field !pr-11"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Confirm password *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="input-field"
                  autoComplete="new-password"
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>Keep me signed in on this device</span>
              </label>

              <button type="submit" disabled={busy} className="btn-primary w-full mt-1">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {busy ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {mode === 'recover' && (
            <form onSubmit={handleRecover} className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('signin');
                  }}
                  className="btn-ghost !p-1.5 -ml-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-semibold">Reset with Recovery Key</h2>
              </div>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Account email"
                className="input-field"
                required
              />
              <input
                type="text"
                value={recoveryKeyInput}
                onChange={(e) => setRecoveryKeyInput(e.target.value.toUpperCase())}
                placeholder="LH-XXXX-XXXX-XXXX"
                className="input-field font-mono uppercase"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 6)"
                className="input-field"
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="input-field"
                required
              />
              <button type="submit" disabled={busy} className="btn-primary w-full">
                <KeyRound className="w-4 h-4" />
                Reset Password
              </button>
            </form>
          )}
        </div>

        {/* Cloud Sync Connection Drawer */}
        <div className="card p-4 space-y-3">
          <button
            type="button"
            onClick={() => setShowCloudSetup((s) => !s)}
            className="w-full flex items-center justify-between text-xs font-medium text-[var(--text-secondary)] cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Cloud className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              {supabaseConfig ? 'Cloud Sync Server Connected (Supabase)' : 'Connect Cloud Sync (PC ↔ Android anywhere)'}
            </span>
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>
              {showCloudSetup ? 'Hide' : 'Configure'}
            </span>
          </button>

          {showCloudSetup && (
            <form onSubmit={handleSaveCloud} className="space-y-2.5 pt-2 border-t animate-modal" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Paste your free Supabase Project URL and Anon Key once on PC and Android (after running <code className="font-mono">supabase/schema.sql</code>) to sync one account over Wi-Fi or mobile data.
              </p>
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
              <div className="flex items-center justify-between gap-2">
                {supabaseConfig && (
                  <button
                    type="button"
                    onClick={() => {
                      setSbUrl('');
                      setSbKey('');
                      saveCloudConfig(null);
                      notify('Switched off Cloud Sync', 'neutral');
                    }}
                    className="btn-ghost !text-xs text-state-danger"
                  >
                    Disconnect
                  </button>
                )}
                <button type="submit" className="btn-secondary !min-h-[36px] !text-xs ml-auto">
                  Save Cloud Server
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
