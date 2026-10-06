import { describe, expect, it } from 'vitest';
import { parseName } from './name-parser';

describe('parseName', () => {
  it('splits a plain name', () => {
    expect(parseName('Jane Smith')).toMatchObject({ first: 'Jane', last: 'Smith', full: 'Jane Smith' });
  });
  it('strips honorifics', () => {
    expect(parseName('Dr. Jane Smith').first).toBe('Jane');
    expect(parseName('Prof. Jane Smith').last).toBe('Smith');
    expect(parseName('Professor Jane Smith').full).toBe('Jane Smith');
  });
  it('strips suffixes', () => {
    expect(parseName('Jane Smith, Ph.D.').full).toBe('Jane Smith');
    expect(parseName('John Doe Jr.').last).toBe('Doe');
  });
  it('handles "Last, First"', () => {
    expect(parseName('Smith, Jane')).toMatchObject({ first: 'Jane', last: 'Smith' });
    expect(parseName('Smith, Jane Marie').first).toBe('Jane');
  });
  it('uses middle names as part of first-last split', () => {
    expect(parseName('Jane Q. Public')).toMatchObject({ first: 'Jane', last: 'Public' });
  });
  it('falls back to Professor', () => {
    expect(parseName('')).toMatchObject({ first: 'Professor', last: '', full: 'Professor' });
    expect(parseName('   ')).toMatchObject({ full: 'Professor' });
    expect(parseName('Dr.')).toMatchObject({ first: 'Professor' });
  });
  it('single token is treated as last name with Professor greeting', () => {
    expect(parseName('Madonna')).toMatchObject({ first: 'Professor', last: 'Madonna' });
  });
});
