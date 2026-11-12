import { HomeScreen } from "@/components/HomeScreen";
import { INITIAL_OWNED } from "@/lib/mock-data";

/**
 * The indices that exist at build time. Needed for the static export, and harmless on the
 * server build. Anything created during a session lives in memory, so it is reachable
 * from Home rather than by URL until there is a database (Fase 2).
 */
export function generateStaticParams() {
  return INITIAL_OWNED.map((o) => ({ id: o.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HomeScreen openId={id} />;
}
