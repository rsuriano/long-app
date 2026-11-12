"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { getWagmiConfig } from "@/lib/wagmi";

/**
 * Wallet + chain context. Wraps the app so any component can read the connected account
 * and on-chain balances. Additive: nothing here touches the mock store yet, so the app
 * keeps working while the real buy is built.
 */
export function Web3Provider({ children }: { children: ReactNode }) {
  const [config] = useState(getWagmiConfig);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
