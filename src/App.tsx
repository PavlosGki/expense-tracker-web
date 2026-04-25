import type { Session, User } from '@supabase/supabase-js';
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { buildCsv, downloadCsv, parseCsvRows } from './lib/csv';
import { compressImage } from './lib/media';
import {
  filterExpensesByDateRange,
  formatIsoDate,
  getAnalyticsGroups,
  getExpensePeriodTotals,
  getHistoryGroups,
  parseIsoDateToLocal,
  toLocalIsoDate,
} from './lib/date';
import { getLocalizedCategoryName, getLocalizedMonthAcc, t, withDisplayName } from './lib/i18n';
import {
  loadBackground,
  loadCategories,
  loadExpenses,
  loadFilter,
  loadIncome,
  loadLastProject,
  loadLocale,
  loadProjects,
  loadRange,
  saveBackground,
  saveCategories,
  saveExpenses,
  saveFilter,
  saveIncome,
  saveLastProject,
  saveLocale,
  saveProjects,
  saveRange,
  type StoredBackground
} from './lib/storage';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { Header } from './components/Header';
import { HeatmapLegend } from './components/HeatmapLegend';
import { HomeMainView } from './views/HomeMainView';
import { SettingsView } from './views/SettingsView';
import { AnalyticsMainView } from './views/AnalyticsMainView';
import {
  ALL_CATEGORIES_VALUE,
  ALL_PROJECTS_VALUE,
  DEFAULT_CATEGORIES,
  NEEDS_CATEGORIES,
  donutArcPath,
  extractFirstEmoji,
  getBackgroundCss,
  NEW_CATEGORY_VALUE,
  NO_PROJECT_VALUE,
  normalizeAmount,
  PRESET_BACKGROUNDS,
  RANGE_OPTIONS,
  WITHOUT_PROJECT_VALUE,
} from './config/appConstants';
import {
  YEAR_HEATMAP_MONTH_FULL_EL,
  YEAR_HEATMAP_MONTH_FULL_EN,
  YEAR_HEATMAP_MONTH_LABELS_EL,
  YEAR_HEATMAP_MONTH_LABELS_EN,
} from './config/heatmapConstants';
import { useHorizontalSwipe } from './hooks/useHorizontalSwipe';
import { useBudgetPace } from './hooks/useBudgetPace';
import { getHeatmapColor } from './lib/heatmap';
import './styles.css';
import type { Category, Expense, ExpenseDraft, Locale, Project, Range, TabId } from './types';

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  const [tab, setTab] = useState<TabId>('home');
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [customCategories, setCustomCategories] = useState<Category[]>(() => loadCategories());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [income, setIncome] = useState(() => loadIncome());
  const [budgetInputValue, setBudgetInputValue] = useState(() => String(loadIncome()));
  const [yearlyBudget, setYearlyBudget] = useState(() => Number(localStorage.getItem('expense_yearly_budget')) || 0);
  const [yearlyBudgetInputValue, setYearlyBudgetInputValue] = useState(() => String(Number(localStorage.getItem('expense_yearly_budget')) || 0));
  const [range, setRange] = useState<Range>(() => loadRange());
  const [background, setBackground] = useState<StoredBackground>(() => loadBackground());
  const [fromDate, setFromDate] = useState<string>(() => loadFilter().fromIso ?? '');
  const [toDate, setToDate] = useState<string>(() => loadFilter().toIso ?? '');
  const [categoryFilter, setCategoryFilter] = useState<string>(() => loadFilter().category ?? '');
  const [projectFilter, setProjectFilter] = useState<string>(() => loadFilter().project ?? '');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [analyticsModal, setAnalyticsModal] = useState<null | 'pace' | 'donut' | 'heatmap' | 'yearHeatmap' | 'weekHeatmap'>(null);
  const [activeDonutSliceName, setActiveDonutSliceName] = useState<string | null>(null);
  const [activeHeatmapDay, setActiveHeatmapDay] = useState<number | null>(null);
  const [seamlessHeatmapTransition, setSeamlessHeatmapTransition] = useState(false);
  const [yearHeatmapViewYear, setYearHeatmapViewYear] = useState(() => new Date().getFullYear());
  const [activeYearHeatmapMonth, setActiveYearHeatmapMonth] = useState<number | null>(() => new Date().getMonth());
  const [heatmapViewDate, setHeatmapViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [weekHeatmapViewStartDate, setWeekHeatmapViewStartDate] = useState(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    const isoDow0Mon = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - isoDow0Mon);
    return weekStart;
  });
  const [activeWeekHeatmapDayIndex, setActiveWeekHeatmapDayIndex] = useState<number>(() => (new Date().getDay() + 6) % 7);
  const [heatmapSlideDir, setHeatmapSlideDir] = useState<'left' | 'right' | ''>('');
  const [weekHeatmapSlideDir, setWeekHeatmapSlideDir] = useState<'left' | 'right' | ''>('');
  const [yearHeatmapSlideDir, setYearHeatmapSlideDir] = useState<'left' | 'right' | ''>('');
  const [categoryModalForExpense, setCategoryModalForExpense] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [swipedExpenseId, setSwipedExpenseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>({
    project: '',
    amount: '',
    category: '',
    emoji: '🏷️',
    date: toLocalIsoDate(new Date()),
    comment: '',
    receiptFileId: null,
  });
  const [newProjectName, setNewProjectName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('🏷️');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [homeBudgetEditModal, setHomeBudgetEditModal] = useState<'monthly' | 'yearly' | null>(null);
  const [homeBudgetEditValue, setHomeBudgetEditValue] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bdFromDate, setBdFromDate] = useState('');
  const [bdToDate, setBdToDate] = useState('');
  const [bdCategory, setBdCategory] = useState('');
  const [bdProject, setBdProject] = useState('');
  const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('expense_ai_api_key') || '');
  const [isImporting, setIsImporting] = useState(false);
  const [customCategoryMap, setCustomCategoryMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('expense_custom_category_map') || '{}'); } catch { return {}; }
  });
  const [importReviewModalOpen, setImportReviewModalOpen] = useState(false);
  const [fixMyPeriod, setFixMyPeriod] = useState<'month' | 'year' | null>(null);
  const [importReviewExpenses, setImportReviewExpenses] = useState<Expense[]>([]);
  const [pendingCategoryExpenseId, setPendingCategoryExpenseId] = useState<string | null>(null);
  const [markerTooltip, setMarkerTooltip] = useState<'month' | 'year' | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [showWrappedModal, setShowWrappedModal] = useState(false);
  const [wrappedData, setWrappedData] = useState<{
    monthKey: string;
    monthName: string;
    total: number;
    saved: number;
    topCategory: { name: string; emoji: string; amount: number } | null;
  } | null>(null);
  const hasLocalBudgetOverrideRef = useRef(false);
  const pendingBudgetRef = useRef<{ income: number; yearly: number } | null>(null);
  const swipeStartRef = useRef<{ id: string; x: number } | null>(null);
  const stickyShellRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const initialBackgroundRef = useRef<StoredBackground | null>(null);
  const activeBudgetSlideRef = useRef(Number(localStorage.getItem('expense_active_budget_slide')) || 0);
  const [activeBudgetSlide, setActiveBudgetSlide] = useState(activeBudgetSlideRef.current);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const [stickyShellHeight, setStickyShellHeight] = useState(0);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const analyticsCarouselRef = useRef<HTMLDivElement | null>(null);
  const [activeAnalyticsSlide, setActiveAnalyticsSlide] = useState(0);
  const isAnalyticsDraggingRef = useRef(false);
  const analyticsStartXRef = useRef(0);
  const analyticsScrollLeftRef = useRef(0);
  const isClickPreventedRef = useRef(false);
  const donutListRef = useRef<HTMLDivElement | null>(null);
  const [showRuleTooltip, setShowRuleTooltip] = useState(false);
  const [animateGauges, setAnimateGauges] = useState(false);
  const [ruleDetailsModal, setRuleDetailsModal] = useState<{
    labelKey: string;
    icon: string;
    color: string;
    amount: number;
    target: number;
    expenses: Expense[];
  } | null>(null);

  useEffect(() => {
    if (!markerTooltip) return;

    const closeTooltip = () => setMarkerTooltip(null);

    setTimeout(() => {
      window.addEventListener('click', closeTooltip);
    }, 0);

    return () => window.removeEventListener('click', closeTooltip);
  }, [markerTooltip]);

  useEffect(() => {
    if (!showRuleTooltip) return;
    const closeTooltip = () => setShowRuleTooltip(false);
    setTimeout(() => {
      window.addEventListener('click', closeTooltip);
    }, 0);
    return () => window.removeEventListener('click', closeTooltip);
  }, [showRuleTooltip]);

  useEffect(() => {
    if (activeBudgetSlide === 2) {
      const timer = setTimeout(() => setAnimateGauges(true), 100);
      return () => clearTimeout(timer);
    } else {
      setAnimateGauges(false);
    }
  }, [activeBudgetSlide]);

  useEffect(() => {
    if (backgroundModalOpen) {
      initialBackgroundRef.current = background;
    }
  }, [backgroundModalOpen]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (active) {
            setSession(session);
            setUser(session?.user ?? null);
          }
        })
        .catch((error) => {
        })
        .finally(() => {
          if (active) setAuthLoading(false);
        });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (active) {
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
        }
      });


    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const element = stickyShellRef.current;
    if (!element) return;

    const updateHeight = () => {
      setStickyShellHeight(element.getBoundingClientRect().height);
    };

    updateHeight();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(element);
    }
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [tab, authLoading, session]);

  useEffect(() => {
    if (tab === 'home' && carouselRef.current) {
      const el = carouselRef.current;
      requestAnimationFrame(() => {
        el.scrollLeft = el.clientWidth * activeBudgetSlideRef.current;
      });
    }
  }, [tab]);

  useEffect(() => {
    async function syncCloudData() {
      if (!user || !supabase) return;
      
      const isFirstLoad = !isInitialSyncDone;
      if (isFirstLoad) setIsInitialSyncDone(false);

      const { data: profile } = await supabase.from('profiles').select('*').maybeSingle();
      const hasSyncedBefore = !!profile;
      
      if (profile) {
        if (hasLocalBudgetOverrideRef.current && pendingBudgetRef.current) {
          await supabase.from('profiles').update({
            income: pendingBudgetRef.current.income,
            yearly_budget: pendingBudgetRef.current.yearly,
            updated_at: new Date().toISOString()
          }).eq('id', user.id);
        }

        const cloudIncome = Number(profile.income);
        const cloudYearly = Number(profile.yearly_budget);
        
        if (hasLocalBudgetOverrideRef.current) {
        } else if (cloudIncome === 0 && income > 0) {
          await supabase.from('profiles').update({ 
            income, 
            yearly_budget: yearlyBudget,
            updated_at: new Date().toISOString() 
          }).eq('id', user.id);
        } else {
          setIncome(cloudIncome);
        }

        if (hasLocalBudgetOverrideRef.current) {
        } else if (cloudYearly === 0 && yearlyBudget > 0) {
        } else if (cloudYearly !== undefined && !isNaN(cloudYearly)) {
          setYearlyBudget(cloudYearly);
        }
        
        setLocale(profile.locale as Locale);
        setBackground(profile.background as StoredBackground);
      } else {
        await supabase.from('profiles').insert({ 
          id: user.id, 
          income, 
          yearly_budget: yearlyBudget,
          locale, 
          background,
          updated_at: new Date().toISOString()
        });
      }

      const { data: remoteExpenses } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (remoteExpenses) {
        if (remoteExpenses.length > 0 || hasSyncedBefore) {
          setExpenses(remoteExpenses.map(({ user_id: _, receipt_file_id, ...e }) => ({
            ...e,
            amount: String(e.amount),
            receiptFileId: receipt_file_id ?? e.receiptFileId ?? null
          }) as Expense));
        } else if (expenses.length > 0) {
          const toUpload = expenses.map(({ receiptFileId, ...e }) => ({ ...e, receipt_file_id: receiptFileId ?? null, user_id: user.id }));
          await supabase.from('expenses').insert(toUpload);
        }
      }

      const { data: remoteCats } = await supabase.from('categories').select('*');
      if (remoteCats) {
        if (remoteCats.length > 0 || hasSyncedBefore) {
          setCustomCategories(remoteCats.map(({ user_id: _, ...c }) => c as Category));
        } else if (customCategories.length > 0) {
          const toUpload = customCategories.map(c => ({ ...c, user_id: user.id }));
          await supabase.from('categories').insert(toUpload);
        }
      }
      
      const { data: remoteProjects } = await supabase.from('projects').select('*');
      if (remoteProjects) {
        if (remoteProjects.length > 0 || hasSyncedBefore) {
          setProjects(remoteProjects.map(({ user_id: _, ...p }) => p as Project));
        } else if (projects.length > 0) {
          const toUpload = projects.map(p => ({ ...p, user_id: user.id }));
          await supabase.from('projects').insert(toUpload);
        }
      }

      setIsInitialSyncDone(true);
    }

    if (user?.id) syncCloudData();
  }, [user?.id]);

  useEffect(() => {
    if (!isInitialSyncDone || tab !== 'home') return;

    const today = new Date();
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthKey = toLocalIsoDate(prevMonthDate).slice(0, 7); // YYYY-MM

    if (localStorage.getItem('expense_wrapped_seen') === prevMonthKey) return;

    const prevMonthExpenses = expenses.filter((e) => e.date?.startsWith(prevMonthKey));
    if (prevMonthExpenses.length === 0) return; // Δεν υπάρχουν έξοδα, άρα δεν βγάζουμε wrapped

    const total = prevMonthExpenses.reduce((sum, e) => sum + (Number.parseFloat(e.amount) || 0), 0);
    const saved = income - total;
    
    const catTotals: Record<string, { amount: number; emoji: string }> = {};
    prevMonthExpenses.forEach((e) => {
      const catName = getLocalizedCategoryName(locale, e.category || t(locale, 'other'));
      if (!catTotals[catName]) catTotals[catName] = { amount: 0, emoji: e.emoji || '🏷️' };
      catTotals[catName].amount += Number.parseFloat(e.amount) || 0;
    });

    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1].amount - a[1].amount);
    const topCategory = sortedCats.length > 0 ? { name: sortedCats[0][0], emoji: sortedCats[0][1].emoji, amount: sortedCats[0][1].amount } : null;
    const monthName = getLocalizedMonthAcc(locale, prevMonthDate.getMonth());

    setWrappedData({
      monthKey: prevMonthKey,
      monthName,
      total,
      saved,
      topCategory
    });
    setShowWrappedModal(true);
  }, [isInitialSyncDone, tab, expenses, income, locale]);

  useEffect(() => saveLocale(locale), [locale]);
  useEffect(() => saveExpenses(expenses), [expenses]);
  useEffect(() => saveCategories(customCategories), [customCategories]);
  useEffect(() => saveProjects(projects), [projects]);
  useEffect(() => saveIncome(income), [income]);
  
  useEffect(() => {
    localStorage.setItem('expense_ai_api_key', aiApiKey);
  }, [aiApiKey]);
  
  useEffect(() => {
    localStorage.setItem('expense_custom_category_map', JSON.stringify(customCategoryMap));
  }, [customCategoryMap]);
  
  useEffect(() => {
    localStorage.setItem('expense_yearly_budget', String(yearlyBudget));
    setYearlyBudgetInputValue(String(yearlyBudget));
  }, [yearlyBudget]);

  useEffect(() => {
    if (user?.id && supabase && isInitialSyncDone) {
      supabase.from('profiles').upsert({ 
        id: user.id, 
        income, 
        yearly_budget: yearlyBudget,
        locale, 
        background,
        updated_at: new Date().toISOString()
      });
    }
  }, [income, yearlyBudget, locale, background, user?.id, isInitialSyncDone]);

  useEffect(() => {
    setBudgetInputValue(String(income));
  }, [income]);
  useEffect(() => saveRange(range), [range]);
  useEffect(() => saveBackground(background), [background]);
  useEffect(
    () => saveFilter({ fromIso: fromDate || null, toIso: toDate || null, category: categoryFilter || null, project: projectFilter || null }),
    [fromDate, toDate, categoryFilter, projectFilter]
  );
  useEffect(() => setExpandedGroups({}), [range, fromDate, toDate, categoryFilter, projectFilter]);
  useEffect(() => {
    const cssBackground = getBackgroundCss(background);
    document.body.style.background = cssBackground;
    document.body.style.backgroundAttachment = 'fixed';
  }, [background]);


  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  const displayCategories = useMemo(() => withDisplayName(locale, allCategories), [locale, allCategories]); // Ensure this is defined
  const filterFromDate = fromDate ? parseIsoDateToLocal(fromDate) : null;
  const filterToDate = toDate ? parseIsoDateToLocal(toDate) : null;
  const categoryFilterLabel =
    displayCategories.find((category) => category.name === categoryFilter)?.displayName ?? categoryFilter;
  const projectFilterLabel =
    projectFilter === WITHOUT_PROJECT_VALUE ? t(locale, 'withoutProject') : projectFilter || t(locale, 'allProjects');
  const metaFilteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        if (categoryFilter && expense.category !== categoryFilter) return false;
        if (projectFilter === WITHOUT_PROJECT_VALUE) return !expense.project;
        if (projectFilter && (expense.project ?? '') !== projectFilter) return false;
        return true;
      }),
    [expenses, categoryFilter, projectFilter]
  );
  const filteredExpenses = useMemo(
    () => {
      if (!filterFromDate && !filterToDate) return metaFilteredExpenses;
      return filterExpensesByDateRange(metaFilteredExpenses, filterFromDate, filterToDate);
    },
    [metaFilteredExpenses, filterFromDate, filterToDate]
  );
  const analyticsCategoryUniverse = useMemo(() => {
    const map = new Map<string, string>();
    filteredExpenses.forEach((expense) => {
      const key = expense.category || t(locale, 'other');
      if (!map.has(key)) map.set(key, expense.emoji || '🏷️');
    });
    return Array.from(map.entries()).map(([name, emoji]) => ({ name, emoji }));
  }, [filteredExpenses, locale]);

  const noSpendDaysThisMonth = useMemo(() => {
    const today = new Date();
    const currentMonthPrefix = toLocalIsoDate(today).slice(0, 7); // "YYYY-MM"
    const todayStr = toLocalIsoDate(today);

    const daysWithExpenses = new Set<string>();
    expenses.forEach((expense) => {
      if (expense.date && expense.date.startsWith(currentMonthPrefix) && expense.date <= todayStr) {
        const amount = Number.parseFloat(expense.amount.replace(',', '.'));
        if (amount > 0) {
          daysWithExpenses.add(expense.date);
        }
      }
    });

    const todayDateNum = today.getDate();
    return Math.max(0, todayDateNum - daysWithExpenses.size);
  }, [expenses]);

  const listBounds = useMemo(() => {
    const hasExpenses = metaFilteredExpenses.length > 0;
    const today = new Date();
    const maxDateFromExpenses = hasExpenses ? parseIsoDateToLocal(metaFilteredExpenses[0].date) : today;

    return {
      from: filterFromDate || (hasExpenses ? parseIsoDateToLocal(metaFilteredExpenses[metaFilteredExpenses.length - 1].date) : null),
      to: filterToDate || maxDateFromExpenses
    };
  }, [metaFilteredExpenses, filterFromDate, filterToDate]);

  const totals = useMemo(() => getExpensePeriodTotals(filteredExpenses), [filteredExpenses]);
  const historyGroups = useMemo(
    () => getHistoryGroups(metaFilteredExpenses, range, listBounds.from, listBounds.to, locale).filter(g => g.items.length > 0),
    [metaFilteredExpenses, range, listBounds, locale]
  );
  const analyticsGroups = useMemo(
    () => getAnalyticsGroups(metaFilteredExpenses, range, listBounds.from, listBounds.to, locale).filter(g => g.items.length > 0),
    [metaFilteredExpenses, range, listBounds, locale]
  );
  

  const parsedIncome = Number(income) || 0;
  const parsedYearly = Number(yearlyBudget) || 0;
  const currentMonthSpend = totals.month;
  const actualProgressPct = parsedIncome > 0 ? (currentMonthSpend / parsedIncome) * 100 : 0;
  const visualProgressPct = Math.min(100, Math.max(0, actualProgressPct));
  const isMonthOverBudget = currentMonthSpend > parsedIncome;
  const monthOverage = currentMonthSpend - parsedIncome;
  const hasActiveFilter = Boolean(fromDate || toDate || categoryFilter || projectFilter);
  const actualYearlyProgressPct = parsedYearly > 0 ? (totals.year / parsedYearly) * 100 : 0;
  const visualYearlyProgressPct = Math.min(100, Math.max(0, actualYearlyProgressPct));
  const isYearOverBudget = totals.year > parsedYearly;
  const yearOverage = totals.year - parsedYearly;

  const homeMonthPace = useMemo(() => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const expectedSpend = (parsedIncome / daysInMonth) * currentDay;
    return currentMonthSpend - expectedSpend;
  }, [currentMonthSpend, parsedIncome]);

  const smartInsight = useMemo(() => {
    if (parsedIncome <= 0) return null;
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const remainingDays = Math.max(1, daysInMonth - currentDay);
    const remainingBudget = parsedIncome - currentMonthSpend;
    const safeDailySpend = remainingBudget / remainingDays;
    const expectedDailySpend = parsedIncome / daysInMonth;

    if (remainingBudget < 0) {
      return {
        color: '#ff453a',
        bg: 'rgba(255, 69, 58, 0.1)',
        icon: '🚨',
        badgeText: 'Εκτός Budget',
        message: 'Έχεις ξεπεράσει τον μηνιαίο μισθό σου. Κάθε νέο έξοδο πλέον μειώνει τις αποταμιεύσεις σου.',
        showFixMyMonth: true
      };
    }
    
    if (safeDailySpend < expectedDailySpend * 0.4) {
      return {
        color: '#ff9f0a',
        bg: 'rgba(255, 159, 10, 0.1)',
        icon: '⚠️',
        badgeText: 'Κίνδυνος',
        message: `Προσοχή: Σου απομένουν ${remainingBudget.toFixed(0)}€ (${safeDailySpend.toFixed(0)}€/ημέρα). Περιόρισε τα έξοδα στα απολύτως απαραίτητα.`,
        showFixMyMonth: true
      };
    }
    
    if (safeDailySpend < expectedDailySpend * 0.9) {
      return {
        color: '#ffd60a',
        bg: 'rgba(255, 214, 10, 0.1)',
        icon: '👀',
        badgeText: 'Ελαφρώς εκτός',
        message: `Έχεις ξεφύγει ελαφρώς. Προσπάθησε να μείνεις στα ${safeDailySpend.toFixed(0)}€/ημέρα για να βγεις ακριβώς στο τέλος.`,
        showFixMyMonth: true
      };
    }
    
    return {
      color: '#32d74b',
      bg: 'rgba(50, 215, 75, 0.1)',
      icon: '✨',
      badgeText: 'Όλα τέλεια!',
      message: `Εξαιρετική πορεία! Αν συνεχίσεις έτσι, στο τέλος του μήνα θα σου περισσέψουν χρήματα.`,
      showFixMyMonth: false
    };
  }, [parsedIncome, currentMonthSpend]);

  const rescuePlan = useMemo(() => {
    if (fixMyPeriod !== 'month') return null;
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const remainingDays = Math.max(1, daysInMonth - currentDay);
    const remainingBudget = parsedIncome - currentMonthSpend;
    const safeDailySpend = remainingBudget / remainingDays;
    
    const currentMonthPrefix = toLocalIsoDate(today).slice(0, 7);
    const thisMonthExpenses = expenses.filter(e => e.date?.startsWith(currentMonthPrefix));
    
    const nonEssentialCats = ['Καφές', 'Διασκέδαση', 'Ταξίδια', 'Ρούχα', 'Gaming', 'Ηλεκτρονικά', 'Ομορφιά', 'Δώρα', 'Taxi', 'Coffee', 'Entertainment', 'Travel', 'Clothes', 'Beauty', 'Gifts', 'Electronics'];
    
    const nonEssentialSpend: Record<string, { amount: number, emoji: string }> = {};
    thisMonthExpenses.forEach(e => {
      const cat = e.category || 'Άλλο';
      if (nonEssentialCats.includes(cat)) {
        if (!nonEssentialSpend[cat]) nonEssentialSpend[cat] = { amount: 0, emoji: e.emoji || '🏷️' };
        nonEssentialSpend[cat].amount += (parseFloat(e.amount) || 0);
      }
    });
    
    const topNonEssentials = Object.entries(nonEssentialSpend)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 3)
      .filter(item => item[1].amount > 0);

    // Forecast Algorithm
    const currentDailyPace = currentMonthSpend / Math.max(1, currentDay);
    
    const past3MonthsStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const pastExpenses = expenses.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d >= past3MonthsStart && d < new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const pastTotal = pastExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const pastDailyAvg = pastTotal > 0 ? pastTotal / 90 : 0;
    
    // Blend 70% current pace with 30% historical pace
    const blendedDailyPace = pastTotal > 0 
      ? (currentDailyPace * 0.7) + (pastDailyAvg * 0.3)
      : currentDailyPace;
      
    const forecastedEndMonthSpend = currentMonthSpend + (blendedDailyPace * remainingDays);
    const forecastedSavings = Math.max(0, parsedIncome - forecastedEndMonthSpend);
        
    return {
      remainingBudget,
      remainingDays,
      safeDailySpend,
      topNonEssentials,
      forecastedSavings
    };
  }, [fixMyPeriod, expenses, parsedIncome, currentMonthSpend]);

  const yearlySmartInsight = useMemo(() => {
    if (parsedYearly <= 0) return null;
    const today = new Date();
    const daysInYear = ((today.getFullYear() % 4 === 0 && today.getFullYear() % 100 > 0) || today.getFullYear() % 400 === 0) ? 366 : 365;
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const currentDayOfYear = Math.floor((today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const remainingDays = Math.max(1, daysInYear - currentDayOfYear);
    const remainingBudget = parsedYearly - totals.year;
    const safeDailySpend = remainingBudget / remainingDays;
    const expectedDailySpend = parsedYearly / daysInYear;

    if (remainingBudget < 0) {
      return {
        color: '#ff453a',
        bg: 'rgba(255, 69, 58, 0.1)',
        icon: '🚨',
        badgeText: 'Εκτός Budget',
        message: 'Έχεις ξεπεράσει το ετήσιο budget σου. Κάθε νέο έξοδο πλέον μειώνει τις αποταμιεύσεις σου.',
        showFixMyMonth: true
      };
    }
    
    if (safeDailySpend < expectedDailySpend * 0.4) {
      return {
        color: '#ff9f0a',
        bg: 'rgba(255, 159, 10, 0.1)',
        icon: '⚠️',
        badgeText: 'Κίνδυνος',
        message: `Προσοχή: Σου απομένουν ${remainingBudget.toFixed(0)}€ για το έτος (${safeDailySpend.toFixed(0)}€/ημέρα). Περιόρισε τα έξοδα στα απολύτως απαραίτητα.`,
        showFixMyMonth: true
      };
    }
    
    if (safeDailySpend < expectedDailySpend * 0.9) {
      return {
        color: '#ffd60a',
        bg: 'rgba(255, 214, 10, 0.1)',
        icon: '👀',
        badgeText: 'Ελαφρώς εκτός',
        message: `Έχεις ξεφύγει ελαφρώς. Προσπάθησε να μείνεις στα ${safeDailySpend.toFixed(0)}€/ημέρα για να βγεις ακριβώς στο τέλος του έτους.`,
        showFixMyMonth: true
      };
    }
    
    return {
      color: '#32d74b',
      bg: 'rgba(50, 215, 75, 0.1)',
      icon: '✨',
      badgeText: 'Όλα τέλεια!',
      message: `Εξαιρετική πορεία! Αν συνεχίσεις έτσι, στο τέλος του έτους θα σου περισσέψουν χρήματα.`,
      showFixMyMonth: false
    };
  }, [parsedYearly, totals.year]);

  const yearlyRescuePlan = useMemo(() => {
    if (fixMyPeriod !== 'year') return null;
    const today = new Date();
    const daysInYear = ((today.getFullYear() % 4 === 0 && today.getFullYear() % 100 > 0) || today.getFullYear() % 400 === 0) ? 366 : 365;
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const currentDayOfYear = Math.floor((today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const remainingDays = Math.max(1, daysInYear - currentDayOfYear);
    const remainingBudget = parsedYearly - totals.year;
    const safeDailySpend = remainingBudget / remainingDays;
    
    const currentYearPrefix = String(today.getFullYear());
    const thisYearExpenses = expenses.filter(e => e.date?.startsWith(currentYearPrefix));
    
    const nonEssentialCats = ['Καφές', 'Διασκέδαση', 'Ταξίδια', 'Ρούχα', 'Gaming', 'Ηλεκτρονικά', 'Ομορφιά', 'Δώρα', 'Taxi', 'Coffee', 'Entertainment', 'Travel', 'Clothes', 'Beauty', 'Gifts', 'Electronics'];
    
    const nonEssentialSpend: Record<string, { amount: number, emoji: string }> = {};
    thisYearExpenses.forEach(e => {
      const cat = e.category || 'Άλλο';
      if (nonEssentialCats.includes(cat)) {
        if (!nonEssentialSpend[cat]) nonEssentialSpend[cat] = { amount: 0, emoji: e.emoji || '🏷️' };
        nonEssentialSpend[cat].amount += (parseFloat(e.amount) || 0);
      }
    });
    
    const topNonEssentials = Object.entries(nonEssentialSpend)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 3)
      .filter(item => item[1].amount > 0);

    // Forecast Algorithm for Year
    const currentDailyPace = totals.year / Math.max(1, currentDayOfYear);
    
    const pastYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const pastYearEnd = new Date(today.getFullYear(), 0, 1);
    const pastExpenses = expenses.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d >= pastYearStart && d < pastYearEnd;
    });
    const pastTotal = pastExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const pastDaysInYear = ((pastYearStart.getFullYear() % 4 === 0 && pastYearStart.getFullYear() % 100 > 0) || pastYearStart.getFullYear() % 400 === 0) ? 366 : 365;
    const pastDailyAvg = pastTotal > 0 ? pastTotal / pastDaysInYear : 0;
    
    // Blend 70% current pace with 30% historical pace
    const blendedDailyPace = pastTotal > 0 
      ? (currentDailyPace * 0.7) + (pastDailyAvg * 0.3)
      : currentDailyPace;
      
    const forecastedEndYearSpend = totals.year + (blendedDailyPace * remainingDays);
    const forecastedSavings = Math.max(0, parsedYearly - forecastedEndYearSpend);
        
    return {
      remainingBudget,
      remainingDays,
      safeDailySpend,
      topNonEssentials,
      forecastedSavings
    };
  }, [fixMyPeriod, expenses, parsedYearly, totals.year]);

  const isYearOffTrack = useMemo(() => {
    const currentMonthNum = new Date().getMonth() + 1;
    const expectedYearlyPct = (currentMonthNum / 12) * 100;
    return actualYearlyProgressPct > expectedYearlyPct;
  }, [actualYearlyProgressPct]);
  const budgetDateMarkers = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthDatePct = Math.max(0, Math.min(100, 100 - (now.getDate() / daysInMonth) * 100));

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
    const yearDatePct = Math.max(0, Math.min(100, 100 - ((now.getTime() - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime())) * 100));
    return { monthDatePct, yearDatePct };
  }, []);

  const donutPeriodExpenses = useMemo(() => {
    const todayIso = toLocalIsoDate(new Date());
    const todayMonthKey = todayIso.slice(0, 7);
    const todayYearKey = todayIso.slice(0, 4);
    const todayUtc = new Date(`${todayIso}T00:00:00Z`);
    const isoDow0Mon = (todayUtc.getUTCDay() + 6) % 7;
    const weekStartUtc = new Date(todayUtc);
    weekStartUtc.setUTCDate(weekStartUtc.getUTCDate() - isoDow0Mon);
    const weekEndUtcExclusive = new Date(weekStartUtc);
    weekEndUtcExclusive.setUTCDate(weekEndUtcExclusive.getUTCDate() + 7);

    return filteredExpenses.filter((expense) => {
      if (!expense.date) return false;
      if (range === 'day') return expense.date === todayIso;
      if (range === 'month') return expense.date.slice(0, 7) === todayMonthKey;
      if (range === 'year') return expense.date.slice(0, 4) === todayYearKey;
      const expenseUtc = new Date(`${expense.date}T00:00:00Z`);
      return expenseUtc >= weekStartUtc && expenseUtc < weekEndUtcExclusive;
    });
  }, [filteredExpenses, range]);
  const { budgetPaceView, budgetPaceModalChart } = useBudgetPace(metaFilteredExpenses, parsedIncome, parsedYearly, range);

  const { needsMonthTotal, wantsMonthTotal } = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 7);
    let needs = 0;
    let wants = 0;
    expenses.forEach(exp => {
      if (exp.date && exp.date.slice(0, 7) === todayIso) {
        const amount = Number.parseFloat(exp.amount) || 0;
        if (NEEDS_CATEGORIES.includes(exp.category)) {
          needs += amount;
        } else {
          // Anything not explicitly a Need is considered a Want
          wants += amount;
        }
      }
    });
    return { needsMonthTotal: needs, wantsMonthTotal: wants };
  }, [expenses]);

  const targetNeeds = parsedIncome * 0.5;
  const targetWants = parsedIncome * 0.3;
  const currentNeeds = needsMonthTotal;
  const currentWants = wantsMonthTotal;
  const currentSavings = Math.max(0, parsedIncome - currentNeeds - currentWants);

  const budgetPaceTarget = budgetPaceView.target;
  const budgetPaceActual = budgetPaceView.actual;
  const budgetPaceDelta = budgetPaceView.delta;
  const budgetPaceDayMax = Math.max(budgetPaceActual, budgetPaceTarget, 1);

  const budgetPaceDayActualPct = (budgetPaceActual / budgetPaceDayMax) * 100;
  const budgetPaceDayTargetPct = (budgetPaceTarget / budgetPaceDayMax) * 100;
  const budgetPaceDayIsOver = budgetPaceActual > budgetPaceTarget;

  const prevTotals = useMemo(() => {
    const todayIso = toLocalIsoDate(new Date());
    const todayDate = parseIsoDateToLocal(todayIso);

    const prevDayDate = new Date(todayDate);
    prevDayDate.setDate(prevDayDate.getDate() - 1);
    const prevDayIso = toLocalIsoDate(prevDayDate);

    const prevWeekStart = new Date(todayDate);
    const isoDow0Mon = (prevWeekStart.getDay() + 6) % 7;
    prevWeekStart.setDate(prevWeekStart.getDate() - isoDow0Mon - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() + 7);

    const prevMonthDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
    const prevMonthKey = toLocalIsoDate(prevMonthDate).slice(0, 7);

    const prevYearKey = String(todayDate.getFullYear() - 1);

    return metaFilteredExpenses.reduce(
      (acc, expense) => {
        if (!expense.date) return acc;
        const amount = Number.parseFloat(expense.amount) || 0;
        const expDate = parseIsoDateToLocal(expense.date);

        if (expense.date === prevDayIso) acc.day += amount;
        if (expense.date.slice(0, 7) === prevMonthKey) acc.month += amount;
        if (expense.date.slice(0, 4) === prevYearKey) acc.year += amount;
        if (expDate >= prevWeekStart && expDate < prevWeekEnd) acc.week += amount;

        return acc;
      },
      { day: 0, week: 0, month: 0, year: 0 }
    );
  }, [metaFilteredExpenses]);

  const currentTotal = totals[range];
  const prevTotal = prevTotals[range];
  const comparisonDiff = currentTotal - prevTotal;
  const comparisonPct = prevTotal > 0 ? (comparisonDiff / prevTotal) * 100 : (currentTotal > 0 ? 100 : 0);
  const isComparisonMore = comparisonDiff > 0;
  const isComparisonLess = comparisonDiff < 0;
  const prevLabelKey = range === 'day' ? 'analyticsPrevDay' : range === 'week' ? 'analyticsPrevWeek' : range === 'month' ? 'analyticsPrevMonth' : 'analyticsPrevYear';
  const comparisonMax = Math.max(currentTotal, prevTotal, 1);
  const currentBarPct = (currentTotal / comparisonMax) * 100;
  const prevBarPct = (prevTotal / comparisonMax) * 100;

  const categoryDonut = useMemo(() => {
    const aggregate: Record<string, { amount: number; emoji: string }> = {};
    donutPeriodExpenses.forEach((expense) => {
      const key = getLocalizedCategoryName(locale, expense.category || t(locale, 'other'));
      if (!aggregate[key]) aggregate[key] = { amount: 0, emoji: expense.emoji || '🏷️' };
      aggregate[key].amount += Number.parseFloat(expense.amount) || 0;
    });

    const slices = Object.entries(aggregate)
      .map(([name, data]) => ({ name, amount: data.amount, emoji: data.emoji }))
      .sort((a, b) => b.amount - a.amount);

    const total = slices.reduce((sum, row) => sum + row.amount, 0);
    const colors = ['#0a84ff', '#32d74b', '#ff9f0a', '#bf5af2', '#ffd60a', '#8e8e93'];

    let cursor = 0;
    const gradientStops = slices
      .map((slice, index) => {
        const start = cursor;
        const pct = total > 0 ? (slice.amount / total) * 100 : 0;
        cursor += pct;
        return `${colors[index % colors.length]} ${start}% ${cursor}%`;
      })
      .join(', ');

    return {
      total,
      slices: slices.map((slice, index) => ({
        ...slice,
        color: colors[index % colors.length],
        pct: total > 0 ? (slice.amount / total) * 100 : 0,
      })),
      gradient: gradientStops,
    };
  }, [donutPeriodExpenses, locale]);
  const donutInteractiveSlices = useMemo(() => {
    let startAngle = -90;
    return categoryDonut.slices.map((slice, index) => {
      const rawSweep = (slice.pct / 100) * 360;
      const sweep = rawSweep >= 360 ? 359.999 : rawSweep;
      const endAngle = startAngle + sweep;
      const next = {
        ...slice,
        index,
        startAngle,
        endAngle,
      };
      startAngle = endAngle;
      return next;
    });
  }, [categoryDonut]);
  const activeDonutSlice = useMemo(() => {
    if (donutInteractiveSlices.length === 0) return null;
    return (
      donutInteractiveSlices.find((slice) => slice.name === activeDonutSliceName) ??
      donutInteractiveSlices[0]
    );
  }, [donutInteractiveSlices, activeDonutSliceName]);
  useEffect(() => {
    if (donutInteractiveSlices.length === 0) {
      setActiveDonutSliceName(null);
      return;
    }
    if (!activeDonutSliceName || !donutInteractiveSlices.some((slice) => slice.name === activeDonutSliceName)) {
      setActiveDonutSliceName(donutInteractiveSlices[0].name);
    }
  }, [donutInteractiveSlices, activeDonutSliceName]);
  useEffect(() => {
    if (analyticsModal === 'donut' && activeDonutSliceName && donutListRef.current) {
      const activeIndex = categoryDonut.slices.findIndex(s => s.name === activeDonutSliceName);
      if (activeIndex !== -1) {
        const activeEl = document.getElementById(`donut-slice-${activeIndex}`);
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [activeDonutSliceName, analyticsModal, categoryDonut.slices]);

  useEffect(() => {
    if (analyticsModal === 'pace' && budgetPaceView.mode !== 'chart') {
      setAnalyticsModal(null);
    }
  }, [analyticsModal, budgetPaceView.mode]);
  useEffect(() => {
    if (analyticsModal !== 'heatmap') {
      setSeamlessHeatmapTransition(false);
    }

    if (analyticsModal === null) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      setHeatmapViewDate((prev) => 
        prev.getFullYear() === currentYear && prev.getMonth() === currentMonth 
          ? prev 
          : new Date(currentYear, currentMonth, 1)
      );
      setActiveHeatmapDay(now.getDate());
      setHeatmapSlideDir('');

      setYearHeatmapViewYear(currentYear);
      setYearHeatmapSlideDir('');
      setActiveYearHeatmapMonth(currentMonth);

      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      const isoDow0Mon = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - isoDow0Mon);
      
      setWeekHeatmapViewStartDate((prev) => 
        prev.getTime() === weekStart.getTime() ? prev : weekStart
      );
      setActiveWeekHeatmapDayIndex(isoDow0Mon);
      setWeekHeatmapSlideDir('');
    }
  }, [analyticsModal]);

  const monthHeatmapData = useMemo(() => {
    const year = heatmapViewDate.getFullYear();
    const month = heatmapViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayDow = (new Date(year, month, 1).getDay() + 6) % 7; 
    
    const dailySpend = new Array(daysInMonth).fill(0);
    const dailyExpenses: Expense[][] = Array.from({ length: daysInMonth }, () => []);
    
    filteredExpenses.forEach((exp) => {
      if (!exp.date) return;
      const expDate = parseIsoDateToLocal(exp.date);
      if (expDate.getFullYear() === year && expDate.getMonth() === month) {
        const dayIndex = expDate.getDate() - 1;
        dailySpend[dayIndex] += Number.parseFloat(exp.amount) || 0;
        dailyExpenses[dayIndex].push(exp);
      }
    });
    
    const maxSpend = Math.max(...dailySpend, 1);
    
    return { year, month, daysInMonth, firstDayDow, dailySpend, dailyExpenses, maxSpend };
  }, [filteredExpenses, heatmapViewDate]);

  const yearHeatmapData = useMemo(() => {
    const year = yearHeatmapViewYear;
    const monthlySpend = Array.from({ length: 12 }, () => 0);
    const monthlyExpenses: Expense[][] = Array.from({ length: 12 }, () => []);
    filteredExpenses.forEach((expense) => {
      if (!expense.date) return;
      const expDate = parseIsoDateToLocal(expense.date);
      if (expDate.getFullYear() !== year) return;
      const m = expDate.getMonth();
      monthlySpend[m] += Number.parseFloat(expense.amount) || 0;
      monthlyExpenses[m].push(expense);
    });

    return {
      year,
      monthlySpend,
      monthlyExpenses,
      maxSpend: Math.max(...monthlySpend, 1),
    };
  }, [filteredExpenses, yearHeatmapViewYear]);

  const weekHeatmapData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(weekHeatmapViewStartDate);
      date.setDate(weekHeatmapViewStartDate.getDate() + idx);
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const dailySpend = new Array(7).fill(0);
    const dailyExpenses: Expense[][] = Array.from({ length: 7 }, () => []);

    filteredExpenses.forEach((exp) => {
      if (!exp.date) return;
      const expDate = parseIsoDateToLocal(exp.date);
      expDate.setHours(0, 0, 0, 0);
      const dayIndex = days.findIndex((d) => d.getTime() === expDate.getTime());
      if (dayIndex === -1) return;
      dailySpend[dayIndex] += Number.parseFloat(exp.amount) || 0;
      dailyExpenses[dayIndex].push(exp);
    });

    return {
      days,
      dailySpend,
      dailyExpenses,
      maxSpend: Math.max(...dailySpend, 1),
    };
  }, [filteredExpenses, weekHeatmapViewStartDate]);

  const shiftHeatmapMonth = (direction: -1 | 1) => {
    setHeatmapSlideDir(direction === 1 ? 'left' : 'right');
    setHeatmapViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    setActiveHeatmapDay(1);
  };
  const shiftYearHeatmap = (direction: -1 | 1) => {
    setYearHeatmapSlideDir(direction === 1 ? 'left' : 'right');
    setYearHeatmapViewYear((prev) => prev + direction);
  };
  const shiftWeekHeatmap = (direction: -1 | 1) => {
    setWeekHeatmapSlideDir(direction === 1 ? 'left' : 'right');
    setWeekHeatmapViewStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + direction * 7);
      return next;
    });
    setActiveWeekHeatmapDayIndex(0);
  };
  const monthHeatmapSwipe = useHorizontalSwipe({
    onSwipeLeft: () => shiftHeatmapMonth(1),
    onSwipeRight: () => shiftHeatmapMonth(-1),
  });
  const weekHeatmapSwipe = useHorizontalSwipe({
    onSwipeLeft: () => shiftWeekHeatmap(1),
    onSwipeRight: () => shiftWeekHeatmap(-1),
  });
  const yearHeatmapSwipe = useHorizontalSwipe({
    onSwipeLeft: () => shiftYearHeatmap(1),
    onSwipeRight: () => shiftYearHeatmap(-1),
  });

  const topCategories = useMemo(() => {
    const frequency: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.category) {
        frequency[e.category] = (frequency[e.category] || 0) + 1;
      }
    });
    const sorted = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    
    const result: Category[] = [];
    for (const name of sorted) {
      const cat = allCategories.find(c => c.name === name);
      if (cat) result.push(cat);
      if (result.length === 5) break;
    }
    
    if (result.length < 5) {
      const fallback = allCategories.filter(c => !result.some(r => r.name === c.name));
      result.push(...fallback.slice(0, 5 - result.length));
    }
    return result;
  }, [expenses, allCategories]);

  const openAddExpense = (prefillCategory?: Category) => {
    setEditingExpense(null);

    const lastProject = loadLastProject(); // Load from localStorage
    const defaultProject = projects.some(p => p.name === lastProject) ? (lastProject || '') : ''; // Check if project exists

    setDraft({
      project: defaultProject,
      amount: '',
      category: prefillCategory ? prefillCategory.name : '',
      emoji: prefillCategory ? prefillCategory.emoji : '🏷️',
      date: toLocalIsoDate(new Date()),
      comment: '',
    receiptFileId: null,
    });
    setExpenseModalOpen(true);
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const action = url.searchParams.get('action');
    if (action !== 'add-expense') return;

    setTab('home');
    openAddExpense();

    url.searchParams.delete('action');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const handleFabPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Μόνο αριστερό κλικ / αφή
    if (fabMenuOpen) {
      setFabMenuOpen(false);
      return;
    }
    longPressTimer.current = setTimeout(() => {
      setFabMenuOpen(true);
      longPressTimer.current = null;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50); // Haptic feedback στο κινητό!
      }
    }, 400); // 400ms πατημένο για να ανοίξει
  };

  const handleFabPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      openAddExpense(); // Ήταν απλό κλικ, άνοιξε την κενή φόρμα
    }
  };

  const handleFabPointerCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setDraft({
      project: expense.project ?? '',
      amount: String(expense.amount),
      category: expense.category,
      emoji: expense.emoji,
      date: expense.date,
      comment: expense.comment ?? '',
    receiptFileId: expense.receiptFileId ?? null,
    });
    setExpenseModalOpen(true);
  };

  const closeExpenseModal = () => {
    setExpenseModalOpen(false);
    setEditingExpense(null);
  };

  const openProjectModal = () => {
    setNewProjectName('');
    setProjectModalOpen(true);
  };

  const openCategoryModal = (fromExpense = false) => {
    setNewCategoryName('');
    setNewCategoryEmoji('🏷️');
    setCategoryModalForExpense(fromExpense);
    setCategoryModalOpen(true);
  };

  const handleSaveExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedAmount = String(draft.amount).replace(',', '.');
    if (!normalizedAmount || Number.isNaN(Number(normalizedAmount))) {
      window.alert(t(locale, 'invalidAmount'));
      return;
    }

    const categoryName = draft.category;
    if (!categoryName) {
      window.alert(t(locale, 'invalidCategory'));
      return;
    }
    const categoryEmoji = draft.emoji || '🏷️';

    const nextExpense: Expense = {
      id: editingExpense?.id ?? String(Date.now()),
      amount: Number.parseFloat(normalizedAmount).toFixed(2),
      category: categoryName,
      emoji: categoryEmoji,
      date: draft.date,
      comment: draft.comment.trim(),
      project: draft.project || undefined,
    receiptFileId: draft.receiptFileId || null,
    };

    if (user && supabase) {
      const { receiptFileId, ...dbExpense } = nextExpense;
      const { error } = await supabase.from('expenses').upsert({ ...dbExpense, receipt_file_id: receiptFileId, user_id: user.id });
    }

    saveLastProject(nextExpense.project || null); // Αποθήκευση του τελευταίου project
    setExpenses((prev) => {
      const base = editingExpense ? prev.map((item) => (item.id === editingExpense.id ? nextExpense : item)) : [nextExpense, ...prev];
      return base.sort((a, b) => b.date.localeCompare(a.date));
    });

    closeExpenseModal();
  };


  const handleExpenseTouchStart = (id: string, clientX: number) => {
    swipeStartRef.current = { id, x: clientX };
  };

  const handleExpenseTouchEnd = (id: string, clientX: number) => {
    const swipe = swipeStartRef.current;
    if (!swipe || swipe.id !== id) return;
    const deltaX = clientX - swipe.x;
    if (deltaX <= -60) {
      setSwipedExpenseId(id);
    } else if (deltaX >= 30 || swipedExpenseId === id) {
      setSwipedExpenseId(null);
    }
    swipeStartRef.current = null;
  };

  const handleDeleteExpense = async (id: string) => {
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    
    if (user && supabase) {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCustomCategories((prev) => prev.filter((category) => category.id !== id));

    if (user && supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
    }
  };

  const handleDeleteCategoryFromSettings = (id: string) => {
    if (!window.confirm(t(locale, 'deleteCategoryConfirm'))) return;
    handleDeleteCategory(id);
  };

  const handleDeleteProjectFromSettings = async (id: string) => {
    if (!window.confirm(t(locale, 'deleteProjectConfirm'))) return;
    const projectToDelete = projects.find((project) => project.id === id);
    
    setProjects((prev) => prev.filter((project) => project.id !== id));

    if (user && supabase) {
      if (projectToDelete) {
        await supabase
          .from('expenses')
          .update({ project: null })
          .eq('project', projectToDelete.name)
          .eq('user_id', user.id);
      }
      
      await supabase.from('projects').delete().eq('id', id);
    }

    if (projectToDelete) {
      setExpenses((prev) =>
        prev.map((expense) => (expense.project === projectToDelete.name ? { ...expense, project: undefined } : expense))
      );
      if (draft.project === projectToDelete.name) {
        setDraft((prev) => ({ ...prev, project: '' }));
      }
    }
  };

  const handleAddProject = async () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      window.alert(t(locale, 'invalidProject'));
      return;
    }
    if (projects.some((project) => project.name === trimmedName)) {
      setNewProjectName('');
      return;
    }

    const newProject = { id: `project_${Date.now()}`, name: trimmedName };
    
    if (user && supabase) {
      const { error } = await supabase.from('projects').insert({ ...newProject, user_id: user.id });
    }

    setProjects((prev) => [...prev, newProject]);
    setNewProjectName('');
    setProjectModalOpen(false);
  };

  const handleAddCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      window.alert(t(locale, 'invalidCategory'));
      return;
    }
    if (allCategories.some((category) => category.name === trimmedName)) {
      setNewCategoryName('');
      return;
    }

    const newCat = { id: `custom_${Date.now()}`, name: trimmedName, emoji: newCategoryEmoji.trim() || '🏷️' };
    
    if (user && supabase) {
      const { error } = await supabase.from('categories').insert({ ...newCat, user_id: user.id });
    }

    setCustomCategories((prev) => [...prev, newCat]);
    if (categoryModalForExpense) {
      setDraft((prev) => ({
        ...prev,
        category: trimmedName,
        emoji: newCategoryEmoji.trim() || '🏷️',
      }));
    }
    
    if (pendingCategoryExpenseId) {
      setImportReviewExpenses((prev) =>
        prev.map((e) =>
          e.id === pendingCategoryExpenseId
            ? { ...e, category: trimmedName, emoji: newCategoryEmoji.trim() || '🏷️' }
            : e
        )
      );
      setPendingCategoryExpenseId(null);
    }
    setNewCategoryName('');
    setNewCategoryEmoji('🏷️');
    setCategoryModalOpen(false);
    setCategoryModalForExpense(false);
  };

  const handleRenameCategory = async (id: string) => {
    const trimmedName = editingCategoryName.trim();
    if (!trimmedName) {
      window.alert(t(locale, 'invalidCategory'));
      return;
    }
    
    const currentCategory = customCategories.find((category) => category.id === id);
    if (!currentCategory) return;

    if (user && supabase) {
      await supabase.from('categories').update({ name: trimmedName }).eq('id', id);
      await supabase
        .from('expenses')
        .update({ category: trimmedName })
        .eq('category', currentCategory.name)
        .eq('user_id', user.id);
    }

    setCustomCategories((prev) => prev.map((category) => (category.id === id ? { ...category, name: trimmedName } : category)));
    setExpenses((prev) =>
      prev.map((expense) => (expense.category === currentCategory.name ? { ...expense, category: trimmedName } : expense))
    );

    if (draft.category === currentCategory.name) {
      setDraft((prev) => ({ ...prev, category: trimmedName }));
    }
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleRenameProject = async (id: string) => {
    const trimmedName = editingProjectName.trim();
    if (!trimmedName) {
      window.alert(t(locale, 'invalidProject'));
      return;
    }

    const currentProject = projects.find((project) => project.id === id);
    if (!currentProject) return;

    if (user && supabase) {
      await supabase.from('projects').update({ name: trimmedName }).eq('id', id);
      await supabase
        .from('expenses')
        .update({ project: trimmedName })
        .eq('project', currentProject.name)
        .eq('user_id', user.id);
    }

    setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, name: trimmedName } : project)));
    setExpenses((prev) =>
      prev.map((expense) => (expense.project === currentProject.name ? { ...expense, project: trimmedName } : expense))
    );
    if (draft.project === currentProject.name) {
      setDraft((prev) => ({ ...prev, project: trimmedName }));
    }
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleManageInputKeyDown = (event: KeyboardEvent<HTMLInputElement>, action: () => void, cancel?: () => void) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
    if (event.key === 'Escape' && cancel) {
      event.preventDefault();
      cancel();
    }
  };

  const handleExportCsv = () => {
    let toExport = expenses;
    if (exportFromDate || exportToDate) {
      const from = exportFromDate ? parseIsoDateToLocal(exportFromDate) : null;
      const to = exportToDate ? parseIsoDateToLocal(exportToDate) : null;
      toExport = filterExpensesByDateRange(expenses, from, to);
    }
    if (toExport.length === 0) {
      window.alert(t(locale, 'noExpenses'));
      return;
    }
    downloadCsv(buildCsv(toExport, locale));
    setExportModalOpen(false);
  };

  const expensesToDelete = useMemo(() => {
    const hasAnyFilter = Boolean(bdFromDate || bdToDate || bdCategory || bdProject);
    if (!hasAnyFilter) return [];

    let filtered = expenses;
    if (bdCategory) {
      filtered = filtered.filter((e) => e.category === bdCategory);
    }
    if (bdProject === WITHOUT_PROJECT_VALUE) {
      filtered = filtered.filter((e) => !e.project);
    } else if (bdProject) {
      filtered = filtered.filter((e) => (e.project ?? '') === bdProject);
    }
    if (bdFromDate || bdToDate) {
      const from = bdFromDate ? parseIsoDateToLocal(bdFromDate) : null;
      const to = bdToDate ? parseIsoDateToLocal(bdToDate) : null;
      filtered = filterExpensesByDateRange(filtered, from, to);
    }
    return filtered;
  }, [expenses, bdFromDate, bdToDate, bdCategory, bdProject]);

  const handleBulkDelete = async () => {
    if (expensesToDelete.length === 0) return;
    const msg = t(locale, 'bulkDeleteConfirmMsg').replace('{n}', String(expensesToDelete.length));
    if (!window.confirm(msg)) return;

    const idsToDelete = expensesToDelete.map((e) => e.id);
    setExpenses((prev) => prev.filter((e) => !idsToDelete.includes(e.id)));

    if (user && supabase) {
      const chunkSize = 200;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        const { error } = await supabase.from('expenses').delete().in('id', chunk);
      }
    }

    setBulkDeleteModalOpen(false);
    setBdFromDate('');
    setBdToDate('');
    setBdCategory('');
    setBdProject('');
  };

  const handleImportClick = () => {
    setImportModalOpen(true);
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportModalOpen(false);
    setIsImporting(true);

    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (rows.length <= 1) {
        window.alert(t(locale, 'invalidCsv'));
        return;
      }

      const normalizeStr = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const header = rows[0].map((value) => normalizeStr(value.replace(/"/g, '').trim()));

      const dateIndex = header.findIndex((v) => v.includes('ημερομηνια') || v.includes('ημ/νια') || v === 'date');
      const projectIndex = header.findIndex((v) => v === 'project');
      const descIndex = header.findIndex((v) => v.includes('κατηγορια') || v.includes('category') || v.includes('περιγραφη') || v.includes('description') || v.includes('αιτιολογια'));
      const amountIndex = header.findIndex((v) => v.includes('ποσο') || v.includes('amount'));

      if (dateIndex === -1 || descIndex === -1 || amountIndex === -1) {
        window.alert(t(locale, 'invalidCsv'));
        return;
      }

      const isBankExport = header[descIndex].includes('περιγραφ') || header[descIndex].includes('description') || header[descIndex].includes('αιτιολογ');
      const otherCategoryName = locale === 'el' ? 'Άλλο' : 'Other';
      
      let hasNegativeAmounts = false;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[amountIndex]) continue;
        let rawAmt = row[amountIndex].replace(/"/g, '').trim();
        if (rawAmt.includes(',') && rawAmt.includes('.')) {
             const lastComma = rawAmt.lastIndexOf(',');
             const lastDot = rawAmt.lastIndexOf('.');
             rawAmt = lastComma > lastDot ? rawAmt.replace(/\./g, '').replace(',', '.') : rawAmt.replace(/,/g, '');
        } else if (rawAmt.includes(',')) {
             rawAmt = rawAmt.replace(',', '.');
        }
        const amt = Number.parseFloat(rawAmt);
        if (!Number.isNaN(amt) && amt < 0) {
          hasNegativeAmounts = true;
          break;
        }
      }

      let aiCategoryMap: Record<string, string> = {};

      if (isBankExport && aiApiKey) {
        try {
          const descriptionsToCategorize = Array.from(new Set(
            rows.slice(1)
              .filter(row => row[dateIndex] && row[amountIndex] && row[descIndex])
              .map(row => row[descIndex].replace(/"/g, '').trim())
              .filter(Boolean)
          ));

          if (descriptionsToCategorize.length > 0) {
            const catNames = displayCategories.map(c => c.name);
            catNames.push(otherCategoryName);

            const prompt = `You are a bank transaction categorizer.
Available categories: ${catNames.join(', ')}.
Map the following transaction descriptions to the most appropriate category. Return ONLY a valid JSON object where keys are the exact descriptions and values are the category names. If unsure, use '${otherCategoryName}'. No markdown blocks.
Transactions:
${descriptionsToCategorize.join('\n')}`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${aiApiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
              })
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Κωδικός Σφάλματος: ${res.status} - ${errText}`);
            }

            const data = await res.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aiText) {
              const cleanText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              const rawMap = JSON.parse(cleanText);
              for (const [k, v] of Object.entries(rawMap)) {
                aiCategoryMap[k.trim().toLowerCase()] = v as string;
              }
            }
          }
        } catch (e) {
          window.alert(`Η ταξινόμηση με AI απέτυχε.\n\nΣφάλμα: ${e instanceof Error ? e.message : 'Άγνωστο'}\n\nΗ εισαγωγή θα συνεχιστεί με τους βασικούς κανόνες. Δες την κονσόλα (F12) για λεπτομέρειες.`);
        }
      }

      const BANK_CATEGORY_RULES: Record<string, string[]> = {
        'Σούπερ Μάρκετ': ['lidl', 'ab food', 'sklavenitis', 'my market', 'masoutis', 'bazaar', 'galaxias', 'market in'],
        'Φαγητό': ['efood', 'wolt', 'box', 'pizza', 'burger', 'grill', 'gyros', 'souvlaki', 'food', 'bakery', 'choux', 'the bitt', 'pagkalos'],
        'Καφές': ['coffee', 'mikel', 'gregorys', 'starbucks', 'coffee island', 'everest'],
        'Καύσιμα': ['shell', 'eko', 'bp', 'aegean', 'revoil', 'elin', 'petrol'],
        'Διόδια': ['diodia', 'olympia odos', 'nea odos', 'gefyra', 'attiki odos', 'egnatia', 'kentriki odos'],
        'Λογαριασμοί': ['cosmote', 'vodafone', 'nova', 'dei', 'eydap', 'protergia', 'heron', 'zenith', 'elta'],
        'Φαρμακείο': ['farmakeio', 'pharmacy', 'φαρμακειο'],
        'Ηλεκτρονικά': ['skroutz', 'plaisio', 'public', 'kotsovolos', 'germanos'],
        'Ταξίδια': ['hotel', 'airbnb', 'booking', 'aegean airlines', 'sky express', 'ryanair', 'ferries'],
        'Τράπεζα': ['eurobank', 'alpha bank', 'piraeus', 'national bank', 'ethniki', 'viva', 'paypal', 'revolut']
      };

      const importedExpenses: Expense[] = [];
      const newCategories: Category[] = [];
      const existingNames = new Set(allCategories.map((category) => category.name));

      rows.slice(1).forEach((row, index) => {
        if (!row[dateIndex] || !row[amountIndex] || !row[descIndex]) return;

        const rawDate = row[dateIndex].replace(/"/g, '').trim();
        if (!rawDate) return;
        let date = rawDate;
        if (rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3) {
                date = `${parts[2].length === 2 ? '20'+parts[2] : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

        let rawAmount = row[amountIndex].replace(/"/g, '').trim();
        if (rawAmount.includes(',') && rawAmount.includes('.')) {
             const lastComma = rawAmount.lastIndexOf(',');
             const lastDot = rawAmount.lastIndexOf('.');
             rawAmount = lastComma > lastDot ? rawAmount.replace(/\./g, '').replace(',', '.') : rawAmount.replace(/,/g, '');
        } else if (rawAmount.includes(',')) {
             rawAmount = rawAmount.replace(',', '.');
        }
        
        const amount = Number.parseFloat(rawAmount);
        if (Number.isNaN(amount) || amount === 0) return;
        
        if (hasNegativeAmounts && amount > 0) return;

        const finalAmount = Math.abs(amount);

        const desc = row[descIndex].replace(/"/g, '').trim();
        let category = desc;
        let comment = '';

        if (isBankExport) {
            comment = desc;
            const descLow = desc.toLowerCase();
            const cleanDesc = normalizeStr(desc);
            
            if (customCategoryMap[cleanDesc]) {
                category = customCategoryMap[cleanDesc]; // 1. Από το ιστορικό εκμάθησης (User Rules)
            } else if (aiCategoryMap[descLow]) {
                category = aiCategoryMap[descLow]; // Από το AI Map
            } else {
                category = otherCategoryName;
                const dLow = normalizeStr(desc);
                for (const [catName, keywords] of Object.entries(BANK_CATEGORY_RULES)) {
                    if (keywords.some(keyword => dLow.includes(normalizeStr(keyword)))) {
                        category = catName;
                        break;
                    }
                }
            }
        }

        const project = projectIndex === -1 ? '' : (row[projectIndex] ?? '').replace(/"/g, '').trim();

        if (!existingNames.has(category)) {
          existingNames.add(category);
          newCategories.push({
            id: `import_cat_${Date.now()}_${index}`,
            name: category,
            emoji: '🏷️',
          });
        }

        importedExpenses.push({
          id: `import_${Date.now()}_${index}`,
          amount: finalAmount.toFixed(2),
          category,
          emoji: allCategories.find((item) => item.name === category)?.emoji ?? '🏷️',
          date,
          comment,
          project: project || undefined,
        });
      });

      if (user && supabase) {
        if (newCategories.length > 0) {
          await supabase.from('categories').insert(newCategories.map(c => ({ ...c, user_id: user.id })));
        }
        if (importedExpenses.length > 0) {
            const toUpload = importedExpenses.map(({ receiptFileId, ...e }) => ({ ...e, receipt_file_id: receiptFileId ?? null, user_id: user.id }));
            await supabase.from('expenses').insert(toUpload);
        }
      }

      setCustomCategories((prev) => [...prev, ...newCategories]);
      setExpenses((prev) => [...importedExpenses, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      
      const uncategorized = importedExpenses.filter(e => e.category === otherCategoryName);
      if (uncategorized.length > 0) {
        setImportReviewExpenses(uncategorized);
        setImportReviewModalOpen(true);
      } else {
        window.alert(t(locale, 'importDone'));
      }

    } catch (error) {
      window.alert(t(locale, 'invalidCsv'));
    } finally {
      setIsImporting(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleReceiptUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const token = session?.provider_token;
    if (!token) {
      window.alert('Το κλειδί του Google Drive έληξε (ανανεώνεται κάθε 1 ώρα). Παρακαλώ κάνε αποσύνδεση και ξανά σύνδεση για να ανεβάσεις απόδειξη.');
      return;
    }

    setIsUploadingReceipt(true);
    try {
      const fileToUpload = await compressImage(file);
      const mimeType = fileToUpload instanceof File ? file.type : 'image/jpeg';
      
      const metadata = { name: `Receipt_${Date.now()}_${file.name}`, mimeType };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', fileToUpload);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      setDraft(prev => ({ ...prev, receiptFileId: data.id }));
    } catch (e) {
      window.alert('Αποτυχία ανεβάσματος στο Google Drive. Δοκίμασε ξανά.');
    } finally {
      setIsUploadingReceipt(false);
      if (event.target) event.target.value = '';
    }
  };

  const showDashboard = tab !== 'settings';
  const isAnyModalOpen =
    expenseModalOpen || filterModalOpen || backgroundModalOpen || projectModalOpen || categoryModalOpen || exportModalOpen || importModalOpen || bulkDeleteModalOpen || importReviewModalOpen || fixMyPeriod !== null || analyticsModal !== null;

  const handleGoogleSignIn = async () => {
    if (!supabase) return;
    const redirectTo = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo,
        scopes: 'https://www.googleapis.com/auth/drive.file'
      },
    });
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleSaveBudget = async () => {
    const finalIncome = Number(budgetInputValue) || 0;
    const finalYearly = Number(yearlyBudgetInputValue) || 0;
    hasLocalBudgetOverrideRef.current = true;
    pendingBudgetRef.current = { income: finalIncome, yearly: finalYearly };
    setIncome(finalIncome);
    setYearlyBudget(finalYearly);

    if (user?.id && supabase) {
      await supabase.from('profiles').upsert({
        id: user.id,
        income: finalIncome,
        yearly_budget: finalYearly,
        locale,
        background,
        updated_at: new Date().toISOString()
      });
    }
  };

  const handleHomeBudgetSave = async () => {
    let finalIncome = income;
    let finalYearly = yearlyBudget;
    
    if (homeBudgetEditModal === 'monthly') {
      finalIncome = Number(homeBudgetEditValue) || 0;
      setBudgetInputValue(String(finalIncome));
      setIncome(finalIncome);
    } else if (homeBudgetEditModal === 'yearly') {
      finalYearly = Number(homeBudgetEditValue) || 0;
      setYearlyBudgetInputValue(String(finalYearly));
      setYearlyBudget(finalYearly);
    }
    
    hasLocalBudgetOverrideRef.current = true;
    pendingBudgetRef.current = { income: finalIncome, yearly: finalYearly };

    if (user?.id && supabase) {
      await supabase.from('profiles').upsert({
        id: user.id,
        income: finalIncome,
        yearly_budget: finalYearly,
        locale,
        background,
        updated_at: new Date().toISOString()
      });
    }
    setHomeBudgetEditModal(null);
  };

  const handleDeleteReceipt = async () => {
    if (!window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε τη φωτογραφία; Θα διαγραφεί οριστικά και από το Google Drive.')) return;
    
    const fileId = draft.receiptFileId;
    setDraft(prev => ({ ...prev, receiptFileId: null }));
    
    if (fileId && session?.provider_token) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.provider_token}` }
        });
      } catch (e) {
      }
    }
  };

  const renderGauge = (labelKey: string, targetPctOfIncome: number, currentAmount: number, color: string, icon: string, isSavings: boolean = false) => {
    const displayAmount = animateGauges ? currentAmount : 0;
    const targetAmount = parsedIncome * (targetPctOfIncome / 100);
    const currentPctOfIncome = parsedIncome > 0 ? (displayAmount / parsedIncome) * 100 : 0;
    const clampedPct = Math.min(100, currentPctOfIncome);
    const cx = 50, cy = 50, r = 35;
    const L = Math.PI * r;
    const dashOffset = L - ((animateGauges ? targetPctOfIncome : 0) / 100) * L;
    const needleRotation = (clampedPct / 100) * 180 - 90;
    const tipX = cx, tipY = cy - 40;
    const base1X = cx - 2.5, base1Y = cy;
    const base2X = cx + 2.5, base2Y = cy;

    const isOverTarget = currentAmount > targetAmount;
    let needleColor = '#f5f5f7';
    if (isSavings) {
      if (isOverTarget) needleColor = '#32d74b';
    } else {
      if (isOverTarget) needleColor = '#ff453a';
    }
    
    const pathId = `gauge-arc-${labelKey}`;

    return (
      <div 
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 2px', maxWidth: '110px', cursor: 'pointer' }}
        onClick={(e) => { 
          e.stopPropagation();
          const todayIso = new Date().toISOString().slice(0, 7);
          const monthExpenses = expenses.filter(exp => exp.date && exp.date.slice(0, 7) === todayIso);
          let catExpenses: Expense[] = [];
          if (labelKey === 'ruleNeeds') {
            catExpenses = monthExpenses.filter(exp => NEEDS_CATEGORIES.includes(exp.category));
          } else if (labelKey === 'ruleWants') {
            catExpenses = monthExpenses.filter(exp => !NEEDS_CATEGORIES.includes(exp.category));
          }
          setRuleDetailsModal({
            labelKey, icon, color, amount: currentAmount, target: targetAmount,
            expenses: catExpenses.sort((a,b) => Number(b.amount) - Number(a.amount))
          });
        }}
      >
        <svg width="100%" viewBox="8 5 84 66" style={{ overflow: 'visible', maxHeight: '70px' }}>
          <defs>
            <path id={pathId} d={`M 15 50 A 35 35 0 0 1 85 50`} />
          </defs>
          <path d={`M 15 50 A 35 35 0 0 1 85 50`} fill="none" stroke="#2c2c2e" strokeWidth="14" strokeLinecap="butt" />
          <path d={`M 15 50 A 35 35 0 0 1 85 50`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="butt" strokeDasharray={`${L}`} strokeDashoffset={`${dashOffset}`} style={{ transition: animateGauges ? 'stroke-dashoffset 1s ease-out' : 'none' }} />
          
          <g style={{ transform: `rotate(${needleRotation}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: animateGauges ? 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none' }}>
            <polygon points={`${base1X},${base1Y} ${base2X},${base2Y} ${tipX},${tipY}`} fill={needleColor} style={{ transition: 'fill 1s ease-out' }} />
          </g>
          <circle cx={cx} cy={cy} r="3.5" fill={needleColor} style={{ transition: 'fill 1s ease-out' }} />
          <text x="50" y="68" fill={needleColor} fontSize="10" textAnchor="middle" fontWeight="700">{displayAmount.toFixed(0)}€ / {targetAmount.toFixed(0)}€</text>
        </svg>
        <span style={{ fontSize: '11px', color: '#8e8e93', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>{icon}</span> {t(locale, labelKey)}
        </span>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h2>{t(locale, 'appTitle')}</h2>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h2>{t(locale, 'authSetupTitle')}</h2>
          <p>{t(locale, 'authSetupBody')}</p>
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h2>{t(locale, 'authRequired')}</h2>
          <p>{t(locale, 'authRequiredBody')}</p>
          <button className="primary-btn auth-btn" onClick={handleGoogleSignIn}>
            {t(locale, 'continueWithGoogle')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div
        ref={stickyShellRef}
        className="sticky-shell"
        style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 40, 
          backgroundColor: 'transparent', 
          margin: '-24px -16px 0 -16px', 
          padding: tab === 'home' ? '24px 16px 0 16px' : tab === 'analytics' ? '24px 16px 10px 16px' : '24px 16px 16px 16px',
          borderBottom: 'none' 
        }}
      >
        {/* Camouflage Mask Layer */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: tab === 'home' ? '60px' : '0',
          background: getBackgroundCss(background),
          backgroundAttachment: 'fixed',
          zIndex: -1,
          pointerEvents: 'none',
          maskImage: 'linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)'
        }} />
        <Header 
          locale={locale} 
          user={user} 
          onSignOut={handleSignOut} 
        />
        
        <nav className="tabbar">
          {(['home', 'analytics', 'settings'] as const).map((id) => (
            <button key={id} className={`tab-chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {t(locale, id)}
            </button>
          ))}
          <button 
            className={`tab-chip ${hasActiveFilter ? 'active' : ''}`} 
            onClick={() => setFilterModalOpen(true)}
            title="Φίλτρα"
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}
          >
            <span style={{ fontSize: '15px' }}>🔍</span>
          </button>
        </nav>

        {tab === 'home' && (
          <>
            <div 
              className="budget-carousel"
              ref={carouselRef}
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => {
                if (!carouselRef.current) return;
                isDraggingRef.current = true;
                startXRef.current = e.pageX - carouselRef.current.offsetLeft;
                scrollLeftRef.current = carouselRef.current.scrollLeft;
                carouselRef.current.style.cursor = 'grabbing';
                carouselRef.current.style.scrollSnapType = 'none';
              }}
              onMouseLeave={() => {
                isDraggingRef.current = false;
                if (carouselRef.current) {
                  carouselRef.current.style.cursor = 'grab';
                  carouselRef.current.style.scrollSnapType = 'x mandatory';
                }
              }}
              onMouseUp={() => {
                isDraggingRef.current = false;
                if (carouselRef.current) {
                  carouselRef.current.style.cursor = 'grab';
                  carouselRef.current.style.scrollSnapType = 'x mandatory';
                }
              }}
              onMouseMove={(e) => {
                if (!isDraggingRef.current || !carouselRef.current) return;
                e.preventDefault();
                const x = e.pageX - carouselRef.current.offsetLeft;
                const walk = (x - startXRef.current) * 1.5;
                carouselRef.current.scrollLeft = scrollLeftRef.current - walk;
              }}
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.clientWidth > 0) {
                  const index = Math.round(target.scrollLeft / target.clientWidth);
                  if (index !== activeBudgetSlideRef.current) {
                    activeBudgetSlideRef.current = index;
                    setActiveBudgetSlide(index);
                    localStorage.setItem('expense_active_budget_slide', String(index));
                  }
                }
              }}
            >
              <section className="panel budget-panel">
                <h3 
                  className="budget-title" 
                  style={{ cursor: 'pointer', display: 'inline-block' }}
                  onClick={(e) => { e.stopPropagation(); setHomeBudgetEditValue(budgetInputValue); setHomeBudgetEditModal('monthly'); }}
                >
                  {t(locale, 'monthlyBudget')}
                </h3>
                <div className="budget-bar-wrap">
                  {currentMonthSpend > 0 && (
                    <strong className="budget-spent-value">{(parsedIncome - currentMonthSpend).toFixed(0)} €</strong>
                  )}
                  <div className="progress-track budget-track">
                    <div className="progress-fill budget-fill" style={{ width: `${Math.max(0, 100 - visualProgressPct)}%` }} />
                  </div>
                  <span
                    className="budget-date-marker"
                    style={{ left: `${budgetDateMarkers.monthDatePct}%` }}
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'mouse') setMarkerTooltip('month');
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === 'mouse') setMarkerTooltip(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMarkerTooltip(prev => prev === 'month' ? null : 'month');
                    }}
                  />
                  {markerTooltip === 'month' && (
                    <div className="marker-tooltip" style={{ left: `${budgetDateMarkers.monthDatePct}%` }}>
                      {new Date().toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                  <strong 
                    className="budget-bar-value" 
                    onClick={(e) => { e.stopPropagation(); setHomeBudgetEditValue(budgetInputValue); setHomeBudgetEditModal('monthly'); }} 
                    style={{ cursor: 'pointer' }}
                  >
                    {parsedIncome.toFixed(0)} €
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <p className="budget-consumed" style={{ margin: 0, color: actualProgressPct > 100 ? '#ff453a' : '#8e8e93' }}>{actualProgressPct.toFixed(0)}% κατανάλωση</p>
                  {parsedIncome > 0 && smartInsight && (
                    <span 
                      className="insight-badge"
                      onClick={() => setFixMyPeriod('month')}
                      style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: smartInsight.bg, 
                        color: smartInsight.color,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {smartInsight.icon} {smartInsight.badgeText}
                      <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, marginLeft: '2px' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                  )}
                </div>
              </section>

              <section className="panel budget-panel">
                <h3 
                  className="budget-title" 
                  style={{ cursor: 'pointer', display: 'inline-block' }}
                  onClick={(e) => { e.stopPropagation(); setHomeBudgetEditValue(yearlyBudgetInputValue); setHomeBudgetEditModal('yearly'); }}
                >
                  {t(locale, 'yearlyBudget')}
                </h3>
                <div className="budget-bar-wrap">
                  {totals.year > 0 && (
                    <strong className="budget-spent-value">{(parsedYearly - totals.year).toFixed(0)} €</strong>
                  )}
                  <div className="progress-track budget-track">
                    <div className="progress-fill budget-fill" style={{ width: `${Math.max(0, 100 - visualYearlyProgressPct)}%` }} />
                  </div>
                  <span
                    className="budget-date-marker"
                    style={{ left: `${budgetDateMarkers.yearDatePct}%` }}
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'mouse') setMarkerTooltip('year');
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === 'mouse') setMarkerTooltip(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMarkerTooltip(prev => prev === 'year' ? null : 'year');
                    }}
                  />
                  {markerTooltip === 'year' && (
                    <div className="marker-tooltip" style={{ left: `${budgetDateMarkers.yearDatePct}%` }}>
                      {new Date().toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                  <strong 
                    className="budget-bar-value" 
                    onClick={(e) => { e.stopPropagation(); setHomeBudgetEditValue(yearlyBudgetInputValue); setHomeBudgetEditModal('yearly'); }} 
                    style={{ cursor: 'pointer' }}
                  >
                    {parsedYearly.toFixed(0)} €
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <p className="budget-consumed" style={{ margin: 0, color: actualYearlyProgressPct > 100 ? '#ff453a' : '#8e8e93' }}>{actualYearlyProgressPct.toFixed(0)}% κατανάλωση</p>
                  {parsedYearly > 0 && yearlySmartInsight && (
                    <span 
                      className="insight-badge"
                      onClick={() => setFixMyPeriod('year')}
                      style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: yearlySmartInsight.bg, 
                        color: yearlySmartInsight.color,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {yearlySmartInsight.icon} {yearlySmartInsight.badgeText}
                      <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, marginLeft: '2px' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                  )}
                </div>
              </section>

              {/* Slide 3: 50/30/20 Gauges */}
              <section className="panel budget-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 className="budget-title" style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); setShowRuleTooltip(true); }}>
                    {t(locale, 'ruleTitle')}
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="#8e8e93" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                  </h3>
                  {showRuleTooltip && (
                    <div style={{ position: 'absolute', top: '24px', left: '0', width: '220px', padding: '10px', backgroundColor: '#1c1c1f', border: '1px solid #2c2c2e', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 100, color: '#f5f5f7', fontSize: '11px', lineHeight: '1.4' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><span style={{ color: '#0a84ff', fontWeight: 'bold' }}>{t(locale, 'ruleNeeds')}:</span> {t(locale, 'ruleNeedsDesc')}</div>
                        <div><span style={{ color: '#ff9f0a', fontWeight: 'bold' }}>{t(locale, 'ruleWants')}:</span> {t(locale, 'ruleWantsDesc')}</div>
                        <div><span style={{ color: '#32d74b', fontWeight: 'bold' }}>{t(locale, 'ruleSavings')}:</span> {t(locale, 'ruleSavingsDesc')}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-evenly', gap: '8px', alignItems: 'center', width: '100%' }}>
                  {renderGauge('ruleNeeds', 50, currentNeeds, '#0a84ff', '🏠')}
                  {renderGauge('ruleWants', 30, currentWants, '#ff9f0a', '🍕')}
                  {renderGauge('ruleSavings', 20, currentSavings, '#32d74b', '🏦', true)}
                </div>
              </section>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', paddingBottom: '4px', marginTop: '-8px' }}>
              {[0, 1, 2].map(idx => (
                <div 
                  key={idx}
                  style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeBudgetSlide === idx ? '#f5f5f7' : '#48484a', transition: 'background-color 0.3s ease', cursor: 'pointer' }} 
                  onClick={() => carouselRef.current?.scrollTo({ left: carouselRef.current.clientWidth * idx, behavior: 'smooth' })}
                />
              ))}
            </div>
            
            
          </>
        )}

        {showDashboard && tab === 'analytics' && (
          <>
            <section className="range-scroll-row">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`tab-chip ${range === option ? 'active' : ''}`}
                  onClick={() => setRange(option)}
                >
                  {t(locale, option)}
                </button>
              ))}
            </section>
          </>
        )}
      </div>

      <main className="main-grid" style={{ marginTop: tab === 'home' ? '4px' : undefined }}>
        {tab === 'home' && (
          <HomeMainView
            locale={locale}
            range={range}
            ranges={RANGE_OPTIONS}
            totals={totals}
            showDashboard={showDashboard}
            historyGroups={historyGroups}
            expandedGroups={expandedGroups}
            setExpandedGroups={setExpandedGroups}
            setRange={setRange}
            swipedExpenseId={swipedExpenseId}
            setSwipedExpenseId={setSwipedExpenseId}
            handleDeleteExpense={handleDeleteExpense}
            handleExpenseTouchStart={handleExpenseTouchStart}
            handleExpenseTouchEnd={handleExpenseTouchEnd}
            openEditExpense={openEditExpense}
            needsMonthTotal={needsMonthTotal}
            wantsMonthTotal={wantsMonthTotal}
            income={parsedIncome}
          />
        )}
        {tab === 'analytics' && (
          <AnalyticsMainView
            locale={locale}
            range={range}
            analyticsCarouselRef={analyticsCarouselRef}
            isAnalyticsDraggingRef={isAnalyticsDraggingRef}
            isClickPreventedRef={isClickPreventedRef}
            analyticsStartXRef={analyticsStartXRef}
            analyticsScrollLeftRef={analyticsScrollLeftRef}
            activeAnalyticsSlide={activeAnalyticsSlide}
            setActiveAnalyticsSlide={setActiveAnalyticsSlide}
            budgetPaceView={budgetPaceView}
            budgetPaceDelta={budgetPaceDelta}
            setAnalyticsModal={setAnalyticsModal}
            budgetPaceDayActualPct={budgetPaceDayActualPct}
            budgetPaceActual={budgetPaceActual}
            budgetPaceDayTargetPct={budgetPaceDayTargetPct}
            budgetPaceTarget={budgetPaceTarget}
            isComparisonMore={isComparisonMore}
            isComparisonLess={isComparisonLess}
            comparisonPct={comparisonPct}
            prevLabelKey={prevLabelKey}
            prevTotal={prevTotal}
            prevBarPct={prevBarPct}
            currentTotal={currentTotal}
            currentBarPct={currentBarPct}
            categoryDonut={categoryDonut}
            monthHeatmapData={monthHeatmapData}
            setSeamlessHeatmapTransition={setSeamlessHeatmapTransition}
            setHeatmapSlideDir={setHeatmapSlideDir}
            setHeatmapViewDate={setHeatmapViewDate}
            setActiveHeatmapDay={setActiveHeatmapDay}
            weekHeatmapData={weekHeatmapData}
            setWeekHeatmapSlideDir={setWeekHeatmapSlideDir}
            setWeekHeatmapViewStartDate={setWeekHeatmapViewStartDate}
            setActiveWeekHeatmapDayIndex={setActiveWeekHeatmapDayIndex}
            yearHeatmapData={yearHeatmapData}
            setYearHeatmapSlideDir={setYearHeatmapSlideDir}
            setActiveYearHeatmapMonth={setActiveYearHeatmapMonth}
            hasActiveFilter={hasActiveFilter}
            fromDate={fromDate}
            toDate={toDate}
            categoryFilterLabel={categoryFilterLabel}
            projectFilterLabel={projectFilterLabel}
            analyticsGroups={analyticsGroups}
            analyticsCategoryUniverse={analyticsCategoryUniverse}
            expandedGroups={expandedGroups}
            setExpandedGroups={setExpandedGroups}
            openEditExpense={openEditExpense}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            locale={locale}
            budgetInputValue={budgetInputValue}
            setBudgetInputValue={setBudgetInputValue}
            yearlyBudgetInputValue={yearlyBudgetInputValue}
            setYearlyBudgetInputValue={setYearlyBudgetInputValue}
            income={income}
            yearlyBudget={yearlyBudget}
            handleSaveBudget={handleSaveBudget}
            projects={projects}
            openProjectModal={openProjectModal}
            editingProjectId={editingProjectId}
            editingProjectName={editingProjectName}
            setEditingProjectName={setEditingProjectName}
            handleRenameProject={handleRenameProject}
            handleManageInputKeyDown={handleManageInputKeyDown}
            setEditingProjectId={setEditingProjectId}
            handleDeleteProjectFromSettings={handleDeleteProjectFromSettings}
            customCategories={customCategories}
            openCategoryModal={openCategoryModal}
            editingCategoryId={editingCategoryId}
            editingCategoryName={editingCategoryName}
            setEditingCategoryName={setEditingCategoryName}
            handleRenameCategory={handleRenameCategory}
            setEditingCategoryId={setEditingCategoryId}
            handleDeleteCategoryFromSettings={handleDeleteCategoryFromSettings}
            handleImportClick={handleImportClick}
            setExportModalOpen={setExportModalOpen}
            setBulkDeleteModalOpen={setBulkDeleteModalOpen}
            setBackgroundModalOpen={setBackgroundModalOpen}
            setLocale={setLocale}
            user={user}
            handleSignOut={handleSignOut}
            importInputRef={importInputRef}
            handleImportCsv={handleImportCsv}
            displayCategories={displayCategories}
          />
        )}
      </main>

      {/* Floating Action Button (FAB) for adding expenses */}
      {showDashboard && !isAnyModalOpen && (
        <>
          {fabMenuOpen && (
            <div 
              className="fab-backdrop" 
              onClick={() => setFabMenuOpen(false)}
            />
          )}

          {fabMenuOpen && (
            <div 
              style={{
                position: 'fixed',
                bottom: '120px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '48px',
                display: 'flex',
                flexDirection: 'column-reverse',
                gap: '16px',
                zIndex: 1001,
              }}
            >
              {topCategories.map((cat, i) => (
                <div key={cat.id} style={{ position: 'relative', width: '48px', height: '48px', '--i': i } as React.CSSProperties} className="fab-bubble-wrap">
                  <span className="fab-bubble-label">{getLocalizedCategoryName(locale, cat.name)}</span>
                  <button
                    className="fab-bubble"
                    onClick={() => {
                      setFabMenuOpen(false);
                      openAddExpense(cat);
                    }}
                    title={getLocalizedCategoryName(locale, cat.name)}
                  >
                    {cat.emoji}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            className={`fab-button ${fabMenuOpen ? 'open' : ''}`}
            onPointerDown={handleFabPointerDown}
            onPointerUp={handleFabPointerUp}
            onPointerLeave={handleFabPointerCancel}
            onPointerCancel={handleFabPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            style={{
            position: 'fixed',
            bottom: '40px',
            left: '50%',
            width: '64px',
            height: '64px',
            borderRadius: '32px',
            backgroundColor: '#0a84ff',
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            fontWeight: '300',
            boxShadow: '0 8px 32px rgba(10, 132, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.5)',
            cursor: 'pointer',
              zIndex: 1002,
              touchAction: 'none', // Σημαντικό για να δουλεύει το Long Press σε οθόνες αφής
              userSelect: 'none',
              WebkitUserSelect: 'none'
          }}
          title={t(locale, 'addExpense')}
        >
          {fabMenuOpen ? (
            <svg className="fab-button-symbol" viewBox="0 0 24 24" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          ) : (
            <svg className="fab-button-symbol" viewBox="0 0 24 24" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
        </>
      )}

      {isImporting && (
        <div className="modal-backdrop" style={{ zIndex: 9999, flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
          <style>{`
            @keyframes aiPulse {
              0% { transform: scale(0.9); opacity: 0.8; filter: drop-shadow(0 0 12px rgba(10, 132, 255, 0.4)); }
              50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 32px rgba(10, 132, 255, 0.8)); }
              100% { transform: scale(0.9); opacity: 0.8; filter: drop-shadow(0 0 12px rgba(10, 132, 255, 0.4)); }
            }
          `}</style>
          <div style={{ fontSize: '56px', animation: 'aiPulse 2s infinite ease-in-out' }}>✨🤖</div>
          <h3 style={{ color: '#fff', margin: 0 }}>{t(locale, 'importProcessing')}</h3>
        </div>
      )}

      {/* Monthly Wrapped Modal */}
      {showWrappedModal && wrappedData && (
        <div className="modal-backdrop" style={{ zIndex: 2000 }} onClick={() => {}}>
          <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px 24px', background: 'linear-gradient(180deg, #1c1c1e 0%, #0b0b0d 100%)', border: '1px solid #3a3b40', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px', filter: 'drop-shadow(0 0 32px rgba(10, 132, 255, 0.4))' }}>🎇</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>{t(locale, 'wrappedTitle').replace('{month}', wrappedData.monthName)}</h2>
            <p style={{ margin: '0 0 24px 0', color: '#8e8e93', fontSize: '15px' }}>{t(locale, 'wrappedSubtitle')}</p>

            <div style={{ display: 'grid', gap: '12px', textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ background: '#111214', padding: '16px', borderRadius: '16px', border: '1px solid #2c2c2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#8e8e93' }}>{t(locale, 'wrappedTotal')}</span>
                <strong style={{ fontSize: '18px' }}>{wrappedData.total.toFixed(2)}€</strong>
              </div>

              {income > 0 && (
                <div style={{ background: '#111214', padding: '16px', borderRadius: '16px', border: '1px solid #2c2c2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8e8e93' }}>{wrappedData.saved >= 0 ? t(locale, 'wrappedSaved') : t(locale, 'wrappedOver')}</span>
                  <strong style={{ fontSize: '18px', color: wrappedData.saved >= 0 ? '#32d74b' : '#ff453a' }}>{Math.abs(wrappedData.saved).toFixed(2)}€</strong>
                </div>
              )}

              {wrappedData.topCategory && (
                <div style={{ background: '#111214', padding: '16px', borderRadius: '16px', border: '1px solid #2c2c2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8e8e93' }}>{t(locale, 'wrappedTopCategory')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{wrappedData.topCategory.emoji}</span>
                    <strong>{wrappedData.topCategory.name}</strong>
                  </div>
                </div>
              )}
            </div>

            <button 
              className="primary-btn" 
              style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '16px', fontWeight: 'bold' }}
              onClick={() => {
                localStorage.setItem('expense_wrapped_seen', wrappedData.monthKey);
                setShowWrappedModal(false);
              }}
            >
              {t(locale, 'wrappedBtn')}
            </button>
          </div>
        </div>
      )}

      {analyticsModal === 'pace' && budgetPaceModalChart && budgetPaceView.mode === 'chart' && (
        <div className="modal-backdrop" onClick={() => setAnalyticsModal(null)}>
          <div className="modal-card analytics-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="analytics-modal-header">
              <h3>{t(locale, 'analyticsBudgetPaceTitle')}</h3>
              <button className="ghost-btn" onClick={() => setAnalyticsModal(null)}>
                {t(locale, 'close')}
              </button>
            </div>
            <div className="analytics-kpi-compact">
              <strong className={budgetPaceDelta > 0 ? 'danger' : 'success'}>
                {Math.abs(budgetPaceDelta).toFixed(0)}€
              </strong>
              <small>{budgetPaceDelta > 0 ? t(locale, 'analyticsPaceOverText') : t(locale, 'analyticsPaceUnderText')}</small>
            </div>

            <svg
              className="analytics-modal-line-svg"
              viewBox={`0 0 ${budgetPaceModalChart.width} ${budgetPaceModalChart.height}`}
              aria-label="Cumulative spending chart"
            >
              {budgetPaceModalChart.yTicks.map((tick) => (
                <g key={`yt_${tick}`}>
                  <line
                    x1={budgetPaceModalChart.margin.left}
                    y1={budgetPaceModalChart.toY(tick)}
                    x2={budgetPaceModalChart.width - budgetPaceModalChart.margin.right}
                    y2={budgetPaceModalChart.toY(tick)}
                    className="analytics-modal-grid-line"
                  />
                  <text
                    x={budgetPaceModalChart.margin.left - 10}
                    y={budgetPaceModalChart.toY(tick) + 4}
                    className="analytics-modal-axis-text"
                    textAnchor="end"
                  >
                    {tick.toFixed(0)}€
                  </text>
                </g>
              ))}

              <line
                x1={budgetPaceModalChart.margin.left}
                y1={budgetPaceModalChart.margin.top}
                x2={budgetPaceModalChart.margin.left}
                y2={budgetPaceModalChart.height - budgetPaceModalChart.margin.bottom}
                className="analytics-modal-axis-line"
              />
              <line
                x1={budgetPaceModalChart.margin.left}
                y1={budgetPaceModalChart.height - budgetPaceModalChart.margin.bottom}
                x2={budgetPaceModalChart.width - budgetPaceModalChart.margin.right}
                y2={budgetPaceModalChart.height - budgetPaceModalChart.margin.bottom}
                className="analytics-modal-axis-line"
              />

              <polyline className="analytics-modal-line expected" points={budgetPaceModalChart.expectedPoints} />
              <polyline className="analytics-modal-line" points={budgetPaceModalChart.forecastPoints} strokeDasharray="6 6" style={{ stroke: '#0a84ff', strokeWidth: 3, fill: 'none', opacity: 0.6 }} />
              <polyline className="analytics-modal-line actual" points={budgetPaceModalChart.actualPoints} />

              <circle
                cx={budgetPaceModalChart.actualEndX}
                cy={budgetPaceModalChart.actualEndY}
                r="5"
                className="analytics-modal-actual-dot"
              />

              <g
                transform={`translate(${budgetPaceModalChart.actualEndX + (budgetPaceModalChart.actualEndLabelLeft ? -12 : 12)}, ${budgetPaceModalChart.actualEndY - 14})`}
              >
                <rect
                  x={budgetPaceModalChart.actualEndLabelLeft ? -64 : 0}
                  y="-22"
                  width="64"
                  height="24"
                  rx="7"
                  className="analytics-modal-actual-chip"
                />
                <text
                  x={budgetPaceModalChart.actualEndLabelLeft ? -32 : 32}
                  y="-6"
                  textAnchor="middle"
                  className="analytics-modal-actual-chip-text"
                >
                  {budgetPaceActual.toFixed(0)}€
                </text>
              </g>

              <line
                x1={budgetPaceModalChart.todayX}
                y1={budgetPaceModalChart.margin.top}
                x2={budgetPaceModalChart.todayX}
                y2={budgetPaceModalChart.height - budgetPaceModalChart.margin.bottom}
                className="analytics-modal-today-line"
              />

              {budgetPaceModalChart.xTicks.map((tick) => (
                <g key={`xt_${tick.index}`}>
                  <line
                    x1={budgetPaceModalChart.toX(tick.index)}
                    y1={budgetPaceModalChart.height - budgetPaceModalChart.margin.bottom}
                    x2={budgetPaceModalChart.toX(tick.index)}
                    y2={budgetPaceModalChart.height - budgetPaceModalChart.margin.bottom + 6}
                    className="analytics-modal-axis-line"
                  />
                  <text
                    x={budgetPaceModalChart.toX(tick.index)}
                    y={budgetPaceModalChart.height - budgetPaceModalChart.margin.bottom + 24}
                    className="analytics-modal-axis-text"
                    textAnchor="middle"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}
            </svg>

            <div className="analytics-modal-meta">
              <span><i className="line-swatch expected" />{t(locale, 'analyticsExpectedLine')}</span>
              <span><i className="line-swatch actual" />{t(locale, 'analyticsActualLine')}</span>
              <span>
                {range === 'year' ? t(locale, 'analyticsYearlyBudget') : range === 'week' ? t(locale, 'analyticsWeeklyBudget') : t(locale, 'analyticsBudgetLabel')}: {budgetPaceView.targetBudget.toFixed(0)}€
              </span>
            </div>
          </div>
        </div>
      )}

      {analyticsModal === 'donut' && (
        <div className="modal-backdrop" onClick={() => setAnalyticsModal(null)}>
          <div className="modal-card analytics-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="analytics-modal-header">
              <h3>{t(locale, 'analyticsCategorySplitTitle')}</h3>
              <button className="ghost-btn" onClick={() => setAnalyticsModal(null)}>
                {t(locale, 'close')}
              </button>
            </div>

            <div className="analytics-donut-modal-layout">
              <div className="analytics-donut-modal-canvas-wrap">
                <svg className="analytics-donut-modal-svg" viewBox="0 0 320 320" aria-label="Category split donut">
                  {donutInteractiveSlices.length > 0 ? (
                    donutInteractiveSlices.map((slice) => {
                      const isActive = activeDonutSlice?.name === slice.name;
                      const outerR = isActive ? 118 : 110;
                      return (
                        <path
                          key={`donut_modal_${slice.name}`}
                          d={donutArcPath(160, 160, 72, outerR, slice.startAngle, slice.endAngle)}
                          fill={slice.color}
                          className="analytics-modal-donut-slice"
                          onClick={() => setActiveDonutSliceName(slice.name)}
                        />
                      );
                    })
                  ) : (
                    <path d={donutArcPath(160, 160, 72, 110, -90, 269.999)} fill="#2c2c2e" />
                  )}
                  <circle cx="160" cy="160" r="68" fill="#101113" stroke="#2c2c2e" />
                  <text x="160" y="166" textAnchor="middle" className="analytics-modal-center-value">
                    {categoryDonut.total.toFixed(0)}€
                  </text>
                  <text x="160" y="191" textAnchor="middle" className="analytics-modal-center-label">
                    {t(locale, 'analyticsTotal')}
                  </text>
                </svg>
              </div>

              <div className="analytics-donut-modal-side" ref={donutListRef} style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categoryDonut.slices.length > 0 ? (
                  categoryDonut.slices.map((slice, index) => {
                    const isActive = activeDonutSliceName === slice.name;
                    return (
                      <div
                        key={slice.name}
                        id={`donut-slice-${index}`}
                        onClick={() => setActiveDonutSliceName(slice.name)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: isActive ? 'rgba(10, 132, 255, 0.1)' : '#0e0f12',
                          border: `1px solid ${isActive ? '#0a84ff' : '#2c2c2e'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 0 0 2px rgba(10, 132, 255, 0.2)' : 'none',
                          transition: 'all 0.2s ease',
                          flexShrink: 0
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: slice.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '20px' }}>{slice.emoji}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <strong style={{ fontSize: '15px', color: isActive ? '#fff' : '#e5e5ea', lineHeight: '1.2' }}>{slice.name}</strong>
                            <span style={{ fontSize: '13px', color: '#8e8e93', lineHeight: '1.2' }}>{slice.pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <strong style={{ fontSize: '16px', color: isActive ? '#fff' : '#f5f5f7' }}>{slice.amount.toFixed(2)}€</strong>
                      </div>
                    );
                  })
                ) : (
                  <p className="analytics-empty-note">{t(locale, 'analyticsNoDataInPeriod')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {analyticsModal === 'heatmap' && monthHeatmapData && (
        <div className={`modal-backdrop ${seamlessHeatmapTransition ? 'modal-no-fade' : ''}`} onClick={() => setAnalyticsModal(null)}>
          <div
            className={`modal-card analytics-modal-card ${seamlessHeatmapTransition ? 'modal-no-pop' : ''}`}
            style={{ maxWidth: '400px', margin: 'auto', left: 0, right: 0 }}
            onClick={(event) => event.stopPropagation()}
            {...monthHeatmapSwipe}
          >
            <div className="analytics-modal-header">
              <div>
                <h3>{t(locale, 'analyticsSpendingHeatmap')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', color: '#8e8e93' }}>
                  <svg onClick={() => shiftHeatmapMonth(-1)} style={{ cursor: 'pointer', padding: '2px' }} viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  <p 
                    key={`label-month-${monthHeatmapData.month}-${monthHeatmapData.year}`}
                    className={`heatmap-modal-month-label ${heatmapSlideDir ? `slide-${heatmapSlideDir}` : ''}`}
                    style={{ margin: 0, minWidth: '100px', textAlign: 'center', fontWeight: '600', color: '#f5f5f7', cursor: 'pointer', userSelect: 'none' }}
                    title={t(locale, 'periodToday')}
                    onClick={() => {
                      setSeamlessHeatmapTransition(true);
                      setHeatmapSlideDir('');
                      const now = new Date();
                      setHeatmapViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                      setActiveHeatmapDay(now.getDate());
                    }}
                  >
                    {getLocalizedMonthAcc(locale, monthHeatmapData.month)} {monthHeatmapData.year}
                  </p>
                  <svg onClick={() => shiftHeatmapMonth(1)} style={{ cursor: 'pointer', padding: '2px' }} viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </div>
              <button className="ghost-btn" onClick={() => setAnalyticsModal(null)}>
                {t(locale, 'close')}
              </button>
            </div>

            <div 
              id="month-heatmap-container"
              key={`grid-month-${monthHeatmapData.month}-${monthHeatmapData.year}`}
              className={heatmapSlideDir ? `slide-${heatmapSlideDir}` : ''}
            >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#8e8e93', marginBottom: '8px' }}>
              {locale === 'el' ? ['Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ', 'Κ'].map((d, i) => <span key={i}>{d}</span>) : ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', gap: '6px' }}>
              {Array.from({ length: monthHeatmapData.firstDayDow }).map((_, i) => (
                <div key={`empty-${i}`} style={{ aspectRatio: '1/1', background: 'transparent' }} />
              ))}
              {monthHeatmapData.dailySpend.map((amount, index) => {
                const dayOfMonth = index + 1;
                const bgColor = getHeatmapColor(amount, monthHeatmapData.maxSpend);
                
                const isToday = new Date().getDate() === dayOfMonth && new Date().getMonth() === monthHeatmapData.month;
                const isSelected = activeHeatmapDay === dayOfMonth;
                
                return (
                  <div
                    key={`day-modal-${dayOfMonth}`}
                    onClick={() => setActiveHeatmapDay(dayOfMonth)}
                    style={{
                      aspectRatio: '1/1',
                      background: bgColor,
                      borderRadius: '6px',
                      border: isSelected ? '2px solid #0a84ff' : isToday ? '1px solid rgba(255, 255, 255, 0.8)' : '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      cursor: 'pointer',
                      color: amount > monthHeatmapData.maxSpend * 0.5 ? '#fff' : 'rgba(255,255,255,0.8)',
                      fontWeight: isToday || isSelected ? 'bold' : 'normal',
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.5)' : 'none',
                      zIndex: isSelected ? 10 : 1
                    }}
                  >
                    {dayOfMonth}
                  </div>
                );
              })}
              {Array.from({ length: 42 - (monthHeatmapData.firstDayDow + monthHeatmapData.daysInMonth) }).map((_, i) => (
                <div key={`empty-end-${i}`} style={{ aspectRatio: '1/1', background: 'transparent' }} />
              ))}
            </div>

            <HeatmapLegend locale={locale} className="heatmap-card-legend" />

            <div style={{ marginTop: '24px', padding: '16px', background: '#111214', borderRadius: '16px', border: '1px solid #2c2c2e', height: '260px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px' }}>
                  {activeHeatmapDay ? `${activeHeatmapDay} ${getLocalizedMonthAcc(locale, monthHeatmapData.month)}` : ''}
                </h4>
                <strong style={{ fontSize: '16px' }}>
                  {activeHeatmapDay ? monthHeatmapData.dailySpend[activeHeatmapDay - 1].toFixed(2) : '0.00'}€
                </strong>
              </div>
              
              {activeHeatmapDay && monthHeatmapData.dailyExpenses[activeHeatmapDay - 1].length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                  {monthHeatmapData.dailyExpenses[activeHeatmapDay - 1].map(exp => (
                    <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>{exp.emoji}</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{getLocalizedCategoryName(locale, exp.category)}</span>
                          {exp.comment && <span style={{ fontSize: '12px', color: '#8e8e93' }}>{exp.comment}</span>}
                        </div>
                      </div>
                      <strong style={{ fontSize: '14px' }}>{Number.parseFloat(exp.amount).toFixed(2)}€</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 'auto', fontSize: '14px', color: '#8e8e93', textAlign: 'center' }}>
                  {t(locale, 'noExpenses')}
                </p>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {analyticsModal === 'weekHeatmap' && weekHeatmapData && (
        <div className="modal-backdrop" onClick={() => setAnalyticsModal(null)}>
          <div
            className="modal-card analytics-modal-card"
            style={{ maxWidth: '400px', margin: 'auto', left: 0, right: 0 }}
            onClick={(event) => event.stopPropagation()}
            {...weekHeatmapSwipe}
          >
            <div className="analytics-modal-header">
              <div>
                <h3>{t(locale, 'analyticsSpendingHeatmap')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', color: '#8e8e93' }}>
                  <svg onClick={() => shiftWeekHeatmap(-1)} style={{ cursor: 'pointer', padding: '2px' }} viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  <p 
                    key={`label-week-${weekHeatmapData.days[0].getTime()}`}
                    className={`heatmap-modal-month-label ${weekHeatmapSlideDir ? `slide-${weekHeatmapSlideDir}` : ''}`}
                    style={{ margin: 0, minWidth: '100px', textAlign: 'center', fontWeight: '600', color: '#f5f5f7', cursor: 'pointer', userSelect: 'none' }}
                    title={t(locale, 'periodToday')}
                    onClick={() => {
                      setSeamlessHeatmapTransition(true);
                      setWeekHeatmapSlideDir('');
                      const now = new Date();
                      const weekStart = new Date(now);
                      weekStart.setHours(0, 0, 0, 0);
                      const isoDow0Mon = (weekStart.getDay() + 6) % 7;
                      weekStart.setDate(weekStart.getDate() - isoDow0Mon);
                      setWeekHeatmapViewStartDate(weekStart);
                      setActiveWeekHeatmapDayIndex(isoDow0Mon);
                    }}
                  >
                    {`${weekHeatmapData.days[0].getDate()}/${weekHeatmapData.days[0].getMonth() + 1} - ${weekHeatmapData.days[6].getDate()}/${weekHeatmapData.days[6].getMonth() + 1}`}
                  </p>
                  <svg onClick={() => shiftWeekHeatmap(1)} style={{ cursor: 'pointer', padding: '2px' }} viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </div>
              <button className="ghost-btn" onClick={() => setAnalyticsModal(null)}>
                {t(locale, 'close')}
              </button>
            </div>

            <div 
              id="week-heatmap-container"
              key={`grid-week-${weekHeatmapData.days[0].getTime()}`}
              className={weekHeatmapSlideDir ? `slide-${weekHeatmapSlideDir}` : ''}
            >
            <div style={{ display: 'flex', gap: '6px', width: '100%', justifyContent: 'space-between' }}>
              {weekHeatmapData.dailySpend.map((amount, dayIndex) => {
                const bgColor = getHeatmapColor(amount, weekHeatmapData.maxSpend);
                const dayDate = weekHeatmapData.days[dayIndex];
                const isToday = new Date().toDateString() === dayDate.toDateString();
                const isSelected = activeWeekHeatmapDayIndex === dayIndex;
                return (
                  <button
                    key={`week_modal_day_${dayIndex}`}
                    style={{
                      background: bgColor,
                      borderColor: isSelected ? '#0a84ff' : isToday ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      boxShadow: isSelected ? '0 0 0 1px #0a84ff inset' : 'none',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 2px',
                      flex: 1,
                      minWidth: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      zIndex: isSelected ? 10 : 1
                    }}
                    onClick={() => setActiveWeekHeatmapDayIndex(dayIndex)}
                  >
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
                      {dayDate.toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-US', { weekday: 'short' }).replace('.', '')}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                      {dayDate.getDate()}
                    </span>
                    <strong style={{ fontSize: '11px', color: amount > 0 ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                      {amount > 0 ? `${amount.toFixed(0)}€` : '-'}
                    </strong>
                  </button>
                );
              })}
            </div>

            <HeatmapLegend locale={locale} className="heatmap-card-legend" />

            <div style={{ marginTop: '16px', padding: '14px', background: '#111214', borderRadius: '14px', border: '1px solid #2c2c2e', height: '240px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '15px' }}>
                  {weekHeatmapData.days[activeWeekHeatmapDayIndex].toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h4>
                <strong style={{ fontSize: '16px' }}>
                  {weekHeatmapData.dailySpend[activeWeekHeatmapDayIndex].toFixed(2)}€
                </strong>
              </div>

              {weekHeatmapData.dailyExpenses[activeWeekHeatmapDayIndex].length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                  {weekHeatmapData.dailyExpenses[activeWeekHeatmapDayIndex].map((exp) => (
                    <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>{exp.emoji}</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{getLocalizedCategoryName(locale, exp.category)}</span>
                          {exp.comment && <span style={{ fontSize: '12px', color: '#8e8e93' }}>{exp.comment}</span>}
                        </div>
                      </div>
                      <strong style={{ fontSize: '14px' }}>{Number.parseFloat(exp.amount).toFixed(2)}€</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 'auto', fontSize: '14px', color: '#8e8e93', textAlign: 'center' }}>
                  {t(locale, 'noExpenses')}
                </p>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {analyticsModal === 'yearHeatmap' && yearHeatmapData && (
        <div className="modal-backdrop" onClick={() => setAnalyticsModal(null)}>
          <div
            className="modal-card analytics-modal-card"
            style={{ maxWidth: '460px', margin: 'auto', left: 0, right: 0 }}
            onClick={(event) => event.stopPropagation()}
            {...yearHeatmapSwipe}
          >
            <div className="analytics-modal-header">
              <div>
                <h3>{t(locale, 'analyticsSpendingHeatmap')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', color: '#8e8e93' }}>
                  <svg onClick={() => shiftYearHeatmap(-1)} style={{ cursor: 'pointer', padding: '2px' }} viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  <p 
                    key={`label-year-${yearHeatmapData.year}`}
                    className={`heatmap-modal-month-label ${yearHeatmapSlideDir ? `slide-${yearHeatmapSlideDir}` : ''}`}
                    style={{ margin: 0, minWidth: '100px', textAlign: 'center', fontWeight: '600', color: '#f5f5f7', cursor: 'pointer', userSelect: 'none' }}
                    title={t(locale, 'periodToday')}
                    onClick={() => {
                      setSeamlessHeatmapTransition(true);
                      setYearHeatmapSlideDir('');
                      setYearHeatmapViewYear(new Date().getFullYear());
                    }}
                  >
                    {yearHeatmapData.year}
                  </p>
                  <svg onClick={() => shiftYearHeatmap(1)} style={{ cursor: 'pointer', padding: '2px' }} viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </div>
              <button className="ghost-btn" onClick={() => setAnalyticsModal(null)}>
                {t(locale, 'close')}
              </button>
            </div>

            <div 
              id="year-heatmap-container"
              key={`grid-year-${yearHeatmapData.year}`}
              className={yearHeatmapSlideDir ? `slide-${yearHeatmapSlideDir}` : ''}
            >
            <div className="year-heatmap-modal-grid">
              {yearHeatmapData.monthlySpend.map((amount, monthIndex) => {
                const bgColor = getHeatmapColor(amount, yearHeatmapData.maxSpend);

                const isSelected = activeYearHeatmapMonth === monthIndex;
                const isCurrentMonth = new Date().getFullYear() === yearHeatmapData.year && new Date().getMonth() === monthIndex;
                
                return (
                  <button
                    key={`year_modal_month_${monthIndex}`}
                    className="year-heatmap-modal-cell"
                    style={{ 
                      background: bgColor,
                      borderColor: isSelected ? '#0a84ff' : isCurrentMonth ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                      borderWidth: isSelected ? '2px' : '1px',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.5)' : 'none',
                      zIndex: isSelected ? 10 : 1,
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveYearHeatmapMonth(monthIndex)}
                  >
                    <span style={{ color: isSelected || isCurrentMonth ? '#fff' : 'rgba(255,255,255,0.8)' }}>{locale === 'el' ? YEAR_HEATMAP_MONTH_FULL_EL[monthIndex] : YEAR_HEATMAP_MONTH_FULL_EN[monthIndex]}</span>
                    <strong>{amount.toFixed(0)}€</strong>
                  </button>
                );
              })}
            </div>

            <HeatmapLegend locale={locale} className="heatmap-card-legend" />

            <div style={{ marginTop: '16px', padding: '14px', background: '#111214', borderRadius: '14px', border: '1px solid #2c2c2e', height: '240px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '15px' }}>
                  {activeYearHeatmapMonth != null ? (locale === 'el' ? YEAR_HEATMAP_MONTH_FULL_EL[activeYearHeatmapMonth] : YEAR_HEATMAP_MONTH_FULL_EN[activeYearHeatmapMonth]) : ''} {yearHeatmapData.year}
                </h4>
                <strong style={{ fontSize: '16px' }}>
                  {activeYearHeatmapMonth != null ? yearHeatmapData.monthlySpend[activeYearHeatmapMonth].toFixed(2) : '0.00'}€
                </strong>
              </div>

              {activeYearHeatmapMonth != null && yearHeatmapData.monthlyExpenses[activeYearHeatmapMonth].length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                  {yearHeatmapData.monthlyExpenses[activeYearHeatmapMonth].map(exp => (
                    <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>{exp.emoji}</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{getLocalizedCategoryName(locale, exp.category)}</span>
                          <span style={{ fontSize: '12px', color: '#8e8e93' }}>
                            {exp.date ? formatIsoDate(exp.date) : ''} {exp.comment ? ` • ${exp.comment}` : ''}
                          </span>
                        </div>
                      </div>
                      <strong style={{ fontSize: '14px' }}>{Number.parseFloat(exp.amount).toFixed(2)}€</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 'auto', fontSize: '14px', color: '#8e8e93', textAlign: 'center' }}>
                  {t(locale, 'noExpenses')}
                </p>
              )}
            </div>
            </div>

          </div>
        </div>
      )}

      {/* Background Modal */}
      {backgroundModalOpen && (
        <div className="modal-backdrop" onClick={() => {
          if (initialBackgroundRef.current) setBackground(initialBackgroundRef.current);
          setBackgroundModalOpen(false);
        }}>
          <div className="modal-card background-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t(locale, 'backgroundLibrary')}</h3>
            <div className="background-grid">
              {PRESET_BACKGROUNDS.map((item) => {
                const active = background.value === item.id;
                return (
                  <button
                    key={item.id}
                    className={`background-option ${active ? 'active' : ''}`}
                    onClick={() => setBackground({ type: 'preset', value: item.id })}
                  >
                    <span className="background-preview" style={{ background: item.preview }} />
                  </button>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => {
                if (initialBackgroundRef.current) setBackground(initialBackgroundRef.current);
                setBackgroundModalOpen(false);
              }}>
                {t(locale, 'cancel')}
              </button>
              <button className="primary-btn" onClick={() => setBackgroundModalOpen(false)}>
                {t(locale, 'apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {filterModalOpen && (
        <div className="modal-backdrop" onClick={() => setFilterModalOpen(false)}>
          <div className="modal-card filter-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t(locale, 'dateFilterTitle')}</h3>
            <div className="filter-fields">
              <label>
                <span>{t(locale, 'from')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <input 
                    type="date"
                    value={fromDate} 
                    onChange={(event) => setFromDate(event.target.value)} 
                  />
                </div>
              </label>
              <label>
                <span>{t(locale, 'to')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <input 
                    type="date"
                    value={toDate} 
                    onChange={(event) => setToDate(event.target.value)} 
                  />
                </div>
              </label>
              <label>
                <span>{t(locale, 'project')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  <select
                    value={projectFilter || ALL_PROJECTS_VALUE}
                    onChange={(event) => setProjectFilter(event.target.value === ALL_PROJECTS_VALUE ? '' : event.target.value)}
                  >
                  <option value={ALL_PROJECTS_VALUE}></option>
                    <option value={WITHOUT_PROJECT_VALUE}>{t(locale, 'withoutProject')}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
                </div>
              </label>
              <label>
                <span>{t(locale, 'category')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                  <select
                    value={categoryFilter || ALL_CATEGORIES_VALUE}
                    onChange={(event) => setCategoryFilter(event.target.value === ALL_CATEGORIES_VALUE ? '' : event.target.value)}
                  >
                  <option value={ALL_CATEGORIES_VALUE}></option>
                    {displayCategories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.emoji} {category.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="ghost-btn"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setCategoryFilter('');
                  setProjectFilter('');
                }}
              >
                {t(locale, 'clear')}
              </button>
              <button className="primary-btn" onClick={() => setFilterModalOpen(false)}>
                {t(locale, 'apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {exportModalOpen && (
        <div className="modal-backdrop" onClick={() => setExportModalOpen(false)}>
          <div className="modal-card filter-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t(locale, 'exportCsv')}</h3>
            <p style={{ marginBottom: '16px', color: '#8e8e93', fontSize: '14px' }}>
              {t(locale, 'exportCsvDesc')}
            </p>
            <div className="filter-fields">
              <label>
                <span>{t(locale, 'from')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <input 
                    type="date"
                    value={exportFromDate} 
                    onChange={(event) => setExportFromDate(event.target.value)} 
                  />
                </div>
              </label>
              <label>
                <span>{t(locale, 'to')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <input 
                    type="date"
                    value={exportToDate} 
                    onChange={(event) => setExportToDate(event.target.value)} 
                  />
                </div>
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="ghost-btn"
                onClick={() => {
                  setExportFromDate('');
                  setExportToDate('');
                }}
              >
                {t(locale, 'clear')}
              </button>
              <button className="primary-btn" onClick={handleExportCsv}>
                {t(locale, 'exportCsv')}
              </button>
            </div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="modal-backdrop" onClick={() => setImportModalOpen(false)}>
          <div className="modal-card filter-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t(locale, 'importInstructionsTitle')}</h3>
            <p style={{ marginTop: '8px', marginBottom: '16px', color: '#8e8e93', fontSize: '14px', lineHeight: '1.5' }}>
              {t(locale, 'importInstructionsDesc')}
            </p>
            <ul style={{ margin: '0 0 20px 20px', padding: 0, color: '#f5f5f7', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>1.</strong> {t(locale, 'importFormatColDate')}</li>
              <li><strong>2.</strong> {t(locale, 'importFormatColProject')}</li>
              <li><strong>3.</strong> {t(locale, 'importFormatColCategory')}</li>
              <li><strong>4.</strong> {t(locale, 'importFormatColAmount')}</li>
            </ul>
            <p style={{ marginTop: '0', marginBottom: '24px', color: '#8e8e93', fontSize: '13px' }}>
              <em>💡 {t(locale, 'importCategoryHelp')}</em>
            </p>
            <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {t(locale, 'aiKeyLabel')}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#0a84ff', textDecoration: 'none' }}>{t(locale, 'aiKeyHint')}</a>
                </span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="#bf5af2" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15 9l7 3-7 3-3 7-3-7-7-3 7-3z" /></svg>
                  <input
                    type="password"
                    placeholder={t(locale, 'aiKeyPlaceholder')}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                  />
                </div>
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setImportModalOpen(false)}>
                {t(locale, 'cancel')}
              </button>
              <button 
                className="primary-btn" 
                onClick={() => {
                  importInputRef.current?.click();
                }}
              >
                {t(locale, 'importSelectFile')}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteModalOpen && (
        <div className="modal-backdrop" onClick={() => setBulkDeleteModalOpen(false)}>
          <div className="modal-card filter-modal" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ color: '#ff453a' }}>{t(locale, 'bulkDelete')}</h3>
            <p style={{ marginBottom: '16px', color: '#8e8e93', fontSize: '14px' }}>
              {t(locale, 'bulkDeleteDesc')}
            </p>
            <div className="filter-fields">
              <label>
                <span>{t(locale, 'from')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <input 
                    type="date"
                    value={bdFromDate} 
                    onChange={(event) => setBdFromDate(event.target.value)} 
                  />
                </div>
              </label>
              <label>
                <span>{t(locale, 'to')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <input 
                    type="date"
                    value={bdToDate} 
                    onChange={(event) => setBdToDate(event.target.value)} 
                  />
                </div>
              </label>
              <label>
                <span>{t(locale, 'project')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  <select
                    value={bdProject || ALL_PROJECTS_VALUE}
                    onChange={(event) => setBdProject(event.target.value === ALL_PROJECTS_VALUE ? '' : event.target.value)}
                  >
                  <option value={ALL_PROJECTS_VALUE}></option>
                    <option value={WITHOUT_PROJECT_VALUE}>{t(locale, 'withoutProject')}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
                </div>
              </label>
              <label>
                <span>{t(locale, 'category')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                  <select
                    value={bdCategory || ALL_CATEGORIES_VALUE}
                    onChange={(event) => setBdCategory(event.target.value === ALL_CATEGORIES_VALUE ? '' : event.target.value)}
                  >
                  <option value={ALL_CATEGORIES_VALUE}></option>
                    {displayCategories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.emoji} {category.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
            
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 69, 58, 0.1)', borderRadius: '12px', border: '1px solid rgba(255, 69, 58, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#f5f5f7', fontSize: '14px', fontWeight: '500' }}>Επιλεγμένα έξοδα:</span>
                <strong style={{ color: '#ff453a', fontSize: '18px' }}>{expensesToDelete.length}</strong>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="ghost-btn"
                onClick={() => {
                  setBulkDeleteModalOpen(false);
                  setBdFromDate('');
                  setBdToDate('');
                  setBdCategory('');
                  setBdProject('');
                }}
              >
                {t(locale, 'cancel')}
              </button>
              <button 
                className="primary-btn" 
                style={{ background: '#ff453a', color: '#fff', borderColor: '#ff453a', opacity: expensesToDelete.length === 0 ? 0.5 : 1 }}
                onClick={handleBulkDelete}
                disabled={expensesToDelete.length === 0}
              >
                {t(locale, 'bulkDeleteAction').replace('{n}', String(expensesToDelete.length))}
              </button>
            </div>
          </div>
        </div>
      )}

      {importReviewModalOpen && (
        <div className="modal-backdrop" onClick={() => {}}>
          <div className="modal-card filter-modal" style={{ maxWidth: '500px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(event) => event.stopPropagation()}>
            <h3>{t(locale, 'importReviewTitle')}</h3>
            <p style={{ marginBottom: '16px', color: '#8e8e93', fontSize: '14px' }}>
              {t(locale, 'importReviewDesc')}
            </p>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', paddingRight: '4px' }}>
              {importReviewExpenses.map((expense) => (
                <div key={expense.id} style={{ background: '#111214', padding: '14px', borderRadius: '14px', border: '1px solid #2c2c2e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '15px', color: '#fff', wordBreak: 'break-word' }}>{expense.comment || expense.category}</strong>
                    <strong style={{ color: '#fff', fontSize: '15px' }}>{expense.amount}€</strong>
                  </div>
                  <div style={{ color: '#8e8e93', fontSize: '13px', marginBottom: '12px' }}>{formatIsoDate(expense.date)}</div>
                  
                  <div className="input-icon-wrap">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                    <select
                      value={expense.category}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (val === NEW_CATEGORY_VALUE) {
                          setPendingCategoryExpenseId(expense.id);
                          openCategoryModal(false);
                        } else {
                          const cat = allCategories.find((c) => c.name === val);
                          setImportReviewExpenses((prev) => prev.map((ex) => ex.id === expense.id ? { ...ex, category: val, emoji: cat?.emoji ?? '🏷️' } : ex));
                        }
                      }}
                      style={{ height: '42px', paddingLeft: '38px', fontSize: '14px' }}
                    >
                      <option value={locale === 'el' ? 'Άλλο' : 'Other'}>{t(locale, 'other')}</option>
                      {displayCategories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.emoji} {category.displayName}
                        </option>
                      ))}
                      <option value={NEW_CATEGORY_VALUE}>{t(locale, 'newCategoryOption')}</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => { setImportReviewModalOpen(false); setImportReviewExpenses([]); window.alert(t(locale, 'importDone')); }}>
                {t(locale, 'skip')}
              </button>
              <button className="primary-btn" onClick={async () => {
                setExpenses((prev) => prev.map((e) => { const reviewed = importReviewExpenses.find((r) => r.id === e.id); return reviewed ? reviewed : e; }));
                
                const newMap = { ...customCategoryMap };
                importReviewExpenses.forEach(e => {
                  if (e.comment && e.category !== (locale === 'el' ? 'Άλλο' : 'Other') && e.category !== NEW_CATEGORY_VALUE) {
                    newMap[e.comment.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()] = e.category;
                  }
                });
                setCustomCategoryMap(newMap);

                if (user && supabase) {
                  const toUpsert = importReviewExpenses.map(({ receiptFileId, ...e }) => ({ ...e, receipt_file_id: receiptFileId ?? null, user_id: user.id }));
                  await supabase.from('expenses').upsert(toUpsert);
                }
                setImportReviewModalOpen(false); setImportReviewExpenses([]); window.alert(t(locale, 'importDone'));
              }}>
                {t(locale, 'saveCategories')}
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseModalOpen && (
        <div className="modal-backdrop" onClick={closeExpenseModal}>
          <form className="modal-card expense-form" onClick={(event) => event.stopPropagation()} onSubmit={handleSaveExpense}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{editingExpense ? t(locale, 'editExpense') : t(locale, 'addExpense')}</h3>
              {editingExpense && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ff453a' }}
                  title={t(locale, 'delete')}
                  onClick={() => {
                    if (window.confirm('Είστε σίγουροι για τη διαγραφή αυτού του εξόδου;')) {
                      handleDeleteExpense(editingExpense.id);
                      closeExpenseModal();
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              )}
            </div>

            <label>
              <span>{t(locale, 'project')}</span>
              <div className="input-icon-wrap">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                <select
                  value={draft.project || NO_PROJECT_VALUE}
                  onChange={(event) => setDraft((prev) => ({ ...prev, project: event.target.value === NO_PROJECT_VALUE ? '' : event.target.value }))}
                >
                <option value={NO_PROJECT_VALUE}></option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label>
              <span>{t(locale, 'category')}</span>
              <div className="input-icon-wrap">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                <select
                  value={draft.category}
                  onChange={(event) => {
                    if (event.target.value === NEW_CATEGORY_VALUE) {
                      openCategoryModal(true);
                      return;
                    }
                    const category = allCategories.find((item) => item.name === event.target.value);
                    setDraft((prev) => ({
                      ...prev,
                      category: event.target.value,
                      emoji: category?.emoji ?? prev.emoji,
                    }));
                  }}
                >
              <option value="" disabled hidden></option>
                  {displayCategories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.emoji} {category.displayName}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY_VALUE}>{t(locale, 'newCategoryOption')}</option>
                </select>
              </div>
            </label>

            <div className="grid-two">
              <label>
                <span>{t(locale, 'amount')}</span>
                <div className="input-icon-wrap">
              <span className="input-icon-text" style={{ fontSize: '18px', fontWeight: '500' }}>€</span>
                  <input value={draft.amount} inputMode="decimal" onChange={(event) => setDraft((prev) => ({ ...prev, amount: normalizeAmount(event.target.value) }))} />
                </div>
              </label>

              <label>
                <span>{t(locale, 'date')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <input type="date" value={draft.date} onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))} />
                </div>
              </label>
            </div>

            <label>
              <span>{t(locale, 'comment')}</span>
              <div className="input-icon-wrap">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <input
                  value={draft.comment}
                  onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value }))}
                />
              </div>
            </label>

            <label>
              <span>{t(locale, 'receipt') || 'Απόδειξη (Προαιρετικό)'}</span>
              <div style={{ marginTop: '6px' }}>
                {draft.receiptFileId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#000', padding: '8px 12px', borderRadius: '12px', border: '1px solid #2c2c2e' }}>
                    <a 
                      href={`https://drive.google.com/file/d/${draft.receiptFileId}/view`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '8px', background: '#1c1c1e', overflow: 'hidden', textDecoration: 'none', border: '1px solid #2c2c2e', flexShrink: 0 }}
                      title="Προβολή απόδειξης"
                    >
                      <img 
                        src={`https://drive.google.com/thumbnail?id=${draft.receiptFileId}&sz=w100`} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement).style.display = 'block'; }}
                      />
                      <span style={{ fontSize: '20px', display: 'none' }}>🧾</span>
                    </a>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ color: '#32d74b', fontSize: '13px', fontWeight: 'bold' }}>Αποθηκεύτηκε</span>
                      <span style={{ color: '#8e8e93', fontSize: '11px' }}>Πατήστε για προβολή</span>
                    </div>
                    <button type="button" style={{ background: 'none', border: 'none', padding: '6px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }} title="Διαγραφή απόδειξης" onClick={(e) => { e.preventDefault(); handleDeleteReceipt(); }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : isUploadingReceipt ? (
                  <div style={{ padding: '6px', width: '100%', textAlign: 'center', color: '#8e8e93', fontSize: '14px' }}>
                    Συμπίεση & ανέβασμα...
                  </div>
                ) : (
                  <>
                    <input ref={receiptInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleReceiptUpload} />
                    <button type="button" style={{ background: 'none', border: 'none', padding: '8px 0', fontSize: '32px', cursor: 'pointer', display: 'block' }} onClick={(e) => { e.preventDefault(); receiptInputRef.current?.click(); }} title="Ανέβασμα απόδειξης">
                      🧾
                    </button>
                  </>
                )}
              </div>
            </label>

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={closeExpenseModal}>
                {t(locale, 'cancel')}
              </button>
              <button type="submit" className="primary-btn">
                {editingExpense ? t(locale, 'update') : t(locale, 'add')}
              </button>
            </div>
          </form>
        </div>
      )}

      {projectModalOpen && (
        <div className="modal-backdrop" onClick={() => setProjectModalOpen(false)}>
          <form className="modal-card expense-form" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); handleAddProject(); }}>
            <h3>{t(locale, 'addProject')}</h3>
            <label>
              <span>{t(locale, 'projectName')}</span>
              <div className="input-icon-wrap">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                <input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => handleManageInputKeyDown(event, handleAddProject)}
                  autoFocus
                />
              </div>
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setProjectModalOpen(false)}>
                {t(locale, 'cancel')}
              </button>
              <button type="submit" className="primary-btn">
                {t(locale, 'add')}
              </button>
            </div>
          </form>
        </div>
      )}

      {categoryModalOpen && (
        <div className="modal-backdrop" onClick={() => { setCategoryModalOpen(false); setCategoryModalForExpense(false); setPendingCategoryExpenseId(null); }}>
          <form className="modal-card expense-form" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); handleAddCategory(); }}>
            <h3>{t(locale, 'addCategory')}</h3>
            <div className="category-create-row">
              <label className="category-create-emoji">
                <span>{t(locale, 'emoji')}</span>
                <input
                  className="emoji-input category-emoji-input"
                  value={newCategoryEmoji}
                  onChange={(event) => setNewCategoryEmoji(extractFirstEmoji(event.target.value))}
                  onPaste={(event) => {
                    event.preventDefault();
                    const pasted = event.clipboardData.getData('text');
                    setNewCategoryEmoji(extractFirstEmoji(pasted));
                  }}
                  maxLength={4}
                  inputMode="text"
                />
              </label>
              <label className="category-create-name">
                <span>{t(locale, 'categoryName')}</span>
                <div className="input-icon-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                  <input
                    className="category-name-input"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => handleManageInputKeyDown(event, handleAddCategory)}
                    autoFocus
                  />
                </div>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => { setCategoryModalOpen(false); setCategoryModalForExpense(false); setPendingCategoryExpenseId(null); }}>
                {t(locale, 'cancel')}
              </button>
              <button type="submit" className="primary-btn">
                {t(locale, 'add')}
              </button>
            </div>
          </form>
        </div>
      )}
      {(() => {
        const periodInsight = fixMyPeriod === 'year' ? yearlySmartInsight : smartInsight;
        const periodRescuePlan = fixMyPeriod === 'year' ? yearlyRescuePlan : rescuePlan;
        if (!fixMyPeriod || !periodRescuePlan || !periodInsight) return null;
        
        return (
          <div className="modal-backdrop" onClick={() => setFixMyPeriod(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: periodInsight.color }}>
                {periodInsight.showFixMyMonth ? (fixMyPeriod === 'year' ? 'Σχέδιο Διάσωσης Έτους 🛟' : 'Σχέδιο Διάσωσης Μήνα 🛟') : 'Συμβουλή 💡'}
              </h3>
              
              <div style={{ background: periodInsight.bg, border: `1px solid ${periodInsight.color}40`, padding: '16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.4rem', lineHeight: '1' }}>{periodInsight.icon}</span>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#f5f5f7', lineHeight: '1.4', flex: 1 }}>
                  {periodInsight.message}
                </p>
              </div>

              {periodInsight.showFixMyMonth && (
                <div style={{ background: '#1c1c1e', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#f5f5f7' }}>
                    Μέχρι το τέλος του {fixMyPeriod === 'year' ? 'έτους' : 'μήνα'} μένουν <strong>{periodRescuePlan.remainingDays} ημέρες</strong>.
                  </p>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#f5f5f7' }}>
                    Για να μην βγεις εκτός στόχου, πρέπει να ξοδεύεις αυστηρά μέχρι <strong>{periodRescuePlan.safeDailySpend.toFixed(2)}€ την ημέρα</strong>.
                  </p>
                </div>
              )}

              {periodInsight.showFixMyMonth && periodRescuePlan.topNonEssentials.length > 0 && (
                <div style={{ background: '#1c1c1e', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#f5f5f7', fontWeight: 600 }}>
                    Από πού να κόψεις:
                  </p>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#8e8e93', lineHeight: '1.4' }}>
                    Αυτές είναι οι κατηγορίες που σου "τρώνε" τα περισσότερα χρήματα αυτό το {fixMyPeriod === 'year' ? 'έτος' : 'μήνα'} (χωρίς να είναι απολύτως απαραίτητες). Προσπάθησε να τις μειώσεις:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {periodRescuePlan.topNonEssentials.map(([cat, info]) => (
                      <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2c2c2e', padding: '10px 14px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.95rem', color: '#f5f5f7' }}>{info.emoji} {getLocalizedCategoryName(locale, cat)}</span>
                        <strong style={{ color: '#ff453a', fontSize: '1rem' }}>{info.amount.toFixed(2)}€</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!periodInsight.showFixMyMonth && periodRescuePlan.forecastedSavings > 0 && (
                <div style={{ background: 'rgba(50, 215, 75, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(50, 215, 75, 0.3)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center' }}>
                  <span style={{ fontSize: '2rem' }}>🎯</span>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#f5f5f7' }}>
                    Με βάση τον ρυθμό σου και το ιστορικό σου, προβλέπεται να αποταμιεύσεις:
                  </p>
                  <strong style={{ fontSize: '2rem', color: '#32d74b' }}>{periodRescuePlan.forecastedSavings.toFixed(2)}€</strong>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#8e8e93' }}>
                    Συνέχισε με την ίδια συνέπεια!
                  </p>
                </div>
              )}

              {periodInsight.showFixMyMonth && (
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#8e8e93', lineHeight: '1.5' }}>
                    Μπορείς να το καταφέρεις! 💪<br/>Κατάγραψε κάθε έξοδο και σκέψου διπλά πριν από κάθε αγορά.
                  </p>
                </div>
              )}

              <button className="primary-btn" onClick={() => setFixMyPeriod(null)} style={{ marginTop: '8px' }}>
                {periodInsight.showFixMyMonth ? 'Το κατάλαβα, φύγαμε!' : 'Κλείσιμο'}
              </button>
            </div>
          </div>
        );
      })()}
      {homeBudgetEditModal && (
        <div className="modal-backdrop" onClick={() => setHomeBudgetEditModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>
                {homeBudgetEditModal === 'monthly' ? t(locale, 'monthlyBudget') : t(locale, 'yearlyBudget')}
              </h3>
              <button className="ghost-btn" style={{ padding: '8px 12px' }} onClick={() => setHomeBudgetEditModal(null)}>
                {t(locale, 'close')}
              </button>
            </div>
            <div className="input-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8e8e93', fontSize: '14px', fontWeight: 'bold' }}>
                {t(locale, 'budgetAmount') || 'Ποσό Budget'}
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#1c1c1e', padding: '12px 16px', borderRadius: '12px', border: '1px solid #2c2c2e' }}>
                <input
                  type="number"
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', fontWeight: 'bold', outline: 'none', width: '100%' }}
                  value={homeBudgetEditValue}
                  onChange={e => setHomeBudgetEditValue(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleHomeBudgetSave();
                  }}
                />
                <span style={{ fontSize: '24px', color: '#8e8e93', fontWeight: 'bold' }}>€</span>
              </div>
            </div>
            <button className="primary-btn" style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', borderRadius: '12px' }} onClick={handleHomeBudgetSave}>
              {t(locale, 'save')}
            </button>
          </div>
        </div>
      )}

      {ruleDetailsModal && (
        <div className="modal-backdrop" onClick={() => setRuleDetailsModal(null)} style={{ zIndex: 1000 }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>{ruleDetailsModal.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{t(locale, ruleDetailsModal.labelKey)}</h3>
                  <div style={{ color: '#8e8e93', fontSize: '13px', marginTop: '2px' }}>{t(locale, 'ruleTitle')}</div>
                </div>
              </div>
              <button className="ghost-btn" style={{ padding: '8px' }} onClick={() => setRuleDetailsModal(null)}>
                {t(locale, 'close')}
              </button>
            </div>
            
            <div style={{ padding: '16px', background: '#111214', borderRadius: '12px', border: '1px solid #2c2c2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#8e8e93', fontSize: '14px', fontWeight: '500' }}>{t(locale, 'analyticsActual')}</span>
                <strong style={{ fontSize: '20px', color: ruleDetailsModal.amount > ruleDetailsModal.target ? (ruleDetailsModal.labelKey === 'ruleSavings' ? '#32d74b' : '#ff453a') : '#fff' }}>{ruleDetailsModal.amount.toFixed(2)}€</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                <span style={{ color: '#8e8e93', fontSize: '14px', fontWeight: '500' }}>{t(locale, 'target')}</span>
                <strong style={{ fontSize: '20px', color: '#fff' }}>{ruleDetailsModal.target.toFixed(2)}€</strong>
              </div>
            </div>

            {ruleDetailsModal.labelKey === 'ruleSavings' ? (
              <p style={{ margin: 'auto', fontSize: '14px', color: '#8e8e93', textAlign: 'center', padding: '32px 0' }}>
                {t(locale, 'ruleSavingsEmpty')}
              </p>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {ruleDetailsModal.expenses.map((exp: any) => (
                  <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', cursor: 'pointer' }} onClick={() => { setRuleDetailsModal(null); openEditExpense(exp); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>{exp.emoji}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{exp.comment || getLocalizedCategoryName(locale, exp.category)}</span>
                        <span style={{ fontSize: '12px', color: '#8e8e93' }}>{formatIsoDate(exp.date)} {exp.project ? ` • ${exp.project}` : ''}</span>
                      </div>
                    </div>
                    <strong style={{ fontSize: '15px', color: '#fff' }}>{Number.parseFloat(exp.amount).toFixed(2)}€</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
