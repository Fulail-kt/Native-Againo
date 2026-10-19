/** One sentence a person can act on. Nest already sends human copy; this only rewrites junk. */
export function explain(raw: unknown): string {
  const text = flatten(raw);
  if (!text) return 'Something went wrong. Try again.';

  for (const [re, msg] of RULES) {
    if (re.test(text)) return msg;
  }
  if (/whitelistValidation|forbidNonWhitelisted/i.test(text)) {
    return 'Check the form and try again.';
  }
  return tidy(text);
}

const RULES: [RegExp, string][] = [
  [/gym code/i, 'Couldn’t create the account. If you already have one, sign in.'],
  [/already registered/i, 'That email already has an account. Sign in instead.'],
  [/property \w+ should not exist/i, 'Couldn’t save that. Try again.'],
  [/cannot (get|post|put|patch|delete) \//i, 'Couldn’t do that. Try again.'],
  [/cannot reach|network request failed|failed to fetch|is nest running/i, 'Can’t reach the server. Check your connection.'],
  [/internal server error/i, 'Server error. Try again in a moment.'],
  [/missing access token|invalid or expired token|^unauthorized$/i, 'Please sign in again.'],
  [/^forbidden$/i, 'You’re not allowed to do that.'],
  [/^not found$/i, 'Nothing found for that.'],
  [/hello_world|WA_TEST_TEMPLATE|public test number/i, 'This WhatsApp number can’t send a test yet. Add an approved message template in WhatsApp Manager, then try again.'],
];

function flatten(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (raw instanceof Error) return raw.message;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(flatten).filter(Boolean).join('. ');
  if (typeof raw === 'object' && 'message' in raw) {
    return flatten((raw as { message: unknown }).message);
  }
  return String(raw);
}

function tidy(s: string) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length > 160) return `${t.slice(0, 157)}…`;
  return t;
}
