import * as cheerio from 'cheerio';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const TITLE_RE =
  /\b((?:assistant|associate|distinguished|emeritus|adjunct|visiting|research|clinical|teaching)?\s*(?:professor|lecturer|instructor|chair|dean|scientist|researcher|fellow))\b/i;
const GENERIC_LOCAL =
  /^(info|admin|webmaster|contact|office|help|support|noreply|no-reply|dept|department|registrar|admissions|events|news|communications|web|media|hr|careers|feedback)$/i;

export function decodeCfEmail(hex) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return out;
}

export function baseDomain(host) {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2];
  const tld = parts[parts.length - 1];
  const take = tld.length === 2 && ['ac', 'edu', 'co', 'com', 'org'].includes(sld) ? 3 : 2;
  return parts.slice(-take).join('.');
}

export function cleanEmail(raw) {
  const e = raw.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0];
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(e) ? e : null;
}

const squish = (s) => s.replace(/\s+/g, ' ').trim();

function looksLikeName(s) {
  if (!s || s.length < 4 || s.length > 60 || /@|\d/.test(s)) return false;
  if (/^(email|e-mail|contact|send|more|read|view|profile|website|cv)/i.test(s)) return false;
  const words = s.split(' ');
  return words.length >= 2 && words.length <= 6;
}

// text() glues sibling elements together ("SmithAssociate"); pad every element first.
function spacedText($, node) {
  const clone = node.clone();
  clone.find('*').each((_, e) => {
    $(e).prepend(' ').append(' ');
  });
  return squish(clone.text());
}

// Walk up from the email node to the smallest block that looks like one person's card.
function findCard($, el) {
  let node = $(el);
  for (let i = 0; i < 6; i++) {
    const parent = node.parent();
    if (!parent.length) break;
    const emails = spacedText($, parent).match(EMAIL_RE) ?? [];
    if (new Set(emails.map((m) => m.toLowerCase())).size > 1) break;
    node = parent;
    if (/^(li|tr|article)$/i.test(node.prop('tagName') ?? '') && spacedText($, node).length > 20) break;
  }
  return node;
}

function nameFromCard($, card, email) {
  const local = email.split('@')[0];
  let found = '';
  card.find('h1,h2,h3,h4,h5,strong,b,a,.name,[class*=name]').each((_, n) => {
    const t = squish($(n).text());
    if (!found && looksLikeName(t) && !t.toLowerCase().includes(local)) found = t;
  });
  return found.replace(/,?\s*(ph\.?d\.?|md|jr\.?|sr\.?)$/i, '');
}

// Footer/contact emails fail this: a person's card name should show up in their address.
export function nameMatchesEmail(name, email) {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  const tokens = name.toLowerCase().replace(/[^a-z\s'-]/g, '').split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length < 2) return false;
  const last = tokens[tokens.length - 1].replace(/[^a-z]/g, '');
  return last.length >= 3 && local.includes(last);
}

function nameFromEmail(email) {
  const [local] = email.split('@');
  const parts = local.split(/[._-]/).filter((p) => p.length > 1 && !/\d/.test(p));
  return parts.length >= 2 ? parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(' ') : '';
}

/** Extract {name,email,title,department,source} rows from one HTML page. */
export function extractPeople(html, pageUrl, allowedBase) {
  const $ = cheerio.load(html);
  const dept = squish($('h1').first().text() || $('title').text()).slice(0, 120);
  const found = new Map();

  const add = (rawEmail, el) => {
    const email = cleanEmail(rawEmail);
    if (!email || found.has(email)) return;
    const [local, domain] = email.split('@');
    if (GENERIC_LOCAL.test(local)) return;
    if (allowedBase && baseDomain(domain) !== allowedBase) return;
    const card = findCard($, el);
    const title = spacedText($, card).match(TITLE_RE)?.[1] ?? '';
    const cardName = nameFromCard($, card, email);
    const isPerson = (cardName && nameMatchesEmail(cardName, email)) || (title && (cardName || nameFromEmail(email)));
    if (!isPerson) return;
    const name = cardName || nameFromEmail(email);
    found.set(email, { name, email, title: squish(title), department: dept, source: pageUrl });
  };

  $('a[href^="mailto:"]').each((_, a) => add($(a).attr('href'), a));
  $('[data-cfemail]').each((_, el) => add(decodeCfEmail($(el).attr('data-cfemail')), el));
  $('a[href*="/cdn-cgi/l/email-protection#"]').each((_, a) =>
    add(decodeCfEmail($(a).attr('href').split('#')[1]), a),
  );
  $('body *').each((_, el) => {
    if ($(el).children().length) return;
    // "name [at] domain.edu" / "name (at) domain.edu" obfuscation
    const deobf = $(el)
      .text()
      .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@')
      .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
    for (const m of deobf.match(EMAIL_RE) ?? []) add(m, el);
  });
  return [...found.values()];
}

/** Links on a page, resolved + scored for how likely they lead to faculty listings. */
export function extractLinks(html, pageUrl, allowedBase) {
  const $ = cheerio.load(html);
  const out = new Map();
  $('a[href]').each((_, a) => {
    let u;
    try {
      u = new URL($(a).attr('href'), pageUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    if (baseDomain(u.hostname) !== allowedBase) return;
    if (/\.(pdf|jpe?g|png|gif|zip|docx?|pptx?|xlsx?|mp4|css|js)$/i.test(u.pathname)) return;
    u.hash = '';
    const text = squish($(a).text()).toLowerCase();
    const hay = `${u.pathname.toLowerCase()} ${u.search.toLowerCase()} ${text}`;
    let score = 0;
    if (/facult|professor/.test(hay)) score += 5;
    if (/people|directory|staff|researcher|our-team|members/.test(hay)) score += 3;
    if (/profile|bio|person/.test(hay)) score += 2;
    if (/department|school|college|division/.test(hay)) score += 1;
    if (/page=|p=\d|start=|offset=/.test(u.search) || /\/page\/\d+/.test(u.pathname)) score += 2;
    if (/news|event|calendar|giving|apply|login|shop|store|parking|athletic|alumni|donate/.test(hay)) score -= 6;
    if (!out.has(u.href) || out.get(u.href) < score) out.set(u.href, score);
  });
  return [...out].map(([url, score]) => ({ url, score }));
}
