import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import { buildCsv, downloadCsv, parseCsvRows } from './lib/csv';
import {
  filterExpensesByDateRange,
  getAnalyticsGroups,
  getExpensePeriodTotals,
  getHistoryGroups,
  parseIsoDateToLocal,
  toLocalIsoDate,
} from './lib/date';
import { getLocalizedCategoryName, t, withDisplayName } from './lib/i18n';
import {
  loadBackground,
  loadCategories,
  loadExpenses,
  loadFilter,
  loadIncome,
  loadLocale,
  loadRange,
  saveBackground,
  saveCategories,
  saveExpenses,
  saveFilter,
  saveIncome,
  saveLocale,
  saveRange,
  type StoredBackground,
} from './lib/storage';
import type { Category, Expense, Locale, Range, TabId } from './types';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Φαγητό', emoji: '🍔', isDefault: true },
  { id: 'c2', name: 'Supermarket', emoji: '🛒', isDefault: true },
  { id: 'c3', name: 'Καφές', emoji: '☕', isDefault: true },
  { id: 'c4', name: 'Διασκέδαση', emoji: '🍻', isDefault: true },
  { id: 'c5', name: 'Λογαριασμοί', emoji: '💡', isDefault: true },
  { id: 'c6', name: 'Καύσιμα', emoji: '⛽', isDefault: true },
  { id: 'c7', name: 'Διόδια', emoji: '🛣️', isDefault: true },
  { id: 'c8', name: 'Γυμναστήριο', emoji: '🏋️‍♂️', isDefault: true },
  { id: 'c9', name: 'Gaming', emoji: '🎮', isDefault: true },
  { id: 'c10', name: 'Ταξίδια', emoji: '✈️', isDefault: true },
  { id: 'c11', name: 'Ρούχα', emoji: '👕', isDefault: true },
  { id: 'c12', name: 'Φαρμακείο', emoji: '💊', isDefault: true },
  { id: 'c13', name: 'Σπίτι', emoji: '🏠', isDefault: true },
  { id: 'c14', name: 'Μετακινήσεις', emoji: '🚌', isDefault: true },
  { id: 'c15', name: 'Taxi', emoji: '🚕', isDefault: true },
  { id: 'c16', name: 'Συνδρομές', emoji: '📺', isDefault: true },
  { id: 'c17', name: 'Εκπαίδευση', emoji: '📚', isDefault: true },
  { id: 'c18', name: 'Υγεία', emoji: '🩺', isDefault: true },
  { id: 'c19', name: 'Κατοικίδια', emoji: '🐾', isDefault: true },
  { id: 'c20', name: 'Παιδιά', emoji: '🧸', isDefault: true },
  { id: 'c21', name: 'Δώρα', emoji: '🎁', isDefault: true },
  { id: 'c22', name: 'Ηλεκτρονικά', emoji: '💻', isDefault: true },
  { id: 'c23', name: 'Ομορφιά', emoji: '💄', isDefault: true },
  { id: 'c24', name: 'Καθαριστήριο', emoji: '🧺', isDefault: true },
];

const RANGE_OPTIONS: Range[] = ['day', 'week', 'month', 'year'];
const NEW_CATEGORY_VALUE = '__new_category__';

type ExpenseDraft = {
  amount: string;
  category: string;
  emoji: string;
  date: string;
  comment: string;
};

