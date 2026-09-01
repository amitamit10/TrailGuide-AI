import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://trailguide-ai-iota.vercel.app"),
  title: {
    default: "TrailGuide AI — Your Personal AI Travel Planner",
    template: "%s | TrailGuide AI",
  },
  description:
    "Plan your entire vacation in seconds with AI. Get customized day-by-day itineraries, interactive maps, packing lists, expense tracking, and real-time live travel companion guidance.",
  applicationName: "TrailGuide AI",
  keywords: [
    "AI travel planner",
    "trip itinerary generator",
    "vacation planner",
    "travel guide",
    "packing checklist",
    "travel budget tracker",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TrailGuide AI",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://trailguide-ai-iota.vercel.app",
    siteName: "TrailGuide AI",
    title: "TrailGuide AI — Your Personal AI Travel Planner",
    description:
      "Plan your entire vacation in seconds with AI. Day-by-day itineraries, interactive maps, packing lists, and live travel companion.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrailGuide AI — Your Personal AI Travel Planner",
    description:
      "Plan your entire vacation in seconds with AI. Day-by-day itineraries, interactive maps, packing lists, and live travel companion.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2D6A4F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
