import { Metadata } from 'next';
import ForgeClient from './ForgeClient';
import { StructuredData } from '../components/SEOHead';
import { forgeProductSchema, forgeFAQSchema, forgeHowToSchema } from '@/lib/schemas/health-schemas';

export const metadata: Metadata = {
  title: 'forge - AI-Powered Personalized Training Programs',
  description: 'Get fitness and training programs built from your biomarkers, HRV data, and recovery patterns. AI fitness planning that adapts to your biology for optimal results.',
  keywords: 'personalized training program, AI fitness, HRV training, biomarker workout, personalized exercise plan, recovery optimization, fitness AI, personalized workout, heart rate variability training, overtraining prevention, adaptive fitness program',
  openGraph: {
    title: 'forge - AI-Powered Personalized Training Programs | moccet',
    description: 'Get fitness and training programs built from your biomarkers, HRV data, and recovery patterns. AI that adapts to your biology.',
    url: 'https://www.moccet.ai/forge',
    type: 'website',
    images: [
      {
        url: '/images/forge-og.png',
        width: 1200,
        height: 630,
        alt: 'moccet forge - Personalized Fitness AI',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'forge - AI-Powered Personalized Training Programs',
    description: 'Get fitness and training programs built from your biomarkers, HRV data, and recovery patterns.',
    images: ['/images/forge-og.png'],
  },
  alternates: {
    canonical: 'https://www.moccet.ai/forge',
  },
};

export default function ForgePage() {
  return (
    <>
      {/* Structured Data for SEO - invisible to users */}
      <StructuredData data={forgeProductSchema} />
      <StructuredData data={forgeFAQSchema} />
      <StructuredData data={forgeHowToSchema} />

      {/* Client Component with interactive UI */}
      <ForgeClient />
    </>
  );
}
