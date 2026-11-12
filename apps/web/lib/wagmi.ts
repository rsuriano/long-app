import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";

/**
 * wagmi config for Base. One connector: Coinbase Smart Wallet in
 * smartWalletOnly mode (passkey — no seed phrase, no extension), per the plan. SSR-safe storage so the connection survives a
 * reload. A paid RPC goes in NEXT_PUBLIC_BASE_RPC_URL later; the default is Base's public one.
 */
export function getWagmiConfig() {
  return createConfig({
    chains: [base],
    connectors: [coinbaseWallet({ appName: "Long", preference: { options: "smartWalletOnly" } })],
    storage: createStorage({ storage: cookieStorage }),
    ssr: true,
    transports: {
      [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
    },
  });
}
