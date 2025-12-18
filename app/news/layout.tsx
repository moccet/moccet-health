import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stories | moccet',
  description: 'Insights on metabolic health, nutrition science, biomarkers, and the future of personalized health AI.',
  keywords: 'health blog, nutrition science, metabolic health, biomarkers, personalized health, AI health',
  openGraph: {
    title: 'Stories | moccet',
    description: 'Insights on metabolic health, nutrition science, biomarkers, and the future of personalized health AI.',
    type: 'website',
  },
};

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
