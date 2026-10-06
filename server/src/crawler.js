import robotsParser from 'robots-parser';
import { baseDomain, extractLinks, extractPeople } from './extract.js';

const UA = 'FacultyDirectoryScraper/1.0 (+research; respects robots.txt)';
const SEED_PATHS = ['/faculty', '/people', '/directory', '/people/faculty', '/about/faculty', '/academics/faculty'];
const MAX_PAGES = 400;
const CONCURRENCY = 6;
const HOST_DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, signal) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)].filter(Boolean)),
  });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  return { html: await res.text(), finalUrl: res.url };
}

/** Turn "UT Dallas", "utdallas.edu" or a URL into a domain. Name lookup uses DuckDuckGo HTML. */
export async function resolveDomain(input, signal) {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed).hostname.replace(/^www\./, '');
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) return trimmed.replace(/^www\./, '').toLowerCase();
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${trimmed} official website`)}`, {
    headers: { 'user-agent': 'Mozilla/5.0' },
    signal,
  });
  const html = await res.text();
  const hosts = [...html.matchAll(/uddg=([^"&]+)/g)].map((m) => {
    try {
      return new URL(decodeURIComponent(m[1])).hostname;
    } catch {
      return '';
    }
  });
  const hit = hosts.find((h) => /\.(edu|ac\.[a-z]{2}|edu\.[a-z]{2})$/.test(h));
  if (!hit) throw new Error(`Could not find website for "${trimmed}". Use "Name | domain.edu".`);
  return baseDomain(hit);
}

/** Polite per-host throttle so a school's servers aren't hammered. */
function makeThrottle() {
  const next = new Map();
  return async (host) => {
    const now = Date.now();
    const at = Math.max(now, next.get(host) ?? 0);
    next.set(host, at + HOST_DELAY_MS);
    if (at > now) await sleep(at - now);
  };
}

/**
 * Crawl one school and return up to `limit` people.
 * onProgress({pages, found, status}) fires as the crawl advances.
 */
export async function scrapeSchool({ domain, limit, signal, onProgress }) {
  const base = baseDomain(domain);
  const throttle = makeThrottle();
  const robotsCache = new Map();
  const people = new Map();
  const seen = new Set();
  const queue = [];
  let pages = 0;
  let active = 0;

  const allowed = async (url) => {
    const { origin } = new URL(url);
    if (!robotsCache.has(origin)) {
      robotsCache.set(
        origin,
        fetch(`${origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) })
          .then(async (r) => {
            if (!r.ok) {
              await r.body?.cancel().catch(() => {});
              return null;
            }
            return robotsParser(`${origin}/robots.txt`, await r.text());
          })
          .catch(() => null),
      );
    }
    const robots = await robotsCache.get(origin);
    return !robots || robots.isAllowed(url, UA) !== false;
  };

  const enqueue = (url, score) => {
    if (seen.has(url) || seen.size > MAX_PAGES * 8) return;
    seen.add(url);
    queue.push({ url, score });
    queue.sort((a, b) => b.score - a.score);
  };

  for (const prefix of [`https://www.${base}`, `https://${base}`]) {
    for (const p of SEED_PATHS) enqueue(`${prefix}${p}`, 10);
    enqueue(`${prefix}/`, 1);
  }

  const visit = async ({ url }) => {
    try {
      if (!(await allowed(url))) return;
      await throttle(new URL(url).hostname);
      const page = await fetchText(url, signal);
      pages++;
      if (!page) return;
      for (const row of extractPeople(page.html, page.finalUrl, base)) {
        if (people.size < limit && !people.has(row.email)) people.set(row.email, row);
      }
      for (const l of extractLinks(page.html, page.finalUrl, base)) enqueue(l.url, l.score);
    } catch {
      /* dead link / timeout: move on */
    } finally {
      onProgress({ pages, found: people.size, status: 'running' });
    }
  };

  await new Promise((resolve) => {
    const pump = () => {
      if (signal?.aborted || people.size >= limit || pages >= MAX_PAGES) {
        if (active === 0) resolve();
        return;
      }
      while (active < CONCURRENCY && queue.length && pages + active < MAX_PAGES) {
        active++;
        visit(queue.shift()).finally(() => {
          active--;
          pump();
        });
      }
      if (active === 0 && !queue.length) resolve();
    };
    pump();
  });

  return [...people.values()].slice(0, limit);
}
