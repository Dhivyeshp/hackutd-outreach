export interface OrganizerLoad {
  id: string;
  load: number;
}

export interface AssignResult {
  assignments: { contactId: string; userId: string }[];
  unassigned: string[];
}

/** Round-robin contacts across organizers, never pushing anyone past `max` total assigned. */
export function assignRoundRobin(contactIds: readonly string[], organizers: readonly OrganizerLoad[], max: number): AssignResult {
  const loads = organizers.map((o) => ({ id: o.id, load: o.load }));
  const assignments: AssignResult['assignments'] = [];
  const unassigned: string[] = [];
  let cursor = 0;

  for (const contactId of contactIds) {
    let picked = -1;
    for (let step = 0; step < loads.length; step++) {
      const idx = (cursor + step) % loads.length;
      if (loads[idx].load < max) {
        picked = idx;
        break;
      }
    }
    if (picked === -1) {
      unassigned.push(contactId);
      continue;
    }
    loads[picked].load++;
    assignments.push({ contactId, userId: loads[picked].id });
    cursor = (picked + 1) % loads.length;
  }
  return { assignments, unassigned };
}
