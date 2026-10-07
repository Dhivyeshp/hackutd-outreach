import { promises as dns } from 'node:dns';

/** ok: the domain can receive mail. dead: it definitely cannot. unknown: the lookup failed, so we assume it is fine. */
export type DomainStatus = 'ok' | 'dead' | 'unknown';

export interface Resolver {
  resolveMx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

const NOT_THERE = new Set(['ENOTFOUND', 'ENODATA']);
const isNotThere = (err: unknown) => NOT_THERE.has((err as { code?: string }).code ?? '');

/**
 * Can this domain receive email at all? A domain with an MX record can. With none, mail falls back to
 * the domain's own address (RFC 5321), so an A or AAAA record also counts. A "null MX" (a single "."
 * record) means the domain says it takes no mail. Timeouts and server errors are "unknown", never "dead",
 * so a flaky lookup can never remove a good contact.
 */
export async function checkDomain(domain: string, resolver: Resolver = dns): Promise<DomainStatus> {
  try {
    const mx = await resolver.resolveMx(domain);
    if (mx.length > 0) return mx.every((r) => r.exchange === '' || r.exchange === '.') ? 'dead' : 'ok';
  } catch (err) {
    if (!isNotThere(err)) return 'unknown';
  }
  for (const lookup of [resolver.resolve4, resolver.resolve6]) {
    try {
      if ((await lookup.call(resolver, domain)).length > 0) return 'ok';
    } catch (err) {
      if (!isNotThere(err)) return 'unknown';
    }
  }
  return 'dead';
}

export const domainOf = (email: string): string => email.slice(email.lastIndexOf('@') + 1).toLowerCase();

/** Check many domains with a limited number of lookups in flight. Each domain is looked up once. */
export async function checkDomains(domains: Iterable<string>, resolver: Resolver = dns, concurrency = 25): Promise<Map<string, DomainStatus>> {
  const queue = [...new Set(domains)];
  const results = new Map<string, DomainStatus>();
  const worker = async () => {
    for (let d = queue.pop(); d !== undefined; d = queue.pop()) results.set(d, await checkDomain(d, resolver));
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return results;
}
