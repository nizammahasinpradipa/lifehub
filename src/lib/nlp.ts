import type { AIDraft, Category, LifeHubData, Priority, Wallet } from '../types/models';
import { addDaysToDateString, getLocalDateString, getLocalMonthString, localDateTimeToUtcIso } from './dates';
import { extractIDRAmountFromText, formatIDR } from './idr';

export interface AIQueryAnswer {
  kind: 'answer';
  answer: string;
  details?: string[];
}

export type AIParseResult = AIDraft | AIQueryAnswer;

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2,
  mar: 3, march: 3, maret: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, desember: 12,
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: ['lunch', 'dinner', 'breakfast', 'coffee', 'kopi', 'makan', 'jajan', 'snack', 'bakso', 'nasi', 'mie', 'warteg', 'cafe', 'restaurant', 'resto', 'groceries', 'grocery', 'superindo', 'indomaret', 'alfamart', 'gofood', 'grabfood', 'drink', 'boba', 'tea', 'ayam', 'soto', 'sate', 'food'],
  transport: ['grab', 'gojek', 'goride', 'gocar', 'taxi', 'bluebird', 'bensin', 'fuel', 'pertamina', 'parkir', 'parking', 'tol', 'toll', 'mrt', 'krl', 'commuter', 'transjakarta', 'bus', 'train', 'kereta', 'flight', 'tiket', 'transport', 'uber', 'ojol'],
  bills: ['bill', 'bills', 'rent', 'kos', 'kost', 'sewa', 'pln', 'listrik', 'electricity', 'wifi', 'internet', 'indihome', 'biznet', 'pulsa', 'paket data', 'telkomsel', 'xl', 'air', 'pdam', 'water', 'subscription', 'netflix', 'spotify', 'icloud', 'youtube'],
  shopping: ['shop', 'shopping', 'tokopedia', 'shopee', 'lazada', 'blibli', 'beli', 'buy', 'bought', 'shirt', 'shoes', 'baju', 'sepatu', 'clothes', 'book', 'buku', 'gadget', 'elektronik', 'uniqlo', 'ikea'],
  health: ['health', 'doctor', 'dokter', 'apotek', 'pharmacy', 'obat', 'medicine', 'clinic', 'klinik', 'hospital', 'rs', 'gym', 'vitamin', 'dentist', 'gigi', 'medical', 'halodoc'],
  salary: ['salary', 'gaji', 'paycheck', 'payroll', 'bonus', 'thr'],
  freelance: ['freelance', 'client', 'project', 'invoice', 'commission', 'komisi'],
};

function findMatchingWallet(text: string, wallets: Wallet[]): Wallet | null {
  const lower = text.toLowerCase();
  const active = wallets.filter((w) => !w.deleted_at);

  // Direct name match first
  for (const w of active) {
    const wName = w.name.toLowerCase();
    const baseToken = wName.replace(/\([^)]*\)/g, '').trim();
    if (lower.includes(wName) || (baseToken.length >= 2 && lower.includes(baseToken))) {
      return w;
    }
    // Check inside parentheses e.g. "Bank (BCA)" -> "bca"
    const paren = wName.match(/\(([^)]+)\)/);
    if (paren && lower.includes(paren[1].trim())) {
      return w;
    }
  }

  // Common Indonesian wallet aliases
  if (/\b(tunai|cash|dompet)\b/.test(lower)) {
    return active.find((w) => w.type === 'cash') || null;
  }
  if (/\b(bca|mandiri|bni|bri|jago|jenius|seabank|bank|transfer|debit)\b/.test(lower)) {
    return active.find((w) => w.type === 'bank') || null;
  }
  if (/\b(gopay|ovo|dana|shopeepay|qris|linkaja|ewallet|e-wallet)\b/.test(lower)) {
    return active.find((w) => w.type === 'e-wallet') || null;
  }

  return null;
}

