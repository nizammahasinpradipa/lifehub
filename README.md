# LifeHub

All-in-one personal workspace for **Tasks**, **Indonesian Rupiah (IDR) Expense Tracking & Budgets**, **Plain-Text Notes & Daily Journal**, **Cross-Module Links**, and **Natural-Language Quick Input** — built to run on both **PC and Android** with rock-solid auto-saving.

## How Data Is Saved (Never Disappears on Close/Reopen)

1. **Instant Local Auto-Save (PC & Android, works offline):** Every change is written immediately to **IndexedDB** and mirrored to **localStorage**. Closing the browser, closing the installed app, or restarting your device keeps all data intact.
2. **Built-in PC ↔ Android Wi-Fi Sync (`server.mjs`):** When running `npm start`, LifeHub also persists every change atomically to `data/lifehub-db.json` on disk and pushes live updates to any PC or Android device on the same Wi-Fi network.
3. **Optional Supabase Cloud Sync:** Connect your own Supabase project in **Settings & Sync** (using `supabase/schema.sql`) to sync PC and Android from anywhere over mobile data.

## Quick Start (PC & Android)

```bash
npm install
npm run build
npm start
```

- **On PC:** Open `http://localhost:3000` (you can also click **Install** in Chrome/Edge to run it as a standalone desktop app).
- **On Android (same Wi-Fi):** Open the LAN URL printed in your terminal (e.g. `http://192.168.x.x:3000`) in Chrome, tap the menu (**⋮**) → **Install app / Add to Home Screen**.

## Optional: Build a Native Android APK (Capacitor)

`capacitor.config.ts` is pre-configured:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
