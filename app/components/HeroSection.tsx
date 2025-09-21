'use client';

interface HeroSectionProps {
  onWaitlistClick?: () => void;
}

export default function HeroSection({ onWaitlistClick }: HeroSectionProps) {
  return (
    <section className="min-h-screen flex flex-col justify-center p-4 sm:p-6 lg:p-10">
      <div>
        <div className="w-full h-[340px] rounded-2xl flex items-center justify-center relative overflow-hidden">
          <img
            src="/images/big feature.jpg"
            alt="Moccet Health Hero"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <h1 className="text-5xl sm:text-6xl lg:text-[84px] font-semibold text-white tracking-tighter z-10 relative drop-shadow-lg">
            moccet-health
          </h1>
        </div>

        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-normal mt-7 mb-3 text-black">Join the waitlist</h2>
        <p className="text-base lg:text-[17px] text-gray-600 mb-9">
          Small AI models that will track your health. Complete privacy. Expert implementation.
        </p>

        <button
          onClick={onWaitlistClick}
          className="bg-black text-white px-8 py-3 rounded-full text-base font-medium cursor-pointer transition-all hover:bg-gray-800 hover:scale-105 inline-block"
        >
          Join Waitlist
        </button>
      </div>
    </section>
  );
}