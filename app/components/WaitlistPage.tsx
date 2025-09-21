'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';

interface WaitlistPageProps {
  onClose: () => void;
}

export default function WaitlistPage({ onClose }: WaitlistPageProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [organization, setOrganization] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !name || !interest || !agreed) return;

    setIsSubmitting(true);

    try {
      // Send Slack notification
      await fetch('/api/slack-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'waitlist',
          data: {
            name,
            email,
            reason: interest,
            organization: organization || 'Not provided'
          }
        })
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }

    // Simulate additional processing
    await new Promise(resolve => setTimeout(resolve, 500));

    setIsSubmitting(false);
    setShowSuccess(true);

    // Auto close after showing success
    setTimeout(() => {
      onClose();
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center animate-fadeIn">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="w-full max-w-md px-6">
        {!showSuccess ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold mb-4 tracking-tight">Join the waitlist</h1>
              <p className="text-gray-600 text-lg">
                Be first to experience personal health AI with complete privacy
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                disabled={isSubmitting}
                className="w-full px-6 py-4 text-base border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors"
              />

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                disabled={isSubmitting}
                className="w-full px-6 py-4 text-base border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors"
              />

              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full px-6 py-4 text-base border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors appearance-none bg-white cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1.5rem center',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '3.5rem'
                }}
              >
                <option value="">I'm interested in moccet health for...</option>
                <option value="personal">Personal health tracking</option>
                <option value="family">Family health management</option>
                <option value="hospital">Hospital or healthcare system</option>
                <option value="clinic">Private clinic or practice</option>
                <option value="wellness">The Wellness partnership</option>
                <option value="research">Medical research</option>
                <option value="enterprise">Enterprise health programs</option>
              </select>

              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Organization (optional)"
                disabled={isSubmitting}
                className="w-full px-6 py-4 text-base border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors"
              />

              <div className="flex items-start gap-3 py-2">
                <input
                  type="checkbox"
                  id="privacy-agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  disabled={isSubmitting}
                  className="mt-1"
                />
                <label htmlFor="privacy-agree" className="text-sm text-gray-600">
                  I understand moccet health will use end-to-end encryption and I will hold my own data keys.
                  I agree to receive updates about moccet health.
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email || !name || !interest || !agreed}
                className={`w-full py-4 px-6 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${
                  isSubmitting || !email || !name || !interest || !agreed
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Join Waitlist
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center animate-fadeIn">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-semibold mb-3">You're on the list!</h2>
            <p className="text-gray-600 text-lg">
              We'll email you when moccet health launches. You'll be among the first to experience
              personal health AI with complete privacy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}