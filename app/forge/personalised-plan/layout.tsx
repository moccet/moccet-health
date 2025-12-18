import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Training Program | forge by moccet',
  description: 'Your personalized training program based on your unique biology, biomarkers, and fitness goals.',
  robots: {
    index: false, // Don't index individual plan pages
    follow: false,
  },
};

export default function PersonalisedPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
