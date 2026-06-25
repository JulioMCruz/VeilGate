# app/ — VeilGate Next.js 14 frontend

The reader-side UI for the VeilGate paywall. Generates the ZK proof in the browser,
submits it to the Soroban verifier, and unlocks the content on success.

## File layout

```
app/
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx              # / — landing
│   ├── premium/page.tsx      # /premium — paywall demo
│   ├── pay/[url]/page.tsx    # /pay/[url] — pay flow (TODO)
│   └── api/
│       └── challenge/route.ts # GET /api/challenge — server-issued challenge
├── components/
│   ├── ConnectWallet.tsx
│   └── PaywallDemo.tsx
└── lib/
    ├── wallet.ts             # Freighter wrappers
    ├── proof.ts              # ZK proof generation
    ├── soroban.ts            # TX builder + submission
    └── types.ts              # Shared types
```

## Stack

- Next.js 14 with App Router
- React 18
- TypeScript 5
- TailwindCSS 3
- Freighter wallet via `@stellar/freighter-api`
- Stellar SDK via `@stellar/stellar-sdk`
- ZK proofs via `@noir-lang/noir_js` + `@aztec/bb.js`

## Setup

```bash
cd app
npm install
cp .env.example .env.local
# Edit .env.local with VERIFIER_CONTRACT_ID from the deployed contracts/verifier
npm run dev
```

## Env vars

```bash
NEXT_PUBLIC_VERIFIER_CONTRACT_ID=C...    # From contracts/verifier deploy
NEXT_PUBLIC_HORIZON_RPC=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC=https://soroban-testnet.stellar.org
```

## Scripts

- `npm run dev` — dev server (localhost:3000)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
- `npm run type-check` — TypeScript check

## Reference

- Next.js App Router: <https://nextjs.org/docs/app>
- Freighter API: <https://github.com/StellarCN/freighter-api>
- Stellar SDK: <https://github.com/StellarCN/js-stellar-sdk>
- Noir: <https://noir-lang.org/docs>
- Barretenberg: <https://github.com/AztecProtocol/aztec-packages/tree/master/barretenberg/ts>

## Security notes

⚠️ This is demo code. The ZK proof generator currently emits a placeholder
Groth16 proof. Replace the placeholder in `lib/proof.ts` with the real
Noir + Barretenberg pipeline before deploying with real funds.

## License

MIT