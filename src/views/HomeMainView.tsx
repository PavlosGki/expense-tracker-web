import { formatIsoDate } from '../lib/date';
import { getLocalizedCategoryName, t } from '../lib/i18n';
import type { Expense, HistoryGroup, Locale, Range } from '../types';
import { useState, useRef, type Dispatch, type SetStateAction } from 'react';

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
  const [activeRuleSlide, setActiveRuleSlide] = useState(0);
  const ruleCarouselRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const targetNeeds = income * 0.5;
  const targetWants = income * 0.3;
  const targetSavings = income * 0.2;

  const currentNeeds = needsMonthTotal;
  const currentWants = wantsMonthTotal;
  const currentSavings = Math.max(0, income - currentNeeds - currentWants);

  const needsPct = targetNeeds > 0 ? (currentNeeds / targetNeeds) * 100 : 0;
  const wantsPct = targetWants > 0 ? (currentWants / targetWants) * 100 : 0;
  const savingsPct = targetSavings > 0 ? (currentSavings / targetSavings) * 100 : 0;

  const visualNeedsPct = Math.min(100, needsPct);
  const visualWantsPct = Math.min(100, wantsPct);
  const visualSavingsPct = Math.min(100, savingsPct);

  // Dynamic scaling logic for horizontal bars
  const requiredNeeds = Math.max(50, (needsPct / 100) * 50);
  const requiredWants = Math.max(30, (wantsPct / 100) * 30);
  const requiredSavings = Math.max(20, (savingsPct / 100) * 20);

  const maxRequired = Math.max(requiredNeeds, requiredWants, requiredSavings);
  const dynamicScale = 100 / maxRequired;

  const trackWidthNeeds = 50 * dynamicScale;
  const trackWidthWants = 30 * dynamicScale;
  const trackWidthSavings = 20 * dynamicScale;

  // Gauge Render Helper
  const renderGauge = (label: string, targetPctOfIncome: number, currentAmount: number, color: string, icon: string, isSavings: boolean = false) => {
    const currentPctOfIncome = income > 0 ? (currentAmount / income) * 100 : 0;
    const clampedPct = Math.min(100, currentPctOfIncome);

    const cx = 50, cy = 50, r = 35;
    const L = Math.PI * r;
    const dashOffset = L - (targetPctOfIncome / 100) * L;

    const angleRad = Math.PI - (clampedPct / 100) * Math.PI;
    const tipX = cx + 40 * Math.cos(angleRad);
    const tipY = cy - 40 * Math.sin(angleRad);

    // Needle base
    const base1X = cx + 2.5 * Math.cos(angleRad - Math.PI / 2);
    const base1Y = cy - 2.5 * Math.sin(angleRad - Math.PI / 2);
    const base2X = cx + 2.5 * Math.cos(angleRad + Math.PI / 2);
    const base2Y = cy - 2.5 * Math.sin(angleRad + Math.PI / 2);

    const isOver = isSavings ? currentAmount < (income * (targetPctOfIncome / 100)) : currentAmount > (income * (targetPctOfIncome / 100));
    const needleColor = isOver ? (isSavings ? '#ff9f0a' : '#ff453a') : '#f5f5f7';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 4px' }}>
        <svg width="100%" viewBox="0 0 100 70" style={{ overflow: 'visible' }}>
          {/* Background track (Total Income) */}
          <path d={`M 15 50 A 35 35 0 0 1 85 50`} fill="none" stroke="#2c2c2e" strokeWidth="10" strokeLinecap="round" />

          {/* Colored target area */}
          <path
            d={`M 15 50 A 35 35 0 0 1 85 50`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={L}
            strokeDashoffset={dashOffset}
          />

          {/* Needle */}
          <polygon points={`${base1X},${base1Y} ${base2X},${base2Y} ${tipX},${tipY}`} fill={needleColor} style={{ transition: 'all 0.5s ease' }} />
          <circle cx={cx} cy={cy} r="3" fill={needleColor} style={{ transition: 'fill 0.5s ease' }} />

          {/* Current Amount */}
          <text x="50" y="68" fill={isOver ? needleColor : '#f5f5f7'} fontSize="12" textAnchor="middle" fontWeight="700">
            {currentAmount.toFixed(0)}€
          </text>
        </svg>
        <span style={{ fontSize: '10px', color: '#8e8e93', marginTop: '2px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>{icon}</span> {label}
        </span>
      </div>
    );
  };

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
                <strong>{totals[option].toFixed(2)} €</strong>
              </button>
            ))}
          </section>

          <section className="panel rule-panel" style={{ marginTop: '16px', padding: '16px 0 0 0', overflow: 'hidden' }}>
            <div style={{ padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="budget-title" style={{ margin: 0, fontSize: '13px' }}>ΚΑΝΟΝΑΣ 50/30/20</h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: activeRuleSlide === i ? '#0a84ff' : '#48484a',
                      transition: 'background-color 0.3s ease'
                    }}
                  />
                ))}
              </div>
            </div>

            <div
              className="budget-carousel"
              ref={ruleCarouselRef}
              style={{
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                cursor: 'grab',
                paddingBottom: '16px',
                margin: '12px 0 0 0',
                borderRadius: '0 0 28px 28px',
                minHeight: '130px',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none'
              }}
              onMouseDown={(e) => {
                if (!ruleCarouselRef.current) return;
                isDraggingRef.current = true;
                startXRef.current = e.pageX - ruleCarouselRef.current.offsetLeft;
                scrollLeftRef.current = ruleCarouselRef.current.scrollLeft;
                ruleCarouselRef.current.style.cursor = 'grabbing';
                ruleCarouselRef.current.style.scrollSnapType = 'none';
              }}
              onMouseLeave={() => {
                isDraggingRef.current = false;
                if (ruleCarouselRef.current) {
                  ruleCarouselRef.current.style.cursor = 'grab';
                  ruleCarouselRef.current.style.scrollSnapType = 'x mandatory';
                }
              }}
              onMouseUp={() => {
                isDraggingRef.current = false;
                if (ruleCarouselRef.current) {
                  ruleCarouselRef.current.style.cursor = 'grab';
                  ruleCarouselRef.current.style.scrollSnapType = 'x mandatory';
                }
              }}
              onMouseMove={(e) => {
                if (!isDraggingRef.current || !ruleCarouselRef.current) return;
                e.preventDefault();
                const x = e.pageX - ruleCarouselRef.current.offsetLeft;
                const walk = (x - startXRef.current) * 1.5;
                ruleCarouselRef.current.scrollLeft = scrollLeftRef.current - walk;
              }}
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.clientWidth > 0) {
                  const index = Math.round(target.scrollLeft / target.clientWidth);
                  if (index !== activeRuleSlide) {
                    setActiveRuleSlide(index);
                  }
                }
              }}
            >
              <style>{`.budget-carousel::-webkit-scrollbar { display: none; }`}</style>

              {/* Slide 1: True Gauges */}
              <div className="budget-panel" style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: '0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                {renderGauge('Ανάγκες', 50, currentNeeds, '#0a84ff', '🏠')}
                {renderGauge('Επιθυμίες', 30, currentWants, '#ff9f0a', '🍕')}
                {renderGauge('Αποταμίευση', 20, currentSavings, '#32d74b', '🏦', true)}
              </div>

              {/* Slide 2: Proportional Bars */}
              <div className="budget-panel" style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
                <div className="rule-bucket">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#f5f5f7', fontWeight: 600 }}>🏠 Ανάγκες (50%)</span>
                    <span style={{ fontSize: '0.85rem', color: needsPct > 100 ? '#ff453a' : '#8e8e93' }}>
                      {currentNeeds.toFixed(0)}€ / {targetNeeds.toFixed(0)}€
                    </span>
                  </div>
                  <div className="progress-track" style={{ marginTop: 0, height: '10px', width: `${trackWidthNeeds}%`, position: 'relative', overflow: 'visible', borderRadius: '5px', backgroundColor: '#2c2c2e', transition: 'width 0.3s ease' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${visualNeedsPct}%`, backgroundColor: '#0a84ff', borderRadius: '5px' }} />
                    {needsPct > 100 && (
                      <div style={{ position: 'absolute', top: 0, left: '100%', height: '100%', width: `${needsPct - 100}%`, backgroundColor: '#ff453a', borderRadius: '0 5px 5px 0' }} />
                    )}
                  </div>
                </div>

                <div className="rule-bucket">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#f5f5f7', fontWeight: 600 }}>🍕 Επιθυμίες (30%)</span>
                    <span style={{ fontSize: '0.85rem', color: wantsPct > 100 ? '#ff453a' : '#8e8e93' }}>
                      {currentWants.toFixed(0)}€ / {targetWants.toFixed(0)}€
                    </span>
                  </div>
                  <div className="progress-track" style={{ marginTop: 0, height: '10px', width: `${trackWidthWants}%`, position: 'relative', overflow: 'visible', borderRadius: '5px', backgroundColor: '#2c2c2e', transition: 'width 0.3s ease' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${visualWantsPct}%`, backgroundColor: '#ff9f0a', borderRadius: '5px' }} />
                    {wantsPct > 100 && (
                      <div style={{ position: 'absolute', top: 0, left: '100%', height: '100%', width: `${wantsPct - 100}%`, backgroundColor: '#ff453a', borderRadius: '0 5px 5px 0' }} />
                    )}
                  </div>
                </div>

                <div className="rule-bucket">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#f5f5f7', fontWeight: 600 }}>🏦 Αποταμίευση (20%)</span>
                    <span style={{ fontSize: '0.85rem', color: '#8e8e93' }}>
                      {currentSavings.toFixed(0)}€ / {targetSavings.toFixed(0)}€
                    </span>
                  </div>
                  <div className="progress-track" style={{ marginTop: 0, height: '10px', width: `${trackWidthSavings}%`, position: 'relative', overflow: 'visible', borderRadius: '5px', backgroundColor: '#2c2c2e', transition: 'width 0.3s ease' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${visualSavingsPct}%`, backgroundColor: currentSavings < targetSavings ? '#ff9f0a' : '#32d74b', borderRadius: '5px' }} />
                    {savingsPct > 100 && (
                      <div style={{ position: 'absolute', top: 0, left: '100%', height: '100%', width: `${savingsPct - 100}%`, backgroundColor: '#30b043', borderRadius: '0 5px 5px 0' }} />
                    )}
                  </div>
                </div>
              </div>

            </div>
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
