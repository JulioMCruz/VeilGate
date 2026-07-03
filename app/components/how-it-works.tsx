import type { ReactNode } from 'react';
import { Card, PrivacyBadge } from '@/components/ui';

/**
 * The 3-step explainer — same copy everywhere it appears (dashboard home, pay
 * screen). Extracted so the story isn't duplicated/drifting across pages.
 */
export function HowItWorks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-3'}>
      <StepCard n="1" icon="◈" title="Deposit" compact={compact}>
        Choose 0.1, 1, or 10 XLM. One Freighter transaction locks your funds into the
        fixed-denomination pool.
      </StepCard>
      <StepCard n="2" icon="⬡" title="Prove — in your browser" compact={compact}>
        Your browser generates a Groth16 proof that your note is in the pool. The note secret
        never leaves this tab.
      </StepCard>
      <StepCard n="3" icon="⇄" title="Withdraw & pay" compact={compact}>
        The contract verifies the proof on-chain and pays the publisher.{' '}
        {!compact && <PrivacyBadge>unlinkable</PrivacyBadge>}
      </StepCard>
    </div>
  );
}

function StepCard({
  n,
  icon,
  title,
  compact,
  children,
}: {
  n: string;
  icon: string;
  title: string;
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={compact ? '!p-3' : '!p-4'}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-veil-900/60 text-veil-300">
          {icon}
        </span>
        <span className="text-xs font-semibold text-veil-400">Step {n}</span>
      </div>
      <p className="mt-2 font-semibold text-gray-200">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-400">{children}</p>
    </Card>
  );
}
