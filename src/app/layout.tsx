import type { Metadata, Viewport } from "next";
import { locale } from "@/lib/i18n";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "The Great Movember Challenge 2026",
    template: "%s · Movember Club",
  },
  description: "A private November wellness challenge for friends and family.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Movember Club" },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#183c32",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={await locale()}>
      <body>{children}</body>
    </html>
  );
}
