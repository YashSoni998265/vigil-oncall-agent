import type { Metadata } from 'next';
import Console from '@/components/console/Console';

export const metadata: Metadata = {
  title: 'Live demo · Vigil',
  description: 'Break a private copy of production and let Vigil, the AI on-call engineer, call you with the fix.',
};

export default function ConsolePage() {
  return <Console />;
}
