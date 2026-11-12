import type { MetadataRoute } from "next";

/**
 * Installable from the browser's "Add to Home Screen". `display: browser` on purpose: in
 * standalone mode iOS opens the Coinbase wallet popup in a detached view with no
 * window.opener, and signing breaks. An icon on the home screen is the win here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Long",
    short_name: "Long",
    description: "Go long on what you believe in. Your own index of tokenized stocks on Base.",
    start_url: "/",
    display: "browser",
    background_color: "#CFE1FF",
    theme_color: "#0052FF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
