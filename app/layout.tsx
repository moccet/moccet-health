import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { StructuredData } from "./components/SEOHead";
import { organizationSchema, websiteSchema } from "@/lib/schemas/health-schemas";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter"
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair"
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: "Moccet - Autonomous Health AI Platform",
    template: "%s | Moccet"
  },
  description: "Autonomous health AI platform with personalized nutrition, fitness, clinical workflows, family health coordination, and specialized programs. AI agents that monitor, recommend, and coordinate with clinicians.",
  keywords: "autonomous health AI, health AI platform, AI health agents, continuous health monitoring, predictive health AI, personalized nutrition, AI nutrition plan, metabolic health, blood biomarker analysis, CGM nutrition, microbiome diet, personalized fitness, HRV training, AI physician consult, family health monitoring, caregiver health alerts, surgery preparation AI, travel health AI, early disease detection, clinical AI integration",
  authors: [{ name: "Moccet" }],
  creator: "Moccet",
  publisher: "Moccet Inc",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: "https://www.moccet.ai"
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
      { url: '/apple-touch-icon-57x57.png', sizes: '57x57', type: 'image/png' },
      { url: '/apple-touch-icon-60x60.png', sizes: '60x60', type: 'image/png' },
      { url: '/apple-touch-icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/apple-touch-icon-76x76.png', sizes: '76x76', type: 'image/png' },
      { url: '/apple-touch-icon-114x114.png', sizes: '114x114', type: 'image/png' },
      { url: '/apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/apple-touch-icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' }
    ],
    other: [
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: "Moccet - Autonomous Health AI Platform",
    description: "Autonomous health AI platform with personalized nutrition, fitness, clinical workflows, family health coordination, and AI agents that monitor, recommend, and coordinate with clinicians.",
    type: "website",
    siteName: "Moccet",
    locale: "en_US",
    url: "https://www.moccet.ai",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Moccet - Autonomous Health AI Platform',
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@moccet",
    title: "Moccet - Autonomous Health AI Platform",
    description: "Autonomous health AI platform with personalized nutrition, fitness, clinical workflows, and AI agents that monitor, recommend, and coordinate with clinicians.",
    images: ['/og-image.png'],
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
        <StructuredData data={websiteSchema} />
      </head>
      <body className={`${inter.variable} ${playfair.variable}`}>
        {children}
      </body>
    </html>
  );
}
