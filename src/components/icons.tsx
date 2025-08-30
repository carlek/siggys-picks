import type { SVGProps } from "react"

export const HockeyPuckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    fill="none"
    {...props}
  >
    {/* Top ellipse (silver, opaque) */}
    <ellipse cx="32" cy="16" rx="28" ry="6" fill="#c0c5ca" stroke="black" strokeWidth="0.5" />

    {/* Side wall (solid black walls) */}
    <rect x="4" y="16" width="56" height="18" fill="black" />

    {/* Bottom ellipse (black base for depth) */}
    <ellipse cx="32" cy="34" rx="28" ry="6" fill="black" />
  </svg>
)

export function HockeyRinkIcon(props: SVGProps<SVGSVGElement>) {
return (
    <svg xmlns="http://www.w3.org/2000/svg
      " viewBox="0 0 600 360" fill="none" stroke="black" strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x={10} y={10} width={580} height={340} rx={40} />
      <line x1={300} y1={20} x2={300} y2={340} />
      <line x1={150} y1={20} x2={150} y2={340} />
      <line x1={450} y1={20} x2={450} y2={340} />
      <line x1={40} y1={20} x2={40} y2={340} />
      <line x1={560} y1={20} x2={560} y2={340} />
      <rect x={20} y={160} width={20} height={40} rx={6} />
      <rect x={560} y={160} width={20} height={40} rx={6} />
      <circle cx={300} cy={180} r={36} />
      <circle cx={300} cy={180} r={4} fill="currentColor" stroke="none" />
      <circle cx={120} cy={90} r={32} />
      <circle cx={120} cy={270} r={32} />
      <circle cx={120} cy={90} r={4} fill="currentColor" stroke="none" />
      <circle cx={120} cy={270} r={4} fill="currentColor" stroke="none" />
      <circle cx={480} cy={90} r={32} />
      <circle cx={480} cy={270} r={32} />
      <circle cx={480} cy={90} r={4} fill="currentColor" stroke="none" />
      <circle cx={480} cy={270} r={4} fill="currentColor" stroke="none" />
    </svg>
)
}
