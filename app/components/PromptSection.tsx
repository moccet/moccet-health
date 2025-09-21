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
              We just opened the moccet-health waitlist.
            </p>

            <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
              Every person will soon have their own AI health model—trained on their unique biology, predicting disease 18 months before symptoms appear.
            </p>

            <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
              This isn't cloud-based health tracking. Your AI lives on your device. Learns only from you. Tracks 24/7. Never shares your data. Complete privacy by design.
            </p>

            <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
              In testing, we've detected pancreatic cancer 18 months early with 94% accuracy using routine blood work. The same patterns exist for heart disease, diabetes, and 200+ conditions. We just haven't been looking with the right tools.
            </p>

            <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
              The infrastructure for preventive medicine is finally here. This is AI used for good.
            </p>

            <p className="text-base lg:text-lg text-black font-semibold">
              $99 to join the waitlist for early access. Limited spots.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}