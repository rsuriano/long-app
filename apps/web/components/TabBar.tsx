"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActivityIcon, ExploreIcon, HomeIcon, PlusIcon, StocksIcon } from "./icons";

export function TabBar() {
  const path = usePathname();
  // No navigation on the wizard, and none before you are through the gate.
  // The wizard hides it itself from step 2 on (see .wiz-focus): step 1 is still browsing.
  if (path.startsWith("/gate")) return null;
  const homeOn = path === "/" || path.startsWith("/i/");
  const actOn = path.startsWith("/activity");
  return (
    <nav className="tabbar">
      <Link className={"tab" + (homeOn ? " on" : "")} href="/"><HomeIcon />Home</Link>
      <Link className={"tab" + (path.startsWith("/explore") ? " on" : "")} href="/explore"><ExploreIcon />Ideas</Link>
      <Link className="tab build" href="/build"><span className="ring"><PlusIcon /></span>Build</Link>
      <Link className={"tab" + (actOn ? " on" : "")} href="/activity"><ActivityIcon />Activity</Link>
      <Link className={"tab" + (path.startsWith("/stocks") ? " on" : "")} href="/stocks"><StocksIcon />Stocks</Link>
    </nav>
  );
}
