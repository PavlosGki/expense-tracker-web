import type { Category, Expense, Locale, Project, Range } from '../types';

const KEYS = {
  expenses: 'expense_tracker_web_expenses',
  categories: 'expense_tracker_web_categories',
  projects: 'expense_tracker_web_projects',
  income: 'expense_tracker_web_income',
  locale: 'expense_tracker_web_locale',
  range: 'expense_tracker_web_range',
  filter: 'expense_tracker_web_filter',
  background: 'expense_tracker_web_background'
};

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadExpenses() {
  return loadJson<Expense[]>(KEYS.expenses, []);
}

export function saveExpenses(expenses: Expense[]) {
  saveJson(KEYS.expenses, expenses);
}

export function loadCategories() {
  return loadJson<Category[]>(KEYS.categories, []);
}

export function saveCategories(categories: Category[]) {
  saveJson(KEYS.categories, categories);
}

export function loadProjects() {
  return loadJson<Project[]>(KEYS.projects, []);
}

export function saveProjects(projects: Project[]) {
  saveJson(KEYS.projects, projects);
}

export function loadIncome() {
  return loadJson<number>(KEYS.income, 0);
}

export function saveIncome(income: number) {
  saveJson(KEYS.income, income);
}

export function loadLocale() {
  return loadJson<Locale>(KEYS.locale, 'el');
}

export function saveLocale(locale: Locale) {
  saveJson(KEYS.locale, locale);
}

export function loadRange() {
  return loadJson<Range>(KEYS.range, 'month');
}

export function saveRange(range: Range) {
  saveJson(KEYS.range, range);
}

export function loadFilter() {
  return loadJson<{ fromIso: string | null; toIso: string | null; category: string | null; project: string | null }>(KEYS.filter, {
    fromIso: null,
    toIso: null,
    category: null,
    project: null,
  });
}

export function saveFilter(filter: { fromIso: string | null; toIso: string | null; category: string | null; project: string | null }) {
  saveJson(KEYS.filter, filter);
}

export type StoredBackground = { type: 'preset'; value: string };

export function loadBackground() {
  return loadJson<StoredBackground>(KEYS.background, { type: 'preset', value: 'default' });
}

export function saveBackground(background: StoredBackground) {
  saveJson(KEYS.background, background);
}
