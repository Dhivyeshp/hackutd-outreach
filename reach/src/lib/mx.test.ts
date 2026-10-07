import { describe, expect, it } from 'vitest';
import { checkDomain, checkDomains, domainOf, type Resolver } from './mx';

const err = (code: string) => Object.assign(new Error(code), { code });

function fake(opts: { mx?: string[] | string; a?: string[] | string; aaaa?: string[] | string }): Resolver {
  const run = <T>(v: T[] | string | undefined, map: (x: T) => unknown) => async () => {
    if (v === undefined) throw err('ENODATA');
    if (typeof v === 'string') throw err(v);
    return v.map(map) as never;
  };
  return {
    resolveMx: run(opts.mx as string[] | string | undefined, (x: string) => ({ exchange: x, priority: 10 })),
    resolve4: run(opts.a, (x) => x) as Resolver['resolve4'],
    resolve6: run(opts.aaaa, (x) => x) as Resolver['resolve6'],
  };
}

describe('checkDomain', () => {
  it('is ok when the domain has an MX record', async () => {
    expect(await checkDomain('a.com', fake({ mx: ['mail.a.com'] }))).toBe('ok');
  });
  it('falls back to an A record when there is no MX', async () => {
    expect(await checkDomain('a.com', fake({ mx: 'ENODATA', a: ['1.2.3.4'] }))).toBe('ok');
  });
  it('is dead when nothing resolves', async () => {
    expect(await checkDomain('gone.example', fake({ mx: 'ENOTFOUND', a: 'ENOTFOUND', aaaa: 'ENOTFOUND' }))).toBe('dead');
  });
  it('is dead for a null MX', async () => {
    expect(await checkDomain('nomail.example', fake({ mx: ['.'] }))).toBe('dead');
  });
  it('never calls a domain dead on a timeout or server failure', async () => {
    expect(await checkDomain('slow.example', fake({ mx: 'ETIMEOUT' }))).toBe('unknown');
    expect(await checkDomain('slow.example', fake({ mx: 'ENODATA', a: 'ESERVFAIL' }))).toBe('unknown');
  });
});

describe('checkDomains', () => {
  it('looks up each domain once', async () => {
    let calls = 0;
    const r = fake({ mx: ['m'] });
    const counting: Resolver = { ...r, resolveMx: async (d) => (calls++, r.resolveMx(d)) };
    const out = await checkDomains(['a.com', 'a.com', 'b.com'], counting);
    expect(calls).toBe(2);
    expect(out.get('a.com')).toBe('ok');
  });
});

describe('domainOf', () => {
  it('takes the part after the last @, lowercased', () => {
    expect(domainOf('Partnerships@Example.COM')).toBe('example.com');
  });
});
