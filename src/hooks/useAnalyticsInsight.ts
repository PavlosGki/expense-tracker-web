import { useMemo } from 'react';
import { getLocalizedCategoryName, t } from '../lib/i18n';
import type { Expense, Locale, Project, Range } from '../types';
import type { BudgetPaceView } from './useBudgetPace';
import { toLocalIsoDate } from '../lib/date';

export type Insight = {
  icon: string;
  text: string;
  color: 'blue' | 'green' | 'orange' | 'yellow' | 'gray';
};

export function useAnalyticsInsights(
  allExpenses: Expense[],
  periodExpenses: Expense[],
  budgetPaceView: BudgetPaceView,
  range: Range,
  locale: Locale,
  projects: Project[],
  income: number,
  isYearOffTrack: boolean
): Insight[] {
  return useMemo(() => {
    const insights: Insight[] = [];

    const getPeriodText = () => {
      if (range === 'day') return t(locale, 'periodToday');
      if (range === 'week') return t(locale, 'periodThisWeek');
      if (range === 'month') return t(locale, 'periodThisMonth');
      return t(locale, 'periodThisYear');
    };

    if (periodExpenses.length === 0) {
      insights.push({
        icon: '✨',
        text: t(locale, 'insightQuiet').replace('{period}', getPeriodText()),
        color: 'blue',
      });
    }

    const periodTotalSpend = periodExpenses.reduce((sum, exp) => sum + (Number.parseFloat(exp.amount) || 0), 0);

    if (budgetPaceView.mode !== 'disabled' && budgetPaceView.mode !== 'day') {
      const delta = budgetPaceView.delta;
      if (delta > periodTotalSpend * 0.1 && delta > 10) {
        insights.push({
          icon: '⚠️',
          text: t(locale, 'insightPaceBad')
            .replace('{amount}', `<strong>${Math.abs(delta).toFixed(0)}€</strong>`)
            .replace('{period}', getPeriodText()),
          color: 'orange',
        });
      }
      if (delta < -periodTotalSpend * 0.1 && delta < -10) {
        insights.push({
          icon: '🎉',
          text: t(locale, 'insightPaceGood')
            .replace('{amount}', `<strong>${Math.abs(delta).toFixed(0)}€</strong>`)
            .replace('{period}', getPeriodText()),
          color: 'green',
        });
      }
    }

    if (periodExpenses.length > 1) {
      const categoryTotals: Record<string, number> = {};
      periodExpenses.forEach((exp) => {
        const categoryName = getLocalizedCategoryName(locale, exp.category || t(locale, 'other'));
        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + (Number.parseFloat(exp.amount) || 0);
      });

      const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
      if (sortedCategories.length > 0) {
        const [topCategoryName, topCategoryAmount] = sortedCategories[0];
        const topCategoryPercent = (topCategoryAmount / periodTotalSpend) * 100;

        if (topCategoryPercent > 35 && sortedCategories.length > 1) {
          insights.push({
            icon: '💡',
            text: t(locale, 'insightTopCategory').replace('{category}', `<strong>${topCategoryName}</strong>`).replace('{percent}', `<strong>${topCategoryPercent.toFixed(0)}</strong>`).replace('{period}', getPeriodText()),
            color: 'yellow',
          });
        }
      }
    }

    if (periodExpenses.length > 1) {
      const sortedExpenses = [...periodExpenses].sort((a, b) => Number(b.amount) - Number(a.amount));
      const biggestExpense = sortedExpenses[0];
      const biggestExpenseAmount = Number.parseFloat(biggestExpense.amount) || 0;

      if (biggestExpenseAmount > periodTotalSpend * 0.4) {
        const categoryName = getLocalizedCategoryName(locale, biggestExpense.category || t(locale, 'other'));
        insights.push({
          icon: '🔍',
          text: t(locale, 'insightBigExpense').replace('{amount}', `<strong>${biggestExpenseAmount.toFixed(0)}€</strong>`).replace('{category}', `<strong>${categoryName}</strong>`).replace('{period}', getPeriodText()),
          color: 'blue',
        });
      }
    }
    
    if (range === 'day' && periodTotalSpend === 0) {
        insights.push({
            icon: '🎉',
            text: t(locale, 'insightNoSpendDay'),
            color: 'green',
        });
    }

    if (projects.length > 0) {
        const projectTotals: Record<string, number> = {};
        allExpenses.forEach(exp => {
            if (exp.project) {
                projectTotals[exp.project] = (projectTotals[exp.project] || 0) + (Number.parseFloat(exp.amount) || 0);
            }
        });
        const sortedProjects = Object.entries(projectTotals).sort(([,a], [,b]) => b - a);
        if (sortedProjects.length > 0) {
            const [topProjectName] = sortedProjects[0];
            insights.push({
                icon: '🚀',
                text: t(locale, 'insightTopProject').replace('{project}', topProjectName),
                color: 'blue',
            });
        }
    }

    if (income > 0) {
        const today = new Date();
        const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthKey = toLocalIsoDate(prevMonthDate).slice(0, 7);
        const prevMonthExpenses = allExpenses.filter(e => e.date?.startsWith(prevMonthKey));
        const prevMonthTotal = prevMonthExpenses.reduce((sum, e) => sum + (Number.parseFloat(e.amount) || 0), 0);
        const saved = income - prevMonthTotal;
        if (saved > 10) {
            insights.push({
                icon: '💰',
                text: t(locale, 'insightMonthlySavings').replace('{amount}', `${saved.toFixed(0)}€`),
                color: 'green',
            });
        }
    }

    if (range === 'year') {
        insights.push({
            icon: isYearOffTrack ? '📈' : '🎯',
            text: t(locale, isYearOffTrack ? 'insightYearlyPaceBad' : 'insightYearlyPaceGood'),
            color: isYearOffTrack ? 'orange' : 'green',
        });
    }

    insights.push({ icon: '💡', text: t(locale, 'tipReviewSubscriptions'), color: 'gray' });
    insights.push({ icon: '💡', text: t(locale, 'tipPlanGroceries'), color: 'gray' });
    insights.push({ icon: '💡', text: t(locale, 'tipSetGoals'), color: 'gray' });
    insights.push({ icon: '💡', text: t(locale, 'adviceExpert1'), color: 'gray' });
    insights.push({ icon: '💡', text: t(locale, 'adviceExpert2'), color: 'gray' });
    
    if (range === 'month' && budgetPaceView.mode === 'chart' && budgetPaceView.delta < 0) {
        insights.push({
            icon: '🏆',
            text: t(locale, 'rewardBudgetMaster'),
            color: 'yellow',
        });
      }

    if (insights.length === 0) {
      insights.push({
        icon: '💡',
        text: t(locale, 'tip1'),
        color: 'gray',
      });
    }

    const uniqueTexts = new Set<string>();
    return insights.filter((insight) => {
      if (uniqueTexts.has(insight.text)) return false;
      uniqueTexts.add(insight.text);
      return true;
    });
  }, [allExpenses, periodExpenses, budgetPaceView, range, locale, projects, income, isYearOffTrack]);
}