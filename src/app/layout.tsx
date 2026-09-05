import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: {
    default: "PokeGrade",
    template: "%s · PokeGrade",
  },
  description:
    "Should you pay to grade this Pokémon card? PokeGrade measures centering with computer vision, has Claude rule corners, edges and surface from your photos, and gives one call: submit, check it in hand, or skip. An estimate to decide with, never a grade.",
  applicationName: "PokeGrade",
  authors: [{ name: "Aden Mann", url: "https://github.com/AdenCJM" }],
  keywords: [
    "Pokémon card grading",
    "PSA pre-grade",
    "card centering measurement",
    "should I grade this card",
  ],
  openGraph: {
    type: "website",
    siteName: "PokeGrade",
    title: "PokeGrade",
    description:
      "Measured centering, an honest maybe, and a public log. Should you pay to grade this card?",
  },
  twitter: {
    card: "summary_large_image",
    title: "PokeGrade",
    description:
      "Measured centering, an honest maybe, and a public log. Should you pay to grade this card?",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141418" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6f4" },
  ],
};

// Runs before paint so a pinned theme never flashes the OS default.
const themeScript = `(function(){try{var t=localStorage.getItem("pokegrade.theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-AU"
      className={`${sans.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
