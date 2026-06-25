/**
 * x402 Next.js scaffold — generated via stellar_x402_nextjs_scaffold
 * Reference: https://github.com/JulioMCruz/Stellar-mcp/docs/PERKOS_STELLAR_X402_GUIDE.md
 *
 * Paid API route using x402 Payment Required.
 * Wraps with withX402 from @x402/next.
 */

import { NextRequest, NextResponse } from "next/server";

// In production: import { withX402 } from "@x402/next";
// For demo: placeholder implementation

const FACILITATOR_URL =
  process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://stellar-relayer.perkos.xyz";
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "testnet";
const USDC_CONTRACT =
  process.env.NEXT_PUBLIC_USDC_CONTRACT ||
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

/**
 * Middleware: check x402 payment header.
 * Returns 402 if no valid payment, 200 if valid.
 */
async function checkPayment(request: NextRequest) {
  const paymentHeader = request.headers.get("X-PAYMENT");

  if (!paymentHeader) {
    return new NextResponse(
      JSON.stringify({
        error: "Payment Required",
        x402: {
          version: "0.1.0",
          scheme: "exact",
          network: `stellar:${NETWORK}`,
          facilitator: FACILITATOR_URL,
          amount: "1000000", // 0.1 USDC in stroops
          asset: {
            code: "USDC",
            issuer: USDC_CONTRACT,
          },
        },
      }),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-REQUIRED": "exact",
        },
      }
    );
  }

  // In production: verify payment via PerkOS Relayer
  // const verify = await fetch(`${FACILITATOR_URL}/api/v1/plugins/x402-facilitator/call/verify`, ...);

  // Demo: accept any payment header
  return null; // Continue to handler
}

/**
 * GET /api/content/premium
 *
 * Returns premium content. Requires x402 payment.
 * If no payment: returns 402 with x402 requirements.
 */
export async function GET(request: NextRequest) {
  // Check payment
  const paymentCheck = await checkPayment(request);
  if (paymentCheck) {
    return paymentCheck;
  }

  // Return premium content
  return NextResponse.json({
    content: {
      title: "Premium Article",
      body: "This is premium content unlocked via x402 payment on Stellar.",
      author: "VeilGate Publisher",
      publishedAt: new Date().toISOString(),
    },
    payment: {
      status: "verified",
      network: NETWORK,
      note: "Paid via PerkOS x402 Stellar Relayer",
    },
  });
}

/**
 * POST /api/content/premium
 *
 * Accepts proof-of-payment and returns content.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment, url } = body;

    if (!payment) {
      return NextResponse.json(
        { error: "Missing payment payload" },
        { status: 400 }
      );
    }

    // In production: verify payment via PerkOS Relayer
    // const result = await verifyPayment(payment);

    return NextResponse.json({
      content: {
        title: "Premium Article",
        body: "This is premium content unlocked via x402.",
        url: url || "",
      },
      verification: {
        status: "accepted",
        note: "MVP: payment verification placeholder",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
