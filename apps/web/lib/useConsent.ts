"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/** Whether this wallet has made the eligibility declaration; and how to make it. */
export function useConsent(owner?: string) {
  const qc = useQueryClient();
  const key = ["consent", owner?.toLowerCase() ?? ""];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/consent?owner=${owner}`);
      if (!res.ok) throw new Error(`consent: ${res.status}`);
      return (await res.json()) as { ok: boolean; unavailable?: boolean };
    },
    enabled: !!owner,
    staleTime: 5 * 60_000,
  });
  const accept = async () => {
    const res = await fetch("/api/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner, accepted: true }) });
    if (!res.ok) throw new Error("Couldn't save your declaration. Try again.");
    await qc.invalidateQueries({ queryKey: key });
  };
  // No database in this deployment: nothing to record, don't block the demo.
  const given = q.data?.ok === true || q.data?.unavailable === true;
  return { given, isLoading: !!owner && q.isLoading, accept };
}
