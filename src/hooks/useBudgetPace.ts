import { useMemo } from 'react';
import { toLocalIsoDate } from '../lib/date';
import type { Expense, Range } from '../types';

type BudgetPaceViewDisabled = {
  mode: 'disabled';
  actual: number;
  target: number;
  delta: number;
  paceTextKey: string;
};

type BudgetPaceViewDay = {
  mode: 'day';
  actual: number;
  target: number;
  delta: number;
  paceTextKey: string;
};

type BudgetPaceViewChart = {
  mode: 'chart';
  actual: number;
  target: number;
  delta: number;
  paceTextKey: string;
  targetBudget: number;
  periodSpendLabelKey: string;
  chart: {
    totalDays: number;
    currentIndex: number;
    actualSeries: number[];
    expectedSeries: number[];
    actualPoints: string;
    expectedPoints: string;
    tickIndexes: number[];
    tickLabels: string[];
    actualEndX: number;
    actualEndY: number;
  };
};

export type BudgetPaceView = BudgetPaceViewDisabled | BudgetPaceViewDay | BudgetPaceViewChart;

export type BudgetPaceModalChart = {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  xTicks: { index: number; label: string }[];
  yTicks: number[];
  actualPoints: string;
  expectedPoints: string;
  todayX: number;
  actualEndX: number;
  actualEndY: number;
  actualEndLabelLeft: boolean;
  toX: (index1Based: number) => number;
  toY: (value: number) => number;
};

