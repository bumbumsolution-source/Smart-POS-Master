import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Smart POS - Terminal',
  manifest: '/d-pos-manifest.json',
};

export default function DPosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
