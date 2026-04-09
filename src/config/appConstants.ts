import type { StoredBackground } from '../lib/storage';
import type { Category, Range } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Φαγητό', emoji: '🍔', isDefault: true },
  { id: 'c2', name: 'Supermarket', emoji: '🛒', isDefault: true },
  { id: 'c3', name: 'Καφές', emoji: '☕', isDefault: true },
  { id: 'c4', name: 'Διασκέδαση', emoji: '🍻', isDefault: true },
  { id: 'c5', name: 'Λογαριασμοί', emoji: '💡', isDefault: true },
  { id: 'c6', name: 'Καύσιμα', emoji: '⛽', isDefault: true },
  { id: 'c7', name: 'Διόδια', emoji: '🛣️', isDefault: true },
  { id: 'c8', name: 'Γυμναστήριο', emoji: '🏋️‍♂️', isDefault: true },
  { id: 'c9', name: 'Gaming', emoji: '🎮', isDefault: true },
  { id: 'c10', name: 'Ταξίδια', emoji: '✈️', isDefault: true },
  { id: 'c11', name: 'Ρούχα', emoji: '👕', isDefault: true },
  { id: 'c12', name: 'Φαρμακείο', emoji: '💊', isDefault: true },
  { id: 'c13', name: 'Σπίτι', emoji: '🏠', isDefault: true },
  { id: 'c14', name: 'Μετακινήσεις', emoji: '🚌', isDefault: true },
  { id: 'c15', name: 'Taxi', emoji: '🚕', isDefault: true },
  { id: 'c16', name: 'Συνδρομές', emoji: '📺', isDefault: true },
  { id: 'c17', name: 'Εκπαίδευση', emoji: '📚', isDefault: true },
  { id: 'c18', name: 'Υγεία', emoji: '🩺', isDefault: true },
  { id: 'c19', name: 'Κατοικίδια', emoji: '🐾', isDefault: true },
  { id: 'c20', name: 'Παιδιά', emoji: '🧸', isDefault: true },
  { id: 'c21', name: 'Δώρα', emoji: '🎁', isDefault: true },
  { id: 'c22', name: 'Ηλεκτρονικά', emoji: '💻', isDefault: true },
  { id: 'c23', name: 'Ομορφιά', emoji: '💄', isDefault: true },
  { id: 'c24', name: 'Καθαριστήριο', emoji: '🧺', isDefault: true },
];

export const RANGE_OPTIONS: Range[] = ['day', 'week', 'month', 'year'];
export const NEW_CATEGORY_VALUE = '__new_category__';
export const NO_PROJECT_VALUE = '__no_project__';
export const ALL_CATEGORIES_VALUE = '__all_categories__';
export const ALL_PROJECTS_VALUE = '__all_projects__';
export const WITHOUT_PROJECT_VALUE = '__without_project__';

export const PRESET_BACKGROUNDS = [
  {
    id: 'default',
    preview: 'linear-gradient(135deg, #0f172a 0%, #050505 55%, #0b1220 100%)',
    css: 'radial-gradient(circle at top left, rgba(10, 132, 255, 0.16), transparent 26%), radial-gradient(circle at top right, rgba(50, 215, 75, 0.12), transparent 22%), #050505',
  },
  {
    id: 'aurora',
    preview: 'linear-gradient(135deg, #07111f 0%, #10263f 45%, #07111f 100%)',
    css: 'radial-gradient(circle at 20% 20%, rgba(90, 200, 250, 0.28), transparent 24%), radial-gradient(circle at 80% 10%, rgba(48, 209, 88, 0.22), transparent 20%), radial-gradient(circle at 50% 100%, rgba(0, 116, 232, 0.22), transparent 30%), #05070b',
  },
  {
    id: 'sunset',
    preview: 'linear-gradient(135deg, #1a0d0b 0%, #3c1c12 45%, #12090a 100%)',
    css: 'radial-gradient(circle at top left, rgba(255, 159, 10, 0.28), transparent 24%), radial-gradient(circle at top right, rgba(255, 69, 58, 0.22), transparent 26%), #080506',
  },
  {
    id: 'forest',
    preview: 'linear-gradient(135deg, #08100d 0%, #10211b 45%, #070b09 100%)',
    css: 'radial-gradient(circle at top left, rgba(48, 209, 88, 0.22), transparent 26%), radial-gradient(circle at bottom right, rgba(52, 199, 89, 0.16), transparent 24%), #050706',
  },
  {
    id: 'neon',
    preview: 'linear-gradient(135deg, #14061f 0%, #27134f 48%, #090313 100%)',
    css: 'radial-gradient(circle at 20% 15%, rgba(191, 90, 242, 0.28), transparent 24%), radial-gradient(circle at 80% 22%, rgba(94, 92, 230, 0.22), transparent 24%), radial-gradient(circle at 50% 100%, rgba(90, 200, 250, 0.18), transparent 28%), #04040a',
  },
  {
    id: 'rose',
    preview: 'linear-gradient(135deg, #20080f 0%, #4f1526 46%, #12060a 100%)',
    css: 'radial-gradient(circle at top left, rgba(255, 55, 95, 0.24), transparent 22%), radial-gradient(circle at top right, rgba(255, 100, 130, 0.18), transparent 24%), #090507',
  },
  {
    id: 'lagoon',
    preview: 'linear-gradient(135deg, #07141a 0%, #103949 46%, #071015 100%)',
    css: 'radial-gradient(circle at 15% 18%, rgba(100, 210, 255, 0.24), transparent 24%), radial-gradient(circle at 85% 22%, rgba(48, 176, 199, 0.2), transparent 20%), radial-gradient(circle at 50% 100%, rgba(0, 116, 232, 0.16), transparent 28%), #04080a',
  },
] as const;

export function getBackgroundCss(background: StoredBackground) {
  return PRESET_BACKGROUNDS.find((item) => item.id === background.value)?.css ?? PRESET_BACKGROUNDS[0].css;
}

export function normalizeAmount(value: string) {
  const normalized = value.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
  const parts = normalized.split('.');
  return parts.length <= 1 ? normalized : `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
}

export function extractFirstEmoji(value: string) {
  const match = value.match(/\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?/u);
  return match?.[0] ?? '';
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export function donutArcPath(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number) {
  const startOuter = polarToCartesian(cx, cy, outerR, startDeg);
  const endOuter = polarToCartesian(cx, cy, outerR, endDeg);
  const startInner = polarToCartesian(cx, cy, innerR, startDeg);
  const endInner = polarToCartesian(cx, cy, innerR, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ');
}
