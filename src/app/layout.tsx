import type { Metadata, Viewport } from "next";
import { IBM_Plex_Serif, Inter } from "next/font/google";
import "@fontsource/iosevka/latin-400.css";
import "@fontsource/iosevka/latin-500.css";
import "./globals.css";
import "../styles/deep-nova.css";
import DeepBackdrop from "./DeepBackdrop";

const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "nova press",
  description: "the writing studio where AI matches your voice, not the other way around.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "nova press",
    description: "the writing studio where AI matches your voice, not the other way around.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="deep" className={`${plexSerif.variable} ${inter.variable}`}>
      <body>
        <DeepBackdrop />
        {children}
      </body>
    </html>
  );
}
