export interface ParsedName {
  first: string;
  last: string;
  full: string;
}

const HONORIFIC = /^(dr|prof|professor|mr|mrs|ms|mx|sir)\.?$/i;
const SUFFIX = /^(ph\.?d\.?|m\.?d\.?|jr\.?|sr\.?|ii|iii|iv|esq\.?|mba|dds|dvm|ed\.?d\.?)$/i;
const FALLBACK = 'Professor';

/** Parse a scraped faculty name into first/last, with a "Professor" fallback for greetings. */
export function parseName(raw: string | null | undefined): ParsedName {
  const parts = (raw ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !SUFFIX.test(p));

  // "Last, First [Middle]" -> "First Middle Last"
  const ordered = parts.length >= 2 ? `${parts[1]} ${parts[0]}` : (parts[0] ?? '');
  const tokens = ordered
    .split(/\s+/)
    .filter(Boolean)
    .filter((t, i, all) => !(HONORIFIC.test(t) && i < all.length - 1) && !SUFFIX.test(t));

  if (!tokens.length || (tokens.length === 1 && HONORIFIC.test(tokens[0]))) {
    return { first: FALLBACK, last: '', full: FALLBACK };
  }
  if (tokens.length === 1) {
    return { first: FALLBACK, last: tokens[0], full: tokens[0] };
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return { first, last, full: `${first} ${last}` };
}
