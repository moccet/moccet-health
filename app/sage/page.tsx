import { Metadata } from 'next';
import SageClient from './SageClient';
import { StructuredData } from '../components/SEOHead';
import { sageProductSchema, sageFAQSchema, sageHowToSchema } from '@/lib/schemas/health-schemas';

export const metadata: Metadata = {
  title: 'Sage - AI-Powered Personalized Nutrition Plans',
  description: 'Generate personalized nutrition plans based on your metabolic data, blood biomarkers, CGM data, and microbiome analysis. AI nutrition planning that adapts to your biology for optimal health.',
  keywords: 'personalized nutrition plan, AI nutrition, metabolic health, CGM nutrition, microbiome diet, blood biomarker diet, personalized meal plan, health AI, glucose optimization, insulin sensitivity diet, anti-inflammatory nutrition, gut health diet',
  openGraph: {
    title: 'Sage - AI-Powered Personalized Nutrition Plans | Moccet',
    description: 'Generate personalized nutrition plans based on your metabolic data, blood biomarkers, CGM data, and microbiome analysis. AI that adapts to your biology.',
    url: 'https://www.moccet.ai/sage',
    type: 'website',
    images: [
      {
        url: '/images/sage-og.png',
        width: 1200,
        height: 630,
        alt: 'Moccet Sage - Personalized Nutrition AI',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sage - AI-Powered Personalized Nutrition Plans',
    description: 'Generate personalized nutrition plans based on your metabolic data, blood biomarkers, CGM data, and microbiome analysis.',
    images: ['/images/sage-og.png'],
  },
  alternates: {
    canonical: 'https://www.moccet.ai/sage',
  },
};

export default function SagePage() {
  return (
    <>
      {/* Structured Data for SEO - invisible to users */}
      <StructuredData data={sageProductSchema} />
      <StructuredData data={sageFAQSchema} />
      <StructuredData data={sageHowToSchema} />

      {/* Client Component with interactive UI */}
      <SageClient />
    </>
  );
}
