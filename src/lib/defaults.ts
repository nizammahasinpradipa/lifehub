import type { LifeHubData } from '../types/models';
import { addDaysToDateString, DEFAULT_TIMEZONE, getLocalDateString, getLocalMonthString, localDateTimeToUtcIso } from './dates';

export const DEFAULT_USER_ID = 'owner-local';

export function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createInitialData(): LifeHubData {
  // Epoch timestamp for untouched starter records so a fresh device NEVER overwrites edits from another device during merge
  const seedTs = '1970-01-01T00:00:00.000Z';

  const wallets = [
    {
      id: 'wal_cash',
      user_id: DEFAULT_USER_ID,
      name: 'Cash',
      type: 'cash' as const,
      starting_balance: 0,
      created_at: seedTs,
      updated_at: seedTs,
      deleted_at: null,
    },
    {
      id: 'wal_bank',
      user_id: DEFAULT_USER_ID,
      name: 'Bank (BCA)',
      type: 'bank' as const,
      starting_balance: 0,
      created_at: seedTs,
      updated_at: seedTs,
      deleted_at: null,
    },
    {
      id: 'wal_gopay',
      user_id: DEFAULT_USER_ID,
      name: 'GoPay',
      type: 'e-wallet' as const,
      starting_balance: 0,
      created_at: seedTs,
      updated_at: seedTs,
      deleted_at: null,
    },
  ];

  const categories = [
    { id: 'cat_food', name: 'Food', kind: 'expense' as const, icon: 'utensils', color: '#233E1E' },
    { id: 'cat_transport', name: 'Transport', kind: 'expense' as const, icon: 'car', color: '#709446' },
    { id: 'cat_bills', name: 'Bills', kind: 'expense' as const, icon: 'zap', color: '#E59A38' },
    { id: 'cat_shopping', name: 'Shopping', kind: 'expense' as const, icon: 'shopping-bag', color: '#C3834C' },
    { id: 'cat_health', name: 'Health', kind: 'expense' as const, icon: 'heart', color: '#B94E48' },
    { id: 'cat_other', name: 'Other', kind: 'expense' as const, icon: 'circle-dot', color: '#6B6E5C' },
    { id: 'cat_salary', name: 'Salary', kind: 'income' as const, icon: 'briefcase', color: '#233E1E' },
    { id: 'cat_freelance', name: 'Freelance', kind: 'income' as const, icon: 'laptop', color: '#709446' },
    { id: 'cat_income_other', name: 'Other Income', kind: 'income' as const, icon: 'plus-circle', color: '#6B6E5C' },
  ].map((c) => ({
    ...c,
    user_id: DEFAULT_USER_ID,
    created_at: seedTs,
    updated_at: seedTs,
    deleted_at: null,
  }));

  const projects = [
    {
      id: 'proj_personal',
      user_id: DEFAULT_USER_ID,
      name: 'Personal',
      color: '#0F766E',
      created_at: seedTs,
      updated_at: seedTs,
      deleted_at: null,
    },
    {
      id: 'proj_work',
      user_id: DEFAULT_USER_ID,
      name: 'Work',
      color: '#2563EB',
      created_at: seedTs,
      updated_at: seedTs,
      deleted_at: null,
    },
  ];

  return {
    version: 1,
    user: {
      id: DEFAULT_USER_ID,
      user_id: DEFAULT_USER_ID,
      email: 'owner@lifehub.local',
      display_name: 'Owner',
      timezone: DEFAULT_TIMEZONE,
      created_at: seedTs,
      updated_at: seedTs,
      deleted_at: null,
    },
    projects,
    tasks: [],
    wallets,
    categories,
    transactions: [],
    budgets: [],
    notes: [],
    tags: [],
    tagAssignments: [],
    links: [],
    socialLinks: [],
    preferences: {
      theme: 'system',
      default_wallet_id: 'wal_gopay',
      default_category_id: 'cat_food',
      notifications_enabled: false,
    },
    security: null,
  };
}

