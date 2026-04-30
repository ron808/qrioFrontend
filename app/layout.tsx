import type { Metadata, Viewport } from "next";
import { Nunito, Caveat, Permanent_Marker } from "next/font/google";
import { ThemeProvider, themeBootScript } from "@/lib/theme";
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
  title: "Qrio — Quiz Together",
  description: "AI-powered multiplayer quiz game. Pick any topic, challenge friends, learn together.",
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
    { media: "(prefers-color-scheme: light)", color: "#edecea" },
    { media: "(prefers-color-scheme: dark)",  color: "#131316" },
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
