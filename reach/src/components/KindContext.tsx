'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { KIND_LABEL, KINDS, type Kind } from '@/lib/kind';

interface KindState {
  kind: Kind;
  setKind: (k: Kind) => void;
}

const STORAGE_KEY = 'spark.kind';
const KindCtx = createContext<KindState>({ kind: 'FACULTY', setKind: () => {} });

/** Which list the app is showing (faculty or sponsors). Remembered in this browser. */
export function KindProvider({ children }: { children: ReactNode }) {
  const [kind, setKindState] = useState<Kind>('FACULTY');

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'SPONSOR') setKindState('SPONSOR');
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);

  const value = useMemo<KindState>(
    () => ({
      kind,
      setKind: (k) => {
        setKindState(k);
        try {
          localStorage.setItem(STORAGE_KEY, k);
        } catch {
          /* ignore */
        }
      },
    }),
    [kind],
  );
  return <KindCtx.Provider value={value}>{children}</KindCtx.Provider>;
}

export const useKind = () => useContext(KindCtx);

export function KindSwitch() {
  const { kind, setKind } = useKind();
  return (
    <div role="tablist" aria-label="Outreach type" className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
      {KINDS.map((k) => (
        <button
          key={k}
          role="tab"
          aria-selected={kind === k}
          onClick={() => setKind(k)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${kind === k ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
        >
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}
