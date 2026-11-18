import type { Metadata } from 'next';
import Postmortem from '@/components/public/Postmortem';

export const metadata: Metadata = { title: 'Postmortem · Vigil', description: 'Blameless postmortem drafted by Vigil after the incident.' };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  return <Postmortem id={s ?? ''} />;
}
