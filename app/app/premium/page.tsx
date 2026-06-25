import { PaywallDemo } from '@/components/PaywallDemo';

export default function PremiumPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Demo paywall
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Connect your Freighter wallet and pay to see the premium content below.
        </p>
      </div>
      <div className="mt-12 flex justify-center">
        <PaywallDemo />
      </div>
    </main>
  );
}