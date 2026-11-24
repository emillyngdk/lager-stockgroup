import type { Metadata, Viewport } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Lager · Stock Group",
  description: "Lagerforecast og suppleringsradar for Shop Group og Stock Group",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#f7f5f0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
