'use client';

interface DevelopersSectionProps {
  onWaitlistClick?: () => void;
}

export default function DevelopersSection({ onWaitlistClick }: DevelopersSectionProps) {
  return (
    <section id="developers" className="min-h-screen flex items-center py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-10">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-6 text-black">
          Build with us
        </h2>
        <p className="text-lg sm:text-xl text-gray-600 mb-10 leading-relaxed">
          We&apos;re building specialized AI models that detect diseases years before symptoms appear.
          Working on privacy-first systems where users own their health data.
          Express interest to be notified when engineering positions open.
        </p>

        <button
          onClick={onWaitlistClick}
          className="bg-black text-white px-8 py-3 rounded-full text-base font-medium cursor-pointer transition-all hover:bg-gray-800 hover:scale-105"
        >
          Express Interest
        </button>

        <p className="text-sm text-gray-500 mt-8">
          Positions will open in Q2 2026
        </p>
      </div>
    </section>
  );
}