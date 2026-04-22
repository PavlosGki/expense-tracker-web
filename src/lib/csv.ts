import type { Expense, Locale } from '../types';
import { getLocalizedCategoryName, t } from './i18n';

function escapeCsvField(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(expenses: Expense[], locale: Locale) {
  const headers = [t(locale, 'csvHeaderDate'), t(locale, 'project'), t(locale, 'csvHeaderCategory'), t(locale, 'csvHeaderAmount')];
  return [
    headers.join(','),
    ...expenses.map((expense) =>
      [
        escapeCsvField(expense.date),
        escapeCsvField(expense.project ?? ''),
        escapeCsvField(getLocalizedCategoryName(locale, expense.category)),
        escapeCsvField(expense.amount),
      ].join(',')
    ),
  ].join('\n');
}

export function downloadCsv(text: string) {
  const now = new Date();
  const fileName = `expenses_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.csv`;
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const firstLine = csvText.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      currentRow.push(currentField);
      if (currentRow.some((field) => field.trim().length > 0)) rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField);
  if (currentRow.some((field) => field.trim().length > 0)) rows.push(currentRow);
  return rows;
}
