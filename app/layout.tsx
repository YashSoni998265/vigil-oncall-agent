import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#060709',
};

export const metadata: Metadata = {
  title: 'Vigil: the AI on-call engineer that calls you with the fix',
  description:
    'When production breaks, Vigil investigates first, calls the on-call engineer with the diagnosis, fixes it with spoken approval, verifies recovery and writes the postmortem. Built on Agora Conversational AI and Murf Falcon.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'Vigil: the AI on-call engineer',
    description: 'Production is down. Your phone rings. It is already diagnosed.',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
