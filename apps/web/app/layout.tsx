import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { Web3Provider } from "@/components/Web3Provider";
import { TabBar } from "@/components/TabBar";
import { Toast } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Long",
  description: "Go long on what you believe in. Build your own index from tokenized stocks on Base.",
  applicationName: "Long",
  appleWebApp: { title: "Long", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-180.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0052FF",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <Web3Provider>
          <StoreProvider>
          <div className="stage">
            <div className="app">
              {children}
              <TabBar />
              <Toast />
            </div>
          </div>
          </StoreProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