function findMatchingCategory(text: string, categories: Category[], kind: 'expense' | 'income'): Category | null {
  const lower = text.toLowerCase();
  const active = categories.filter((c) => !c.deleted_at && c.kind === kind);

  // Exact category name match
  for (const c of active) {
    if (lower.includes(c.name.toLowerCase())) {
      return c;
    }
  }

  // Keyword match
  for (const [key, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower))) {
      const cat = active.find((c) => c.name.toLowerCase().includes(key));
      if (cat) return cat;
    }
  }

  return null;
}

function parseDateFromText(text: string): { date: string; time?: string; explicit: boolean } {
  const lower = text.toLowerCase();
  const today = getLocalDateString();

  // Optional time e.g. "at 14:30", "at 9am", "at 5 pm", "jam 19.00"
  let time: string | undefined;
  const time24 = lower.match(/(?:at|jam|pukul)\s*(\d{1,2})[:.](\d{2})/);
  const time12 = lower.match(/(?:at|jam)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (time12) {
    let h = parseInt(time12[1], 10);
    const m = time12[2] ? parseInt(time12[2], 10) : 0;
    if (time12[3] === 'pm' && h < 12) h += 12;
    if (time12[3] === 'am' && h === 12) h = 0;
    time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  } else if (time24) {
    const h = Math.min(23, parseInt(time24[1], 10));
    const m = Math.min(59, parseInt(time24[2], 10));
    time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  if (/\b(today|hari ini)\b/.test(lower)) {
    return { date: today, time, explicit: true };
  }
  if (/\b(tomorrow|besok)\b/.test(lower)) {
    return { date: addDaysToDateString(today, 1), time, explicit: true };
  }
  if (/\b(yesterday|kemarin)\b/.test(lower)) {
    return { date: addDaysToDateString(today, -1), time, explicit: true };
  }

  // "on the 1st", "on the 25th", "tanggal 1"
  const ordinalMatch = lower.match(/\b(?:on the|on|tanggal|tgl)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (ordinalMatch) {
    const dayNum = parseInt(ordinalMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const [y, m, d] = today.split('-').map(Number);
      let targetYear = y;
      let targetMonth = m;
      if (dayNum < d) {
        targetMonth += 1;
        if (targetMonth > 12) {
          targetMonth = 1;
          targetYear += 1;
        }
      }
      const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return { date: dateStr, time, explicit: true };
    }
  }

  // Explicit YYYY-MM-DD
  const isoMatch = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return { date: isoMatch[1], time, explicit: true };
  }

  // "Nov 25" or "25 Nov"
  const monthDay = lower.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthDay && MONTH_MAP[monthDay[1]]) {
    const [y] = today.split('-').map(Number);
    const m = MONTH_MAP[monthDay[1]];
    const d = Math.min(31, parseInt(monthDay[2], 10));
    return { date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, time, explicit: true };
  }

  return { date: today, time, explicit: Boolean(time) };
}

function answerDataQuestion(input: string, data: LifeHubData): AIQueryAnswer | null {
  const lower = input.toLowerCase().trim();
  const isQuestion =
    lower.endsWith('?') ||
    /^(how much|what|berapa|total|show me|list|summary|cek|check|how many)\b/.test(lower);

  if (!isQuestion) return null;

  const activeTx = data.transactions.filter((t) => !t.deleted_at);
  const activeTasks = data.tasks.filter((t) => !t.deleted_at && !t.parent_task_id);
  const activeWallets = data.wallets.filter((w) => !w.deleted_at);
  const activeCats = data.categories.filter((c) => !c.deleted_at);

  // 1. Wallet balance query
  if (/\b(balance|saldo|left in|uang di)\b/.test(lower)) {
    const matchedWallet = findMatchingWallet(lower, activeWallets);
    const calcBalance = (walletId: string, starting: number) => {
      let bal = starting;
      for (const tx of activeTx) {
        if (tx.type === 'income' && tx.wallet_id === walletId) bal += tx.amount;
        else if (tx.type === 'expense' && tx.wallet_id === walletId) bal -= tx.amount;
        else if (tx.type === 'transfer') {
          if (tx.wallet_id === walletId) bal -= tx.amount;
          if (tx.destination_wallet_id === walletId) bal += tx.amount;
        }
      }
      return bal;
    };

    if (matchedWallet) {
      const bal = calcBalance(matchedWallet.id, matchedWallet.starting_balance);
      return {
        kind: 'answer',
        answer: `${matchedWallet.name} currently has ${formatIDR(bal)}.`,
      };
    }

    const details = activeWallets.map((w) => `${w.name}: ${formatIDR(calcBalance(w.id, w.starting_balance))}`);
    const total = activeWallets.reduce((sum, w) => sum + calcBalance(w.id, w.starting_balance), 0);
    return {
      kind: 'answer',
      answer: `Total balance across ${activeWallets.length} wallets is ${formatIDR(total)}.`,
      details,
    };
  }

  // 2. Tasks / overdue query
  if (/\b(task|tasks|todo|to-do|overdue|tugas)\b/.test(lower)) {
    const today = getLocalDateString();
    const open = activeTasks.filter((t) => t.status === 'todo');
    const overdue = open.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now());
    const dueToday = open.filter((t) => t.due_at && t.due_at.slice(0, 10) === today);

    return {
      kind: 'answer',
      answer: `You have ${open.length} open task${open.length === 1 ? '' : 's'} (${overdue.length} overdue, ${dueToday.length} due today).`,
      details: open.slice(0, 6).map((t) => `• ${t.title} (${t.priority})`),
    };
  }

  // 3. Spending / Budget query (e.g. "how much did I spend on food in November?")
  if (/\b(spend|spent|spending|expense|expenses|budget|pengeluaran|keluar|income|earned|pemasukan)\b/.test(lower)) {
    const isIncome = /\b(income|earned|pemasukan|gaji)\b/.test(lower);
    const currentMonth = getLocalMonthString();
    const currentYear = Number(currentMonth.slice(0, 4));

    let targetMonth = currentMonth;
    let monthLabel = 'this month';

    for (const [mName, mNum] of Object.entries(MONTH_MAP)) {
      if (new RegExp(`\\b${mName}\\b`, 'i').test(lower)) {
        targetMonth = `${currentYear}-${String(mNum).padStart(2, '0')}`;
        monthLabel = mName.charAt(0).toUpperCase() + mName.slice(1);
        break;
      }
    }

    const matchedCat = findMatchingCategory(lower, activeCats, isIncome ? 'income' : 'expense');
    const matchedWallet = findMatchingWallet(lower, activeWallets);

    const filtered = activeTx.filter((tx) => {
      if (tx.type !== (isIncome ? 'income' : 'expense')) return false;
      if (!tx.date.startsWith(targetMonth)) return false;
      if (matchedCat && tx.category_id !== matchedCat.id) return false;
      if (matchedWallet && tx.wallet_id !== matchedWallet.id) return false;
      return true;
    });

    const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);

    // Check if asking about budget remaining
    if (/\b(budget|left|remaining|sisa)\b/.test(lower) && matchedCat) {
      const budget = data.budgets.find(
        (b) => !b.deleted_at && b.category_id === matchedCat.id && b.month === targetMonth
      );
      if (budget) {
        const left = budget.amount - total;
        const pct = budget.amount > 0 ? Math.round((total / budget.amount) * 100) : 0;
        return {
          kind: 'answer',
          answer:
            left >= 0
              ? `You have ${formatIDR(left)} left in your ${matchedCat.name} budget for ${monthLabel} (${formatIDR(total)} of ${formatIDR(budget.amount)}, ${pct}%).`
              : `You are over your ${matchedCat.name} budget for ${monthLabel} by ${formatIDR(Math.abs(left))} (${formatIDR(total)} of ${formatIDR(budget.amount)}, ${pct}%).`,
        };
      }
    }

    const scopeParts = [
      matchedCat ? `on ${matchedCat.name}` : '',
      matchedWallet ? `via ${matchedWallet.name}` : '',
      `in ${monthLabel}`,
    ].filter(Boolean);

    const details = filtered
      .slice(0, 5)
      .map((tx) => `• ${tx.date}: ${formatIDR(tx.amount)} — ${tx.merchant || tx.note || 'Transaction'}`);

    return {
      kind: 'answer',
      answer: `You ${isIncome ? 'received' : 'spent'} ${formatIDR(total)} ${scopeParts.join(' ')} (${filtered.length} transaction${filtered.length === 1 ? '' : 's'}).`,
      details: details.length > 0 ? details : undefined,
    };
  }

  // 4. Mood / Journal query
  if (/\b(mood|journal|feeling|reflections)\b/.test(lower)) {
    const journals = data.notes
      .filter((n) => !n.deleted_at && n.type === 'journal' && n.mood)
      .sort((a, b) => (b.journal_date || '').localeCompare(a.journal_date || ''))
      .slice(0, 7);
    if (journals.length === 0) {
      return { kind: 'answer', answer: 'No journal entries with mood ratings recorded yet.' };
    }
    const avg = (journals.reduce((s, j) => s + (j.mood || 0), 0) / journals.length).toFixed(1);
    return {
      kind: 'answer',
      answer: `Your average mood over the last ${journals.length} journal entries is ${avg} / 5.`,
      details: journals.map((j) => `• ${j.journal_date}: ${j.mood}/5 ${j.mood_reason ? `— ${j.mood_reason}` : ''}`),
    };
  }

  return {
    kind: 'answer',
    answer:
      'I can answer read-only questions about your spending, budgets, wallet balances, tasks, and mood (e.g., "How much did I spend on food in November?"). To record an item, type a statement like "spent 50k on lunch with GoPay".',
  };
}

