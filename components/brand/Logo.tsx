// Vigil mark: an open eye (keeping watch at night) whose pupil is a pulse line.

export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`text-brand ${className}`}
    >
      <path
        d="M3 16C7.5 8.5 12 6.5 16 6.5S24.5 8.5 29 16C24.5 23.5 20 25.5 16 25.5S7.5 23.5 3 16Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 16H12L14 11.5L18 20.5L20 16H24.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({ className = '', size = 26 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="text-[17px] font-semibold tracking-tight text-ink">Vigil</span>
    </span>
  );
}
