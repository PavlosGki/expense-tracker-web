import type { AnalyticsGroup, Expense, HistoryGroup, Locale, Range } from '../types';
import { getLocalizedMonthAcc } from './i18n';

export const TRACKING_START_ISO = '2026-01-01';

export function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDateToLocal(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

function getIsoWeekStartUtc(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const isoDow0Mon = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - isoDow0Mon);
  return start;
}

function toIsoDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function clampFilterRange(fromDate: Date | null, toDate: Date | null) {
  const todayIso = toLocalIsoDate(new Date());
  let startIso = TRACKING_START_ISO;
  let endIso = todayIso;

  if (fromDate) startIso = toLocalIsoDate(fromDate);
  if (toDate) endIso = toLocalIsoDate(toDate);

  if (startIso > endIso) {
    [startIso, endIso] = [endIso, startIso];
  }

  return { startIso, endIso };
}

export function filterExpensesByDateRange(expenses: Expense[], fromDate: Date | null, toDate: Date | null) {
  const { startIso, endIso } = clampFilterRange(fromDate, toDate);
  
  const finalEndIso = toDate ? endIso : '2099-12-31';

  const startUtc = new Date(`${startIso}T00:00:00Z`);
  const endExclusiveUtc = addDaysUtc(new Date(`${finalEndIso}T00:00:00Z`), 1);

  return expenses.filter((expense) => {
    if (!expense.date) return false;
    const expenseUtc = new Date(`${expense.date}T00:00:00Z`);
    return expenseUtc >= startUtc && expenseUtc < endExclusiveUtc;
  });
}

export function getExpensePeriodTotals(expenses: Expense[]) {
  const todayIso = toLocalIsoDate(new Date());
  const todayDate = parseIsoDateToLocal(todayIso);
  const todayMonthKey = todayIso.slice(0, 7);
  const todayYearKey = todayIso.slice(0, 4);
  const weekStart = getIsoWeekStartUtc(todayIso);
  const weekEnd = addDaysUtc(weekStart, 7);

  return expenses.reduce(
    (acc, expense) => {
      const amount = Number.parseFloat(expense.amount) || 0;
      const expenseDate = parseIsoDateToLocal(expense.date);
      const expenseUtc = new Date(`${expense.date}T00:00:00Z`);

      if (expense.date === todayIso) acc.day += amount;
      if (expense.date.slice(0, 7) === todayMonthKey) acc.month += amount;
      if (expense.date.slice(0, 4) === todayYearKey) acc.year += amount;
      if (expenseUtc >= weekStart && expenseUtc < weekEnd) acc.week += amount;

      return acc;
    },
    { day: 0, week: 0, month: 0, year: 0 }
  );
}

