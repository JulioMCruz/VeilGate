'use client';

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/providers/wallet-provider';
import { loadHistory, domainOf } from '@/lib/history';
import { truncate } from '@/components/ui';

interface HermesCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}
const Ctx = createContext<HermesCtx | null>(null);

export function HermesProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <Ctx.Provider
      value={{
        isOpen,
        open: () => setOpen(true),
        close: () => setOpen(false),
        toggle: () => setOpen((v) => !v),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useHermes(): HermesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHermes must be used within HermesProvider');
  return ctx;
}

interface Msg {
  from: 'hermes' | 'user';
  text: string;
}

const COMMANDS = ['/pay', '/wallet', '/history', '/shield', '/verify'];

export function HermesDrawer() {
  const { isOpen, close } = useHermes();
  const router = useRouter();
  const { address, balances } = useWallet();
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: 'hermes',
      text:
        'Hey — I can run any VeilGate operation for you. Try /pay <url>, /wallet, /history, /shield, or /verify. I trigger the same operations as the main UI; I never see your keys or amounts.',
    },
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  function reply(text: string) {
    setMessages((m) => [...m, { from: 'hermes', text }]);
  }

  function handle(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: 'user', text }]);
    setInput('');

    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(' ');
    switch (cmd) {
      case '/wallet':
        reply(
          address
            ? `Wallet (testnet)\nAddress  ${truncate(address)}\n` +
                balances.map((b) => `${b.asset}      ${Number(b.amount).toLocaleString()}`).join('\n')
            : 'No wallet connected. Connect Freighter first.'
        );
        break;
      case '/history': {
        const h = address ? loadHistory(address) : [];
        reply(
          h.length
            ? `Last ${Math.min(h.length, 5)} payments (amounts never stored):\n` +
                h
                  .slice(0, 5)
                  .map((r) => `• ${domainOf(r.contentUrl)} · ${r.nullifier.slice(0, 12)}… · amount: private`)
                  .join('\n')
            : 'No payments yet. Use /pay <url> to make your first private payment.'
        );
        break;
      }
      case '/pay':
        if (!arg) {
          reply('Usage: /pay <url> — give me the article URL to unlock.');
        } else {
          reply(`Opening the private pay flow for ${domainOf(arg)}. Choose your amount and I’ll generate the proof.`);
          setTimeout(() => {
            close();
            router.push(`/dashboard/pay?url=${encodeURIComponent(arg)}`);
          }, 700);
        }
        break;
      case '/shield':
        reply('Shielding pre-mints a payment commitment to use later. Opening Shield…');
        setTimeout(() => {
          close();
          router.push('/dashboard/shield');
        }, 700);
        break;
      case '/verify':
        reply(
          arg
            ? `A nullifier proves a payment happened without revealing the amount. ${arg.slice(0, 14)}… is a valid format; full on-chain verification runs in the verifier contract.`
            : 'Usage: /verify <nullifier> — paste a nullifier from your history.'
        );
        break;
      default:
        reply(`I don’t know "${cmd}". Available: ${COMMANDS.join('  ')}`);
    }
  }

  return (
    <>
      {/* Drawer */}
      <aside
        role="complementary"
        aria-label="Hermes agent"
        aria-hidden={!isOpen}
        className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-veil-900/70 bg-gray-950 shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-veil-900/70 px-4 py-3">
          <div>
            <p className="font-semibold text-veil-300">Hermes</p>
            <p className="text-[11px] text-gray-500">Your VeilGate agent</p>
          </div>
          <button onClick={close} aria-label="Close Hermes" className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.from === 'user'
                  ? 'ml-auto bg-veil-600 text-white'
                  : 'bg-gray-900 text-gray-200'
              }`}
            >
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t border-veil-900/70 px-3 py-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {COMMANDS.map((c) => (
              <button
                key={c}
                onClick={() => setInput(c + ' ')}
                className="mono rounded-md border border-veil-900/70 px-2 py-0.5 text-[11px] text-veil-300 hover:bg-veil-900/40"
              >
                {c}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handle(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Hermes…"
              aria-label="Message Hermes"
              className="flex-1 rounded-lg border border-veil-900/70 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-veil-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-veil-600 px-3 py-2 text-sm text-white hover:bg-veil-500"
            >
              Send
            </button>
          </form>
        </div>
      </aside>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={close}
          aria-hidden
          className="fixed inset-0 z-30 bg-black/40"
        />
      )}
    </>
  );
}

/** Floating button to open Hermes. */
export function HermesFab() {
  const { open } = useHermes();
  return (
    <button
      onClick={open}
      aria-label="Open Hermes agent"
      className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-veil-600 text-xl font-bold text-white shadow-lg shadow-veil-900/50 hover:bg-veil-500"
    >
      H
    </button>
  );
}
