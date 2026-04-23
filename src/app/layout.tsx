import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sykkelpris — Finn beste sykkeltilbud i Norge",
    template: "%s | Sykkelpris",
  },
  description:
    "Søk blant hundrevis av sykler fra seriøse nettbutikker som leverer til Norge. Finn beste pris og størst rabatt på veisykler, grusykler, terrengsykler og elsykler.",
  openGraph: {
    type: "website",
    locale: "nb_NO",
    siteName: "Sykkelpris",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb" className={inter.variable}>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
