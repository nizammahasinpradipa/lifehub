# PRD: All-in-One Personal App (Working Title: LifeHub)

Nov 21, 2026 · @dippa

## Overview

LifeHub (working title) is one personal app that replaces separate to-do, expense and journal apps with a single account, one search and one daily dashboard, on mobile and web.

**Problem.** Daily life is tracked in three or more apps that do not talk to each other. A purchase, the task behind it and the note about it end up in different places, and checking "how is my day going" means opening each app in turn.

**Vision.** Capture anything in under 10 seconds, then see tasks, spending and reflections together in one calm, minimal interface.

**Product summary**

- **Audience:** a single owner-user (personal project); no sharing or collaboration in v1.
- **Platforms:** mobile app and web app, synced through a cloud account.
- **Modules:** Tasks, Expense Tracker, Notes and Daily Journal.
- **Connected features:** home dashboard, links between items, and an AI assistant for natural-language input.
- **Locale:** English interface, Indonesian rupiah (IDR) as the only currency.
- **Build approach:** solo build with AI coding help, no fixed deadline, delivered in phases.

## Goals and non-goals

The first working version must make daily capture fast and keep phone and web in sync; everything else is secondary.

**Goals**

- Add a task, expense or note in under 10 seconds from the home screen.
- Show one daily view: today's tasks, spending against budget, and today's journal entry.
- Sync changes between phone and web within a few seconds while online.
- Deliver task reminders reliably on mobile.
- Keep the interface minimal: one primary action per screen.

**Non-goals (not in v1)**

- Sharing, shared budgets or any multi-user collaboration.
- Automatic bank or e-wallet syncing.
- Multiple currencies; IDR only.
- Rich text editing in notes (plain text first).
- Recurring tasks (planned after the core is stable; see the roadmap).
- Full offline-first editing. Cloud is the source of truth; a read-only cache is optional.

## Target user and use cases

The only user in v1 is the owner: one person in Indonesia who manages daily tasks, pays with cash, bank accounts and e-wallets, and wants a single place to plan, spend and reflect.

| # | Use case | Module |
| --- | --- | --- |
| U1 | Plan the day: list today's tasks by priority and tick them off | Tasks |
| U2 | Log lunch money in seconds right after paying | Expenses |
| U3 | Check how much of this month's food budget is left | Expenses |
| U4 | Write a short end-of-day journal entry and record my mood | Notes |
| U5 | Find an old note or task by keyword or tag | All |
| U6 | Link a note to the task or purchase it relates to | All |
| U7 | Type "spent 50k on lunch with GoPay" and have it recorded | AI assistant |

## Tasks module

Tasks let the owner capture, organize and finish work with the least possible friction. Phase numbers refer to the roadmap.

| ID | Requirement | Phase |
| --- | --- | --- |
| T1 | Create a task with a title in one step (quick-add). | 1 |
| T2 | Edit, complete, reopen and delete a task. | 1 |
| T3 | Set an optional due date and time. | 1 |
| T4 | Send a reminder notification at a chosen time before the due date. | 2 |
| T5 | Priority levels: low, medium, high. | 2 |
| T6 | Subtasks under a task, with progress shown on the parent (for example 2 of 5). | 2 |
| T7 | Projects (lists) to group tasks; a task belongs to at most one project. | 2 |
| T8 | Tags: several per task, shared with notes and expenses. | 2 |
| T9 | Views: Today, Upcoming, Overdue, by project, by tag. | 2 |
| T10 | Recurring tasks (daily, weekly, monthly). | 4 |

**User stories**

- As the owner, I add a task in one tap so I never lose a thought.
- As the owner, I see only today's and overdue tasks by default so the list stays short.
- As the owner, I get a reminder on my phone so I do not miss a deadline.

**Acceptance criteria**

- A new task appears in the list within 1 second and on the other device within 5 seconds.
- Completing the last subtask does not auto-complete the parent; the app asks first.
- Overdue tasks are visibly marked and sorted above today's tasks.
- A reminder fires within 1 minute of its set time on mobile.

## Expense tracker module

The tracker answers two questions fast: where did my money go, and how much of this month's budget is left. All amounts are IDR, stored as whole rupiah.