/**
 * Parses a single line of natural language into either:
 * - A read-only answer to a data question
 * - A pre-filled Draft Task, Draft Transaction, or Draft Note (with uncertainFields flagged!)
 * Never mutates data directly.
 */
export function parseNaturalLanguage(input: string, data: LifeHubData): AIParseResult {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check read-only Q&A first
  const qa = answerDataQuestion(trimmed, data);
  if (qa) return qa;

  const activeWallets = data.wallets.filter((w) => !w.deleted_at);
  const activeCats = data.categories.filter((c) => !c.deleted_at);
  const parsedDate = parseDateFromText(trimmed);

  // 2. Detect explicit Note intent
  if (/^(note:|note\b|catatan:?|write down|jot down|remember that)/i.test(trimmed)) {
    const body = trimmed.replace(/^(note:|note\b|catatan:?|write down|jot down|remember that)\s*/i, '').trim();
    const firstSentence = body.split(/[.!\n]/)[0]?.trim() || 'Quick note';
    return {
      kind: 'note',
      title: firstSentence.slice(0, 60),
      body: body || trimmed,
      uncertainFields: body ? [] : ['body'],
    };
  }

  // 3. Detect Task / Reminder intent
  const isTaskIntent =
    /^(remind me|todo:?|to-do:?|task:?|don'?t forget|need to|have to|must|schedule|ingatkan)\b/i.test(trimmed) ||
    /\b(remind me|deadline|due\s+(today|tomorrow|on)|every (day|week|month))\b/i.test(lower);

  const amount = extractIDRAmountFromText(trimmed);
  const isMoneyIntent =
    amount !== null ||
    /\b(spent|spend|paid|payed|bought|bayar|beli|keluar|jajan|received|earned|got paid|gaji|income|transfer|topup|top-up)\b/i.test(lower);

  // "remind me to pay rent on the 1st" is a TASK even though it mentions "pay"!
  if (isTaskIntent && !/^(spent|bought|paid|received|earned)\b/i.test(trimmed)) {
    let title = trimmed
      .replace(/^(remind me to|remind me|ingatkan saya untuk|ingatkan|todo:?|to-do:?|task:?|don'?t forget to|need to|have to)\s+/i, '')
      .replace(/\s+(on the \d{1,2}(?:st|nd|rd|th)?|tomorrow|today|besok|hari ini|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*$/i, '')
      .trim();

    if (title) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    let priority: Priority = 'medium';
    if (/\b(urgent|asap|important|high priority|penting)\b/i.test(lower)) priority = 'high';
    if (/\b(low priority|whenever|someday)\b/i.test(lower)) priority = 'low';

    const due_at = parsedDate.explicit
      ? localDateTimeToUtcIso(parsedDate.date, parsedDate.time)
      : null;

    const uncertainFields: string[] = [];
    if (!title) uncertainFields.push('title');
    if (!due_at) uncertainFields.push('due_at');

    return {
      kind: 'task',
      title: title || trimmed,
      due_at,
      reminder_minutes_before: /\b(remind|ingatkan)\b/i.test(lower) ? 15 : null,
      priority,
      notes: '',
      uncertainFields,
    };
  }

  // 4. Expense / Income / Transfer intent
  if (isMoneyIntent) {
    const isIncome = /\b(received|earned|got paid|salary|gaji|income|masuk|freelance payment|terima)\b/i.test(lower);
    const isTransfer = /\b(transfer|topup|top-up|top up|move money)\b/i.test(lower);
    const type = isTransfer ? 'transfer' : isIncome ? 'income' : 'expense';

    const matchedWallet = findMatchingWallet(trimmed, activeWallets);
    const matchedCategory =
      type === 'transfer' ? null : findMatchingCategory(trimmed, activeCats, type);

    // Clean note / merchant extraction
    let cleanedNote = trimmed
      .replace(/^(spent|spend|paid|bought|bayar|beli|received|earned|got|income|expense)\s+/i, '')
      .replace(/(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)\b/gi, '')
      .replace(/rp\.?\s*\d{1,3}(?:[.,]\d{3})+/gi, '')
      .replace(/\b(on|for|with|using|via|pakai|dengan|dari|ke|today|yesterday|tomorrow)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (matchedWallet) {
      const wToken = matchedWallet.name.replace(/\([^)]*\)/g, '').trim();
      cleanedNote = cleanedNote.replace(new RegExp(`\\b${wToken}\\b`, 'gi'), '').trim();
    }

    const merchant = cleanedNote
      ? cleanedNote.charAt(0).toUpperCase() + cleanedNote.slice(1)
      : '';

    const uncertainFields: string[] = [];
    if (amount === null) uncertainFields.push('amount');
    if (type !== 'transfer' && !matchedCategory) uncertainFields.push('category_id');
    if (!matchedWallet) uncertainFields.push('wallet_id');

    return {
      kind: 'transaction',
      type,
      amount,
      category_id: matchedCategory?.id || null,
      wallet_id: matchedWallet?.id || null,
      date: parsedDate.date,
      merchant,
      note: trimmed,
      uncertainFields,
    };
  }

  // 5. Fallback: treat short actionable phrase as Task, longer paragraph as Note
  if (trimmed.length > 80 || trimmed.includes('\n')) {
    return {
      kind: 'note',
      title: trimmed.split('\n')[0].slice(0, 60),
      body: trimmed,
      uncertainFields: [],
    };
  }

  return {
    kind: 'task',
    title: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    due_at: parsedDate.explicit ? localDateTimeToUtcIso(parsedDate.date, parsedDate.time) : null,
    reminder_minutes_before: null,
    priority: 'medium',
    notes: '',
    uncertainFields: parsedDate.explicit ? [] : ['due_at'],
  };
}
