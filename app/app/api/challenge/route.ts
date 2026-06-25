import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * GET /api/challenge?publisher=<pubkey>&price_hash=<hash>
 *
 * Server-issued challenge for a paywall. The reader uses this as the public
 * inputs (publisher pubkey binding) when generating their ZK proof.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const publisher = url.searchParams.get('publisher');
  const priceHash = url.searchParams.get('price_hash');

  if (!publisher || !priceHash) {
    return NextResponse.json(
      { error: 'Missing publisher or price_hash' },
      { status: 400 }
    );
  }

  // In production: read publisher pubkey from a registry, validate price_hash
  // against the content URL, etc. For demo we return the inputs as-is.
  return NextResponse.json({
    publisher_pubkey_x: '0x' + '0'.repeat(64),
    publisher_pubkey_y: '0x' + '0'.repeat(64),
    price_hash: priceHash,
    merkle_root: '0x' + '0'.repeat(64),
    expires_at: Date.now() + 60_000, // 60s window
  });
}