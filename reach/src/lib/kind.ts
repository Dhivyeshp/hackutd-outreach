export type Kind = 'FACULTY' | 'SPONSOR';

export const KINDS: readonly Kind[] = ['FACULTY', 'SPONSOR'];

export const KIND_LABEL: Record<Kind, string> = { FACULTY: 'Faculty', SPONSOR: 'Sponsors' };

/** Campaign row id for each kind. Faculty keeps the original "default" row. */
export const campaignIdFor = (kind: Kind): string => (kind === 'SPONSOR' ? 'sponsor' : 'default');

export const parseKind = (v: string | null | undefined): Kind => (v === 'SPONSOR' ? 'SPONSOR' : 'FACULTY');
