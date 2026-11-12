"use client";
import { useStore } from "@/lib/store";
export function Toast() {
  const { toastMsg } = useStore();
  // Announced, or the only feedback some actions give is invisible to a screen reader.
  return (
    <div className={"toast" + (toastMsg ? " on" : "")} role="status" aria-live="polite">
      {toastMsg ?? ""}
    </div>
  );
}
