import { describe, expect, it } from 'vitest';
import { compareReplyRates, contentFor, pickVariant, variantFor, type AbCampaign } from './ab';

const base: AbCampaign = {
  subject: 'Subject A',
  body: 'Body A',
  htmlBody: '<p>Html A</p>',
  mailingAddress: '1 Main St',
  abEnabled: true,
  abPercentB: 50,
  bSubject: 'Subject B',
  bBody: 'Body B',
  bHtmlBody: null,
};

describe('pickVariant', () => {
  it('is stable for the same contact', () => {
    expect(pickVariant('abc123', 50)).toBe(pickVariant('abc123', 50));
  });
  it('sends nobody to B at 0% and everybody at 100%', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickVariant(`c${i}`, 0)).toBe('A');
      expect(pickVariant(`c${i}`, 100)).toBe('B');
    }
  });
  it('splits close to the requested share', () => {
    let b = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) if (pickVariant(`cmu${i}x`, 30) === 'B') b++;
    expect(b / n).toBeGreaterThan(0.26);
    expect(b / n).toBeLessThan(0.34);
  });
});

describe('variantFor', () => {
  it('is always A when the test is off', () => {
    expect(variantFor({ ...base, abEnabled: false }, 'x')).toBe('A');
  });
  it('falls back to A when version B is incomplete', () => {
    expect(variantFor({ ...base, abPercentB: 100, bBody: '' }, 'x')).toBe('A');
    expect(variantFor({ ...base, abPercentB: 100, bSubject: null }, 'x')).toBe('A');
  });
  it('uses B when the test is on and B is complete', () => {
    expect(variantFor({ ...base, abPercentB: 100 }, 'x')).toBe('B');
  });
});

describe('contentFor', () => {
  it('returns the original content for A', () => {
    expect(contentFor(base, 'A')).toMatchObject({ subject: 'Subject A', body: 'Body A', htmlBody: '<p>Html A</p>' });
  });
  it('returns plain text for B when B has no HTML, keeping the shared mailing address', () => {
    const b = contentFor(base, 'B');
    expect(b).toMatchObject({ subject: 'Subject B', body: 'Body B', htmlBody: null, mailingAddress: '1 Main St' });
  });
});

describe('compareReplyRates', () => {
  it('says too early with small samples', () => {
    expect(compareReplyRates({ sent: 20, replied: 5 }, { sent: 20, replied: 1 }).verdict).toBe('too_early');
  });
  it('calls a clear winner', () => {
    const r = compareReplyRates({ sent: 500, replied: 60 }, { sent: 500, replied: 20 });
    expect(r.verdict).toBe('A');
  });
  it('calls B when B is clearly better', () => {
    expect(compareReplyRates({ sent: 500, replied: 20 }, { sent: 500, replied: 60 }).verdict).toBe('B');
  });
  it('reports no clear winner for similar rates', () => {
    expect(compareReplyRates({ sent: 300, replied: 30 }, { sent: 300, replied: 33 }).verdict).toBe('tie');
  });
  it('handles zero replies without dividing by zero', () => {
    expect(compareReplyRates({ sent: 300, replied: 0 }, { sent: 300, replied: 0 }).verdict).toBe('tie');
  });
});
