# Expense Tracker Web

Separate web project for the expense tracker. This does not modify or replace the mobile Expo app in the repo root.

## What it includes

- Home view with grouped history
- Analytics by category
- Settings view with `EN / GR`
- Budget editing
- Date range filtering
- CSV import and export
- Local browser storage

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

## Notes

- Data is stored in browser `localStorage`, so each device keeps its own copy.
- CSV import/export is browser-native, which is better suited for web than the mobile file APIs used in the Expo app.
