import { useState } from 'react';
import { formatIsoDate } from '../lib/date';
import { getLocalizedCategoryName, getLocalizedMonthAcc, t } from '../lib/i18n';
import { YEAR_HEATMAP_MONTH_LABELS_EL, YEAR_HEATMAP_MONTH_LABELS_EN } from '../config/heatmapConstants';
import { HeatmapLegend } from '../components/HeatmapLegend';
import { getHeatmapColor } from '../lib/heatmap';

export function AnalyticsMainView(props: any) {
  const {
    locale, range, analyticsCarouselRef, isAnalyticsDraggingRef, isClickPreventedRef, analyticsStartXRef, analyticsScrollLeftRef,
    activeAnalyticsSlide, setActiveAnalyticsSlide, budgetPaceView, budgetPaceDelta, setAnalyticsModal, budgetPaceDayActualPct,
    budgetPaceActual, budgetPaceDayTargetPct, budgetPaceTarget, isComparisonMore, isComparisonLess, comparisonPct, prevLabelKey,
    prevTotal, prevBarPct, currentTotal, currentBarPct, categoryDonut, monthHeatmapData, setSeamlessHeatmapTransition, setHeatmapSlideDir,
    setHeatmapViewDate, setActiveHeatmapDay, weekHeatmapData, setWeekHeatmapSlideDir, setWeekHeatmapViewStartDate, setActiveWeekHeatmapDayIndex,
    yearHeatmapData, setYearHeatmapSlideDir, setActiveYearHeatmapMonth, hasActiveFilter, fromDate, toDate, categoryFilterLabel, projectFilterLabel,
    analyticsGroups, analyticsCategoryUniverse, expandedGroups, setExpandedGroups, openEditExpense
  } = props;

  const [categoryDetailsModal, setCategoryDetailsModal] = useState<{
    groupTitle: string;
    categoryName: string;
    categoryEmoji: string;
    expenses: any[];
    totalAmount: number;
  } | null>(null);

  return (
          <>
            <style>{`
              .analytics-hero-grid::-webkit-scrollbar {
                height: 6px;
              }
              .analytics-hero-grid::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
              }
              .analytics-hero-grid::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 10px;
              }
              .analytics-hero-grid {
                padding-bottom: 12px !important;
              }
              @keyframes slideFromRight {
                0% { transform: translateX(30px); opacity: 0; }
                100% { transform: translateX(0); opacity: 1; }
              }
              @keyframes slideFromLeft {
                0% { transform: translateX(-30px); opacity: 0; }
                100% { transform: translateX(0); opacity: 1; }
              }
              .slide-left {
                animation: slideFromRight 0.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
              }
              .slide-right {
                animation: slideFromLeft 0.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
              }
            `}</style>
            <section 
              className="analytics-hero-grid analytics-top-gap"
              ref={analyticsCarouselRef}
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => {
                if (!analyticsCarouselRef.current) return;
                isAnalyticsDraggingRef.current = true;
                isClickPreventedRef.current = false;
                analyticsStartXRef.current = e.pageX - analyticsCarouselRef.current.offsetLeft;
                analyticsScrollLeftRef.current = analyticsCarouselRef.current.scrollLeft;
                analyticsCarouselRef.current.style.cursor = 'grabbing';
                analyticsCarouselRef.current.style.scrollSnapType = 'none';
              }}
              onMouseLeave={() => {
                isAnalyticsDraggingRef.current = false;
                if (analyticsCarouselRef.current) {
                  analyticsCarouselRef.current.style.cursor = 'grab';
                  analyticsCarouselRef.current.style.scrollSnapType = 'x mandatory';
                }
              }}
              onMouseUp={() => {
                isAnalyticsDraggingRef.current = false;
                if (analyticsCarouselRef.current) {
                  analyticsCarouselRef.current.style.cursor = 'grab';
                  analyticsCarouselRef.current.style.scrollSnapType = 'x mandatory';
                }
              }}
              onMouseMove={(e) => {
                if (!isAnalyticsDraggingRef.current || !analyticsCarouselRef.current) return;
                e.preventDefault();
                const x = e.pageX - analyticsCarouselRef.current.offsetLeft;
                const walk = (x - analyticsStartXRef.current) * 1.5;
                if (Math.abs(walk) > 5) isClickPreventedRef.current = true;
                analyticsCarouselRef.current.scrollLeft = analyticsScrollLeftRef.current - walk;
              }}
              onClickCapture={(e) => {
                if (isClickPreventedRef.current) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
            onScroll={(e) => {
              const target = e.currentTarget;
              const scrollLeft = target.scrollLeft;
              let newIndex = 0;
              let minDiff = Infinity;
              Array.from(target.children).forEach((child, i) => {
                const childLeft = (child as HTMLElement).offsetLeft - target.offsetLeft;
                const diff = Math.abs(childLeft - scrollLeft);
                if (diff < minDiff) {
                  minDiff = diff;
                  newIndex = i;
                }
              });
              if (activeAnalyticsSlide !== newIndex) {
                setActiveAnalyticsSlide(newIndex);
              }
            }}
            >
              <article
                className={`panel analytics-hero-card analytics-pace-card ${budgetPaceView.mode === 'chart' ? 'analytics-openable-card' : ''}`}
                role={budgetPaceView.mode === 'chart' ? 'button' : undefined}
                tabIndex={budgetPaceView.mode === 'chart' ? 0 : undefined}
                onClick={() => {
                  if (budgetPaceView.mode === 'chart') setAnalyticsModal('pace');
                }}
                onKeyDown={(event) => {
                  if (budgetPaceView.mode === 'chart' && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setAnalyticsModal('pace');
                  }
                }}
              >
                <p className="panel-label">{t(locale, 'analyticsBudgetPaceTitle')}</p>
                <div className="analytics-kpi-compact">
                  <strong className={budgetPaceDelta > 0 ? 'danger' : 'success'}>
                    {Math.abs(budgetPaceDelta).toFixed(0)}€
                  </strong>
                  <small>{t(locale, budgetPaceView.paceTextKey)}</small>
                </div>
                {budgetPaceView.mode === 'chart' && (
                  <>
                    <div className="analytics-line-wrap">
                      <svg className="analytics-line-chart" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                        <polyline className="analytics-line expected" points={budgetPaceView.chart.expectedPoints} />
                        <polyline className="analytics-line" points={budgetPaceView.chart.forecastPoints} strokeDasharray="3 3" style={{ stroke: '#0a84ff', strokeWidth: 1.5, fill: 'none', opacity: 0.6 }} />
                        <polyline className="analytics-line actual" points={budgetPaceView.chart.actualPoints} />
                        <circle
                          cx={budgetPaceView.chart.actualEndX}
                          cy={budgetPaceView.chart.actualEndY}
                          r="2"
                          fill="#0a84ff"
                        />
                      </svg>
                    </div>
                    <div className="analytics-line-legend">
                      <span><i className="line-swatch expected" />{t(locale, 'analyticsExpectedLine')}</span>
                      <span><i className="line-swatch actual" />{t(locale, 'analyticsActualLine')}</span>
                    </div>
                  </>
                )}
                {budgetPaceView.mode === 'day' && (
              <>
                <div className="analytics-line-wrap" style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: '100%', height: '10px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '5px', margin: '24px 0' }}>
                    
                    <div style={{
                      position: 'absolute',
                      top: '-22px',
                      left: `${budgetPaceDayActualPct}%`,
                      transform: budgetPaceDayActualPct > 85 ? 'translateX(-100%)' : budgetPaceDayActualPct < 15 ? 'translateX(0)' : 'translateX(-50%)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '700',
                      transition: 'left 0.4s ease, transform 0.4s ease'
                    }}>
                      {budgetPaceActual.toFixed(2)}€
                    </div>

                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      left: `${budgetPaceDayTargetPct}%`,
                      transform: budgetPaceDayTargetPct > 85 ? 'translateX(-100%)' : budgetPaceDayTargetPct < 15 ? 'translateX(0)' : 'translateX(-50%)',
                      color: '#8e8e93',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {budgetPaceTarget.toFixed(2)}€
                    </div>

                    <div style={{
                      position: 'absolute', top: 0, left: 0, height: '100%',
                      width: `${budgetPaceDayActualPct}%`,
                      minWidth: '6px',
                      backgroundColor: '#0a84ff',
                      borderRadius: '5px',
                      transition: 'width 0.4s ease'
                    }} />
                    <div style={{
                      position: 'absolute', top: '-4px', bottom: '-4px',
                      left: `calc(${budgetPaceDayTargetPct}% - 1.5px)`,
                      width: '3px',
                      backgroundColor: '#8e8e93',
                      borderRadius: '2px',
                      boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                      zIndex: 2
                    }} />
                  </div>
                </div>
                <div className="analytics-line-legend">
                  <span><i className="line-swatch expected" />{t(locale, 'analyticsExpectedLine')}</span>
                  <span><i className="line-swatch actual" />{t(locale, 'analyticsActualLine')}</span>
                </div>
              </>
                )}
                {budgetPaceView.mode === 'disabled' && (
                  <p className="analytics-pace-note">{t(locale, 'analyticsPaceYearDisabled')}</p>
                )}
              </article>

              <article className="panel analytics-hero-card">
                <p className="panel-label">{t(locale, 'analyticsComparisonTitle')}</p>
                
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '20px', marginTop: '4px' }}>
                  <strong style={{ fontSize: '28px', lineHeight: '1', color: isComparisonMore ? '#ff453a' : isComparisonLess ? '#32d74b' : '#8e8e93' }}>
                    {isComparisonMore ? '+' : isComparisonLess ? '-' : ''}{Math.abs(comparisonPct).toFixed(0)}%
                  </strong>
                  <span style={{ color: '#8e8e93', fontSize: '13px', paddingBottom: '3px', fontWeight: '500' }}>
                    {isComparisonMore ? t(locale, 'analyticsMore') : isComparisonLess ? t(locale, 'analyticsLess') : t(locale, 'analyticsSame')}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Previous Bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#8e8e93', fontWeight: '500' }}>
                      <span>{t(locale, prevLabelKey)}</span>
                      <span>{prevTotal.toFixed(0)}€</span>
                    </div>
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${prevBarPct}%`, background: '#8e8e93', height: '100%', borderRadius: '5px', transition: 'width 0.5s ease-out' }} />
                    </div>
                  </div>

                  {/* Current Bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#fff', fontWeight: '600' }}>
                      <span>{t(locale, 'analyticsCurrent')}</span>
                      <span>{currentTotal.toFixed(0)}€</span>
                    </div>
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${currentBarPct}%`, background: isComparisonMore ? '#ff453a' : isComparisonLess ? '#32d74b' : '#0a84ff', height: '100%', borderRadius: '5px', transition: 'width 0.5s ease-out' }} />
                    </div>
                  </div>
                </div>
              </article>

              <article
                className="panel analytics-hero-card analytics-openable-card"
                role="button"
                tabIndex={0}
                onClick={() => setAnalyticsModal('donut')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setAnalyticsModal('donut');
                  }
                }}
              >
                <p className="panel-label">{t(locale, 'analyticsCategorySplitTitle')}</p>
                <div
                  className="analytics-donut"
                  style={{
                    background: categoryDonut.total > 0 ? `conic-gradient(${categoryDonut.gradient})` : 'conic-gradient(#2c2c2e 0% 100%)',
                  }}
                >
                  <span>{categoryDonut.total > 0 ? `${categoryDonut.total.toFixed(0)}€` : '0€'}</span>
                </div>
              </article>

              {range === 'month' && monthHeatmapData && (
                <article 
                  className="panel analytics-hero-card analytics-openable-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSeamlessHeatmapTransition(false);
                  setHeatmapSlideDir('');
                    setAnalyticsModal('heatmap');
                    const now = new Date();
                    setHeatmapViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                    setActiveHeatmapDay(new Date().getDate());
                  }}
                >
                  <p className="panel-label">{t(locale, 'analyticsSpendingHeatmap')}</p>
                  <p className="heatmap-card-month-label">
                    {getLocalizedMonthAcc(locale, monthHeatmapData.month)} {monthHeatmapData.year}
                  </p>
                  <div className="heatmap-card-weekdays">
                    {locale === 'el' ? ['Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ', 'Κ'].map((d, i) => <span key={i}>{d}</span>) : ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
                  </div>
                  <div className="heatmap-card-grid">
                    {Array.from({ length: monthHeatmapData.firstDayDow }).map((_, i) => (
                      <div key={`empty-${i}`} className="heatmap-card-empty" />
                    ))}
                    {monthHeatmapData.dailySpend.map((amount: number, index: number) => {
                      const dayOfMonth = index + 1;
                      const bgColor = getHeatmapColor(amount, monthHeatmapData.maxSpend);
                      
                      const isToday = new Date().getDate() === dayOfMonth;
                      
                      return (
                        <div
                          key={`day-${dayOfMonth}`}
                          title={`${dayOfMonth}: ${amount.toFixed(2)}€`}
                          style={{
                            background: bgColor,
                            aspectRatio: '1/1',
                            borderRadius: '5px',
                            border: isToday ? '1px solid rgba(255, 255, 255, 0.8)' : '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'clamp(9px, 1.6vw, 11px)',
                            color: amount > monthHeatmapData.maxSpend * 0.5 ? '#fff' : 'rgba(255,255,255,0.7)',
                            fontWeight: isToday ? 'bold' : 'normal'
                          }}
                        >
                          {dayOfMonth}
                        </div>
                      );
                    })}
                  </div>
                  <HeatmapLegend locale={locale} />
                </article>
              )}

              {range === 'week' && weekHeatmapData && (
                <article
                  className="panel analytics-hero-card analytics-openable-card week-heatmap-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSeamlessHeatmapTransition(false);
                    setWeekHeatmapSlideDir('');
                    const now = new Date();
                    const weekStart = new Date(now);
                    weekStart.setHours(0, 0, 0, 0);
                    const isoDow0Mon = (weekStart.getDay() + 6) % 7;
                    weekStart.setDate(weekStart.getDate() - isoDow0Mon);
                    setWeekHeatmapViewStartDate(weekStart);
                    setActiveWeekHeatmapDayIndex(isoDow0Mon);
                    setAnalyticsModal('weekHeatmap');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setWeekHeatmapSlideDir('');
                      const now = new Date();
                      const weekStart = new Date(now);
                      weekStart.setHours(0, 0, 0, 0);
                      const isoDow0Mon = (weekStart.getDay() + 6) % 7;
                      weekStart.setDate(weekStart.getDate() - isoDow0Mon);
                      setWeekHeatmapViewStartDate(weekStart);
                      setActiveWeekHeatmapDayIndex(isoDow0Mon);
                      setAnalyticsModal('weekHeatmap');
                    }
                  }}
                >
                  <p className="panel-label">{t(locale, 'analyticsSpendingHeatmap')}</p>
                  <p className="heatmap-card-month-label">
                    {`${weekHeatmapData.days[0].getDate()}/${weekHeatmapData.days[0].getMonth() + 1} - ${weekHeatmapData.days[6].getDate()}/${weekHeatmapData.days[6].getMonth() + 1}`}
                  </p>
                  <div className="week-heatmap-grid" style={{ margin: 'auto 0', justifyContent: 'center' }}>
                    {weekHeatmapData.dailySpend.map((amount: number, index: number) => {
                      const bgColor = getHeatmapColor(amount, weekHeatmapData.maxSpend);
                      const day = weekHeatmapData.days[index];
                      return (
                        <div key={`week_day_${index}`} className="week-heatmap-cell" style={{ background: bgColor }}>
                          <span>{day.getDate()}</span>
                        </div>
                      );
                    })}
                  </div>
                  <HeatmapLegend locale={locale} />
                </article>
              )}

              {range === 'year' && yearHeatmapData && (
                <article
                  className="panel analytics-hero-card analytics-openable-card year-heatmap-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSeamlessHeatmapTransition(false);
                    setYearHeatmapSlideDir('');
                    setActiveYearHeatmapMonth(new Date().getMonth());
                    setAnalyticsModal('yearHeatmap');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSeamlessHeatmapTransition(false);
                      setYearHeatmapSlideDir('');
                      setActiveYearHeatmapMonth(new Date().getMonth());
                      setAnalyticsModal('yearHeatmap');
                    }
                  }}
                >
                  <p className="panel-label">{t(locale, 'analyticsSpendingHeatmap')}</p>
                  <p className="heatmap-card-month-label">{yearHeatmapData.year}</p>
                  <div className="year-heatmap-grid" style={{ margin: 'auto 0', justifyContent: 'center' }}>
                    {yearHeatmapData.monthlySpend.map((amount: number, monthIndex: number) => {
                      const bgColor = getHeatmapColor(amount, yearHeatmapData.maxSpend);
                      return (
                        <div key={`year_month_${monthIndex}`} className="year-heatmap-cell" style={{ background: bgColor }}>
                          <span>{locale === 'el' ? YEAR_HEATMAP_MONTH_LABELS_EL[monthIndex] : YEAR_HEATMAP_MONTH_LABELS_EN[monthIndex]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <HeatmapLegend locale={locale} />
                </article>
              )}
            </section>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', paddingBottom: '4px', marginTop: '-8px' }}>
              {Array.from({ length: range === 'day' ? 3 : 4 }).map((_, idx) => (
                <div
                  key={`analytics-dot-${idx}`}
                  style={{
                    width: activeAnalyticsSlide === idx ? '16px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    backgroundColor: activeAnalyticsSlide === idx ? '#f5f5f7' : '#48484a',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    const target = analyticsCarouselRef.current;
                    if (target && target.children[idx]) {
                      const child = target.children[idx] as HTMLElement;
                      target.scrollTo({ left: child.offsetLeft - target.offsetLeft, behavior: 'smooth' });
                    }
                  }}
                />
              ))}
            </div>

            {hasActiveFilter && (
              <section className="toolbar-row" style={{ marginBottom: '8px' }}>
                <p className="filter-pill">
                  {t(locale, 'activeFilters')}:{' '}
                  {fromDate ? formatIsoDate(fromDate) : '—'} /{' '}
                  {toDate ? formatIsoDate(toDate) : '—'} /{' '}
                  {categoryFilterLabel || t(locale, 'allCategories')} /{' '}
                  {projectFilterLabel}
                </p>
              </section>
            )}

            <section className="panel list-panel" style={{ marginTop: '4px' }}>
              {analyticsGroups.map((group: any) => {
                const expanded = expandedGroups[group.id] ?? group.isCurrent;
                const aggregate: Record<string, { amount: number; emoji: string }> = {};
                group.items.forEach((expense: any) => {
                  const key = expense.category || t(locale, 'other');
                  if (!aggregate[key]) aggregate[key] = { amount: 0, emoji: expense.emoji || '🏷️' };
                  aggregate[key].amount += Number.parseFloat(expense.amount) || 0;
                });
                const rows = analyticsCategoryUniverse
                  .map((category: any) => {
                    const entry = aggregate[category.name];
                    return {
                      originalName: category.name,
                      name: getLocalizedCategoryName(locale, category.name),
                      amount: entry?.amount ?? 0,
                      emoji: entry?.emoji ?? category.emoji ?? '🏷️',
                    };
                  })
                  .filter((row: any) => row.amount > 0)
                  .sort((a: any, b: any) => b.amount - a.amount);
                const maxAmount = rows[0]?.amount ?? 0;
                const totalAmount = rows.reduce((sum: number, row: any) => sum + row.amount, 0);

                return (
                  <article key={group.id} className="group-card">
                    <button className="group-header" onClick={() => setExpandedGroups((prev: any) => ({ ...prev, [group.id]: !expanded }))}>
                      <span>{group.title}</span>
                      <strong>{totalAmount.toFixed(2)} €</strong>
                    </button>
                    {expanded && (
                      <div className="group-body">
                        {rows.length === 0 ? (
                          <p className="empty-line">{t(locale, 'noExpenses')}</p>
                        ) : (
                          rows.map((row: any) => {
                            const fillPct = maxAmount > 0 ? (row.amount / maxAmount) * 100 : 0;
                            const isTightBar = fillPct <= 20;
                            return (
                              <div 
                                key={`${group.id}_${row.name}`} 
                                className="bar-row"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  const catExpenses = group.items.filter((e: any) => (e.category || t(locale, 'other')) === row.originalName);
                                  setCategoryDetailsModal({
                                    groupTitle: group.title,
                                    categoryName: row.name,
                                    categoryEmoji: row.emoji,
                                    expenses: catExpenses,
                                    totalAmount: row.amount
                                  });
                                }}
                              >
                                <div className="bar-label">
                                  <span>{row.emoji}</span>
                                  <strong>{row.name}</strong>
                                </div>
                                <div className="bar-track" style={{ position: 'relative' }}>
                                  <div 
                                    className="bar-fill" 
                                    style={{ 
                                      width: `${Math.max(0.5, fillPct)}%`, 
                                      minWidth: '4px',
                                      padding: 0
                                    }} 
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: isTightBar ? `calc(${Math.max(0.5, fillPct)}% + 8px)` : 'auto',
                                    right: isTightBar ? 'auto' : `calc(100% - ${fillPct}% + 8px)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: isTightBar ? '#8e8e93' : '#fff',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    zIndex: 2,
                                  }}>
                                    {row.amount.toFixed(0)} €
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            {categoryDetailsModal && (
              <div className="modal-backdrop" onClick={() => setCategoryDetailsModal(null)} style={{ zIndex: 1000 }}>
                <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '32px' }}>{categoryDetailsModal.categoryEmoji}</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{categoryDetailsModal.categoryName}</h3>
                        <div style={{ color: '#8e8e93', fontSize: '13px', marginTop: '2px' }}>{categoryDetailsModal.groupTitle}</div>
                      </div>
                    </div>
                    <button className="ghost-btn" style={{ padding: '8px' }} onClick={() => setCategoryDetailsModal(null)}>
                      {t(locale, 'close')}
                    </button>
                  </div>
                  
                  <div style={{ padding: '16px', background: '#111214', borderRadius: '12px', border: '1px solid #2c2c2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ color: '#8e8e93', fontSize: '14px', fontWeight: '500' }}>{t(locale, 'analyticsTotal')}</span>
                    <strong style={{ fontSize: '20px', color: '#fff' }}>{categoryDetailsModal.totalAmount.toFixed(2)}€</strong>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                    {categoryDetailsModal.expenses.map((exp: any) => (
                      <div 
                        key={exp.id} 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', cursor: openEditExpense ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (openEditExpense) {
                            setCategoryDetailsModal(null);
                            openEditExpense(exp);
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '20px' }}>{exp.emoji}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>
                              {exp.comment || getLocalizedCategoryName(locale, exp.category)}
                            </span>
                            <span style={{ fontSize: '12px', color: '#8e8e93' }}>
                              {formatIsoDate(exp.date)} {exp.project ? ` • ${exp.project}` : ''}
                            </span>
                          </div>
                        </div>
                        <strong style={{ fontSize: '15px', color: '#fff' }}>{Number.parseFloat(exp.amount).toFixed(2)}€</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
  );
}
