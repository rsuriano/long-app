import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { base } from "viem/chains";

/**
 * Read-only Base client. Every price and quote in this package is an eth_call: no keys,
 * no gas, nothing moves. Point BASE_RPC_URL at a paid node for the app; the public
 * endpoint is fine for scripts but rate-limits.
 */
/** Public Base endpoints, used when no BASE_RPC_URL is set. They rate-limit, so we spread
 *  across several and let viem retry/fall back. Point BASE_RPC_URL at a paid node in prod. */
const PUBLIC_RPCS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
];

export function basePublicClient(rpcUrl = process.env.BASE_RPC_URL): PublicClient {
  const transport = rpcUrl
    ? http(rpcUrl)
    : fallback(PUBLIC_RPCS.map((u) => http(u, { retryCount: 2, retryDelay: 400 })), { rank: false });
  return createPublicClient({ chain: base, transport, batch: { multicall: true } }) as PublicClient;
}

export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** ARGt, Twin's Argentine peso token on Base (18 decimals). Verified on-chain 9/9/2026; no Aerodrome pool vs USDC yet, so it is shown, not spent. */
export const ARGT_BASE = "0xf016413834E6D1A14F3D628B11D6Ef725a6bdbDD" as const;
export const ARGT_DECIMALS = 18;
