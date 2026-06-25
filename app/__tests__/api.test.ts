import { describe, it, expect } from 'vitest';
import { GET as challengeGET } from '@/app/api/challenge/route';
import { GET as contentGET, POST as contentPOST } from '@/app/api/content/route';

// The handlers only read request.url / request.headers / request.json(),
// so a plain Request stands in for NextRequest at runtime.
const req = (url: string, init?: RequestInit) => new Request(url, init) as never;

describe('GET /api/challenge', () => {
  it('400 when publisher or price_hash is missing', async () => {
    const res = await challengeGET(req('http://t/api/challenge'));
    expect(res.status).toBe(400);
  });

  it('returns the proof inputs and a future expiry when params are present', async () => {
    const res = await challengeGET(
      req('http://t/api/challenge?publisher=GABC&price_hash=0xdeadbeef')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.price_hash).toBe('0xdeadbeef');
    expect(body).toHaveProperty('publisher_pubkey_x');
    expect(body).toHaveProperty('merkle_root');
    expect(body.expires_at).toBeGreaterThan(Date.now());
  });
});

describe('GET /api/content (x402)', () => {
  it('402 Payment Required without an X-PAYMENT header', async () => {
    const res = await contentGET(req('http://t/api/content'));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402.network).toContain('stellar');
    expect(body.x402.scheme).toBe('exact');
  });

  it('200 with content once an X-PAYMENT header is present', async () => {
    const res = await contentGET(
      req('http://t/api/content', { headers: { 'X-PAYMENT': 'demo-proof' } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payment.status).toBe('verified');
    expect(body.content.title).toBeTruthy();
  });
});

describe('POST /api/content', () => {
  it('400 when the payment payload is missing', async () => {
    const res = await contentPOST(
      req('http://t/api/content', { method: 'POST', body: JSON.stringify({}) })
    );
    expect(res.status).toBe(400);
  });

  it('200 and returns content when a payment payload is provided', async () => {
    const res = await contentPOST(
      req('http://t/api/content', {
        method: 'POST',
        body: JSON.stringify({ payment: { proof: 'x' }, url: 'https://news.example/article' }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verification.status).toBe('accepted');
    expect(body.content.url).toBe('https://news.example/article');
  });
});
