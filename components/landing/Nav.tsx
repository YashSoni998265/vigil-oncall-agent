import Link from 'next/link';
import Logo from '@/components/brand/Logo';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#safety', label: 'Safety' },
  { href: '#compare', label: 'Compare' },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/[0.07] bg-canvas/70 backdrop-blur-xl backdrop-saturate-150">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          aria-label="Vigil home"
          className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo />
        </Link>
        <ul className="hidden items-center gap-9 text-[13px] text-dim md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <Link
          href="/console"
          className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-canvas transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Try the live demo
        </Link>
      </nav>
    </header>
  );
}
