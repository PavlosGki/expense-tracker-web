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
  const [activeRuleSlide, setActiveRuleSlide] = useState(0);
  const ruleCarouselRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const [animated, setAnimated] = useState(false);

  const [showRuleTooltip, setShowRuleTooltip] = useState(false);

  useEffect(() => {
    if (!showRuleTooltip) return;
    const closeTooltip = () => setShowRuleTooltip(false);
    setTimeout(() => {
      window.addEventListener('click', closeTooltip);
    }, 0);
    return () => window.removeEventListener('click', closeTooltip);
  }, [showRuleTooltip]);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const targetNeeds = income * 0.5;
  const targetWants = income * 0.3;
  const targetSavings = income * 0.2;

  const currentNeeds = needsMonthTotal;
  const currentWants = wantsMonthTotal;
  const currentSavings = Math.max(0, income - currentNeeds - currentWants);

  const needsPct = targetNeeds > 0 ? (currentNeeds / targetNeeds) * 100 : 0;
  const wantsPct = targetWants > 0 ? (currentWants / targetWants) * 100 : 0;
  const savingsPct = targetSavings > 0 ? (currentSavings / targetSavings) * 100 : 0;

  const ruleSegments = [
    { label: 'Ανάγκες', target: 50, amount: currentNeeds, color: '#0a84ff', icon: '🏠' },
    { label: 'Επιθυμίες', target: 30, amount: currentWants, color: '#ff9f0a', icon: '🍕' },
    { label: 'Αποταμίευση', target: 20, amount: currentSavings, color: '#32d74b', icon: '🏦' },
  ];

  // Gauge Render Helper
  const renderGauge = (label: string, targetPctOfIncome: number, currentAmount: number, color: string, icon: string, isSavings: boolean = false) => {
    const displayAmount = animated ? currentAmount : 0;
    const currentPctOfIncome = income > 0 ? (displayAmount / income) * 100 : 0;
    const clampedPct = Math.min(100, currentPctOfIncome);
    
    const cx = 50, cy = 50, r = 35;
    const L = Math.PI * r;
    const dashOffset = L - ((animated ? targetPctOfIncome : 0) / 100) * L;
    
    // Needle rotation: 0% is -90deg, 100% is +90deg
    const needleRotation = (clampedPct / 100) * 180 - 90;
    
    // Draw needle pointing straight UP (which is 0deg rotation, middle of gauge)
    const tipX = cx;
    const tipY = cy - 40;
    
    const base1X = cx - 2.5;
    const base1Y = cy;
    const base2X = cx + 2.5;
    const base2Y = cy;

    const isOver = isSavings ? currentAmount < (income * (targetPctOfIncome/100)) : currentAmount > (income * (targetPctOfIncome/100));
    const needleColor = isOver ? (isSavings ? '#ff9f0a' : '#ff453a') : '#f5f5f7';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 2px' }}>
        <svg 
          width="100%" 
          viewBox="8 5 84 66" 
          style={{ overflow: 'visible' }}
        >
          {/* Background track (Total Income) */}
          <path d={`M 15 50 A 35 35 0 0 1 85 50`} fill="none" stroke="#2c2c2e" strokeWidth="10" strokeLinecap="butt" />
          
          {/* Colored target area */}
          <path 
            d={`M 15 50 A 35 35 0 0 1 85 50`} 
            fill="none" 
            stroke={color} 
            strokeWidth="10" 
            strokeLinecap="butt" 
            strokeDasharray={`${L}`} 
            strokeDashoffset={`${dashOffset}`} 
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
          
          {/* Needle */}
          <g 
            style={{ 
              transform: `rotate(${needleRotation}deg)`, 
              transformOrigin: `${cx}px ${cy}px`, 
              transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' 
            }}
          >
            <polygon points={`${base1X},${base1Y} ${base2X},${base2Y} ${tipX},${tipY}`} fill={needleColor} style={{ transition: 'fill 1s ease-out' }} />
          </g>
          <circle cx={cx} cy={cy} r="3.5" fill={needleColor} style={{ transition: 'fill 1s ease-out' }} />
          
          {/* Current Amount */}
          <text x="50" y="68" fill={isOver ? needleColor : '#f5f5f7'} fontSize="13" textAnchor="middle" fontWeight="700">
            {displayAmount.toFixed(0)}€
          </text>
        </svg>
        <span style={{ fontSize: '11px', color: '#8e8e93', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
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
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <h3 
                  className="budget-title" 
                  style={{ margin: 0, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={(e) => { e.stopPropagation(); setShowRuleTooltip(true); }}
                >
                  ΚΑΝΟΝΑΣ 50/30/20
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="#8e8e93" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                </h3>
                {showRuleTooltip && (
                  <div 
                    style={{ position: 'absolute', top: '24px', left: '0', width: '220px', padding: '10px', backgroundColor: '#1c1c1f', border: '1px solid #2c2c2e', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 100, color: '#f5f5f7', fontSize: '11px', lineHeight: '1.4' }} 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <strong style={{ color: '#fff', display: 'block', marginBottom: '6px', fontSize: '12px' }}>Κανόνας 50/30/20</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><span style={{ color: '#0a84ff', fontWeight: 'bold' }}>50% Ανάγκες:</span> Στέγαση, λογαριασμοί, s/m.</div>
                      <div><span style={{ color: '#ff9f0a', fontWeight: 'bold' }}>30% Επιθυμίες:</span> Διασκέδαση, ψώνια, χόμπι.</div>
                      <div><span style={{ color: '#32d74b', fontWeight: 'bold' }}>20% Αποταμίευση:</span> Αποταμίευση, επενδύσεις.</div>
                    </div>
                  </div>
                )}
              </div>
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

              {/* Slide 1: Gauges */}
              <div className="budget-panel" style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: '0 16px', display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                {renderGauge('Ανάγκες', 50, currentNeeds, '#0a84ff', '🏠')}
                {renderGauge('Επιθυμίες', 30, currentWants, '#ff9f0a', '🍕')}
                {renderGauge('Αποταμίευση', 20, currentSavings, '#32d74b', '🏦', true)}
              </div>

              {/* Slide 2: 50/30/20 Stack Bar */}
              <div className="budget-panel" style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', color: '#f5f5f7' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{
                      height: '28px',
                      width: '100%',
                      display: 'flex',
                      borderRadius: '0',
                      overflow: 'hidden',
                      backgroundColor: '#1c1c1f',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                    }}>
                      {income > 0 && (
                        <>
                          <div style={{ 
                            width: `${animated ? (currentNeeds / income) * 100 : 0}%`, 
                            backgroundColor: '#0a84ff', 
                            height: '100%', 
                            transition: 'width 1s ease-out',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden'
                          }}>
                            {((currentNeeds / income) * 100) >= 10 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{((currentNeeds / income) * 100).toFixed(0)}%</span>}
                          </div>
                          <div style={{ 
                            width: `${animated ? (currentWants / income) * 100 : 0}%`, 
                            backgroundColor: '#ff9f0a', 
                            height: '100%', 
                            transition: 'width 1s ease-out',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden'
                          }}>
                            {((currentWants / income) * 100) >= 10 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{((currentWants / income) * 100).toFixed(0)}%</span>}
                          </div>
                          <div style={{ 
                            width: `${animated ? (currentSavings / income) * 100 : 0}%`, 
                            backgroundColor: '#32d74b', 
                            height: '100%', 
                            transition: 'width 1s ease-out',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden'
                          }}>
                            {((currentSavings / income) * 100) >= 10 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{((currentSavings / income) * 100).toFixed(0)}%</span>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ideal Ratio Thin Bar */}
                  {income > 0 && (
                    <div style={{ width: '100%', height: '4px', display: 'flex', borderRadius: '0', overflow: 'hidden', opacity: 0.8 }}>
                      <div style={{ width: '50%', backgroundColor: '#0a84ff' }} />
                      <div style={{ width: '30%', backgroundColor: '#ff9f0a' }} />
                      <div style={{ width: '20%', backgroundColor: '#32d74b' }} />
                    </div>
                  )}

                  {income > 0 && (
                    <div style={{ display: 'flex', width: '100%', fontSize: '11px', fontWeight: '600', color: '#8e8e93', textAlign: 'center' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ color: '#0a84ff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>ΑΝΑΓΚΕΣ <span style={{ opacity: 0.7 }}>50%</span></span>
                        <span style={{ color: currentNeeds > targetNeeds ? '#ff453a' : '#f5f5f7' }}>{currentNeeds.toFixed(0)}€ / {targetNeeds.toFixed(0)}€</span>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ color: '#ff9f0a', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>ΕΠΙΘΥΜΙΕΣ <span style={{ opacity: 0.7 }}>30%</span></span>
                        <span style={{ color: currentWants > targetWants ? '#ff453a' : '#f5f5f7' }}>{currentWants.toFixed(0)}€ / {targetWants.toFixed(0)}€</span>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ color: '#32d74b', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>ΑΠΟΤΑΜΙΕΥΣΗ <span style={{ opacity: 0.7 }}>20%</span></span>
                        <span style={{ color: '#f5f5f7' }}>{currentSavings.toFixed(0)}€ / {targetSavings.toFixed(0)}€</span>
                      </div>
                    </div>
                  )}
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
