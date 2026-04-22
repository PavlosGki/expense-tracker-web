import { formatIsoDate } from '../lib/date';
import { getLocalizedCategoryName, t } from '../lib/i18n';
import type { Expense, HistoryGroup, Locale, Range } from '../types';
import type { Dispatch, SetStateAction } from 'react';

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
}: HomeMainViewProps) {
  return (
    <>
      {showDashboard && (
        <section className="summary-grid">
          {ranges.map((option) => (
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
      )}

      <section className="panel list-panel">
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
                            <small>
                              {[expense.project, expense.date ? formatIsoDate(expense.date) : '', expense.comment?.trim()].filter(Boolean).join(' • ')}
                            </small>
                          </span>
                          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {expense.receiptFileId && (
                              <a
                                href={`https://drive.google.com/file/d/${expense.receiptFileId}/view`}
                                target="_blank"
                                rel="noreferrer"
                                title="Προβολή απόδειξης"
                                style={{ fontSize: '16px', textDecoration: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                🧾
                              </a>
                            )}
                            {expense.amount} €
                          </strong>
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
