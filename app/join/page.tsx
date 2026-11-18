import type { Metadata } from 'next';
import TeammateJoin from '@/components/public/TeammateJoin';

export const metadata: Metadata = { title: 'Join the incident call · Vigil', description: 'You have been paged into a live incident call.' };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  return <TeammateJoin id={s ?? ''} />;
}