| ID | Requirement | Phase |
| --- | --- | --- |
| E1 | Log an expense or income with amount, date, category and optional note. | 1 |
| E2 | Default categories (food, transport, bills, shopping, health, other) plus custom categories. | 1 |
| E3 | Multiple wallets (cash, bank, e-wallet); every transaction belongs to one wallet and each wallet shows its balance. | 1 |
| E4 | Transfer between wallets without counting it as spending. | 2 |
| E5 | Monthly budget per category with a progress bar and an alert at 80% and 100%. | 2 |
| E6 | Reports: spending by category, by wallet, and month-over-month trend, as charts. | 2 |
| E7 | Edit and delete transactions; balances and reports update immediately. | 1 |
| E8 | Receipt scan: photo of a receipt fills amount, date and merchant for review. | 3 |
| E9 | Natural-language entry through the AI assistant (see cross-module features). | 3 |
| E10 | Export transactions to CSV. | 4 |

**User stories**

- As the owner, I log a purchase right after paying, with a default wallet and today's date prefilled.
- As the owner, I see budget progress per category so I can slow down before overspending.
- As the owner, I scan a receipt and only confirm the result instead of typing it.

**Acceptance criteria**

- Logging an expense takes no more than 3 taps after opening the quick-add screen.
- Wallet balance equals starting balance plus income minus expenses plus net transfers.
- A receipt scan never saves automatically; the owner reviews and confirms first.
- Deleting a category with transactions asks the owner to reassign them.

## Notes and daily journal module

Notes hold free-form text; the journal is a date-based entry with a mood rating. Both are plain text in v1.

| ID | Requirement | Phase |
| --- | --- | --- |
| N1 | Create, edit and delete a plain-text note with a title and body. | 1 |
| N2 | Daily journal: one entry per date, opened from today's date by default. | 2 |
| N3 | Mood rating on each journal entry, on a 5-point scale, with an optional one-line reason. | 2 |
| N4 | Mood history view: a chart of mood over the last 30 days. | 2 |
| N5 | Tags on notes, shared with tasks and expenses. | 2 |
| N6 | Search by keyword across note titles and bodies, filterable by tag and date. | 2 |
| N7 | Link a note to a task or transaction (see cross-module features). | 3 |
| N8 | Rich text (bold, lists, checklists) in notes. | 4 |

**Acceptance criteria**

- Opening the journal on a new day shows an empty entry for that date, not yesterday's.
- Search returns results as the owner types, in under 1 second for up to 5,000 notes.
- Editing is auto-saved; closing the app mid-edit does not lose text.

## Cross-module features

These features are what make LifeHub more than three apps in one shell. All arrive in Phase 3, after the modules are stable.

**Home dashboard (X1)**

- Today's tasks and overdue count.
- This month's spending against total budget, and the top three categories.
- Today's journal entry status and the last 7 days of mood.
- A global quick-add button for task, expense or note.
- A global search box that covers all three modules.

**Links between items (X2)**

- Attach a note to a task or a transaction, and see the links from both sides (for example, a note about a trip linked to its expenses).
- A linked item shows as a small chip; tapping it opens the item.
- Deleting an item removes its links but never the other item.

**AI assistant (X3)**

- Accepts one line of free text, such as "spent 50k on lunch with GoPay" or "remind me to pay rent on the 1st".
- Returns a draft task, expense or note as a pre-filled form; nothing is saved until the owner confirms.
- Can answer simple questions over the owner's data, such as "how much did I spend on food in November?", using read-only access.
- Never deletes or edits existing data, and does not give financial advice.
- Understands amounts written as "50k", "50rb" and "1.5jt" and defaults dates to today.

**Acceptance criteria**

- At least 9 of 10 test sentences produce a correct draft (amount, category, wallet, date).
- If the assistant is unsure of a field, it leaves it blank and highlights it instead of guessing.

## Data model

Eleven entities cover every v1 feature. Every record also carries `user_id`, `created_at`, `updated_at` and `deleted_at` (soft delete, so deletions sync across devices).

| Entity | Key fields | Relationships |
| --- | --- | --- |
| User | email, display name, time zone (default Asia/Jakarta) | Owns all other records |
| Project | name, color | Has many Tasks |
| Task | title, notes, due\_at, priority, status, completed\_at, parent\_task\_id | Belongs to one Project; has many subtasks (self-reference) |
| Wallet | name, type (cash, bank, e-wallet), starting\_balance | Has many Transactions |
| Category | name, kind (expense or income), icon | Has many Transactions and Budgets |
| Transaction | amount (integer rupiah), type (expense, income, transfer), date, note, merchant | Belongs to one Wallet and one Category; transfers also store a destination wallet |
| Budget | month, amount | Belongs to one Category |
| Note | type (note or journal), title, body, journal\_date, mood (1 to 5), mood\_reason | Journal entries are unique per user and date |
| Tag | name | Applied to Tasks, Notes and Transactions through TagAssignment |
| TagAssignment | tag\_id, item\_type, item\_id | Links one Tag to one item |
| Link | from\_type, from\_id, to\_type, to\_id | Connects any two items across modules |

