import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Nutrition Plan | sage by moccet',
  description: 'Build a personalized nutrition plan based on your unique biology, blood biomarkers, and health goals.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