export function useBudgetPace(metaFilteredExpenses: Expense[], parsedIncome: number, range: Range) {
  const budgetPaceView = useMemo<BudgetPaceView>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toLocalIsoDate(today);
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyTarget = daysInCurrentMonth > 0 ? parsedIncome / daysInCurrentMonth : 0;

    if (range === 'year') {
      return {
        mode: 'disabled',
        actual: 0,
        target: 0,
        delta: 0,
        paceTextKey: 'analyticsPaceYearDisabled',
      };
    }

    if (range === 'day') {
      const actualDay = metaFilteredExpenses.reduce((sum, expense) => {
        if (expense.date !== todayIso) return sum;
        return sum + (Number.parseFloat(expense.amount) || 0);
      }, 0);
      const targetDay = dailyTarget;
      const delta = actualDay - targetDay;

      return {
        mode: 'day',
        actual: actualDay,
        target: targetDay,
        delta,
        paceTextKey: delta > 0 ? 'analyticsPaceOverText' : 'analyticsPaceUnderText',
      };
    }

    const periodStart = new Date(today);
    const totalDays = range === 'week' ? 7 : daysInCurrentMonth;
    if (range === 'week') {
      const isoDow0Mon = (today.getDay() + 6) % 7;
      periodStart.setDate(today.getDate() - isoDow0Mon);
    } else {
      periodStart.setDate(1);
    }
    periodStart.setHours(0, 0, 0, 0);

    const dateToIndex = new Map<string, number>();
    for (let i = 0; i < totalDays; i += 1) {
      const date = new Date(periodStart);
      date.setDate(periodStart.getDate() + i);
      dateToIndex.set(toLocalIsoDate(date), i);
    }

    const dailySpend = Array.from({ length: totalDays }, () => 0);
    metaFilteredExpenses.forEach((expense) => {
      if (!expense.date) return;
      const index = dateToIndex.get(expense.date);
      if (index == null) return;
      dailySpend[index] += Number.parseFloat(expense.amount) || 0;
    });

    const currentIndex = Math.max(
      0,
      Math.min(
        totalDays - 1,
        Math.floor((today.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000))
      )
    );

    const actualCum: number[] = [];
    let running = 0;
    for (let i = 0; i < totalDays; i += 1) {
      if (i <= currentIndex) running += dailySpend[i];
      actualCum.push(running);
    }

    const targetBudget = range === 'week' ? dailyTarget * 7 : parsedIncome;
    const expectedCum = Array.from({ length: totalDays }, (_, i) => (targetBudget * (i + 1)) / totalDays);
    const actualToDate = actualCum[currentIndex] ?? 0;
    const expectedToDate = expectedCum[currentIndex] ?? 0;
    const delta = actualToDate - expectedToDate;
    const maxY = Math.max(targetBudget, actualCum[actualCum.length - 1] ?? 0, expectedCum[expectedCum.length - 1] ?? 0, 1);

    const actualEndX = totalDays > 1 ? (currentIndex / (totalDays - 1)) * 100 : 0;
    const actualEndY = 58 - (actualToDate / maxY) * 56;

    const toCardPoints = (series: number[]) =>
      series
        .map((value, i) => {
          const x = totalDays > 1 ? (i / (totalDays - 1)) * 100 : 0;
          const y = 58 - (value / maxY) * 56;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');

    const tickIndexes = range === 'week'
      ? [0, 3, 6].filter((idx) => idx < totalDays)
      : Array.from(new Set([0, 14, totalDays - 1])).sort((a, b) => a - b);
    const tickLabels = tickIndexes.map((idx) => {
      if (range === 'week') {
        const date = new Date(periodStart);
        date.setDate(periodStart.getDate() + idx);
        return `${date.getDate()}/${date.getMonth() + 1}`;
      }
      return String(idx + 1);
    });

    return {
      mode: 'chart',
      actual: actualToDate,
      target: expectedToDate,
      delta,
      paceTextKey: delta > 0 ? 'analyticsPaceOverText' : 'analyticsPaceUnderText',
      targetBudget,
      periodSpendLabelKey: range === 'week' ? 'analyticsWeekSpendLabel' : 'analyticsMonthSpendLabel',
      chart: {
        totalDays,
        currentIndex,
        actualSeries: actualCum,
        expectedSeries: expectedCum,
        actualPoints: toCardPoints(actualCum.slice(0, currentIndex + 1)),
        expectedPoints: toCardPoints(expectedCum),
        tickIndexes,
        tickLabels,
        actualEndX,
        actualEndY,
      },
    };
  }, [metaFilteredExpenses, parsedIncome, range]);

  const budgetPaceModalChart = useMemo<BudgetPaceModalChart | null>(() => {
    if (budgetPaceView.mode !== 'chart') return null;

    const width = 960;
    const height = 460;
    const margin = { top: 28, right: 28, bottom: 66, left: 58 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const totalDays = budgetPaceView.chart.totalDays;
    const maxY = Math.max(
      budgetPaceView.targetBudget,
      budgetPaceView.chart.actualSeries[budgetPaceView.chart.actualSeries.length - 1] ?? 0,
      1
    );

    const toX = (index1Based: number) => margin.left + ((index1Based - 1) / Math.max(1, totalDays - 1)) * plotW;
    const toY = (value: number) => margin.top + (1 - value / maxY) * plotH;
    const toPoints = (series: number[]) => series.map((value, i) => `${toX(i + 1)},${toY(value)}`).join(' ');

    const yTicksBase = budgetPaceView.targetBudget > 0
      ? [0, budgetPaceView.targetBudget / 2, budgetPaceView.targetBudget]
      : [0, maxY / 2, maxY];
    const yTicks = Array.from(new Set(yTicksBase.map((value) => Math.round(value)))).sort((a, b) => b - a);
    const xTicks = budgetPaceView.chart.tickIndexes.map((idx, i) => ({
      index: idx + 1,
      label: budgetPaceView.chart.tickLabels[i] ?? String(idx + 1),
    }));
    const todayIndex = budgetPaceView.chart.currentIndex + 1;

    return {
      width,
      height,
      margin,
      xTicks,
      yTicks,
      actualPoints: toPoints(budgetPaceView.chart.actualSeries.slice(0, todayIndex)),
      expectedPoints: toPoints(budgetPaceView.chart.expectedSeries),
      todayX: toX(todayIndex),
      actualEndX: toX(todayIndex),
      actualEndY: toY(budgetPaceView.chart.actualSeries[todayIndex - 1] ?? 0),
      actualEndLabelLeft: todayIndex / totalDays > 0.72,
      toX,
      toY,
    };
  }, [budgetPaceView]);

  return { budgetPaceView, budgetPaceModalChart };
}
