import type { SVGProps } from "react"

export const HockeyPuckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    fill="none"
    {...props}
  >
    {/* Gradient definition for silver effect */}
    <defs>
      <linearGradient id="silver-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#C0C0C0" />
        <stop offset="100%" stopColor="#8A8A8A" />
      </linearGradient>
    </defs>

    {/* Top ellipse with silver gradient */}
    <ellipse cx="32" cy="16" rx="32" ry="6" fill="url(#silver-gradient)" />

    {/* Side wall (widened slightly on the right) */}
    <path
      d="M0 16 L0 38 C0 42.3 8.9 40 20 40 C60 50 50 38 65 38 L65 17"
      fill="black"
    />

    {/* Bottom ellipse (matching top ellipse dimensions) */}
    <ellipse cx="32" cy="38" rx="32" ry="6" fill="black" opacity="1" />
  </svg>
)
