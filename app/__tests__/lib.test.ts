import { describe, it, expect, beforeEach } from 'vitest';
import { DENOMINATIONS, DEFAULT_DENOMINATION } from '@/lib/pool-config';
import { loadHistory, addReceipt, domainOf, type PaymentReceipt } from '@/lib/history';

describe('pool-config', () => {
  it('exposes the three denominations with the right stroops', () => {
    expect(DENOMINATIONS.map((d) => d.stroops)).toEqual([1_000_000, 10_000_000, 100_000_000]);
    expect(DENOMINATIONS.map((d) => d.label)).toEqual(['0.1 XLM', '1 XLM', '10 XLM']);
  });

  it('each denomination points at a distinct C... pool contract', () => {
    const ids = DENOMINATIONS.map((d) => d.poolId);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^C[A-Z2-7]{55}$/);
  });

  it('defaults to the 0.1 XLM pool', () => {
    expect(DEFAULT_DENOMINATION.label).toBe('0.1 XLM');
  });
});

describe('history store', () => {
  const addr = 'GTESTADDR';
  beforeEach(() => localStorage.clear());

  const receipt = (nullifier: string): PaymentReceipt => ({
    nullifier,
    commitment: '0xc0',
    contentUrl: 'https://news.example/a',
    publisherDomain: 'news.example',
    timestamp: new Date(0).toISOString(),
    proofBytes: 256,
  });

  it('returns an empty list for an unknown address', () => {
    expect(loadHistory(addr)).toEqual([]);
  });

  it('prepends receipts (most recent first) and is keyed per address', () => {
    addReceipt(addr, receipt('n1'));
    addReceipt(addr, receipt('n2'));
    const list = loadHistory(addr);
    expect(list.map((r) => r.nullifier)).toEqual(['n2', 'n1']);
    expect(loadHistory('GOTHER')).toEqual([]);
  });

  it('never persists an amount field (privacy invariant)', () => {
    addReceipt(addr, receipt('n1'));
    expect(loadHistory(addr)[0]).not.toHaveProperty('amount');
  });
});

describe('domainOf', () => {
  it('strips protocol and www', () => {
    expect(domainOf('https://www.news.example/a/b')).toBe('news.example');
  });
  it('falls back to the raw string for non-URLs', () => {
    expect(domainOf('not a url')).toBe('not a url');
  });
});
