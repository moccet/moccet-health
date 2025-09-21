'use client';

export default function PricingSection() {
  const handlePreorderBasic = () => {
    alert('Pre-order moccet health for $99/month. You will need to arrange testing through The Wellness separately to feed data to your AI model. Redirecting to secure checkout...');
  };

  const handlePreorderPremium = () => {
    alert('Pre-order moccet + The Wellness for $299/month (save $50/month with early access pricing). Includes all testing and your personal AI model. Redirecting to secure checkout...');
  };

  return (
    <section id="health" className="min-h-screen flex items-center py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-10 bg-gray-50">
      <div className="w-full">
        <div className="text-center mb-8 lg:mb-12">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-4">Pre-order Your Personal Health AI</h2>
        <p className="text-base lg:text-lg text-gray-600">Limited early access pricing. Launch expected Q2 2026.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-[900px] mx-auto">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="text-2xl font-semibold mb-2">moccet health</div>
          <div className="text-4xl lg:text-5xl font-semibold mb-2">
            $99<span className="text-base text-gray-600 font-normal">/month</span>
          </div>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Your personal AI health model that learns and protects
          </p>

          <ul className="space-y-3 mb-8">
            {[
              'Personal AI model trained on your health data',
              'Predictive alerts months before symptoms',
              'End-to-end encryption, you hold the keys',
              'Monthly health insights report',
              '24/7 monitoring of your biomarkers',
              'Integration with wearables',
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm pb-3 border-b border-gray-200">
                <span className="text-black font-semibold">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handlePreorderBasic}
            className="w-full py-3 px-5 rounded-md text-base font-medium cursor-pointer transition-colors border border-black bg-white text-black hover:bg-gray-50"
          >
            Pre-order
          </button>
        </div>

        <div className="bg-white rounded-2xl p-8 border-2 border-black transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="inline-block bg-black text-white px-3 py-1 rounded-full text-xs font-semibold mb-4">
            RECOMMENDED
          </div>
          <div className="text-2xl font-semibold mb-2">moccet + The Wellness</div>
          <div className="text-4xl lg:text-5xl font-semibold mb-2">
            $299<span className="text-base text-gray-600 font-normal">/month</span>
          </div>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Complete health AI with comprehensive testing
          </p>

          <ul className="space-y-3 mb-8">
            {[
              'Everything in moccet health',
              'Quarterly comprehensive blood panels',
              'Annual full-body MRI scan',
              'Genetic testing and analysis',
              'Monthly at-home testing kits',
              'Priority access to specialists',
              'Personalized health optimization plan',
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm pb-3 border-b border-gray-200">
                <span className="text-black font-semibold">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handlePreorderPremium}
            className="w-full py-3 px-5 rounded-md text-base font-medium cursor-pointer transition-colors bg-black text-white hover:bg-gray-800"
          >
            Pre-order & Save $50/mo
          </button>
        </div>
      </div>

      <p className="text-center mt-8 text-gray-600 text-sm">
        * Pre-order now and lock in early access pricing. Cancel anytime before launch. Testing data required to train your AI model.
      </p>
      </div>
    </section>
  );
}