# Expense Tracker Web

Separate web project for the expense tracker. This does not modify or replace the mobile Expo app in the repo root.

## What it includes

- Home view with grouped history
- Analytics by category
- Settings view with `EN / GR`
- Budget editing
- Date range filtering
- CSV import and export
- Cloud Sync with Supabase (PostgreSQL)

## What it intentionally skips

- Photo attachments
- Native mobile-only APIs
- App Store / iOS packaging concerns

## Run locally

```bash
cd expense-tracker-web
npm install
npm run dev
```

## Build

```bash
cd expense-tracker-web
npm install
npm run build
```

## Deploy

The simplest path is:

1. Push this folder to GitHub as its own repo, or keep it in this repo and point Vercel to `expense-tracker-web`.
2. In Vercel, set the root directory to `expense-tracker-web`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel settings.

### Supabase Production Setup
After deployment, you must update your Supabase Auth settings:
1. Go to **Authentication > URL Configuration**.
2. Add your Vercel URL to **Site URL** and **Redirect URLs** (e.g., `https://your-app.vercel.app/**`).

## Notes

- Data is primarily stored in Supabase for cross-device sync.
- LocalStorage is used as a fallback for offline sessions.
- CSV import/export is browser-native, which is better suited for web than the mobile file APIs used in the Expo app.
