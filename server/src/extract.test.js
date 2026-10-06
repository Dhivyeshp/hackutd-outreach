import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPeople, extractLinks, baseDomain, decodeCfEmail } from './extract.js';

const html = `<html><head><title>CS Faculty</title></head><body><h1>Computer Science</h1><ul>
<li><h3>Jane Smith</h3><p>Associate Professor</p><a href="mailto:jane.smith@cs.utdallas.edu">email</a></li>
<li><h3>Bob Lee</h3><p>Lecturer</p><span>bob.lee [at] utdallas.edu</span></li>
<li><h3>Admin</h3><a href="mailto:info@utdallas.edu">x</a></li>
<li><h3>Outsider</h3><a href="mailto:x@gmail.com">x</a></li>
</ul><a href="/people/faculty?page=2">next</a><a href="/news/x">news</a></body></html>`;

test('baseDomain', () => {
  assert.equal(baseDomain('cs.utdallas.edu'), 'utdallas.edu');
  assert.equal(baseDomain('www.ox.ac.uk'), 'ox.ac.uk');
});

test('cloudflare decode', () => {
  // key 0x1b, 'a' (0x61) ^ 0x1b = 0x7a
  assert.equal(decodeCfEmail('1b7a'), 'a');
});

test('extracts people, filters generic + foreign', () => {
  const rows = extractPeople(html, 'https://x.utdallas.edu/f', 'utdallas.edu');
  assert.deepEqual(rows.map((r) => r.email).sort(), ['bob.lee@utdallas.edu', 'jane.smith@cs.utdallas.edu']);
  const jane = rows.find((r) => r.email.startsWith('jane'));
  assert.equal(jane.name, 'Jane Smith');
  assert.match(jane.title, /Associate Professor/i);
});

test('rejects footer/contact junk with no person signal', () => {
  const junk = '<footer><h4>Support Staff Scholarships</h4><a href="mailto:staffcouncil@utdallas.edu">x</a></footer>';
  assert.deepEqual(extractPeople(junk, 'u', 'utdallas.edu'), []);
});

test('link scoring prefers faculty, penalizes news', () => {
  const l = extractLinks(html, 'https://x.utdallas.edu/', 'utdallas.edu');
  const s = Object.fromEntries(l.map((x) => [new URL(x.url).pathname, x.score]));
  assert.ok(s['/people/faculty'] > 0);
  assert.ok(s['/news/x'] < 0);
});
