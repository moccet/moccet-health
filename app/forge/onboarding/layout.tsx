import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Training Program | forge by moccet',
  description: 'Build a personalized training program based on your unique biology, HRV data, and fitness goals.',
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
