'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWallet } from '@/lib/providers/wallet-provider';
import { useHermes } from '@/components/hermes';
import { NetworkPill, CopyButton, truncate } from '@/components/ui';
import { cn } from '@/lib/cn';

// Only the real, on-chain XLM settlement flow is surfaced. The earlier
// content-unlock / shield routes are proving demos that move no value, so they
// are kept out of the nav to avoid any confusion for evaluators.
const NAV = [
  { href: '/dashboard', label: 'Home', icon: '⌂' },
  { href: '/dashboard/settle', label: 'Pay', icon: '⇄' },
  { href: '/dashboard/history', label: 'Activity', icon: '⊞' },
  { href: '/dashboard/wallet', label: 'Wallet', icon: '⬡' },
];

export function TopBar() {
  const router = useRouter();
  const { address, disconnect, balances } = useWallet();
  const xlm = balances.find((b) => b.asset === 'XLM');

  function handleDisconnect() {
    disconnect();
    router.push('/');
  }
  return (
    <header className="flex items-center justify-between border-b border-veil-900/50 bg-ink-950/80 px-4 py-3 backdrop-blur sm:px-6">
      <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
        <Image src="/brand/logo-mark.png" alt="" width={36} height={25} className="h-[25px] w-auto object-contain" />
        VeilGate
      </Link>
      <div className="flex items-center gap-3">
        <NetworkPill />
        {address && (
          <span className="hidden items-center gap-2 rounded-lg border border-veil-900/70 px-3 py-1.5 text-xs text-gray-300 sm:flex">
            <span className="mono">{truncate(address)}</span>
            {xlm && <span className="text-gray-500">· {Number(xlm.amount).toFixed(1)} XLM</span>}
            <CopyButton value={address} label="address" />
          </span>
        )}
        <button
          onClick={handleDisconnect}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-veil-900/40 hover:text-white"
        >
          Disconnect
        </button>
      </div>
    </header>
  );
}

export function NavRail() {
  const pathname = usePathname();
  const { open } = useHermes();

  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-veil-900/50 p-3 sm:flex">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
              active
                ? 'bg-veil-600/15 font-medium text-veil-200 hairline'
                : 'text-gray-400 hover:bg-ink-900/60 hover:text-gray-200'
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
      <hr className="my-2 border-veil-900/50" />
      <button
        onClick={open}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400 transition hover:bg-ink-900/60 hover:text-gray-200"
      >
        <span aria-hidden>✦</span>
        Hermes
      </button>
    </nav>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-veil-900/70 bg-gray-950 sm:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              active ? 'text-veil-300' : 'text-gray-500'
            }`}
          >
            <span aria-hidden className="text-base">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
