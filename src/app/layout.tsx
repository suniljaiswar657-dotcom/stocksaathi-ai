import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockSaathi AI — Smart shop management",
  description:
    "A simple Hindi-first AI shop manager for inventory, expiry alerts and profit insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
