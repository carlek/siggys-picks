import type { SVGProps } from "react"
import { cn } from "@/lib/utils"

// Both icons invert to a light palette in dark mode, where the original hardcoded
// black rendered invisible against the dark background. The colors live on Tailwind
// dark: classes rather than currentColor because --primary is the same crimson in
// both themes, so inheriting the caller's text color would not flip anything.

export const HockeyPuckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    fill="none"
    {...props}
  >
    {/* Top ellipse (silver, opaque; dark slate in dark mode so it still reads
        against the inverted white body) */}
    <ellipse
      cx="32"
      cy="16"
      rx="28"
      ry="6"
      strokeWidth="0.5"
      className="fill-[#c0c5ca] stroke-black dark:fill-[#3f444a] dark:stroke-white"
    />

    {/* Side wall (solid walls) */}
    <rect x="4" y="16" width="56" height="18" className="fill-black dark:fill-white" />

    {/* Bottom ellipse (base for depth) */}
    <ellipse cx="32" cy="34" rx="28" ry="6" className="fill-black dark:fill-white" />
  </svg>
)

export function HockeyRinkIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
return (
    // className is pulled out of props and merged so the caller's classes land
    // alongside the stroke colors instead of replacing them via the spread.
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" fill="none" strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" className={cn("stroke-black dark:stroke-white", className)} {...props}>
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
