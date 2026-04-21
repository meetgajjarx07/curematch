import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SmoothScroll from "@/components/SmoothScroll";

export const metadata: Metadata = {
  metadataBase: new URL("https://curematch.app"),
  title: {
    default: "CureMatch — Find Clinical Trials You Qualify For",
    template: "%s",
  },
  description:
    "Enter your medical profile. Get matched to trials you qualify for from 65,081 actively recruiting studies on ClinicalTrials.gov. Deterministic scoring with per-criterion verdicts.",
  keywords: [
    "clinical trials",
    "patient matching",
    "clinical trial finder",
    "ClinicalTrials.gov",
    "medical research",
    "trial eligibility",
  ],
  authors: [{ name: "CureMatch" }],
  openGraph: {
    title: "CureMatch — Find Clinical Trials You Qualify For",
    description:
      "Match your medical profile against 65,081 recruiting trials. Transparent, per-criterion verdicts.",
    type: "website",
    siteName: "CureMatch",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CureMatch — Find Clinical Trials You Qualify For",
    description:
      "Match your medical profile against 65,081 recruiting trials. Transparent, per-criterion verdicts.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-paper text-fg antialiased">
        <SmoothScroll />
        <Navbar />
        <main className="flex-1 pt-12">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
