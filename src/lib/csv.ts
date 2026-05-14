/**
 * CSV builder + save helper for PRD F-008.
 *
 * Web: uses Blob + `<a download>` shim. Native: writes to cacheDirectory and
 * opens the system share sheet via `expo-sharing`.
 *
 * RFC 4180 escaping: fields containing comma / quote / newline are wrapped in
 * double quotes and internal quotes doubled.
 */
import { Platform } from 'react-native';

export type CsvRow = Record<string, string | number | null | undefined>;

function escapeCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV string from rows. Header is taken from the keys of the first
 * row; pass `columns` to lock order or include nullable columns absent from
 * row 1.
 */
export function toCsv(rows: CsvRow[], columns?: string[]): string {
  if (rows.length === 0) return '';
  const cols = columns ?? Array.from(
    rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set; }, new Set<string>()),
  );
  const lines: string[] = [];
  // BOM so Excel-Korean opens UTF-8 without garbling.
  lines.push(cols.join(','));
  for (const r of rows) lines.push(cols.map((c) => escapeCell(r[c])).join(','));
  return '﻿' + lines.join('\r\n');
}

/**
 * Save & share a CSV. On web triggers a browser download; on native opens
 * the share sheet (or silently writes to cacheDirectory if sharing unavailable).
 *
 * Returns the file URI on native, the object URL on web, or null on failure.
 */
export async function saveCsv(filename: string, csv: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revocation so the browser has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return url;
    } catch {
      return null;
    }
  }
  try {
    const FileSystem = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const dir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory;
    if (!dir) return null;
    const path = `${dir}${filename}`;
    await (FileSystem as any).writeAsStringAsync(path, csv);
    if (await (Sharing as any).isAvailableAsync()) {
      await (Sharing as any).shareAsync(path, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    }
    return path;
  } catch {
    return null;
  }
}
