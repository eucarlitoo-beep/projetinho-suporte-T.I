import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const INTRO_VIDEO =
  "https://customer-assets-7cd3h4nn.emergentagent.net/job_bb83583d-b1fe-4a0b-9f63-acd42bb9192a/artifacts/ba24de9008416a40_ffffg.mp4";

/** Chip-shaped mark: a square core with pins, pulsing like the reference microchip. */
export function LogoMark({ className, animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8", className)} aria-hidden>
      <defs>
        <radialGradient id="nx-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#0284C7" />
        </radialGradient>
      </defs>
      {[8, 14, 20, 26, 32].map((p) => (
        <g key={p} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-primary/70">
          <line x1={p} y1="2" x2={p} y2="7" />
          <line x1={p} y1="33" x2={p} y2="38" />
          <line x1="2" y1={p} x2="7" y2={p} />
          <line x1="33" y1={p} x2="38" y2={p} />
        </g>
      ))}
      <rect x="8" y="8" width="24" height="24" rx="6" className="fill-card stroke-primary" strokeWidth="1.6" />
      <rect x="14" y="14" width="12" height="12" rx="3" fill="url(#nx-core)" className={animated ? "animate-node" : ""} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} data-testid="brand-logo">
      <LogoMark />
      <span className="type-wordmark text-lg">
        nexus<span className="text-primary">.</span>
      </span>
    </div>
  );
}

/** Animated circuit traces: dashed strokes flowing towards a glowing core. */
export function CircuitLines({ className }: { className?: string }) {
  const paths = [
    "M0 120 H180 L220 160 H420",
    "M0 260 H120 L170 210 H420",
    "M600 40 V140 L560 180 V300",
    "M1000 140 H820 L780 180 H600",
    "M1000 320 H860 L820 280 H640",
    "M300 600 V480 L340 440 H520",
    "M760 600 V500 L720 460 H560",
  ];
  const nodes: [number, number][] = [[420, 160], [420, 210], [560, 300], [600, 180], [640, 280], [520, 440], [560, 460]];
  return (
    <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className={cn("pointer-events-none absolute inset-0 size-full", className)} aria-hidden>
      {paths.map((d, i) => (
        <g key={d}>
          <path d={d} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1.2" />
          <motion.path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="animate-circuit"
            style={{ animationDelay: `${i * -0.8}s`, animationDuration: `${5 + (i % 3)}s` }}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.8 }}
            transition={{ duration: 1.6, delay: 0.2 + i * 0.12, ease: "easeOut" }}
          />
        </g>
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="currentColor" className="animate-node" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
    </svg>
  );
}
