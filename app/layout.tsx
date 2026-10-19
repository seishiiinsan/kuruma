import type { Metadata, Viewport } from "next";
import { Nunito, Russo_One } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Footer } from "@/components/footer";
import { MotionProvider } from "@/components/motion-provider";
import { ErrorReporter } from "@/components/error-reporter";
import { NavBar } from "@/components/nav-bar";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./kuruma.css";

const russo = Russo_One({
  variable: "--font-russo",
  weight: "400",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const description =
  "Kuruma est un jeu de cartes à collectionner pour les passionnés d'automobile. Ouvre des boosters gratuits, échange et expose les 2 445 vraies voitures du jeu.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Kuruma — Toutes les cultures auto, une seule collection",
  description,
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "fr_FR", description },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1d1656",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${russo.variable} ${nunito.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col font-body text-ink">
        <MotionProvider>
          <NavBar />
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer />
        </MotionProvider>
        <ErrorReporter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
