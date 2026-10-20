import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Jarvis",
  description: "Assistant personnel : travail, sommeil, sport.",
  applicationName: "Jarvis",
  appleWebApp: { capable: true, title: "Jarvis", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#05080D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${grotesk.variable} ${plexMono.variable} antialiased`}>
      <body className="min-h-dvh hud-bg">{children}</body>
    </html>
  );
}
