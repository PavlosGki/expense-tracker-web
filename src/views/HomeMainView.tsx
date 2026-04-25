import { formatIsoDate } from '../lib/date';
import { getLocalizedCategoryName, t } from '../lib/i18n';
import type { Expense, HistoryGroup, Locale, Range } from '../types';
import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from 'react';

type HomeMainViewProps = {
  locale: Locale;
  range: Range;
  ranges: Range[];
  totals: Record<Range, number>;
  showDashboard: boolean;
  historyGroups: HistoryGroup[];
  expandedGroups: Record<string, boolean>;
  setExpandedGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  setRange: (range: Range) => void;
  swipedExpenseId: string | null;
  setSwipedExpenseId: Dispatch<SetStateAction<string | null>>;
  handleDeleteExpense: (id: string) => void;
  handleExpenseTouchStart: (id: string, clientX: number) => void;
  handleExpenseTouchEnd: (id: string, clientX: number) => void;
  openEditExpense: (expense: Expense) => void;
  needsMonthTotal?: number;
  wantsMonthTotal?: number;
  income?: number;
};

export function HomeMainView({
  locale,
  range,
  ranges,
  totals,
  showDashboard,
  historyGroups,
  expandedGroups,
  setExpandedGroups,
  setRange,
  swipedExpenseId,
  setSwipedExpenseId,
  handleDeleteExpense,
  handleExpenseTouchStart,
  handleExpenseTouchEnd,
  openEditExpense,
  needsMonthTotal = 0,
  wantsMonthTotal = 0,
  income = 0,
}: HomeMainViewProps) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  return (
    <>
      {showDashboard && (
        <>
          <section className="summary-grid">
            {ranges.map((option) => (
              <button
                key={option}
                className={`summary-card ${range === option ? 'active' : ''}`}
                onClick={() => setRange(option)}
              >
                <span>{t(locale, option)}</span>
                <strong>{totals[option].toFixed(0)} €</strong>
              </button>
            ))}
          </section>
        </>
      )}

      <section className="panel list-panel" style={{ marginTop: '16px' }}>
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
                  <strong>{group.total.toFixed(0)} €</strong>
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
                            } else {
                              openEditExpense(expense);
                            }
                          }}
                        >
                          <span className="expense-emoji">{expense.emoji || '🏷️'}</span>
                          <div className="expense-copy">
                            <strong>{expense.comment || getLocalizedCategoryName(locale, expense.category)}</strong>
                            <small>{formatIsoDate(expense.date)} &bull; {getLocalizedCategoryName(locale, expense.category)}</small>
                          </div>
                          <strong className="expense-amount">{Number(expense.amount).toFixed(2)} €</strong>
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
    </>
  );
}
