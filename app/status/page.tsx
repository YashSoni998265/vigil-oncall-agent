import type { Metadata } from 'next';
import StatusPage from '@/components/public/StatusPage';

export const metadata: Metadata = { title: 'Thali status', description: 'Live status of Thali (a fictional demo company), updated by Vigil.' };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  return <StatusPage id={s ?? ''} />;
}
