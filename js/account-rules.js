// Password and phone rules, shared by the browser (instant feedback) and the server (enforced).

// Passwords people pick most often. Checked case-insensitively.
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344',
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword1',
  'qwerty12', 'qwerty123', 'qwertyui', 'qwerty1234', 'asdfghjk', 'asdf1234', 'zxcvbnm1',
  'abcd1234', 'abc12345', 'abcdefg1', 'a1b2c3d4', '1q2w3e4r', '1qaz2wsx', 'iloveyou1', 'welcome1',
  'welcome123', 'admin123', 'admin1234', 'letmein1', 'monkey12', 'india123', 'india1234',
  'tuition1', 'tuition123', 'teacher1', 'teacher123', 'student1', 'student123', 'school123',
  'tutorsala', 'tutorsala1', 'tutorsala123', 'demo1234', 'test1234', 'changeme', 'changeme1',
]);

const words = (s) =>
  String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);

/**
 * At least 8 characters with a letter and a number; not a common password; not built from
 * the person's email or center name.
 * @param {string} password
 * @param {{ email?: string, name?: string }} [context]
 * @returns {string|null} an error message, or null when acceptable
 */
export function validatePassword(password, { email = '', name = '' } = {}) {
  const p = String(password || '');
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (p.length > 200) return 'Password is too long';
  if (!/[a-z]/i.test(p) || !/[0-9]/.test(p)) return 'Use at least one letter and one number';
  const lower = p.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(p)) return 'That password is too common — choose something harder to guess';
  const personal = [...words(String(email).split('@')[0]), ...words(name)];
  if (personal.some((w) => lower.includes(w))) return "Don't use your email or center name in the password";
  return null;
}

/** 0–4, for the strength meter. */
export function passwordStrength(password) {
  const p = String(password || '');
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score += 1;
  if (p.length >= 12) score += 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1;
  if (/[0-9]/.test(p) && /[^a-z0-9]/i.test(p)) score += 1;
  if (validatePassword(p)) score = Math.min(score, 1);
  return score;
}

export const PHONE_COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+1', label: 'USA / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
  { code: '+974', label: 'Qatar (+974)' },
  { code: '+968', label: 'Oman (+968)' },
  { code: '+965', label: 'Kuwait (+965)' },
  { code: '+973', label: 'Bahrain (+973)' },
  { code: '+977', label: 'Nepal (+977)' },
  { code: '+94', label: 'Sri Lanka (+94)' },
];

/**
 * Joins a country code and a local number into one full number like +919876543210.
 * @returns {{ phone: string|null, error: string|null }}
 */
export function normalizePhone(countryCode, number) {
  const local = String(number || '').replace(/[\s-]/g, '');
  if (!local) return { phone: null, error: null };
  if (!/^\d+$/.test(local)) return { phone: null, error: 'Phone number can only contain digits' };
  const code = PHONE_COUNTRY_CODES.find((c) => c.code === countryCode)?.code;
  if (!code) return { phone: null, error: 'Choose a country code' };
  const digits = local.replace(/^0+/, '');
  if (code === '+91' && !/^[6-9]\d{9}$/.test(digits)) return { phone: null, error: 'Enter a 10-digit Indian mobile number' };
  if (code !== '+91' && (digits.length < 6 || digits.length > 14)) return { phone: null, error: 'Enter a valid phone number' };
  return { phone: `${code}${digits}`, error: null };
}

/** For the server: a full number must be + and 8–15 digits from a listed country. */
export function isValidFullPhone(phone) {
  const p = String(phone || '');
  const country = PHONE_COUNTRY_CODES.filter((c) => p.startsWith(c.code)).sort((a, b) => b.code.length - a.code.length)[0];
  if (!country) return false;
  return !normalizePhone(country.code, p.slice(country.code.length)).error;
}
