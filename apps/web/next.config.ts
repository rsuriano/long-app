import { loadEnvFile } from "node:process";
import type { NextConfig } from "next";

// Next reads .env next to the app; in this monorepo the keys live at the repo root.
try {
  loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // No root .env (CI, or a fresh clone): the AI route falls back to a template basket.
}

// Static export for the public demo: no server, so no API routes and no proxy.
// See scripts/build-static.sh, which moves those aside for the duration of the build.
const isStatic = process.env.LONG_STATIC === "1";

const nextConfig: NextConfig = {
  // Its own dist dir: otherwise a static build overwrites the server build that
  // `next start` is running, and the app goes blank until someone rebuilds.
  ...(isStatic ? { output: "export" as const, distDir: ".next-static", images: { unoptimized: true } } : {}),
  transpilePackages: ["@long/universe", "@long/ai", "@long/execution"],
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
