// Pure CSS, server-rendered. Fixed positions (no Math.random) so markup matches between server and client.
const STARS = [
  [6, 12, 2, 0, 5], [14, 68, 1.5, 1.2, 7], [22, 30, 2, 2.4, 6], [31, 84, 1.5, 0.6, 8], [38, 8, 2, 3.1, 6],
  [47, 52, 1.5, 1.8, 9], [55, 22, 2, 4.2, 5], [63, 76, 1.5, 0.3, 7], [71, 40, 2, 2.9, 8], [78, 90, 1.5, 3.6, 6],
  [85, 18, 2, 1.1, 7], [92, 58, 1.5, 4.8, 9], [10, 46, 1.5, 5.2, 6], [27, 60, 2, 0.9, 8], [44, 94, 1.5, 2.2, 7],
  [60, 6, 1.5, 3.8, 6], [74, 64, 2, 1.6, 9], [96, 34, 1.5, 4.4, 7],
] as const;

const EMBERS = [
  [9, 4, 0, 16], [24, 3, 5, 20], [41, 4, 9, 18], [58, 3, 2, 22], [73, 4, 12, 17], [88, 3, 7, 21],
] as const;

export function AnimatedBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07070b]">
      <div className="bg-blob animate-blob-a -left-[10vw] -top-[15vh] size-[42vw] min-h-[22rem] min-w-[22rem] bg-amber-500/30" />
      <div className="bg-blob animate-blob-b -right-[12vw] top-[8vh] size-[46vw] min-h-[24rem] min-w-[24rem] bg-fuchsia-600/30" />
      <div className="bg-blob animate-blob-c -bottom-[20vh] left-[18vw] size-[44vw] min-h-[24rem] min-w-[24rem] bg-rose-600/25" />
      <div className="bg-blob animate-blob-b -bottom-[10vh] -right-[8vw] size-[28vw] min-h-[16rem] min-w-[16rem] bg-indigo-600/20" />

      <div className="animate-spin-slow absolute left-1/2 top-1/2 size-[120vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.07] [background:conic-gradient(from_0deg,transparent,#f59e0b,transparent_30%,#a855f7,transparent_60%,#f43f5e,transparent)]" />

      <div className="bg-grid absolute inset-0" />

      {STARS.map(([left, top, size, delay, duration]) => (
        <span
          key={`${left}-${top}`}
          className="absolute rounded-full bg-white"
          style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animation: `twinkle ${duration}s ease-in-out ${delay}s infinite` }}
        />
      ))}
      {EMBERS.map(([left, size, delay, duration]) => (
        <span
          key={left}
          className="absolute -bottom-4 rounded-full bg-gradient-to-t from-amber-300 to-rose-400"
          style={{ left: `${left}%`, width: size, height: size, animation: `rise ${duration}s linear ${delay}s infinite` }}
        />
      ))}

      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_40%,rgba(7,7,11,0.85)_100%)]" />
    </div>
  );
}