export function getHistoryGroups(expenses: Expense[], range: Range, fromDate: Date | null, toDate: Date | null, locale: Locale): HistoryGroup[] {
  const visible = filterExpensesByDateRange(expenses, fromDate, toDate);
  const todayIso = toLocalIsoDate(new Date());
  const todayUtc = new Date(`${todayIso}T00:00:00Z`);
  const currentMonthKey = todayIso.slice(0, 7);
  const currentYearKey = todayIso.slice(0, 4);
  const trackingStartUtc = new Date(`${TRACKING_START_ISO}T00:00:00Z`);
  
  const { startIso, endIso } = clampFilterRange(fromDate, toDate);
  const scopeStartUtc = new Date(`${startIso}T00:00:00Z`);
  const scopeEndExclusiveUtc = addDaysUtc(new Date(`${endIso}T00:00:00Z`), 1);

  const byDay: Record<string, Expense[]> = {};
  const byMonth: Record<string, Expense[]> = {};
  const byYear: Record<string, Expense[]> = {};
  const byWeek: Record<string, Expense[]> = {};

  visible.forEach((expense) => {
    const dayKey = expense.date;
    const monthKey = expense.date.slice(0, 7);
    const yearKey = expense.date.slice(0, 4);
    const weekStartKey = toIsoDateUtc(getIsoWeekStartUtc(expense.date));
    (byDay[dayKey] ??= []).push(expense);
    (byMonth[monthKey] ??= []).push(expense);
    (byYear[yearKey] ??= []).push(expense);
    (byWeek[weekStartKey] ??= []).push(expense);
  });

  if (range === 'year') {
    const groups: HistoryGroup[] = [];
    const startYear = scopeStartUtc.getUTCFullYear();
    const endYear = addDaysUtc(scopeEndExclusiveUtc, -1).getUTCFullYear();
    for (let year = endYear; year >= startYear; year -= 1) {
      const key = String(year);
      const items = (byYear[key] ?? []).sort((a, b) => b.date.localeCompare(a.date));
      groups.push({
        id: `y_${key}`,
        title: key,
        total: items.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0),
        items,
        isCurrent: key === currentYearKey,
      });
    }
    return groups;
  }

  if (range === 'month') {
    const groups: HistoryGroup[] = [];
    const startMonthUtc = new Date(Date.UTC(scopeStartUtc.getUTCFullYear(), scopeStartUtc.getUTCMonth(), 1));
    const endDay = addDaysUtc(scopeEndExclusiveUtc, -1);
    const endMonthUtc = new Date(Date.UTC(endDay.getUTCFullYear(), endDay.getUTCMonth(), 1));
    for (let current = new Date(endMonthUtc); current >= startMonthUtc; current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1))) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      const monthIndex = Number.parseInt(month, 10) - 1;
      const items = (byMonth[key] ?? []).sort((a, b) => b.date.localeCompare(a.date));
      groups.push({
        id: `m_${key}`,
        title: `${getLocalizedMonthAcc(locale, monthIndex)} ${year}`,
        total: items.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0),
        items,
        isCurrent: key === currentMonthKey,
      });
    }
    return groups;
  }

  if (range === 'week') {
    const groups: HistoryGroup[] = [];
    const currentWeekStartUtc = getIsoWeekStartUtc(todayIso);
    const endScopeDayIso = toIsoDateUtc(addDaysUtc(scopeEndExclusiveUtc, -1));
    const endWeekUtc = getIsoWeekStartUtc(endScopeDayIso);
    const startWeekUtc = getIsoWeekStartUtc(toIsoDateUtc(scopeStartUtc));
    for (let current = new Date(endWeekUtc); current >= startWeekUtc; current = addDaysUtc(current, -7)) {
      const weekStartIso = toIsoDateUtc(current);
      const weekEndIso = toIsoDateUtc(addDaysUtc(current, 6));
      const items = (byWeek[weekStartIso] ?? []).sort((a, b) => b.date.localeCompare(a.date));
      groups.push({
        id: `w_${weekStartIso}`,
        title: `${formatIsoDate(weekStartIso)} - ${formatIsoDate(weekEndIso)}`,
        total: items.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0),
        items,
        isCurrent: weekStartIso === toIsoDateUtc(currentWeekStartUtc),
      });
    }
    return groups;
  }

  const groups: HistoryGroup[] = [];
  for (let current = addDaysUtc(scopeEndExclusiveUtc, -1); current >= scopeStartUtc; current = addDaysUtc(current, -1)) {
    const dayIso = toIsoDateUtc(current);
    const items = (byDay[dayIso] ?? []).sort((a, b) => b.id.localeCompare(a.id));
    groups.push({
      id: `d_${dayIso}`,
      title: formatIsoDate(dayIso),
      total: items.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0),
      items,
      isCurrent: dayIso === todayIso,
    });
  }
  return groups;
}

export function getAnalyticsGroups(expenses: Expense[], range: Range, fromDate: Date | null, toDate: Date | null, locale: Locale): AnalyticsGroup[] {
  return getHistoryGroups(expenses, range, fromDate, toDate, locale).map((group) => ({
    id: group.id,
    title: group.title,
    isCurrent: group.isCurrent,
    items: group.items,
  }));
}
