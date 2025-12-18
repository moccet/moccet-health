import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Nutrition Plan | sage by moccet',
  description: 'Your personalized nutrition plan based on your unique biology, blood biomarkers, and health goals.',
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
