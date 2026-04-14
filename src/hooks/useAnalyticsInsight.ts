import { useMemo } from 'react';
import { getLocalizedCategoryName, t } from '../lib/i18n';
import type { Expense, Locale, Range } from '../types';
import type { BudgetPaceView } from './useBudgetPace';

export type Insight = {
  icon: string;
  text: string;
  color: 'blue' | 'green' | 'orange' | 'yellow';
} | null;

export function useAnalyticsInsight(
  expenses: Expense[],
  budgetPaceView: BudgetPaceView,
  range: Range,
  locale: Locale
): Insight {
  return useMemo(() => {
    const getPeriodText = () => {
      if (range === 'day') return t(locale, 'periodToday');
      if (range === 'week') return t(locale, 'periodThisWeek');
      if (range === 'month') return t(locale, 'periodThisMonth');
      return t(locale, 'periodThisYear');
    };

    // 1. Quiet Period
    if (expenses.length === 0) {
      return {
        icon: '✨',
        text: t(locale, 'insightQuiet').replace('{period}', getPeriodText()),
        color: 'blue',
      };
    }

    const totalSpend = expenses.reduce((sum, exp) => sum + (Number.parseFloat(exp.amount) || 0), 0);

    // 2. Budget Pace Insights (priority)
    if (budgetPaceView.mode !== 'disabled' && budgetPaceView.mode !== 'day') {
      const delta = budgetPaceView.delta;
      if (delta > totalSpend * 0.1 && delta > 10) {
        return {
          icon: '⚠️',
          text: t(locale, 'insightPaceBad')
            .replace('{amount}', `<strong>${Math.abs(delta).toFixed(0)}€</strong>`)
            .replace('{period}', getPeriodText()),
          color: 'orange',
        };
      }
      if (delta < -totalSpend * 0.1 && delta < -10) {
        return {
          icon: '🎉',
          text: t(locale, 'insightPaceGood')
            .replace('{amount}', `<strong>${Math.abs(delta).toFixed(0)}€</strong>`)
            .replace('{period}', getPeriodText()),
          color: 'green',
        };
      }
    }

    // 3. Top Category
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((exp) => {
      const categoryName = getLocalizedCategoryName(locale, exp.category || t(locale, 'other'));
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + (Number.parseFloat(exp.amount) || 0);
    });

    const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
    if (sortedCategories.length > 0) {
      const [topCategoryName, topCategoryAmount] = sortedCategories[0];
      const topCategoryPercent = (topCategoryAmount / totalSpend) * 100;

      if (topCategoryPercent > 35 && sortedCategories.length > 1) {
        return {
          icon: '💡',
          text: t(locale, 'insightTopCategory').replace('{category}', `<strong>${topCategoryName}</strong>`).replace('{percent}', `<strong>${topCategoryPercent.toFixed(0)}</strong>`).replace('{period}', getPeriodText()),
          color: 'yellow',
        };
      }
    }

    // 4. Single Big Spender
    if (expenses.length > 1) {
      const sortedExpenses = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount));
      const biggestExpense = sortedExpenses[0];
      const biggestExpenseAmount = Number.parseFloat(biggestExpense.amount) || 0;

      if (biggestExpenseAmount > totalSpend * 0.4) {
        const categoryName = getLocalizedCategoryName(locale, biggestExpense.category || t(locale, 'other'));
        return {
          icon: '🔍',
          text: t(locale, 'insightBigExpense').replace('{amount}', `<strong>${biggestExpenseAmount.toFixed(0)}€</strong>`).replace('{category}', `<strong>${categoryName}</strong>`).replace('{period}', getPeriodText()),
          color: 'blue',
        };
      }
    }

    return null;
  }, [expenses, budgetPaceView, range, locale]);
}