"use client";
import type React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/useWallet";

/**
 * A gradient derived from the address, so the same wallet always gets the same colours
 * (the demo gets Base blue). Nicer than two letters, and it needs no image.
 */
export function avatarStyle(address?: string): React.CSSProperties {
  if (!address) return {};
  const n = parseInt(address.slice(2, 10), 16);
  const h1 = n % 360;
  const h2 = (h1 + 40 + ((n >> 8) % 80)) % 360;
  const angle = (n >> 16) % 360;
  return { "--avatar": `linear-gradient(${angle}deg, hsl(${h1} 80% 55%), hsl(${h2} 85% 65%))` } as React.CSSProperties;
}

export function AccountAvatar() {
  const router = useRouter();
  const wallet = useWallet();
  return (
    <button className="avatar" style={avatarStyle(wallet.address)} onClick={() => router.push("/account")} aria-label="Account" />
  );
}
