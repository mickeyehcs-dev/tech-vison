export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  return typeof phone === 'string' && phone.trim().length >= 7 && phone.trim().length <= 30;
}

export function isValidPassword(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long' };
  }
  return { valid: true };
}

export function sanitizeString(val: any): string {
  if (typeof val !== 'string') return '';
  return val.trim();
}

export function parseNumber(val: any, fallback: number = 0): number {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}
