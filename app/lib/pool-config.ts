/**
 * Denominations are separate pool contracts (one fixed amount each) — the same
 * design as the reference shielded pools: mixing only ever happens *within* a
 * denomination, which is exactly what keeps each anonymity set meaningful.
 *
 * All three run the identical contract + verification key; they differ only in
 * the fixed `denom` they were deployed with.
 */
export interface Denomination {
  /** Human label, e.g. "1 XLM". */
  label: string;
  /** Amount in stroops (1 XLM = 10_000_000). */
  stroops: number;
  /** The pool contract for this denomination. */
  poolId: string;
}

export const DENOMINATIONS: Denomination[] = [
  {
    label: '0.1 XLM',
    stroops: 1_000_000,
    poolId:
      process.env.NEXT_PUBLIC_POOL_01_XLM ||
      'CDZGIFZFRFKYIMSPBLA2OSFVD5RIUVVVWRVN5LPAHYHDGH6LOEGKGD7H',
  },
  {
    label: '1 XLM',
    stroops: 10_000_000,
    poolId:
      process.env.NEXT_PUBLIC_POOL_1_XLM ||
      'CBIIKKJHZKA77YWXIITCUX6HFVEWIZAJYKO2Q6ZL3SJ3ZTFUY4RESJ2Z',
  },
  {
    label: '10 XLM',
    stroops: 100_000_000,
    poolId:
      process.env.NEXT_PUBLIC_POOL_10_XLM ||
      'CB27XGZ53S3WGDJE3MN3EHKPBXAMELAK7NY5ZD42ES7ZSLMF7AHTC57E',
  },
];

export const DEFAULT_DENOMINATION = DENOMINATIONS[0];