/**
 * Optional sample data generator (user-triggered from Settings or empty state)
 * so the owner can test charts, budgets, subtasks, mood history, and links in one click.
 */
export function createSampleData(): LifeHubData {
  const base = createInitialData();
  const now = new Date().toISOString();
  const today = getLocalDateString();
  const month = getLocalMonthString();

  base.wallets[0].starting_balance = 500_000;
  base.wallets[1].starting_balance = 8_500_000;
  base.wallets[2].starting_balance = 650_000;

  const t1Id = uid('tsk');
  const t2Id = uid('tsk');
  const t3Id = uid('tsk');
  const tx1Id = uid('tx');
  const tx2Id = uid('tx');
  const note1Id = uid('nte');

  base.tasks = [
    {
      id: t1Id,
      user_id: DEFAULT_USER_ID,
      title: 'Review monthly electricity & Wi-Fi bills',
      notes: 'Check PLN token and IndiHome bill before due date.',
      due_at: localDateTimeToUtcIso(today, '18:00'),
      reminder_minutes_before: 30,
      reminder_fired_at: null,
      priority: 'high',
      status: 'todo',
      completed_at: null,
      parent_task_id: null,
      project_id: 'proj_personal',
      recurrence: 'monthly',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: uid('tsk'),
      user_id: DEFAULT_USER_ID,
      title: 'Check PLN meter balance',
      notes: '',
      due_at: null,
      reminder_minutes_before: null,
      reminder_fired_at: null,
      priority: 'medium',
      status: 'done',
      completed_at: now,
      parent_task_id: t1Id,
      project_id: 'proj_personal',
      recurrence: 'none',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: uid('tsk'),
      user_id: DEFAULT_USER_ID,
      title: 'Pay internet invoice via BCA',
      notes: '',
      due_at: null,
      reminder_minutes_before: null,
      reminder_fired_at: null,
      priority: 'medium',
      status: 'todo',
      completed_at: null,
      parent_task_id: t1Id,
      project_id: 'proj_personal',
      recurrence: 'none',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: t2Id,
      user_id: DEFAULT_USER_ID,
      title: 'Buy groceries for the week',
      notes: 'Eggs, oat milk, chicken breast, vegetables',
      due_at: localDateTimeToUtcIso(addDaysToDateString(today, 1), '10:00'),
      reminder_minutes_before: 15,
      reminder_fired_at: null,
      priority: 'medium',
      status: 'todo',
      completed_at: null,
      parent_task_id: null,
      project_id: 'proj_personal',
      recurrence: 'weekly',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: t3Id,
      user_id: DEFAULT_USER_ID,
      title: 'Send weekly progress update',
      notes: '',
      due_at: localDateTimeToUtcIso(addDaysToDateString(today, -1), '17:00'),
      reminder_minutes_before: null,
      reminder_fired_at: null,
      priority: 'high',
      status: 'todo',
      completed_at: null,
      parent_task_id: null,
      project_id: 'proj_work',
      recurrence: 'none',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ];

  base.transactions = [
    {
      id: tx1Id,
      user_id: DEFAULT_USER_ID,
      amount: 48_000,
      type: 'expense',
      date: today,
      wallet_id: 'wal_gopay',
      destination_wallet_id: null,
      category_id: 'cat_food',
      merchant: 'Warung Kopi & Nasi',
      note: 'Lunch and iced americano',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: tx2Id,
      user_id: DEFAULT_USER_ID,
      amount: 32_000,
      type: 'expense',
      date: addDaysToDateString(today, -1),
      wallet_id: 'wal_gopay',
      destination_wallet_id: null,
      category_id: 'cat_transport',
      merchant: 'Gojek',
      note: 'Commute to city center',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: uid('tx'),
      user_id: DEFAULT_USER_ID,
      amount: 420_000,
      type: 'expense',
      date: addDaysToDateString(today, -3),
      wallet_id: 'wal_bank',
      destination_wallet_id: null,
      category_id: 'cat_bills',
      merchant: 'PLN & Wi-Fi',
      note: 'Monthly home utilities',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: uid('tx'),
      user_id: DEFAULT_USER_ID,
      amount: 1_250_000,
      type: 'expense',
      date: addDaysToDateString(today, -5),
      wallet_id: 'wal_bank',
      destination_wallet_id: null,
      category_id: 'cat_food',
      merchant: 'Superindo',
      note: 'Monthly pantry & groceries',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: uid('tx'),
      user_id: DEFAULT_USER_ID,
      amount: 500_000,
      type: 'transfer',
      date: addDaysToDateString(today, -2),
      wallet_id: 'wal_bank',
      destination_wallet_id: 'wal_gopay',
      category_id: null,
      merchant: 'Top-up',
      note: 'Top-up GoPay from BCA',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ];

  base.budgets = [
    {
      id: uid('bdg'),
      user_id: DEFAULT_USER_ID,
      category_id: 'cat_food',
      month,
      amount: 1_500_000,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: uid('bdg'),
      user_id: DEFAULT_USER_ID,
      category_id: 'cat_transport',
      month,
      amount: 500_000,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: uid('bdg'),
      user_id: DEFAULT_USER_ID,
      category_id: 'cat_bills',
      month,
      amount: 750_000,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ];

  const moods: Array<{ offset: number; mood: 1 | 2 | 3 | 4 | 5; reason: string; body: string }> = [
    { offset: -5, mood: 4, reason: 'Productive morning session', body: 'Wrapped up deep work early and walked outside in the evening.' },
    { offset: -4, mood: 3, reason: 'Busy afternoon errands', body: 'Rainy traffic in Jakarta slowed down errands, kept spending under control.' },
    { offset: -3, mood: 4, reason: 'Sorted monthly bills', body: 'Paid home utilities and organized upcoming tasks for the week.' },
    { offset: -2, mood: 5, reason: 'Great coffee and focus', body: 'Cleared my entire task list before 5 PM and cooked dinner at home.' },
    { offset: -1, mood: 4, reason: 'Steady pace', body: 'Good energy overall. Need to finish weekly update first thing tomorrow.' },
  ];

  base.notes = [
    {
      id: note1Id,
      user_id: DEFAULT_USER_ID,
      type: 'note',
      title: 'Monthly Utilities Checklist',
      body: 'PLN token target: Rp 250.000/month\nWi-Fi due date: 20th of every month\nKeep receipts linked to transactions.',
      journal_date: null,
      mood: null,
      mood_reason: '',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    ...moods.map((m) => ({
      id: uid('jrn'),
      user_id: DEFAULT_USER_ID,
      type: 'journal' as const,
      title: '',
      body: m.body,
      journal_date: addDaysToDateString(today, m.offset),
      mood: m.mood,
      mood_reason: m.reason,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })),
  ];

  const tagHome = {
    id: 'tag_home',
    user_id: DEFAULT_USER_ID,
    name: 'home',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const tagFinance = {
    id: 'tag_finance',
    user_id: DEFAULT_USER_ID,
    name: 'finance',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  base.tags = [tagHome, tagFinance];

  base.tagAssignments = [
    { id: uid('ta'), user_id: DEFAULT_USER_ID, tag_id: tagHome.id, item_type: 'task', item_id: t1Id, created_at: now, updated_at: now, deleted_at: null },
    { id: uid('ta'), user_id: DEFAULT_USER_ID, tag_id: tagFinance.id, item_type: 'note', item_id: note1Id, created_at: now, updated_at: now, deleted_at: null },
  ];

  base.links = [
    {
      id: uid('lnk'),
      user_id: DEFAULT_USER_ID,
      from_type: 'note',
      from_id: note1Id,
      to_type: 'task',
      to_id: t1Id,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ];

  return base;
}
