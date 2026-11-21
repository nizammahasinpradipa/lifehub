/**
 * Indonesian Rupiah (IDR) helpers — strictly integer rupiah, zero decimals.
 */

export function formatIDR(amount: number, opts?: { compact?: boolean; signed?: boolean }): string {
  const rounded = Math.round(amount || 0);
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : opts?.signed && rounded > 0 ? '+' : '';

  if (opts?.compact) {
    if (abs >= 1_000_000_000) {
      const val = (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
      return `${sign}Rp ${val}M`;
    }
    if (abs >= 1_000_000) {
      const val = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '');
      return `${sign}Rp ${val}jt`;
    }
    if (abs >= 10_000) {
      const val = Math.round(abs / 1_000);
      return `${sign}Rp ${val}rb`;
    }
  }

  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp ${formatted}`;
}

/**
 * Parses Indonesian & shorthand amounts like:
 * "50k", "50rb", "50 ribu", "1.5jt", "1,5 juta", "Rp 25.000", "25000"
 * Returns whole integer rupiah or null if not parseable.
 */
export function parseIDRAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .toLowerCase()
    .replace(/rp\.?\s*/g, '')
    .replace(/idr\s*/g, '')
    .trim();

  if (!cleaned) return null;

  // Match shorthand multipliers: 1.5jt, 1,5 juta, 50k, 50rb, 50 ribu
  const shorthand = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(jt|juta|m|rb|ribu|k)$/i);
  if (shorthand) {
    const num = parseFloat(shorthand[1].replace(',', '.'));
    if (Number.isNaN(num)) return null;
    const unit = shorthand[2].toLowerCase();
    if (unit === 'jt' || unit === 'juta' || unit === 'm') {
      return Math.round(num * 1_000_000);
    }
    return Math.round(num * 1_000);
  }

  // Plain numbers with Indonesian thousands separators: 50.000 or 1.500.000 or 50,000
  const digitsOnly = cleaned.replace(/[.,\s]/g, '');
  if (/^\d+$/.test(digitsOnly)) {
    const value = parseInt(digitsOnly, 10);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

/**
 * Extracts first IDR amount found anywhere inside a sentence.
 */
export function extractIDRAmountFromText(text: string): number | null {
  const lower = text.toLowerCase();

  // 1. Explicit shorthand like 50k, 50rb, 1.5jt, 1,5 juta, 25 ribu
  const shorthandRegex = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(jt|juta|rb|ribu|k)\b/i;
  const m1 = lower.match(shorthandRegex);
  if (m1) {
    const num = parseFloat(m1[1].replace(',', '.'));
    const unit = m1[2].toLowerCase();
    if (!Number.isNaN(num)) {
      if (unit === 'jt' || unit === 'juta') return Math.round(num * 1_000_000);
      return Math.round(num * 1_000);
    }
  }

  // 2. Explicit Rp prefix: Rp 50.000 or Rp50000
  const rpRegex = /rp\.?\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,})/i;
  const m2 = lower.match(rpRegex);
  if (m2) {
    return parseInt(m2[1].replace(/[.,]/g, ''), 10);
  }

  // 3. Standalone formatted thousands: 50.000 or 150.000
  const thousandsRegex = /\b(\d{1,3}(?:\.\d{3})+)\b/;
  const m3 = lower.match(thousandsRegex);
  if (m3) {
    return parseInt(m3[1].replace(/\./g, ''), 10);
  }

  // 4. Standalone number >= 500 (avoid matching day numbers like "on the 1st" or "2 coffees")
  const plainNumRegex = /\b(\d{4,})\b/;
  const m4 = lower.match(plainNumRegex);
  if (m4) {
    return parseInt(m4[1], 10);
  }

  return null;
}
