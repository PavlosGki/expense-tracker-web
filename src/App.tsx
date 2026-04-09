import type { Session, User } from '@supabase/supabase-js';
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { buildCsv, downloadCsv, parseCsvRows } from './lib/csv';
import {
  filterExpensesByDateRange,
  formatIsoDate,
  getAnalyticsGroups,
  getExpensePeriodTotals,
  getHistoryGroups,
  parseIsoDateToLocal,
  toLocalIsoDate,
} from './lib/date';
import { getLocalizedCategoryName, t, withDisplayName } from './lib/i18n';
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
import {
  ALL_CATEGORIES_VALUE,
  ALL_PROJECTS_VALUE,
  DEFAULT_CATEGORIES,
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
import { useBudgetPace } from './hooks/useBudgetPace';
import './styles.css';
import type { Category, Expense, Locale, Project, Range, TabId } from './types';

type ExpenseDraft = {
  project: string;
  amount: string;
  category: string;
  emoji: string;
  date: string;
  comment: string;
  receiptFileId: string | null;
};


const compressImage = (file: File): Promise<Blob | File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file); // Αν είναι PDF, δεν κάνουμε συμπίεση
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.7); // 70% ποιότητα
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  const [tab, setTab] = useState<TabId>('home');
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [customCategories, setCustomCategories] = useState<Category[]>(() => loadCategories());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [income, setIncome] = useState(() => loadIncome());
  const [budgetInputValue, setBudgetInputValue] = useState(() => String(loadIncome()));
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
  const [analyticsModal, setAnalyticsModal] = useState<null | 'pace' | 'donut'>(null);
  const [activeDonutSliceName, setActiveDonutSliceName] = useState<string | null>(null);
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
    category: DEFAULT_CATEGORIES[0].name,
    emoji: DEFAULT_CATEGORIES[0].emoji,
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
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const swipeStartRef = useRef<{ id: string; x: number } | null>(null);
  const stickyShellRef = useRef<HTMLDivElement | null>(null);
  const [stickyShellHeight, setStickyShellHeight] = useState(0);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    // Αρχικοποίηση Auth και παρακολούθηση αλλαγών (Login/Logout/Redirect)
    // Ζητάμε το τρέχον session ρητά για να μην κολλήσει το loading
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (active) {
            setSession(session);
            setUser(session?.user ?? null);
          }
        })
        .catch((error) => {
          console.error("Supabase Auth Error:", error);
        })
        .finally(() => {
          if (active) setAuthLoading(false);
        });

      // Παρακολούθηση αλλαγών (Login/Logout/Redirect)
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
      setStickyShellHeight(Math.round(element.getBoundingClientRect().height));
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
  }, [tab]);

  // Cloud Sync Logic: Φόρτωση δεδομένων από το Supabase μετά το Login
  useEffect(() => {
    async function syncCloudData() {
      if (!user || !supabase) return;
      
      const isFirstLoad = !isInitialSyncDone;
      if (isFirstLoad) setIsInitialSyncDone(false);

      // 1. Φόρτωση Προφίλ (Income, Locale, κλπ)
      const { data: profile } = await supabase.from('profiles').select('*').maybeSingle();
      
      if (profile) {
        const cloudIncome = Number(profile.income);
        
        // Robust Sync: Αν το cloud έχει 0 αλλά το τοπικό state έχει ήδη τιμή (από localStorage),
        // τότε προτιμούμε την τοπική τιμή και ενημερώνουμε το cloud.
        if (cloudIncome === 0 && income > 0) {
          await supabase.from('profiles').update({ 
            income, 
            updated_at: new Date().toISOString() 
          }).eq('id', user.id);
        } else {
          setIncome(cloudIncome);
        }
        
        setLocale(profile.locale as Locale);
        setBackground(profile.background as StoredBackground);
      } else {
        // Αν δεν υπάρχει καθόλου προφίλ, δημιουργούμε ένα με τις τρέχουσες τοπικές τιμές
        await supabase.from('profiles').insert({ 
          id: user.id, 
          income, 
          locale, 
          background,
          updated_at: new Date().toISOString()
        });
      }

      // 2. Φόρτωση Εξόδων & Migration
      const { data: remoteExpenses } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (remoteExpenses && remoteExpenses.length > 0) {
        setExpenses(remoteExpenses.map(({ user_id: _, receipt_file_id, ...e }) => ({
          ...e,
          amount: String(e.amount),
          receiptFileId: receipt_file_id ?? e.receiptFileId ?? null
        }) as Expense));
      } else if (expenses.length > 0) {
        // Migration: Αν η βάση είναι άδεια, ανέβασε τα τοπικά έξοδα
        const toUpload = expenses.map(({ receiptFileId, ...e }) => ({ ...e, receipt_file_id: receiptFileId ?? null, user_id: user.id }));
        await supabase.from('expenses').insert(toUpload);
      }

      // 3. Φόρτωση Κατηγοριών
      const { data: remoteCats } = await supabase.from('categories').select('*');
      if (remoteCats && remoteCats.length > 0) {
        setCustomCategories(remoteCats.map(({ user_id: _, ...c }) => c as Category));
      } else if (customCategories.length > 0) {
        const toUpload = customCategories.map(c => ({ ...c, user_id: user.id }));
        await supabase.from('categories').insert(toUpload);
      }
      
      // 4. Φόρτωση Projects
      const { data: remoteProjects } = await supabase.from('projects').select('*');
      if (remoteProjects && remoteProjects.length > 0) {
        setProjects(remoteProjects.map(({ user_id: _, ...p }) => p as Project));
      } else if (projects.length > 0) {
        const toUpload = projects.map(p => ({ ...p, user_id: user.id }));
        await supabase.from('projects').insert(toUpload);
      }

      // Σηματοδότηση ότι ο αρχικός συγχρονισμός ολοκληρώθηκε
      setIsInitialSyncDone(true);
    }

    if (user) syncCloudData();
  }, [user]);

  // Το Local Storage πρέπει να ενημερώνεται ΠΑΝΤΑ, λειτουργώντας ως cache.
  useEffect(() => saveLocale(locale), [locale]);
  useEffect(() => saveExpenses(expenses), [expenses]);
  useEffect(() => saveCategories(customCategories), [customCategories]);
  useEffect(() => saveProjects(projects), [projects]);
  useEffect(() => saveIncome(income), [income]);

  // Συγχρονισμός Locale & Background όταν αλλάζουν
  useEffect(() => {
    if (user && supabase && isInitialSyncDone) {
      supabase.from('profiles').upsert({ 
        id: user.id, 
        income, 
        locale, 
        background,
        updated_at: new Date().toISOString()
      });
    }
  }, [locale, background, user, isInitialSyncDone]);

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
      // Αν δεν υπάρχει ενεργό φίλτρο ημερομηνίας, θέλουμε να βλέπουμε τα πάντα 
      // στα σύνολα (day/week/month/year), συμπεριλαμβανομένων των μελλοντικών.
      if (!filterFromDate && !filterToDate) return metaFilteredExpenses;
      return filterExpensesByDateRange(metaFilteredExpenses, filterFromDate, filterToDate);
    },
    [metaFilteredExpenses, filterFromDate, filterToDate]
  );

  // Υπολογισμός των ορίων ημερομηνίας για τις λίστες (Ιστορικό/Ανάλυση)
  // Αν δεν υπάρχει φίλτρο, χρησιμοποιούμε την παλαιότερη και τη νεότερη ημερομηνία από τα δεδομένα
  const listBounds = useMemo(() => {
    const hasExpenses = metaFilteredExpenses.length > 0;
    const today = new Date();
    // Εξασφαλίζουμε ότι το 'to' όριο είναι τουλάχιστον η σημερινή ημερομηνία
    // ή η ημερομηνία του πιο μελλοντικού εξόδου, αν δεν υπάρχει φίλτρο.
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
  const currentMonthSpend = totals.month;
  const progressPct = parsedIncome > 0 ? Math.min(100, Math.max(0, (currentMonthSpend / parsedIncome) * 100)) : 0;
  const hasActiveFilter = Boolean(fromDate || toDate || categoryFilter || projectFilter);
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
  const { budgetPaceView, budgetPaceModalChart } = useBudgetPace(metaFilteredExpenses, parsedIncome, range);
  const budgetPaceTarget = budgetPaceView.target;
  const budgetPaceActual = budgetPaceView.actual;
  const budgetPaceDelta = budgetPaceView.delta;
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
    if (analyticsModal === 'pace' && budgetPaceView.mode !== 'chart') {
      setAnalyticsModal(null);
    }
  }, [analyticsModal, budgetPaceView.mode]);

  const openAddExpense = () => {
    setEditingExpense(null);

    const lastProject = loadLastProject(); // Load from localStorage
    // Επιβεβαιώνουμε ότι το project υπάρχει ακόμα στη λίστα σου πριν το προεπιλέξουμε
    const defaultProject = projects.some(p => p.name === lastProject) ? (lastProject || '') : ''; // Check if project exists

    setDraft({
      project: defaultProject,
      amount: '',
      category: DEFAULT_CATEGORIES[0].name,
      emoji: DEFAULT_CATEGORIES[0].emoji,
      date: toLocalIsoDate(new Date()),
      comment: '',
    receiptFileId: null,
    });
    setExpenseModalOpen(true);
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

    // Αποθήκευση στο Supabase αν ο χρήστης είναι συνδεδεμένος
    if (user && supabase) {
      const { receiptFileId, ...dbExpense } = nextExpense;
      const { error } = await supabase.from('expenses').upsert({ ...dbExpense, receipt_file_id: receiptFileId, user_id: user.id });
      if (error) console.error('Error saving to cloud:', error);
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
      if (error) console.error('Error deleting from cloud:', error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCustomCategories((prev) => prev.filter((category) => category.id !== id));

    if (user && supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) console.error('Error deleting category from cloud:', error);
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
      await supabase.from('projects').delete().eq('id', id);
    }

    if (projectToDelete) {
      // Ενημέρωση εξόδων τοπικά (στο cloud θα μπορούσε να γίνει με RPC ή trigger, αλλά το κάνουμε upsert αν χρειαστεί)
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
      if (error) console.error('Error adding project to cloud:', error);
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
      if (error) console.error('Error adding category to cloud:', error);
    }

    setCustomCategories((prev) => [...prev, newCat]);
    if (categoryModalForExpense) {
      setDraft((prev) => ({
        ...prev,
        category: trimmedName,
        emoji: newCategoryEmoji.trim() || '🏷️',
      }));
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
    downloadCsv(buildCsv(expenses, locale));
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvRows(text);
    if (rows.length <= 1) {
      window.alert(t(locale, 'invalidCsv'));
      return;
    }

    const header = rows[0].map((value) => value.trim().toLowerCase());
    const dateIndex = header.findIndex((value) => value === 'ημερομηνία' || value === 'date');
    const projectIndex = header.findIndex((value) => value === 'project');
    const categoryIndex = header.findIndex((value) => value === 'κατηγορία' || value === 'category');
    const amountIndex = header.findIndex((value) => value === 'ποσό' || value === 'amount');

    if (dateIndex === -1 || categoryIndex === -1 || amountIndex === -1) {
      window.alert(t(locale, 'invalidCsv'));
      return;
    }

    const importedExpenses: Expense[] = [];
    const newCategories: Category[] = [];
    const existingNames = new Set(allCategories.map((category) => category.name));

    rows.slice(1).forEach((row, index) => {
      const date = (row[dateIndex] ?? '').trim();
      const project = projectIndex === -1 ? '' : (row[projectIndex] ?? '').trim();
      const category = (row[categoryIndex] ?? '').trim();
      const amountRaw = (row[amountIndex] ?? '').trim().replace(',', '.');
      const amount = Number.parseFloat(amountRaw);
      if (!date || !category || Number.isNaN(amount)) return;

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
        amount: amount.toFixed(2),
        category,
        emoji: allCategories.find((item) => item.name === category)?.emoji ?? '🏷️',
        date,
        project: project || undefined,
      });
    });

    // Συγχρονισμός των εισαγόμενων δεδομένων με το Cloud
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
    event.target.value = '';
    window.alert(t(locale, 'importDone'));
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
      console.error(e);
      window.alert('Αποτυχία ανεβάσματος στο Google Drive. Δοκίμασε ξανά.');
    } finally {
      setIsUploadingReceipt(false);
      if (event.target) event.target.value = '';
    }
  };

  const showDashboard = tab !== 'settings';
  const isAnyModalOpen =
    expenseModalOpen || filterModalOpen || backgroundModalOpen || projectModalOpen || categoryModalOpen || analyticsModal !== null;

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
    setIncome(finalIncome);
    if (user && supabase) {
      const { error } = await supabase.from('profiles').upsert({ 
        id: user.id, 
        income: finalIncome, 
        locale, 
        background,
        updated_at: new Date().toISOString()
      });
      if (error) console.error('Budget sync error:', error);
    }
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
        console.error('Failed to delete from Drive', e);
      }
    }
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
          backgroundColor: 'rgba(5, 5, 5, 0.85)', 
          backdropFilter: 'blur(16px)', 
          WebkitBackdropFilter: 'blur(16px)', 
          margin: '-24px -16px 0 -16px', 
          padding: '24px 16px 16px 16px', 
          borderBottom: 'none' 
        }}
      >
        <Header 
          locale={locale} 
          user={user} 
          onSignOut={handleSignOut} 
        />
        
        <nav className="tabbar">
          <button 
            className={`tab-chip ${hasActiveFilter ? 'active' : ''}`} 
            onClick={() => setFilterModalOpen(true)}
            title="Φίλτρα"
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center' }}
          >
            <span style={{ fontSize: '15px' }}>🔍</span>
          </button>
          {(['home', 'analytics', 'settings'] as const).map((id) => (
            <button key={id} className={`tab-chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {t(locale, id)}
            </button>
          ))}
        </nav>

        {tab === 'home' && (
          <section className="panel budget-panel" style={{ marginTop: '16px' }}>
            <h3 className="budget-title">{t(locale, 'monthlyBudget')}</h3>
            <div className="budget-bar-wrap">
              <strong className="budget-spent-value">{currentMonthSpend.toFixed(2)} €</strong>
              <div className="progress-track budget-track">
                <div className="progress-fill budget-fill" style={{ width: `${Math.max(0, 100 - progressPct)}%` }} />
              </div>
              <strong className="budget-bar-value">{parsedIncome.toFixed(2)} €</strong>
            </div>
            <p className="budget-consumed">{progressPct.toFixed(0)}% κατανάλωση</p>
          </section>
        )}

        {showDashboard && tab === 'analytics' && (
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
        )}
      </div>

      <main className="main-grid">
        {showDashboard && (
          <>
            {tab === 'home' && (
              <section className="summary-grid">
                {RANGE_OPTIONS.map((option) => (
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

            {/* Filter Modal is now controlled by the Header button */}
          </>
        )}

        {tab === 'home' && (
          <section
            className="toolbar-row home-history-sticky"
            style={{ top: `${stickyShellHeight}px` }}
          >
            <h3>{t(locale, 'history')}</h3>
          </section>
        )}

        {tab === 'home' && (
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
        )}

        {tab === 'analytics' && (
          <>
            <section className="analytics-hero-grid analytics-top-gap">
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
                    {budgetPaceDelta >= 0 ? '+' : '-'}{Math.abs(budgetPaceDelta).toFixed(0)}€
                  </strong>
                  <small>{t(locale, budgetPaceView.paceTextKey)}</small>
                </div>
                {budgetPaceView.mode === 'chart' && (
                  <>
                    <div className="analytics-line-wrap">
                      <svg className="analytics-line-chart" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                        <polyline className="analytics-line expected" points={budgetPaceView.chart.expectedPoints} />
                        <polyline className="analytics-line actual" points={budgetPaceView.chart.actualPoints} />
                      </svg>
                    </div>
                    <div className="analytics-line-legend">
                      <span><i className="line-swatch expected" />{t(locale, 'analyticsExpectedLine')}</span>
                      <span><i className="line-swatch actual" />{t(locale, 'analyticsActualLine')}</span>
                    </div>
                  </>
                )}
                {budgetPaceView.mode === 'day' && (
                  <div className="analytics-pace-day-metrics">
                    <div className="analytics-pace-day-row">
                      <span>{t(locale, 'analyticsActualLine')}</span>
                      <strong>{budgetPaceActual.toFixed(2)}€</strong>
                    </div>
                    <div className="analytics-pace-day-row">
                      <span>{t(locale, 'analyticsExpectedLine')}</span>
                      <strong>{budgetPaceTarget.toFixed(2)}€</strong>
                    </div>
                  </div>
                )}
                {budgetPaceView.mode === 'disabled' && (
                  <p className="analytics-pace-note">{t(locale, 'analyticsPaceYearDisabled')}</p>
                )}
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
            </section>

            {hasActiveFilter && (
              <section className="toolbar-row">
                <p className="filter-pill">
                  {t(locale, 'activeFilters')}:{' '}
                  {fromDate ? formatIsoDate(fromDate) : '—'} /{' '}
                  {toDate ? formatIsoDate(toDate) : '—'} /{' '}
                  {categoryFilterLabel || t(locale, 'allCategories')} /{' '}
                  {projectFilterLabel}
                </p>
              </section>
            )}

            <section className="panel list-panel">
              {analyticsGroups.map((group) => {
                const expanded = expandedGroups[group.id] ?? group.isCurrent;
                const aggregate: Record<string, { amount: number; emoji: string }> = {};
                group.items.forEach((expense) => {
                  const key = getLocalizedCategoryName(locale, expense.category || t(locale, 'other'));
                  if (!aggregate[key]) aggregate[key] = { amount: 0, emoji: expense.emoji || '🏷️' };
                  aggregate[key].amount += Number.parseFloat(expense.amount) || 0;
                });
                const rows = Object.entries(aggregate)
                  .map(([name, data]) => ({ name, ...data }))
                  .sort((a, b) => b.amount - a.amount);
                const maxAmount = rows[0]?.amount ?? 0;
                const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

                return (
                  <article key={group.id} className="group-card">
                    <button className="group-header" onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !expanded }))}>
                      <span>{group.title}</span>
                      <strong>{totalAmount.toFixed(2)} €</strong>
                    </button>
                    {expanded && (
                      <div className="group-body">
                        {rows.length === 0 ? (
                          <p className="empty-line">{t(locale, 'noExpenses')}</p>
                        ) : (
                          rows.map((row) => {
                            const fillPct = maxAmount > 0 ? Math.max(18, (row.amount / maxAmount) * 100) : 18;
                            const isTightBar = fillPct <= 30;
                            return (
                              <div key={`${group.id}_${row.name}`} className="bar-row">
                                <div className="bar-label">
                                  <span>{row.emoji}</span>
                                  <strong>{row.name}</strong>
                                </div>
                                <div className="bar-track">
                                  <div className={`bar-fill ${isTightBar ? 'tight' : ''}`} style={{ width: `${fillPct}%` }}>
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
          </>
        )}

        {tab === 'settings' && (
          <section className="settings-grid">
            <section className="panel">
              <div className="settings-header" style={{ marginBottom: '16px' }}>
                <h3>{t(locale, 'setBudget')}</h3>
              </div>
              <div style={{ backgroundColor: '#000', borderRadius: '20px', padding: '24px', border: '1px solid #2c2c2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={budgetInputValue}
                    onChange={(event) => setBudgetInputValue(event.target.value)}
                    onFocus={(event) => { if (event.target.value === '0') setBudgetInputValue(''); }}
                    onBlur={() => { if (budgetInputValue === '') setBudgetInputValue('0'); }}
                    style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '48px', fontWeight: '800', textAlign: 'center', maxWidth: '180px', outline: 'none', padding: 0 }}
                  />
                  <span style={{ fontSize: '32px', color: '#8e8e93', fontWeight: '600' }}>€</span>
                </div>
                {Number(budgetInputValue) !== income && (
                  <button className="primary-btn" style={{ marginTop: '20px', width: '100%', borderRadius: '12px', padding: '14px', fontSize: '16px' }} onClick={handleSaveBudget}>
                    {t(locale, 'save')}
                  </button>
                )}
              </div>
            </section>
            <section className="panel">
              <div className="settings-header">
                <h3>{t(locale, 'projects')}</h3>
                <button className="ghost-btn" onClick={openProjectModal}>
                  {t(locale, 'add')}
                </button>
              </div>
              <div className="category-manage-list">
                {projects.length === 0 ? (
                  <p className="empty-line">{t(locale, 'noProjects')}</p>
                ) : (
                  projects.map((project) => (
                    <div key={project.id}>
                      <div
                        className="category-manage-row editable-row manage-main"
                        style={{ paddingRight: '8px' }}
                      >
                        {editingProjectId === project.id ? (
                          <>
                            <div className="category-manage-copy">
                              <input
                                value={editingProjectName}
                                onChange={(event) => setEditingProjectName(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                onBlur={() => handleRenameProject(project.id)}
                                onKeyDown={(event) =>
                                  handleManageInputKeyDown(
                                    event,
                                    () => handleRenameProject(project.id),
                                    () => {
                                      setEditingProjectId(null);
                                      setEditingProjectName('');
                                    }
                                  )
                                }
                                autoFocus
                              />
                            </div>
                            <button
                              style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRenameProject(project.id);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="18" height="18" stroke="#32d74b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="category-manage-copy">
                              <strong>{project.name}</strong>
                            </div>
                            <button
                              style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '4px' }}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteProjectFromSettings(project.id);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ff453a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingProjectId(project.id);
                                setEditingProjectName(project.name);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#0a84ff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="panel">
              <div className="settings-header">
                <h3>{t(locale, 'manageCategories')}</h3>
                <button className="ghost-btn" onClick={() => openCategoryModal(false)}>
                  {t(locale, 'add')}
                </button>
              </div>
              <div className="category-manage-list">
                {customCategories.length === 0 ? (
                  <p className="empty-line">{t(locale, 'noCustomCategories')}</p>
                ) : (
                  withDisplayName(locale, customCategories).map((category) => (
                    <div key={category.id}>
                      <div
                        className="category-manage-row editable-row manage-main"
                        style={{ paddingRight: '8px' }}
                      >
                        {editingCategoryId === category.id ? (
                          <>
                            <div className="category-manage-copy">
                              <span className="category-manage-emoji">{category.emoji}</span>
                              <input
                                value={editingCategoryName}
                                onChange={(event) => setEditingCategoryName(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                onBlur={() => handleRenameCategory(category.id)}
                                onKeyDown={(event) =>
                                  handleManageInputKeyDown(
                                    event,
                                    () => handleRenameCategory(category.id),
                                    () => {
                                      setEditingCategoryId(null);
                                      setEditingCategoryName('');
                                    }
                                  )
                                }
                                autoFocus
                              />
                            </div>
                            <button
                              style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRenameCategory(category.id);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="18" height="18" stroke="#32d74b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="category-manage-copy">
                              <span className="category-manage-emoji">{category.emoji}</span>
                              <strong>{category.displayName}</strong>
                            </div>
                            <button
                              style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '4px' }}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteCategoryFromSettings(category.id);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ff453a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingCategoryId(category.id);
                                setEditingCategoryName(category.name);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#0a84ff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="panel">
              <h3>{t(locale, 'manageData')}</h3>
              <div className="settings-actions">
                <button className="settings-card" onClick={handleImportClick}>
                  <strong>{t(locale, 'importCsv')}</strong>
                  <span>{t(locale, 'importCsvDesc')}</span>
                </button>
                <button className="settings-card" onClick={handleExportCsv}>
                  <strong>{t(locale, 'exportCsv')}</strong>
                  <span>{t(locale, 'exportCsvDesc')}</span>
                </button>
              </div>
            </section>
            <section className="panel">
              <div className="settings-header">
                <div>
                  <h3>{t(locale, 'background')}</h3>
                </div>
                <button className="ghost-btn" onClick={() => setBackgroundModalOpen(true)}>
                  {t(locale, 'chooseBackground')}
                </button>
              </div>
            </section>
            <section className="panel">
              <div className="settings-header">
                <div>
                  <h3>{t(locale, 'language')}</h3>
                  <p>{t(locale, 'appLanguageHint')}</p>
                </div>
                <div className="lang-switch">
                  <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
                  <button className={locale === 'el' ? 'active' : ''} onClick={() => setLocale('el')}>GR</button>
                </div>
              </div>
            </section>
            <section className="panel">
              <div className="settings-header">
                <div>
                  <h3>{t(locale, 'signedInAs')}</h3>
                  <p>{user.email}</p>
                </div>
                <button className="ghost-btn" onClick={handleSignOut}>
                  {t(locale, 'signOut')}
                </button>
              </div>
            </section>
            <input ref={importInputRef} className="hidden-input" type="file" accept=".csv,text/csv" onChange={handleImportCsv} />
          </section>
        )}
      </main>

      {/* Floating Action Button (FAB) for adding expenses */}
      {showDashboard && !isAnyModalOpen && (
        <button
          onClick={openAddExpense}
          style={{
            position: 'fixed',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
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
            zIndex: 10
          }}
          title={t(locale, 'addExpense')}
        >
          <span style={{ marginTop: '-4px' }}>+</span>
        </button>
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
                {budgetPaceDelta >= 0 ? '+' : '-'}{Math.abs(budgetPaceDelta).toFixed(0)}€
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
                  x={budgetPaceModalChart.actualEndLabelLeft ? -150 : 0}
                  y="-22"
                  width="150"
                  height="24"
                  rx="7"
                  className="analytics-modal-actual-chip"
                />
                <text
                  x={budgetPaceModalChart.actualEndLabelLeft ? -142 : 8}
                  y="-6"
                  className="analytics-modal-actual-chip-text"
                >
                  {t(locale, budgetPaceView.periodSpendLabelKey)}: {budgetPaceActual.toFixed(0)}€
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
              <span>{t(locale, 'analyticsBudgetLabel')}: {parsedIncome.toFixed(0)}€</span>
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

              <div className="analytics-donut-modal-side">
                {activeDonutSlice ? (
                  <div className="analytics-slice-details">
                    <strong>{activeDonutSlice.emoji} {activeDonutSlice.name}</strong>
                    <p>{t(locale, 'analyticsAmount')}: {activeDonutSlice.amount.toFixed(2)}€</p>
                    <p>{t(locale, 'analyticsShare')}: {activeDonutSlice.pct.toFixed(1)}%</p>
                  </div>
                ) : (
                  <p className="analytics-empty-note">{t(locale, 'analyticsNoDataInPeriod')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background Modal */}
      {backgroundModalOpen && (
        <div className="modal-backdrop" onClick={() => setBackgroundModalOpen(false)}>
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
              <button className="ghost-btn" onClick={() => setBackground({ type: 'preset', value: 'default' })}>
                {t(locale, 'resetBackground')}
              </button>
              <button className="primary-btn" onClick={() => setBackgroundModalOpen(false)}>
                {t(locale, 'closeBackgrounds')}
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
                <input 
                  type={fromDate ? "date" : "text"} 
                  placeholder="dd-mm-yyyy"
                  onFocus={(e) => e.target.type = 'date'}
                  onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                  value={fromDate} 
                  onChange={(event) => setFromDate(event.target.value)} 
                />
              </label>
              <label>
                <span>{t(locale, 'to')}</span>
                <input 
                  type={toDate ? "date" : "text"} 
                  placeholder="dd-mm-yyyy"
                  onFocus={(e) => e.target.type = 'date'}
                  onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                  value={toDate} 
                  onChange={(event) => setToDate(event.target.value)} 
                />
              </label>
              <label>
                <span>{t(locale, 'project')}</span>
                <select
                  value={projectFilter || ALL_PROJECTS_VALUE}
                  onChange={(event) => setProjectFilter(event.target.value === ALL_PROJECTS_VALUE ? '' : event.target.value)}
                >
                  <option value={ALL_PROJECTS_VALUE}>{t(locale, 'allProjects')}</option>
                  <option value={WITHOUT_PROJECT_VALUE}>{t(locale, 'withoutProject')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
              </label>
              <label>
                <span>{t(locale, 'category')}</span>
                <select
                  value={categoryFilter || ALL_CATEGORIES_VALUE}
                  onChange={(event) => setCategoryFilter(event.target.value === ALL_CATEGORIES_VALUE ? '' : event.target.value)}
                >
                  <option value={ALL_CATEGORIES_VALUE}>{t(locale, 'allCategories')}</option>
                  {displayCategories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.emoji} {category.displayName}
                    </option>
                  ))}
                </select>
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
              <select
                value={draft.project || NO_PROJECT_VALUE}
                onChange={(event) => setDraft((prev) => ({ ...prev, project: event.target.value === NO_PROJECT_VALUE ? '' : event.target.value }))}
              >
                <option value={NO_PROJECT_VALUE}>{t(locale, 'noProject')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t(locale, 'category')}</span>
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
                {displayCategories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.emoji} {category.displayName}
                  </option>
                ))}
                <option value={NEW_CATEGORY_VALUE}>{t(locale, 'newCategoryOption')}</option>
              </select>
            </label>

            <div className="grid-two">
              <label>
                <span>{t(locale, 'amount')}</span>
                <input value={draft.amount} inputMode="decimal" onChange={(event) => setDraft((prev) => ({ ...prev, amount: normalizeAmount(event.target.value) }))} />
              </label>
            </div>

            <label>
              <span>{t(locale, 'date')}</span>
              <input type="date" value={draft.date} onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))} />
            </label>

            <label>
              <span>{t(locale, 'comment')}</span>
              <input
                value={draft.comment}
                onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value }))}
                placeholder={t(locale, 'commentPlaceholder')}
              />
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
              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => handleManageInputKeyDown(event, handleAddProject)}
                autoFocus
              />
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
        <div className="modal-backdrop" onClick={() => { setCategoryModalOpen(false); setCategoryModalForExpense(false); }}>
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
                <input
                  className="category-name-input"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  onKeyDown={(event) => handleManageInputKeyDown(event, handleAddCategory)}
                  autoFocus
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => { setCategoryModalOpen(false); setCategoryModalForExpense(false); }}>
                {t(locale, 'cancel')}
              </button>
              <button type="submit" className="primary-btn">
                {t(locale, 'add')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
