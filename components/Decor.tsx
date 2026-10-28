import { useId } from 'react';

/** Soft palm-frond shadow, drawn procedurally so no image assets are needed. Purely decorative. */
export function LeafShadow({ className }: { className?: string }) {
  const blurId = useId();
  const fronds = [
    { x: 40, y: 20, rotate: 28, scale: 1 },
    { x: 120, y: -10, rotate: 62, scale: 0.85 },
    { x: 10, y: 120, rotate: 8, scale: 0.7 },
  ];
  return (
    <svg className={className} viewBox="0 0 420 360" aria-hidden="true" focusable="false">
      <defs>
        <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g filter={`url(#${blurId})`} fill="currentColor">
        {fronds.map((f, fi) => (
          <g key={fi} transform={`translate(${f.x} ${f.y}) rotate(${f.rotate}) scale(${f.scale})`}>
            <path d="M0 0 Q160 10 330 40" stroke="currentColor" strokeWidth="3" fill="none" />
            {Array.from({ length: 16 }, (_, i) => {
              const t = i / 16;
              const x = 20 + t * 300;
              const y = 4 + t * t * 34;
              const len = 92 * (1 - t * 0.72);
              return [-1, 1].map((side) => (
                <ellipse
                  key={`${i}${side}`}
                  cx={x + len * 0.32}
                  cy={y + side * len * 0.38}
                  rx={len / 2}
                  ry={5.5 - t * 2}
                  transform={`rotate(${side * 52} ${x} ${y})`}
                />
              ));
            })}
          </g>
        ))}
      </g>
    </svg>
  );
}

const WAVES = [
  'M0 40 C60 0 120 70 200 30 S300 20 300 20 V80 H0Z',
  'M0 70 C80 70 120 20 200 20 S280 50 300 46 V80 H0Z',
  'M0 50 C70 30 140 40 210 26 S290 40 300 52 V80 H0Z',
  'M0 80 C90 80 150 60 210 30 S290 10 300 12 V80 H0Z',
];

/** The sand-dune band along the bottom of a stat card. */
export function Wave({ variant = 0 }: { variant?: number }) {
  return (
    <svg className="stat-wave" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={WAVES[variant % WAVES.length]} />
    </svg>
  );
}
