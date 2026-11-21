export type ItemType = 'task' | 'transaction' | 'note';
export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'done';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type WalletType = 'cash' | 'bank' | 'e-wallet';
export type CategoryKind = 'expense' | 'income';
export type TransactionType = 'expense' | 'income' | 'transfer';
export type NoteType = 'note' | 'journal';
export type MoodRating = 1 | 2 | 3 | 4 | 5;
export type ThemePreference = 'system' | 'light' | 'dark';
export type NavTab = 'home' | 'tasks' | 'spending' | 'notes' | 'settings';

export interface BaseEntity {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserProfile extends BaseEntity {
  email: string;
  display_name: string;
  timezone: string; // default 'Asia/Jakarta'
}

export interface Project extends BaseEntity {
  name: string;
  color: string;
}

export interface Task extends BaseEntity {
  title: string;
  notes: string;
  due_at: string | null; // UTC ISO timestamp
  reminder_minutes_before: number | null; // e.g. 0, 15, 30, 60
  reminder_fired_at: string | null;
  priority: Priority;
  status: TaskStatus;
  completed_at: string | null;
  parent_task_id: string | null;
  project_id: string | null;
  recurrence: Recurrence;
}

export interface Wallet extends BaseEntity {
  name: string;
  type: WalletType;
  starting_balance: number; // integer IDR
}

export interface Category extends BaseEntity {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
}

export interface Transaction extends BaseEntity {
  amount: number; // integer IDR rupiah
  type: TransactionType;
  date: string; // YYYY-MM-DD in Asia/Jakarta
  wallet_id: string;
  destination_wallet_id: string | null;
  category_id: string | null;
  note: string;
  merchant: string;
}

export interface Budget extends BaseEntity {
  category_id: string;
  month: string; // YYYY-MM
  amount: number; // integer IDR rupiah
}

export interface Note extends BaseEntity {
  type: NoteType;
  title: string;
  body: string;
  journal_date: string | null; // YYYY-MM-DD, unique per user for journal
  mood: MoodRating | null;
  mood_reason: string;
}

export interface Tag extends BaseEntity {
  name: string;
}

export interface TagAssignment extends BaseEntity {
  tag_id: string;
  item_type: ItemType;
  item_id: string;
}

export interface ItemLink extends BaseEntity {
  from_type: ItemType;
  from_id: string;
  to_type: ItemType;
  to_id: string;
}

export interface AppPreferences {
  theme: ThemePreference;
  default_wallet_id: string | null;
  default_category_id: string | null;
  notifications_enabled: boolean;
}

export interface LifeHubData {
  version: number;
  user: UserProfile;
  projects: Project[];
  tasks: Task[];
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  notes: Note[];
  tags: Tag[];
  tagAssignments: TagAssignment[];
  links: ItemLink[];
  preferences: AppPreferences;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SyncStatus {
  state: 'saved' | 'syncing' | 'synced-lan' | 'synced-cloud' | 'offline';
  lastSavedAt: string | null;
  lastSyncedAt: string | null;
  lanConnected: boolean;
  cloudUserEmail: string | null;
  error: string | null;
}

export interface AIDraftTask {
  kind: 'task';
  title: string;
  due_at: string | null;
  reminder_minutes_before: number | null;
  priority: Priority;
  notes: string;
  uncertainFields: string[];
}

export interface AIDraftTransaction {
  kind: 'transaction';
  type: TransactionType;
  amount: number | null;
  category_id: string | null;
  wallet_id: string | null;
  date: string;
  merchant: string;
  note: string;
  uncertainFields: string[];
}

export interface AIDraftNote {
  kind: 'note';
  title: string;
  body: string;
  uncertainFields: string[];
}

export type AIDraft = AIDraftTask | AIDraftTransaction | AIDraftNote;
