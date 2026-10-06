import { describe, expect, it } from 'vitest';
import { composeEmail } from './compose';
import { htmlToText, injectOptOut } from './html';
import { renderHtmlTemplate } from './template';

const tpl = `<!DOCTYPE html><html><head><style>.x{color:red}</style></head><body>
<table><tr><td>Hi Professor {{prof_last_name}},</td></tr>
<tr><td>I'm {{sender_name}} &amp; team. <a href="https://zeroday.hackutd.co">View Zero Day</a></td></tr>
<tr><td><img src="https://x/y.png" alt="Zero Day banner"></td></tr>
<tr><td>{{sender_title}}, HackUTD<br>Reply to <a href="mailto:hello@hackutd.co">hello@hackutd.co</a></td></tr></table></body></html>`;

describe('renderHtmlTemplate', () => {
  it('fills the HTML placeholders', () => {
    const out = renderHtmlTemplate(tpl, { name: 'Dr. Jane Smith' }, { name: 'Sam', title: 'Marketing Coordinator' });
    expect(out).toContain('Hi Professor Smith,');
    expect(out).toContain("I'm Sam &amp; team.");
    expect(out).toContain('Marketing Coordinator, HackUTD');
  });
  it('HTML-escapes untrusted contact values', () => {
    const out = renderHtmlTemplate('<p>{{uni}}</p>', { name: 'A B', uni: '<script>alert(1)</script>' }, { name: 'Sam' });
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });
  it('greets with "Hello," when the last name is unknown', () => {
    expect(renderHtmlTemplate('Hi Professor {{prof_last_name}},', { name: '' }, { name: 'Sam' })).toBe('Hello,');
  });
  it('exposes a {{greeting}} placeholder', () => {
    expect(renderHtmlTemplate('{{greeting}},', { name: 'Brent Neal Reeves' }, { name: 'Sam' })).toBe('Hi Professor Reeves,');
    expect(renderHtmlTemplate('{{greeting}},', { name: '' }, { name: 'Sam' })).toBe('Hello,');
  });
  it('falls back to a default sender title', () => {
    expect(renderHtmlTemplate('{{sender_title}}', { name: 'A B' }, { name: 'Sam', title: '  ' })).toBe('Organizer');
  });
});

describe('htmlToText', () => {
  const text = htmlToText(tpl);
  it('drops styles and tags, decodes entities', () => {
    expect(text).not.toMatch(/<|\.x\{/);
    expect(text).toContain("& team.");
  });
  it('keeps link targets and image alt text', () => {
    expect(text).toContain('View Zero Day (https://zeroday.hackutd.co)');
    expect(text).toContain('[Zero Day banner]');
    expect(text).toContain('hello@hackutd.co');
    expect(text).not.toContain('mailto:');
  });
});

describe('injectOptOut', () => {
  it('adds the STOP line before </body>', () => {
    const out = injectOptOut('<html><body><p>x</p></body></html>');
    expect(out).toMatch(/reply STOP.*<\/div><\/body>/);
  });
  it('appends when there is no body tag', () => {
    expect(injectOptOut('<p>x</p>')).toMatch(/reply STOP/);
  });
});

describe('composeEmail with an HTML template', () => {
  const campaign = { subject: 'Hi {{first_name}}', body: 'plain', htmlBody: tpl, mailingAddress: '1 Main St' };
  const e = composeEmail(campaign, { name: 'Jane Smith' }, { name: 'Sam', title: 'Coordinator' });
  it('uses the HTML, adds opt-out, derives text, skips the plain footer address', () => {
    expect(e.isHtmlTemplate).toBe(true);
    expect(e.html).toContain('Hi Professor Smith,');
    expect(e.html).toMatch(/reply STOP/);
    expect(e.text).toMatch(/reply STOP/);
    expect(e.text).not.toContain('1 Main St');
    expect(e.subject).toBe('Hi Jane');
  });
});
