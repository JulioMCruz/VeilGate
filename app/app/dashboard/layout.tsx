'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/providers/wallet-provider';
import { HermesProvider, HermesDrawer, HermesFab } from '@/components/hermes';
import { TopBar, NavRail, BottomTabBar } from '@/components/app-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isConnected } = useWallet();

  // Client-side wallet guard. The provider restores the address from storage on
  // mount, so give it a tick before redirecting.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isConnected) router.replace('/connect');
    }, 400);
    return () => clearTimeout(t);
  }, [isConnected, router]);

  return (
    <HermesProvider>
      <div className="flex h-screen flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <NavRail />
          <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 sm:px-8 sm:pb-10">{children}</main>
        </div>
        <BottomTabBar />
        <HermesFab />
        <HermesDrawer />
      </div>
    </HermesProvider>
  );
}
