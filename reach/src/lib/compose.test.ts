import { describe, expect, it } from 'vitest';
import { composeEmail } from './compose';

const campaign = { subject: 'Hi {{first_name}}', body: 'Dear {{name}},\nfrom {{sender_name}}', mailingAddress: '1 Main St' };

describe('composeEmail', () => {
  it('renders, adds footer and html', () => {
    const e = composeEmail(campaign, { name: 'Dr. Jane Smith' }, 'Sam');
    expect(e.subject).toBe('Hi Jane');
    expect(e.text).toContain('Dear Jane Smith,');
    expect(e.text).toMatch(/reply STOP/i);
    expect(e.text).toContain('1 Main St');
    expect(e.html).toContain('<p');
  });
  it('strips newlines from the subject', () => {
    const e = composeEmail({ ...campaign, subject: 'a\r\nBcc: x@y.com' }, { name: 'Jane Smith' }, 'Sam');
    expect(e.subject).not.toMatch(/[\r\n]/);
  });
  it('leaves out the STOP line and address when the footer is off (plain text)', () => {
    const e = composeEmail({ ...campaign, footer: false }, { name: 'Dr. Jane Smith' }, 'Sam');
    expect(e.text).toBe('Dear Jane Smith,\nfrom Sam');
    expect(e.html).not.toMatch(/reply STOP/i);
  });
  it('leaves out the injected STOP line in HTML emails when the footer is off', () => {
    const html = '<html><body><p>Hello {{name}}</p></body></html>';
    expect(composeEmail({ ...campaign, htmlBody: html }, { name: 'Jane Smith' }, 'Sam').html).toMatch(/reply STOP/i);
    expect(composeEmail({ ...campaign, htmlBody: html, footer: false }, { name: 'Jane Smith' }, 'Sam').html).not.toMatch(/STOP/);
  });
});