**Design notes**

- Money is stored as integers; IDR has no practical minor unit, so no decimals.
- Timestamps are stored in UTC and shown in the owner's time zone.
- Wallet balances are calculated from transactions, not stored, so they cannot drift.

## Platform and technical approach

A single shared codebase for mobile and web, backed by a hosted relational database with built-in authentication, keeps a solo build manageable. The stack below is a recommendation, not a requirement.

| Layer | Recommendation | Why |
| --- | --- | --- |
| Client | React Native with Expo for mobile, plus its web export (or Flutter as the alternative) | One codebase for phone and browser; large ecosystem and good AI-assisted coding support |
| Backend | Hosted Postgres with auth and row-level security (for example Supabase) | Relational data suits budgets and reports; per-user data isolation is built in |
| Sync | Realtime subscriptions plus last-write-wins on `updated_at` | Simple and enough for one user on two devices |
| Notifications | Native push on mobile; web push in the browser | Needed for task reminders and budget alerts |
| AI | Hosted LLM API called from a server function, never from the client | Keeps the API key private and lets the server limit what the assistant can read or write |

**Non-functional requirements**

| Area | Requirement |
| --- | --- |
| Performance | Lists open in under 1 second with 10,000 records; app cold start under 3 seconds |
| Sync | Changes appear on the other device within 5 seconds when both are online |
| Security | Email sign-in with a verified address; each user can read only their own rows; all traffic over HTTPS |
| Privacy | Financial and journal data is sensitive: encrypted at rest by the host, no third-party analytics on content, and AI requests send only what the task needs |
| Reliability | Automatic daily backups by the host; CSV export of transactions arrives in Phase 4 |
| Compatibility | Current and previous major versions of Android, iOS and the main desktop browsers |

## UX and design principles

The look is minimal and clean: generous whitespace, one accent color, and no decoration that does not carry information.

- **Capture first.** A persistent add button is on every screen; quick-add opens with the cursor ready.
- **One primary action per screen.** Secondary options sit behind a menu.
- **Navigation.** Mobile uses bottom tabs (Home, Tasks, Spending, Notes); web uses a left sidebar with the same four items.
- **Defaults do the work.** Today's date, last-used wallet and the most likely category are prefilled.
- **Calm feedback.** Soft progress bars and short confirmations; no streak pressure or guilt messages.
- **Light and dark themes**, following the device setting, with readable contrast in both.
- **Empty states** explain the feature in one sentence and offer the first action.
- **Accessibility.** Tap targets of at least 44 px, scalable text, and labels for icon-only buttons.

## Phased roadmap

The build runs in four phases with no fixed dates; each gate must pass before the next phase starts.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

Phase 1 is the smallest version worth using every day, and Phase 2 only starts once it has been used daily for a month.

## Success metrics, risks and open questions

The app succeeds if the owner uses it daily instead of the old apps, so the metrics measure habit and speed rather than growth.

**Success metrics**

| Metric | Target |
| --- | --- |
| Daily use | Opened on at least 25 of 30 days, for 2 months in a row |
| Capture speed | Median time from opening the app to a saved item under 10 seconds |
| Expense logging | At least 90% of spending logged within 24 hours |
| Task reminders | 95% delivered within 1 minute of the set time |
| Replacement | Old to-do, expense and journal apps no longer used |
| AI draft accuracy | At least 9 of 10 test sentences parsed correctly |

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scope creep across three modules and an AI layer | Project never reaches daily use | Ship Phase 1 and use it daily before starting Phase 2 |
| Sync conflicts between phone and web | Lost or duplicated edits | Last-write-wins on `updated_at`, soft deletes, and a conflict test list |
| Reminders unreliable on some devices or browsers | Missed deadlines, loss of trust | Test on real devices early; make reminders a Phase 2 gate |
| AI wrongly records money or tasks | Bad financial data | Always show a draft for confirmation; read-only for existing data |
| Sensitive data exposure | Privacy harm | Row-level security, minimal AI payloads, no content analytics |
| Hosting and AI API costs | Unexpected bills | Set spending caps and rate limits; AI is optional per request |

**Open questions**

- [ ] What is the final app name?
- [ ] Sign-in method: email and password only, or also Google sign-in?
- [ ] Should a read-only offline cache be included in Phase 1 or later?
- [ ] Which AI provider and model, and what monthly budget for it?
- [ ] Should recurring tasks move earlier than Phase 4?
- [ ] Is sharing (for example a shared budget with a partner) wanted after v1?
