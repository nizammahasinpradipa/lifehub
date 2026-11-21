import React, { useState } from 'react';
import { Camera, Check, Loader2, Upload, X, AlertCircle } from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import { getLocalDateString } from '../lib/dates';
import { formatIDR, parseIDRAmount } from '../lib/idr';

interface ReceiptScanModalProps {
  open: boolean;
  onClose: () => void;
}

function parseReceiptText(rawText: string): { amount: number | null; date: string; merchant: string } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Merchant is typically the first non-numeric line with >= 3 letters
  const merchant =
    lines.find((l) => /[a-zA-Z]{3,}/.test(l) && !/^(struk|receipt|nota|invoice|tanggal|date)/i.test(l))?.slice(0, 48) || '';

  // Look for TOTAL / GRAND TOTAL / BAYAR lines first
  let amount: number | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/(grand\s*total|total|bayar|subtotal|jumlah|amount|rp)/i.test(line)) {
      const m = line.match(/(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,})/i);
      if (m) {
        const val = parseInt(m[1].replace(/[.,]/g, ''), 10);
        if (val >= 500 && val < 500_000_000) {
          amount = val;
          break;
        }
      }
    }
  }

  // Fallback: largest plausible rupiah figure on the receipt
  if (amount === null) {
    const matches = rawText.match(/\b\d{1,3}(?:[.,]\d{3})+\b/g) || [];
    const nums = matches
      .map((s) => parseInt(s.replace(/[.,]/g, ''), 10))
      .filter((n) => n >= 1000 && n < 100_000_000);
    if (nums.length > 0) {
      amount = Math.max(...nums);
    }
  }

  // Date match: YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  let date = getLocalDateString();
  const iso = rawText.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
  const dmy = rawText.match(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/);
  if (iso) {
    date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  } else if (dmy) {
    date = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  return { amount, date, merchant };
}

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({ open, onClose }) => {
  const { activeWallets, activeCategories, data, addTransaction, notify } = useLifeHub();
  const expenseCategories = activeCategories.filter((c) => c.kind === 'expense');

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'review'>('upload');

  const [amountInput, setAmountInput] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [walletId, setWalletId] = useState(data.preferences.default_wallet_id || activeWallets[0]?.id || '');
  const [categoryId, setCategoryId] = useState(data.preferences.default_category_id || expenseCategories[0]?.id || '');
  const [note, setNote] = useState('');

  if (!open) return null;

  const reset = () => {
    setPreviewUrl(null);
    setScanning(false);
    setOcrNote(null);
    setStep('upload');
    setAmountInput('');
    setMerchant('');
    setDate(getLocalDateString());
    setNote('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScanning(true);
    setOcrNote(null);

    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(file, 'eng');
      const parsed = parseReceiptText(result.data.text || '');
      setAmountInput(parsed.amount ? String(parsed.amount) : '');
      setMerchant(parsed.merchant);
      setDate(parsed.date);
      setNote('Scanned from receipt');
      if (!parsed.amount) {
        setOcrNote('Could not detect the total automatically — please check and fill the amount below.');
      }
    } catch {
      setOcrNote('OCR ran offline or could not read image text — please verify and fill details manually.');
      setNote('Receipt photo');
    } finally {
      setScanning(false);
      setStep('review');
    }
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseIDRAmount(amountInput);
    if (!parsedAmount || parsedAmount <= 0) {
      notify('Please enter a valid IDR amount', 'warning');
      return;
    }
    if (!walletId) {
      notify('Please choose a wallet', 'warning');
      return;
    }
    addTransaction({
      amount: parsedAmount,
      type: 'expense',
      date,
      wallet_id: walletId,
      category_id: categoryId || null,
      merchant,
      note,
    });
    notify(`Saved ${formatIDR(parsedAmount)} from receipt`, 'success');
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 md:p-4">
      <div
        className="w-full max-w-lg rounded-t-2xl md:rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto animate-modal"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="text-base font-semibold">Scan Receipt</h2>
          </div>
          <button type="button" onClick={handleClose} className="btn-ghost !p-2" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'upload' && !scanning && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                Take a photo or choose a receipt image. LifeHub extracts the amount, date, and merchant for your review — nothing is saved until you confirm.
              </p>

              <label
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors hover:border-teal-500"
                style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-subtle)' }}
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Tap to capture or upload receipt</p>
                  <p className="text-xs text-zinc-500 mt-1">Supports Android camera & PC images (JPG, PNG, WebP)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
            </div>
          )}

          {scanning && (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600 dark:text-teal-400" />
              <p className="text-sm font-medium">Reading receipt details...</p>
              <p className="text-xs text-zinc-500">Extracting amount, date, and merchant locally on your device.</p>
            </div>
          )}

          {step === 'review' && !scanning && (
            <form onSubmit={handleConfirm} className="space-y-4">
              {previewUrl && (
                <div className="rounded-xl overflow-hidden border max-h-40 flex items-center justify-center bg-zinc-950/5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <img src={previewUrl} alt="Receipt preview" className="max-h-40 object-contain" />
                </div>
              )}

              {ocrNote && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{ocrNote}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Amount (IDR) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g. 50000 or 50k"
                    className={`input-field tabular-nums ${!amountInput ? '!border-amber-500' : ''}`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Merchant</label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Store or restaurant name"
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Category</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-field">
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Wallet</label>
                  <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className="input-field">
                    {activeWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                  className="input-field"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={reset} className="btn-secondary">
                  Retake
                </button>
                <button type="submit" className="btn-primary">
                  <Check className="w-4 h-4" />
                  Confirm & Save
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
