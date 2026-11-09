import type { Metadata, Viewport } from "next";
import { Nunito, Caveat, Permanent_Marker } from "next/font/google";
import { ThemeProvider, themeBootScript } from "@/lib/theme";
import DotField from "./components/DotField";
import PageTransition from "./components/PageTransition";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const permanentMarker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marker",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Qrio — Quiz yourself on anything",
  description: "Type any topic and get fresh AI-written quiz questions. Play solo against the clock or race your friends in a live room.",
  applicationName: "Qrio",
  appleWebApp: {
    capable: true,
    title: "Qrio",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1eee6" },
    { media: "(prefers-color-scheme: dark)",  color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${nunito.variable} ${caveat.variable} ${permanentMarker.variable}`}
    >
      <head>
        {/* No-flash theme bootstrap — runs before paint to avoid FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-paper text-ink antialiased font-body">
        <DotField />
        <ThemeProvider>{children}</ThemeProvider>
        <PageTransition />
      </body>
    </html>
  );
}
