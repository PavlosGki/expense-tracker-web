export type Locale = 'el' | 'en';
export type TabId = 'home' | 'analytics' | 'settings';
export type Range = 'day' | 'week' | 'month' | 'year';

export type Category = {
  id: string;
  name: string;
  emoji: string;
  isDefault?: boolean;
};

export type Expense = {
  id: string;
  amount: string;
  category: string;
  emoji: string;
  date: string;
  comment?: string;
};

export type HistoryGroup = {
  id: string;
  title: string;
  total: number;
  items: Expense[];
  isCurrent: boolean;
};

export type AnalyticsGroup = {
  id: string;
  title: string;
  isCurrent: boolean;
  items: Expense[];
};
