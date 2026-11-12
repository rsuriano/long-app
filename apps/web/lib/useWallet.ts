"use client";
import { useAccount, useConnect, useDisconnect, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { balanceContracts, USDC_DECIMALS } from "@/lib/wallet-balances";
import { ARGT_DECIMALS } from "@long/execution";

export type WalletState = {
  isConnected: boolean;
  /** wagmi is restoring a previous session from the cookie; don't decide anything yet. */
  isReconnecting: boolean;
  address?: `0x${string}`;
  /** Real USDC balance on Base, or null while loading / not connected. */
  usdc: number | null;
  /** Real ARGt balance (Twin's peso token), same rules. Shown, not spendable yet. */
  argt: number | null;
  connect: () => void;
  disconnect: () => void;
  isConnecting: boolean;
  error?: string;
};

/** One place the whole app reads the wallet from, so Home, Add funds and the buy agree. */
export function useWallet(): WalletState {
  const { address, isConnected, isReconnecting } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];

  const contracts = address ? balanceContracts(address) : null;
  const { data } = useReadContracts({
    contracts: contracts ? [contracts.usdc, contracts.argt] : [],
    query: { enabled: !!contracts, refetchInterval: 15_000 },
  });
  const raw = data?.[0]?.status === "success" ? (data[0].result as bigint) : null;
  const rawArgt = data?.[1]?.status === "success" ? (data[1].result as bigint) : null;

  return {
    isConnected,
    isReconnecting,
    address,
    usdc: raw !== null ? Number(formatUnits(raw, USDC_DECIMALS)) : null,
    argt: rawArgt !== null ? Number(formatUnits(rawArgt, ARGT_DECIMALS)) : null,
    connect: () => connector && connect({ connector }),
    disconnect: () => disconnect(),
    isConnecting: isPending,
    error: error?.message,
  };
}
