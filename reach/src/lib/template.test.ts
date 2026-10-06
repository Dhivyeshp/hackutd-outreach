import { describe, expect, it } from 'vitest';
import { appendFooter, renderTemplate, textToHtml } from './template';

const contact = { name: 'Dr. Jane Smith', title: 'Associate Professor', department: 'CS', uni: 'UTD' };

describe('renderTemplate', () => {
  it('replaces all placeholders', () => {
    const out = renderTemplate(
      'Hi {{first_name}} {{last_name}} ({{name}}) of {{department}} at {{uni}}, {{title}}. -{{sender_name}}',
      contact,
      'Sam',
    );
    expect(out).toBe('Hi Jane Smith (Jane Smith) of CS at UTD, Associate Professor. -Sam');
  });
  it('tolerates whitespace in braces and repeats', () => {
    expect(renderTemplate('{{ first_name }}/{{first_name}}', contact, 'S')).toBe('Jane/Jane');
  });
  it('falls back to Professor for missing names, empty for other blanks', () => {
    expect(renderTemplate('Hi {{first_name}} {{title}}|', { name: '' }, 'S')).toBe('Hi Professor |');
  });
  it('does not leak prototype properties', () => {
    expect(renderTemplate('a{{constructor}}b{{__proto__}}c', contact, 'S')).toBe('abc');
  });
  it('blanks unknown placeholders', () => {
    expect(renderTemplate('a{{nope}}b', contact, 'S')).toBe('ab');
  });
});

describe('textToHtml', () => {
  it('escapes html and keeps paragraphs', () => {
    const h = textToHtml('a <b>\n\nc & d');
    expect(h).toContain('&lt;b&gt;');
    expect(h).toContain('&amp;');
    expect(h.match(/<p/g)?.length).toBe(2);
  });
  it('autolinks urls', () => {
    expect(textToHtml('see https://hackutd.co now')).toContain('<a href="https://hackutd.co">');
  });
});

describe('appendFooter', () => {
  it('adds opt-out line and address', () => {
    const out = appendFooter('Hello', 'HackUTD, 800 W Campbell Rd, Richardson TX');
    expect(out).toMatch(/reply STOP/i);
    expect(out).toContain('800 W Campbell Rd');
    expect(out.startsWith('Hello')).toBe(true);
  });
});
