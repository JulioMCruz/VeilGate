import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HermesProvider, HermesDrawer, HermesFab } from '@/components/hermes';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/providers/wallet-provider', () => ({
  useWallet: () => ({ address: null, balances: [] }),
}));

function renderHermes() {
  const utils = render(
    <HermesProvider>
      <HermesFab />
      <HermesDrawer />
    </HermesProvider>
  );
  // Open the drawer (otherwise it is aria-hidden and its controls are inaccessible).
  fireEvent.click(screen.getByLabelText('Open Hermes agent'));
  return utils;
}

function send(command: string) {
  const input = screen.getByLabelText('Message Hermes');
  fireEvent.change(input, { target: { value: command } });
  fireEvent.submit(input.closest('form')!);
}

describe('Hermes agent', () => {
  beforeEach(() => push.mockClear());

  it('greets and offers the real /settle flow', () => {
    renderHermes();
    expect(screen.getByText(/I.m Hermes/)).toBeInTheDocument();
    // /settle is a visible command chip
    expect(screen.getByRole('button', { name: '/settle' })).toBeInTheDocument();
  });

  it('routes /settle to the shielded-pool flow', async () => {
    renderHermes();
    send('/settle');
    expect(screen.getByText(/shielded-pool payment/i)).toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/settle'), {
      timeout: 1500,
    });
  });

  it('tells the user to connect a wallet for /wallet when disconnected', () => {
    renderHermes();
    send('/wallet');
    expect(screen.getByText(/No wallet connected/i)).toBeInTheDocument();
  });

  it('rejects an unknown command', () => {
    renderHermes();
    send('/nope');
    expect(screen.getByText(/don.t know/i)).toBeInTheDocument();
  });

  it('describes unlinkability, not amount-hiding', () => {
    renderHermes();
    // the intro should not claim it hides the amount
    expect(screen.queryByText(/never see your amounts/i)).not.toBeInTheDocument();
  });
});
