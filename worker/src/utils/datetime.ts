/**
 * Normalizes any timestamp/date input (ISO 8601 string, Date object, millisecond number)
 * into MySQL DATETIME format: 'YYYY-MM-DD HH:MM:SS'
 */
export function formatMySqlDateTime(val?: string | Date | number | null): string | null {
  if (val === null || val === undefined || val === '') return null;
  try {
    const d = typeof val === 'object' && val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}
