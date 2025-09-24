import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StructuredData, organizationSchema } from "./components/SEOHead";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "moccet - AI that Discovers, Experts who Execute",
  description: "Autonomous intelligence that embeds in your infrastructure, discovers insights without prompting, and deploys world-class operators to execute discoveries.",
  keywords: "autonomous AI, business intelligence, AI discovery, expert execution, artificial intelligence, enterprise AI, automated insights",
  authors: [{ name: "moccet" }],
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
  openGraph: {
    title: "moccet - AI that Discovers, Experts who Execute",
    description: "Autonomous intelligence that embeds in your infrastructure, discovers insights without prompting, and deploys world-class operators to execute discoveries.",
    type: "website",
    siteName: "moccet",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "moccet - AI that Discovers, Experts who Execute",
    description: "Autonomous intelligence that embeds in your infrastructure, discovers insights without prompting, and deploys world-class operators to execute discoveries.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <StructuredData data={organizationSchema} />
      </head>
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  );
}
