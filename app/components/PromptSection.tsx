'use client';

export default function PromptSection() {
  return (
    <section id="safety" className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-10 py-8 lg:py-[60px] pb-12 lg:pb-20 border-b border-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Image on the left */}
          <div>
            <img
              src="/images/The Wellness-14.png"
              alt="The Wellness"
              className="w-full rounded-2xl"
            />
          </div>

          {/* Text on the right */}
          <div className="space-y-6 text-left">
            <p className="text-lg lg:text-xl text-black font-medium">
              Advanced AI for healthcare innovation.
            </p>

            <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
              Our AI models are designed to support healthcare professionals with intelligent insights and decision support tools.
            </p>

            <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
              Built with privacy and security at the core, our healthcare AI solutions help improve patient outcomes while maintaining the highest standards of data protection.
            </p>

            <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
              Join leading healthcare institutions in transforming medical care through responsible AI innovation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}