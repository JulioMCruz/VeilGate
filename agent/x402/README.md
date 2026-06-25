# VeilGate x402 Integration (Stellar-mcp scaffold)

This directory contains the x402 payment integration for VeilGate, generated
using the Stellar-mcp `stellar_x402_perkos_guide` and scaffolds.

## What is x402?

x402 is the payment-native HTTP standard for agentic commerce. A server returns
HTTP 402 Payment Required, the client signs a Stellar auth entry, and the
payment is verified + settled automatically.

## VeilGate x402 Flow

```
Reader (browser/agent)
  → GET /content/premium-article
    → Server returns 402 + x402 requirements
      → Reader signs Stellar auth entry via Freighter
        → Reader retries with X-PAYMENT header
          → Server verifies via PerkOS Stellar Relayer
            → Content served
```

## Stellar-mcp Scaffolds Used

1. **stellar_x402_perkos_guide** — Architecture + endpoints + safety rules
2. **stellar_x402_nextjs_scaffold** — Next.js paid route + Freighter client
3. **stellar_x402_oz_facilitator_scaffold** — OpenZeppelin Relayer facilitator config

## File Layout

```
agent/x402/
├── README.md
├── nextjs-scaffold/          # From stellar_x402_nextjs_scaffold
│   ├── app/api/content/route.ts
│   ├── lib/x402-client.ts
│   └── components/PayButton.tsx
├── facilitator-config/       # From stellar_x402_oz_facilitator_scaffold
│   ├── relayer-config.yaml
│   └── facilitator-plugin.ts
└── .env.example
```

## Setup

```bash
cd agent/x402
# Copy scaffold files from Stellar-mcp
npm install @juliomcruz/stellarmcp
npx stellarmcp --tool stellar_x402_nextjs_scaffold --outputDir ./nextjs-scaffold
npx stellarmcp --tool stellar_x402_oz_facilitator_scaffold --outputDir ./facilitator-config
```

## Configuration

```bash
# .env
NEXT_PUBLIC_FACILITATOR_URL=https://stellar-relayer.perkos.xyz
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```

## PerkOS Relayer Endpoints

- Facilitator: https://stellar-relayer.perkos.xyz
- Verify: POST /api/v1/plugins/x402-facilitator/call/verify
- Settle: POST /api/v1/plugins/x402-facilitator/call/settle
- Supported: GET /api/v1/plugins/x402-facilitator/call/supported

## Safety

- Use testnet first. Mainnet requires explicit approval.
- Never expose relayer API keys in browser code.
- Keep STELLAR_SECRET_KEY server-side only.

## Reference

- Stellar x402 docs: https://developers.stellar.org/docs/build/agentic-payments/x402
- PerkOS x402 Demo: https://github.com/PerkOS-xyz/Stellar-x402-Demo
- PerkOS x402 Relayer: https://github.com/PerkOS-xyz/Stellar-x402-Relayer
- OpenZeppelin Relayer Guide: https://docs.openzeppelin.com/relayer/guides/stellar-x402-facilitator-guide

## License

MIT