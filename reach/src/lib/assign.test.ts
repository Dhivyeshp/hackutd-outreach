import { describe, expect, it } from 'vitest';
import { assignRoundRobin } from './assign';

describe('assignRoundRobin', () => {
  it('distributes evenly', () => {
    const r = assignRoundRobin(['1', '2', '3', '4', '5'], [{ id: 'a', load: 0 }, { id: 'b', load: 0 }], 100);
    const count = (id: string) => r.assignments.filter((x) => x.userId === id).length;
    expect([count('a'), count('b')].sort()).toEqual([2, 3]);
    expect(r.unassigned).toEqual([]);
  });
  it('respects the per-organizer max including existing load', () => {
    const r = assignRoundRobin(['1', '2', '3', '4'], [{ id: 'a', load: 2 }, { id: 'b', load: 0 }], 3);
    expect(r.assignments.filter((x) => x.userId === 'a')).toHaveLength(1);
    expect(r.assignments.filter((x) => x.userId === 'b')).toHaveLength(3);
  });
  it('leaves overflow unassigned', () => {
    const r = assignRoundRobin(['1', '2', '3'], [{ id: 'a', load: 0 }], 2);
    expect(r.unassigned).toEqual(['3']);
  });
  it('handles no organizers', () => {
    expect(assignRoundRobin(['1'], [], 10)).toEqual({ assignments: [], unassigned: ['1'] });
  });
  it('is deterministic and does not mutate input', () => {
    const orgs = [{ id: 'a', load: 0 }];
    assignRoundRobin(['1'], orgs, 5);
    expect(orgs[0].load).toBe(0);
  });
});
