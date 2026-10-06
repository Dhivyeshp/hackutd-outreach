export const TAGLINE = 'Sponsor & Professor Automated Reach Kit';

/** Plain text logo: no icon, no gradient. */
export function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  if (size === 'lg') {
    return (
      <div className="space-y-1.5 text-center">
        <div className="text-4xl font-bold tracking-tight text-white">SPARK</div>
        <div className="text-sm text-zinc-400">{TAGLINE}</div>
      </div>
    );
  }
  return <div className="text-lg font-bold tracking-tight text-white">SPARK</div>;
}
