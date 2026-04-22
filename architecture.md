# Architecture Map

## Folder Structure
- `public/`
  - `apple-touch-icon.png`
  - `favicon.svg`
  - `site.webmanifest`
- `src/`
  - `App.tsx`
  - `main.tsx`
  - `styles.css`
  - `vite-env.d.ts`
  - `types.ts`
  - `components/`
    - `Header.tsx`
    - `HeatmapLegend.tsx`
  - `views/`
    - `AnalyticsMainView.tsx`
    - `HomeMainView.tsx`
    - `SettingsView.tsx`
  - `config/`
    - `appConstants.ts`
    - `heatmapConstants.ts`
  - `hooks/`
    - `useAnalyticsInsight.ts`
    - `useBudgetPace.ts`
    - `useHorizontalSwipe.ts`
  - `lib/`
    - `csv.ts`
    - `date.ts`
    - `heatmap.ts`
    - `i18n.ts`
    - `media.ts`
    - `storage.ts`
    - `supabase.ts`
- Root config/files
  - `index.html`
  - `package.json`
  - `tsconfig.json`
  - `tsconfig.app.json`
  - `tsconfig.node.json`
  - `vite.config.ts`
  - `README.md`

## Classes
- No classes are defined in the codebase (functional React + utility modules).

## Methods and Functions

### `src/main.tsx`
- `main()` bootstrap via `createRoot(...).render(...)`

### `src/App.tsx`
- `App()`
- `shiftHeatmapMonth(direction)`
- `shiftYearHeatmap(direction)`
- `shiftWeekHeatmap(direction)`
- `openAddExpense(prefillCategory?)`
- `handleFabPointerDown(e)`
- `handleFabPointerUp()`
- `handleFabPointerCancel()`
- `openEditExpense(expense)`
- `closeExpenseModal()`
- `openProjectModal()`
- `openCategoryModal(fromExpense?)`
- `handleSaveExpense(event)`
- `handleExpenseTouchStart(id, clientX)`
- `handleExpenseTouchEnd(id, clientX)`
- `handleDeleteExpense(id)`
- `handleDeleteCategory(id)`
- `handleDeleteCategoryFromSettings(id)`
- `handleDeleteProjectFromSettings(id)`
- `handleAddProject()`
- `handleAddCategory()`
- `handleRenameCategory(id)`
- `handleRenameProject(id)`
- `handleManageInputKeyDown(event, action, cancel?)`
- `handleExportCsv()`
- `handleBulkDelete()`
- `handleImportClick()`
- `handleImportCsv(event)`
- `handleReceiptUpload(event)`
- `handleGoogleSignIn()`
- `handleSignOut()`
- `handleSaveBudget()`
- `handleDeleteReceipt()`

### `src/components/Header.tsx`
- `Header(props)`

### `src/components/HeatmapLegend.tsx`
- `HeatmapLegend(props)`

### `src/views/AnalyticsMainView.tsx`
- `AnalyticsMainView(props)`

### `src/views/HomeMainView.tsx`
- `HomeMainView(props)`

### `src/views/SettingsView.tsx`
- `SettingsView(props)`

### `src/config/appConstants.ts`
- `getBackgroundCss(background)`
- `normalizeAmount(value)`
- `extractFirstEmoji(value)`
- `donutArcPath(cx, cy, innerR, outerR, startDeg, endDeg)`

### `src/config/heatmapConstants.ts`
- Constant exports only (`YEAR_HEATMAP_MONTH_*`)

### `src/hooks/useAnalyticsInsight.ts`
- `useAnalyticsInsights(...)`

### `src/hooks/useBudgetPace.ts`
- `useBudgetPace(metaFilteredExpenses, parsedIncome, parsedYearly, range)`

### `src/hooks/useHorizontalSwipe.ts`
- `useHorizontalSwipe(options)`

### `src/lib/csv.ts`
- `buildCsv(expenses, locale)`
- `downloadCsv(text)`
- `parseCsvRows(csvText)`

### `src/lib/date.ts`
- `toLocalIsoDate(date)`
- `parseIsoDateToLocal(isoDate)`
- `addDaysUtc(date, days)`
- `formatIsoDate(isoDate)`
- `clampFilterRange(fromDate, toDate)`
- `filterExpensesByDateRange(expenses, fromDate, toDate)`
- `getExpensePeriodTotals(expenses)`
- `getHistoryGroups(expenses, range, fromDate, toDate, locale)`
- `getAnalyticsGroups(expenses, range, fromDate, toDate, locale)`

### `src/lib/heatmap.ts`
- `getHeatmapColor(amount, maxAmount)`

### `src/lib/i18n.ts`
- `t(locale, key)`
- `getLocalizedMonthAcc(locale, index)`
- `getLocalizedCategoryName(locale, name)`
- `withDisplayName(locale, categories)`

### `src/lib/media.ts`
- `compressImage(file)`

### `src/lib/storage.ts`
- `loadJson(key, fallback)`
- `saveJson(key, value)`
- `loadExpenses()`
- `saveExpenses(expenses)`
- `loadCategories()`
- `saveCategories(categories)`
- `loadProjects()`
- `saveProjects(projects)`
- `loadIncome()`
- `saveIncome(income)`
- `loadLocale()`
- `saveLocale(locale)`
- `loadRange()`
- `saveRange(range)`
- `loadFilter()`
- `saveFilter(filter)`
- `loadBackground()`
- `saveBackground(background)`
- `loadLastProject()`
- `saveLastProject(project)`

### `src/lib/supabase.ts`
- Supabase client/config exports only (`isSupabaseConfigured`, `supabase`)

### `src/types.ts`
- Type exports only (`Locale`, `TabId`, `Range`, `Category`, `Project`, `Expense`, `ExpenseDraft`, `HistoryGroup`, `AnalyticsGroup`)
