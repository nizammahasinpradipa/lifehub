/**
 * Subtle tactile vibration feedback on Android devices (silently no-ops where unsupported).
 */
export function haptic(kind: 'tap' | 'success' | 'warning' = 'tap'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    if (kind === 'tap') navigator.vibrate(8);
    else if (kind === 'success') navigator.vibrate([10, 30, 12]);
    else if (kind === 'warning') navigator.vibrate([18, 40, 18]);
  } catch {
    // ignore browser restrictions
  }
}
