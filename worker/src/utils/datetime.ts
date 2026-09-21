/**
 * Normalizes any timestamp/date input (ISO 8601 string, Date object, millisecond number)
 * into MySQL DATETIME format: 'YYYY-MM-DD HH:MM:SS'
 */
export function formatMySqlDateTime(val?: string | Date | number | null): string | null {
  if (val === null || val === undefined || val === '') return null;
  try {
    let str = String(val);
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str) && !str.includes('Z')) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const d = typeof val === 'object' && val instanceof Date ? val : new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}

/**
 * Normalizes any date or timestamp string into canonical second-precision ISO string: 'YYYY-MM-DDTHH:MM:SSZ'
 */
export function normalizeCanonicalTimestamp(val?: string | Date | number | null): string {
  if (!val) return '';
  try {
    let str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str) && !str.includes('Z') && !str.includes('+')) {
      str = str.replace(' ', 'T') + 'Z';
    }
    const d = typeof val === 'object' && val instanceof Date ? val : new Date(str);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 19) + 'Z';
  } catch {
    return '';
  }
}

