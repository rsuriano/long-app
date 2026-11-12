"use client";
import { findBySymbol } from "@long/universe";
import type { CSSProperties } from "react";
import { W_MAX, W_MIN } from "@/lib/mock-ai";
import { TokenLogo } from "./TokenLogo";
import { LockIcon } from "./icons";

type Props = {
  symbol: string;
  weight: number;
  onWeight?: (w: number) => void;
  onRemove?: () => void;
  locked?: boolean;
  onToggleLock?: () => void;
};

/** One holding: logo, name, weight bar (or bounded slider when editing), percentage (tap to lock). */
export function HoldRow({ symbol, weight, onWeight, onRemove, locked = false, onToggleLock }: Props) {
  const t = findBySymbol(symbol);
  const name = t?.name ?? symbol;
  const ticker = t?.ticker ?? symbol;
  const editable = !!onWeight;
  const fill = ((weight - W_MIN) / (W_MAX - W_MIN)) * 100; // thumb position along the bounded track
  return (
    <div className="hold" data-tk={symbol}>
      <span className="logo"><TokenLogo ticker={ticker} size={26} /></span>
      <span>
        <span className="name">{name}</span>
        {editable ? (
          <input
            type="range"
            className="wr"
            min={W_MIN}
            max={W_MAX}
            value={weight}
            disabled={locked}
            style={{ "--p": fill, opacity: locked ? 0.55 : 1 } as CSSProperties}
            aria-label={`${name} weight`}
            onChange={(e) => onWeight?.(+e.target.value)}
          />
        ) : (
          <span className="bar"><i style={{ width: `${weight}%` }} /></span>
        )}
      </span>
      {editable ? (
        <button className={"w num" + (locked ? " locked" : "")} onClick={onToggleLock} aria-label={`${locked ? "Unlock" : "Lock"} ${name} at ${weight}%`} aria-pressed={locked}>
          {locked && <LockIcon />}{weight}%
        </button>
      ) : (
        <span className="w num">{weight}%</span>
      )}
      {onRemove ? (
        <button className="rm" aria-label={`Remove ${name}`} onClick={onRemove}>×</button>
      ) : (
        <span />
      )}
    </div>
  );
}