const PRESET_BACKGROUNDS = [
  {
    id: 'default',
    preview: 'linear-gradient(135deg, #0f172a 0%, #050505 55%, #0b1220 100%)',
    css: 'radial-gradient(circle at top left, rgba(10, 132, 255, 0.16), transparent 26%), radial-gradient(circle at top right, rgba(50, 215, 75, 0.12), transparent 22%), #050505',
  },
  {
    id: 'aurora',
    preview: 'linear-gradient(135deg, #07111f 0%, #10263f 45%, #07111f 100%)',
    css: 'radial-gradient(circle at 20% 20%, rgba(90, 200, 250, 0.28), transparent 24%), radial-gradient(circle at 80% 10%, rgba(48, 209, 88, 0.22), transparent 20%), radial-gradient(circle at 50% 100%, rgba(0, 116, 232, 0.22), transparent 30%), #05070b',
  },
  {
    id: 'sunset',
    preview: 'linear-gradient(135deg, #1a0d0b 0%, #3c1c12 45%, #12090a 100%)',
    css: 'radial-gradient(circle at top left, rgba(255, 159, 10, 0.28), transparent 24%), radial-gradient(circle at top right, rgba(255, 69, 58, 0.22), transparent 26%), #080506',
  },
  {
    id: 'forest',
    preview: 'linear-gradient(135deg, #08100d 0%, #10211b 45%, #070b09 100%)',
    css: 'radial-gradient(circle at top left, rgba(48, 209, 88, 0.22), transparent 26%), radial-gradient(circle at bottom right, rgba(52, 199, 89, 0.16), transparent 24%), #050706',
  },
  {
    id: 'neon',
    preview: 'linear-gradient(135deg, #14061f 0%, #27134f 48%, #090313 100%)',
    css: 'radial-gradient(circle at 20% 15%, rgba(191, 90, 242, 0.28), transparent 24%), radial-gradient(circle at 80% 22%, rgba(94, 92, 230, 0.22), transparent 24%), radial-gradient(circle at 50% 100%, rgba(90, 200, 250, 0.18), transparent 28%), #04040a',
  },
  {
    id: 'rose',
    preview: 'linear-gradient(135deg, #20080f 0%, #4f1526 46%, #12060a 100%)',
    css: 'radial-gradient(circle at top left, rgba(255, 55, 95, 0.24), transparent 22%), radial-gradient(circle at top right, rgba(255, 100, 130, 0.18), transparent 24%), #090507',
  },
  {
    id: 'lagoon',
    preview: 'linear-gradient(135deg, #07141a 0%, #103949 46%, #071015 100%)',
    css: 'radial-gradient(circle at 15% 18%, rgba(100, 210, 255, 0.24), transparent 24%), radial-gradient(circle at 85% 22%, rgba(48, 176, 199, 0.2), transparent 20%), radial-gradient(circle at 50% 100%, rgba(0, 116, 232, 0.16), transparent 28%), #04080a',
  },
] as const;

function getBackgroundCss(background: StoredBackground) {
  return PRESET_BACKGROUNDS.find((item) => item.id === background.value)?.css ?? PRESET_BACKGROUNDS[0].css;
}

