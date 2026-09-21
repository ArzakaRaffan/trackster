import { MascotWidget } from '@/components/MascotWidget';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MascotWidget />
    </>
  );
}
