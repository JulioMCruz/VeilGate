import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TxLog } from '@/components/tx-log';
import { addReceipt, type PaymentReceipt } from '@/lib/history';

const receipt = (over: Partial<PaymentReceipt> = {}): PaymentReceipt => ({
  nullifier: '0xnullifierabcdef0123456789',
  commitment: '',
  contentUrl: '',
  publisherDomain: 'GABC…WXYZ',
  timestamp: new Date(0).toISOString(),
  proofBytes: 256,
  depositHash: 'dep123abc',
  withdrawHash: 'wd456def',
  poolId: 'CDZGIFZFRFKYIMSPBLA2OSFVD5RIUVVVWRVN5LPAHYHDGH6LOEGKGD7H',
  root: '0xrootcafebabe',
  denomination: '1 XLM',
  anonymitySet: 3,
  ...over,
});

describe('TxLog', () => {
  beforeEach(() => localStorage.clear());

  it('shows the empty state with a settle CTA when there is no history', () => {
    render(<TxLog address="GTEST" />);
    expect(screen.getByText(/No payments yet/i)).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /first private payment/i });
    expect(cta).toHaveAttribute('href', '/dashboard/settle');
  });

  it('renders an on-chain receipt: denomination, proof badge, and both tx links', () => {
    addReceipt('GTEST', receipt());
    render(<TxLog address="GTEST" />);

    expect(screen.getByText('1 XLM')).toBeInTheDocument();
    expect(screen.getByText(/proof verified on-chain/i)).toBeInTheDocument();
    expect(screen.getByText(/unlinkable/i)).toBeInTheDocument();

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('/tx/dep123abc'))).toBe(true);
    expect(hrefs.some((h) => h.includes('/tx/wd456def'))).toBe(true);
    expect(hrefs.some((h) => h.includes('/contract/CDZGIFZ'))).toBe(true);
  });

  it('honors the limit and links to the full log', () => {
    addReceipt('GTEST', receipt({ nullifier: 'n1' }));
    addReceipt('GTEST', receipt({ nullifier: 'n2' }));
    addReceipt('GTEST', receipt({ nullifier: 'n3' }));
    render(<TxLog address="GTEST" limit={2} />);
    expect(screen.getByText(/View all 3 payments/i)).toBeInTheDocument();
  });
});