function normalizeAmount(value: string) {
  const normalized = value.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
  const parts = normalized.split('.');
  return parts.length <= 1 ? normalized : `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>('el');
  const [tab, setTab] = useState<TabId>('home');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [income, setIncome] = useState(0);
  const [budgetInputValue, setBudgetInputValue] = useState('0');
  const [range, setRange] = useState<Range>('month');
  const [background, setBackground] = useState<StoredBackground>({ type: 'preset', value: 'default' });
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [swipedExpenseId, setSwipedExpenseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>({
    amount: '',
    category: DEFAULT_CATEGORIES[0].name,
    emoji: DEFAULT_CATEGORIES[0].emoji,
    date: toLocalIsoDate(new Date()),
    comment: '',
  });
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryEmoji, setCustomCategoryEmoji] = useState('🏷️');
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const swipeStartRef = useRef<{ id: string; x: number } | null>(null);

  useEffect(() => {
    setLocale(loadLocale());
    setExpenses(loadExpenses());
    setCustomCategories(loadCategories());
    const savedIncome = loadIncome();
    setIncome(savedIncome);
    setBudgetInputValue(String(savedIncome));
    setRange(loadRange());
    setBackground(loadBackground());
    const filter = loadFilter();
    setFromDate(filter.fromIso ?? '');
    setToDate(filter.toIso ?? '');
  }, []);

  useEffect(() => saveLocale(locale), [locale]);
  useEffect(() => saveExpenses(expenses), [expenses]);
  useEffect(() => saveCategories(customCategories), [customCategories]);
  useEffect(() => saveIncome(income), [income]);
  useEffect(() => {
    setBudgetInputValue(String(income));
  }, [income]);
  useEffect(() => saveRange(range), [range]);
  useEffect(() => saveBackground(background), [background]);
  useEffect(() => saveFilter({ fromIso: fromDate || null, toIso: toDate || null }), [fromDate, toDate]);
  useEffect(() => setExpandedGroups({}), [range, fromDate, toDate]);
  useEffect(() => {
    const cssBackground = getBackgroundCss(background);
    document.body.style.background = cssBackground;
    document.body.style.backgroundAttachment = 'fixed';
  }, [background]);

  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  const displayCategories = useMemo(() => withDisplayName(locale, allCategories), [locale, allCategories]);
  const filterFromDate = fromDate ? parseIsoDateToLocal(fromDate) : null;
  const filterToDate = toDate ? parseIsoDateToLocal(toDate) : null;
  const totals = useMemo(() => getExpensePeriodTotals(expenses), [expenses]);
  const filteredExpenses = useMemo(() => filterExpensesByDateRange(expenses, filterFromDate, filterToDate), [expenses, filterFromDate, filterToDate]);
  const historyGroups = useMemo(() => getHistoryGroups(expenses, range, filterFromDate, filterToDate, locale), [expenses, range, filterFromDate, filterToDate, locale]);
  const analyticsGroups = useMemo(() => getAnalyticsGroups(expenses, range, filterFromDate, filterToDate, locale), [expenses, range, filterFromDate, filterToDate, locale]);
  const hasDateFilter = Boolean(fromDate || toDate);

  const openAddExpense = () => {
    setEditingExpense(null);
    setDraft({
      amount: '',
      category: DEFAULT_CATEGORIES[0].name,
      emoji: DEFAULT_CATEGORIES[0].emoji,
      date: toLocalIsoDate(new Date()),
      comment: '',
    });
    setIsAddingCustomCategory(false);
    setCustomCategoryName('');
    setCustomCategoryEmoji('');
    setExpenseModalOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setDraft({
      amount: expense.amount,
      category: expense.category,
      emoji: expense.emoji,
      date: expense.date,
      comment: expense.comment ?? '',
    });
    setIsAddingCustomCategory(false);
    setCustomCategoryName('');
    setCustomCategoryEmoji('');
    setExpenseModalOpen(true);
  };

  const closeExpenseModal = () => {
    setExpenseModalOpen(false);
    setEditingExpense(null);
  };

  const handleSaveExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedAmount = draft.amount.replace(',', '.');
    if (!normalizedAmount || Number.isNaN(Number(normalizedAmount))) {
      window.alert(t(locale, 'invalidAmount'));
      return;
    }

    let categoryName = draft.category;
    let categoryEmoji = draft.emoji || '🏷️';

    if (isAddingCustomCategory) {
      const trimmedName = customCategoryName.trim();
      if (!trimmedName) {
        window.alert(t(locale, 'invalidCategory'));
        return;
      }
      categoryName = trimmedName;
      categoryEmoji = customCategoryEmoji.trim() || '🏷️';
      const alreadyExists = allCategories.some((category) => category.name === trimmedName);
      if (!alreadyExists) {
        setCustomCategories((prev) => [...prev, { id: `custom_${Date.now()}`, name: trimmedName, emoji: categoryEmoji }]);
      }
    }

    const nextExpense: Expense = {
      id: editingExpense?.id ?? String(Date.now()),
      amount: Number.parseFloat(normalizedAmount).toFixed(2),
      category: categoryName,
      emoji: categoryEmoji,
      date: draft.date,
      comment: draft.comment.trim(),
    };

    setExpenses((prev) => {
      const base = editingExpense ? prev.map((item) => (item.id === editingExpense.id ? nextExpense : item)) : [nextExpense, ...prev];
      return base.sort((a, b) => b.date.localeCompare(a.date));
    });

    closeExpenseModal();
  };

  const handleExpenseTouchStart = (id: string, clientX: number) => {
    swipeStartRef.current = { id, x: clientX };
  };

  const handleExpenseTouchEnd = (id: string, clientX: number) => {
    const swipe = swipeStartRef.current;
    if (!swipe || swipe.id !== id) return;
    const deltaX = clientX - swipe.x;
    if (deltaX <= -60) {
      setSwipedExpenseId(id);
    } else if (deltaX >= 30 || swipedExpenseId === id) {
      setSwipedExpenseId(null);
    }
    swipeStartRef.current = null;
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
  };

  const handleDeleteCategory = (id: string) => {
    setCustomCategories((prev) => prev.filter((category) => category.id !== id));
  };

  const handleDeleteCategoryFromSettings = (id: string) => {
    if (!window.confirm(t(locale, 'deleteCategoryConfirm'))) return;
    handleDeleteCategory(id);
  };

  const handleExportCsv = () => {
    downloadCsv(buildCsv(expenses, locale));
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvRows(text);
    if (rows.length <= 1) {
      window.alert(t(locale, 'invalidCsv'));
      return;
    }

    const header = rows[0].map((value) => value.trim().toLowerCase());
    const dateIndex = header.findIndex((value) => value === 'ημερομηνία' || value === 'date');
    const categoryIndex = header.findIndex((value) => value === 'κατηγορία' || value === 'category');
    const amountIndex = header.findIndex((value) => value === 'ποσό' || value === 'amount');

    if (dateIndex === -1 || categoryIndex === -1 || amountIndex === -1) {
      window.alert(t(locale, 'invalidCsv'));
      return;
    }

    const importedExpenses: Expense[] = [];
    const newCategories: Category[] = [];
    const existingNames = new Set(allCategories.map((category) => category.name));

    rows.slice(1).forEach((row, index) => {
      const date = (row[dateIndex] ?? '').trim();
      const category = (row[categoryIndex] ?? '').trim();
      const amountRaw = (row[amountIndex] ?? '').trim().replace(',', '.');
      const amount = Number.parseFloat(amountRaw);
      if (!date || !category || Number.isNaN(amount)) return;

      if (!existingNames.has(category)) {
        existingNames.add(category);
        newCategories.push({
          id: `import_cat_${Date.now()}_${index}`,
          name: category,
          emoji: '🏷️',
        });
      }

      importedExpenses.push({
        id: `import_${Date.now()}_${index}`,
        amount: amount.toFixed(2),
        category,
        emoji: allCategories.find((item) => item.name === category)?.emoji ?? '🏷️',
        date,
      });
    });

    setCustomCategories((prev) => [...prev, ...newCategories]);
    setExpenses((prev) => [...importedExpenses, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    event.target.value = '';
    window.alert(t(locale, 'importDone'));
  };

  const selectedCategory = allCategories.find((category) => category.name === draft.category);
  const currentMonthSpend = totals.month;
  const balance = income - currentMonthSpend;
  const progressPct = income > 0 ? Math.min(100, Math.max(0, (currentMonthSpend / income) * 100)) : 0;
  const showDashboard = tab !== 'settings';

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Web</p>
          <h1>{t(locale, 'appTitle')}</h1>
        </div>
        <nav className="tabbar">
          {([
            ['home', t(locale, 'home')],
            ['analytics', t(locale, 'analytics')],
            ['settings', t(locale, 'settings')],
          ] as [TabId, string][]).map(([id, label]) => (
            <button key={id} className={`tab-chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-grid">
        {showDashboard && (
          <>
            <section className="panel budget-panel">
              <h3 className="budget-title">Budget</h3>
              <div className="budget-bar-wrap">
                <strong className="budget-spent-value">{currentMonthSpend.toFixed(2)} €</strong>
                <div className="progress-track budget-track">
                  <div className="progress-fill budget-fill" style={{ width: `${Math.max(0, 100 - progressPct)}%` }} />
                </div>
                <strong className="budget-bar-value">{income.toFixed(2)} €</strong>
              </div>
              <p className="budget-consumed">{progressPct.toFixed(0)}% κατανάλωση</p>
            </section>

            <section className="summary-grid">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`summary-card ${range === option ? 'active' : ''}`}
                  onClick={() => setRange(option)}
                >
                  <span>{t(locale, option)}</span>
                  <strong>{totals[option].toFixed(2)} €</strong>
                </button>
              ))}
            </section>

            <section className="toolbar-row">
              <div className="toolbar-title">
                <h3>{tab === 'analytics' ? t(locale, 'byCategory') : t(locale, 'history')}</h3>
                <button className={`icon-btn ${hasDateFilter ? 'active' : ''}`} onClick={() => setFilterModalOpen(true)}>
                  ☰
                </button>
              </div>
              {hasDateFilter && (
                <p className="filter-pill">
                  {t(locale, 'filterActive')}: {fromDate || '—'} / {toDate || '—'}
                </p>
              )}
            </section>
          </>
        )}

        {tab === 'home' && (
          <section className="panel list-panel">
            <div className="action-row">
              <button className="primary-btn" onClick={openAddExpense}>{t(locale, 'addExpense')}</button>
            </div>
            {historyGroups.every((group) => group.items.length === 0) ? (
              <div className="empty-state">
                <p>{t(locale, 'noExpenses')}</p>
                <span>{t(locale, 'addFirstExpense')}</span>
              </div>
            ) : (
              historyGroups.map((group) => {
                const expanded = expandedGroups[group.id] ?? group.isCurrent;
                return (
                  <article key={group.id} className="group-card">
                    <button className="group-header" onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !expanded }))}>
                      <span>{group.title}</span>
                      <strong>{group.total.toFixed(2)} €</strong>
                    </button>
                    {expanded && group.items.length > 0 && (
                      <div className="group-body">
                        {group.items.map((expense) => (
                          <div key={expense.id} className={`expense-swipe ${swipedExpenseId === expense.id ? 'open' : ''}`}>
                            <button className="expense-delete-action" onClick={() => handleDeleteExpense(expense.id)}>
                              {t(locale, 'delete')}
                            </button>
                            <button
                              className="expense-main"
                              onTouchStart={(event) => handleExpenseTouchStart(expense.id, event.changedTouches[0].clientX)}
                              onTouchEnd={(event) => handleExpenseTouchEnd(expense.id, event.changedTouches[0].clientX)}
                              onClick={() => {
                                if (swipedExpenseId === expense.id) {
                                  setSwipedExpenseId(null);
                                  return;
                                }
                                openEditExpense(expense);
                              }}
                            >
                              <span className="expense-emoji">{expense.emoji}</span>
                              <span className="expense-copy">
                                <strong>{getLocalizedCategoryName(locale, expense.category)}</strong>
                                <small>{expense.comment?.trim() ? `${expense.date} • ${expense.comment.trim()}` : expense.date}</small>
                              </span>
                              <strong>{expense.amount} €</strong>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        )}

        {tab === 'analytics' && (
          <section className="panel list-panel">
            {analyticsGroups.map((group) => {
              const expanded = expandedGroups[group.id] ?? group.isCurrent;
              const aggregate: Record<string, { amount: number; emoji: string }> = {};
              group.items.forEach((expense) => {
                const key = getLocalizedCategoryName(locale, expense.category || t(locale, 'other'));
                if (!aggregate[key]) aggregate[key] = { amount: 0, emoji: expense.emoji || '🏷️' };
                aggregate[key].amount += Number.parseFloat(expense.amount) || 0;
              });
              const rows = Object.entries(aggregate)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.amount - a.amount);
              const maxAmount = rows[0]?.amount ?? 0;
              const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

              return (
                <article key={group.id} className="group-card">
                  <button className="group-header" onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !expanded }))}>
                    <span>{group.title}</span>
                    <strong>{totalAmount.toFixed(2)} €</strong>
                  </button>
                  {expanded && (
                    <div className="group-body">
                      {rows.length === 0 ? (
                        <p className="empty-line">{t(locale, 'noExpenses')}</p>
                      ) : (
                        rows.map((row) => (
                          <div key={`${group.id}_${row.name}`} className="bar-row">
                            <div className="bar-label">
                              <span>{row.emoji}</span>
                              <strong>{row.name}</strong>
                            </div>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${maxAmount > 0 ? Math.max(18, (row.amount / maxAmount) * 100) : 18}%` }}>
                                {row.amount.toFixed(0)} €
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {tab === 'settings' && (
          <section className="settings-grid">
            <section className="panel">
              <div className="settings-header">
                <div>
                  <h3>{t(locale, 'setBudget')}</h3>
                </div>
                <strong className="settings-budget-value">{income.toFixed(0)} €</strong>
              </div>
              <div className="budget-settings-block">
                <input
                  className="budget-slider"
                  type="range"
                  min="0"
                  max="5000"
                  step="5"
                  value={income}
                  onChange={(event) => setIncome(Math.min(5000, Math.max(0, Number(event.target.value) || 0)))}
                />
                <label className="budget-input-wrap">
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    step="5"
                    value={budgetInputValue}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setBudgetInputValue(nextValue);
                      if (nextValue === '') return;
                      setIncome(Math.min(5000, Math.max(0, Number(nextValue) || 0)));
                    }}
                    onFocus={(event) => {
                      if (event.target.value === '0') {
                        setBudgetInputValue('');
                      }
                    }}
                    onBlur={() => {
                      if (budgetInputValue === '') {
                        setBudgetInputValue('0');
                      }
                    }}
                  />
                </label>
              </div>
            </section>
            <section className="panel">
              <div className="settings-header">
                <div>
                  <h3>{t(locale, 'background')}</h3>
                </div>
                <button className="ghost-btn" onClick={() => setBackgroundModalOpen(true)}>
                  {t(locale, 'chooseBackground')}
                </button>
              </div>
            </section>
            <section className="panel">
              <h3>{t(locale, 'manageData')}</h3>
              <div className="settings-actions">
                <button className="settings-card" onClick={handleImportClick}>
                  <strong>{t(locale, 'importCsv')}</strong>
                  <span>{t(locale, 'importCsvDesc')}</span>
                </button>
                <button className="settings-card" onClick={handleExportCsv}>
                  <strong>{t(locale, 'exportCsv')}</strong>
                  <span>{t(locale, 'exportCsvDesc')}</span>
                </button>
              </div>
            </section>
            <section className="panel">
              <h3>{t(locale, 'manageCategories')}</h3>
              <div className="category-manage-list">
                {customCategories.length === 0 ? (
                  <p className="empty-line">{t(locale, 'noCustomCategories')}</p>
                ) : (
                  withDisplayName(locale, customCategories).map((category) => (
                    <div key={category.id} className="category-manage-row">
                      <div className="category-manage-copy">
                        <span className="category-manage-emoji">{category.emoji}</span>
                        <strong>{category.displayName}</strong>
                      </div>
                      <button className="danger-btn" onClick={() => handleDeleteCategoryFromSettings(category.id)}>
                        {t(locale, 'delete')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="panel">
              <div className="settings-header">
                <div>
                  <h3>{t(locale, 'language')}</h3>
                  <p>{t(locale, 'appLanguageHint')}</p>
                </div>
                <div className="lang-switch">
                  <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
                  <button className={locale === 'el' ? 'active' : ''} onClick={() => setLocale('el')}>GR</button>
                </div>
              </div>
            </section>
            <input ref={importInputRef} className="hidden-input" type="file" accept=".csv,text/csv" onChange={handleImportCsv} />
          </section>
        )}
      </main>

      {backgroundModalOpen && (
        <div className="modal-backdrop" onClick={() => setBackgroundModalOpen(false)}>
          <div className="modal-card background-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t(locale, 'backgroundLibrary')}</h3>
            <div className="background-grid">
              {PRESET_BACKGROUNDS.map((item) => {
                const active = background.value === item.id;
                return (
                  <button
                    key={item.id}
                    className={`background-option ${active ? 'active' : ''}`}
                    onClick={() => setBackground({ type: 'preset', value: item.id })}
                  >
                    <span className="background-preview" style={{ background: item.preview }} />
                  </button>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setBackground({ type: 'preset', value: 'default' })}>
                {t(locale, 'resetBackground')}
              </button>
              <button className="primary-btn" onClick={() => setBackgroundModalOpen(false)}>
                {t(locale, 'closeBackgrounds')}
              </button>
            </div>
          </div>
        </div>
      )}

      {filterModalOpen && (
        <div className="modal-backdrop" onClick={() => setFilterModalOpen(false)}>
          <div className="modal-card filter-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t(locale, 'dateFilterTitle')}</h3>
            <div className="filter-fields">
              <label>
                <span>{t(locale, 'from')}</span>
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </label>
              <label>
                <span>{t(locale, 'to')}</span>
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => { setFromDate(''); setToDate(''); }}>
                {t(locale, 'clear')}
              </button>
              <button className="primary-btn" onClick={() => setFilterModalOpen(false)}>
                {t(locale, 'apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseModalOpen && (
        <div className="modal-backdrop" onClick={closeExpenseModal}>
          <form className="modal-card expense-form" onClick={(event) => event.stopPropagation()} onSubmit={handleSaveExpense}>
            <h3>{editingExpense ? t(locale, 'editExpense') : t(locale, 'addExpense')}</h3>

            <label>
              <span>{t(locale, 'category')}</span>
              <select
                value={isAddingCustomCategory ? NEW_CATEGORY_VALUE : draft.category}
                onChange={(event) => {
                  if (event.target.value === NEW_CATEGORY_VALUE) {
                    setIsAddingCustomCategory(true);
                    setDraft((prev) => ({ ...prev, emoji: customCategoryEmoji || '🏷️' }));
                    return;
                  }
                  const category = allCategories.find((item) => item.name === event.target.value);
                  setIsAddingCustomCategory(false);
                  setDraft((prev) => ({
                    ...prev,
                    category: event.target.value,
                    emoji: category?.emoji ?? prev.emoji,
                  }));
                }}
              >
                {displayCategories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.emoji} {category.displayName}
                  </option>
                ))}
                <option value={NEW_CATEGORY_VALUE}>{t(locale, 'newCategoryOption')}</option>
              </select>
            </label>

            {isAddingCustomCategory && (
              <div className="grid-two">
                <label>
                  <span>{t(locale, 'emoji')}</span>
                  <input
                    className="emoji-input"
                    value={customCategoryEmoji}
                    onChange={(event) => setCustomCategoryEmoji(event.target.value)}
                    onFocus={() => setCustomCategoryEmoji('')}
                    placeholder="😀"
                    maxLength={2}
                    inputMode="text"
                  />
                </label>
                <label>
                  <span>{t(locale, 'categoryName')}</span>
                  <input value={customCategoryName} onChange={(event) => setCustomCategoryName(event.target.value)} />
                </label>
              </div>
            )}

            <div className="grid-two">
              <label>
                <span>{t(locale, 'amount')}</span>
                <input value={draft.amount} inputMode="decimal" onChange={(event) => setDraft((prev) => ({ ...prev, amount: normalizeAmount(event.target.value) }))} />
              </label>
            </div>

            <label>
              <span>{t(locale, 'date')}</span>
              <input type="date" value={draft.date} onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))} />
            </label>

            <label>
              <span>{t(locale, 'comment')}</span>
              <input
                value={draft.comment}
                onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value }))}
                placeholder={t(locale, 'commentPlaceholder')}
              />
            </label>

            {selectedCategory?.isDefault !== true && !isAddingCustomCategory && (
              <button
                type="button"
                className="danger-btn inline"
                onClick={() => {
                  const custom = customCategories.find((item) => item.name === draft.category);
                  if (custom) handleDeleteCategory(custom.id);
                  setDraft((prev) => ({ ...prev, category: DEFAULT_CATEGORIES[0].name, emoji: DEFAULT_CATEGORIES[0].emoji }));
                }}
              >
                {t(locale, 'delete')}
              </button>
            )}

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={closeExpenseModal}>
                {t(locale, 'cancel')}
              </button>
              <button type="submit" className="primary-btn">
                {editingExpense ? t(locale, 'update') : t(locale, 'add')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
