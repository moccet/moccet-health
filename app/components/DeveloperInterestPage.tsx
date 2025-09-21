'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';

interface DeveloperInterestPageProps {
  onClose: () => void;
}

export default function DeveloperInterestPage({ onClose }: DeveloperInterestPageProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [github, setGithub] = useState('');
  const [expertise, setExpertise] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !name || !expertise) return;

    setIsSubmitting(true);

    try {
      // Send Slack notification
      await fetch('/api/slack-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'developer',
          data: {
            name,
            email,
            company: expertise,
            useCase: `GitHub: ${github || 'Not provided'}, LinkedIn: ${linkedin || 'Not provided'}`
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
              <h1 className="text-5xl font-bold mb-4 tracking-tight">Express interest</h1>
              <p className="text-gray-600 text-lg">
                Be notified when engineering positions open
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
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
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
                <option value="">Area of expertise</option>
                <option value="ml">Machine Learning / AI</option>
                <option value="backend">Backend Engineering</option>
                <option value="frontend">Frontend Engineering</option>
                <option value="security">Security Engineering</option>
                <option value="data">Data Engineering</option>
                <option value="devops">DevOps / Infrastructure</option>
                <option value="fullstack">Full Stack Engineering</option>
                <option value="other">Other</option>
              </select>

              <input
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="GitHub username (optional)"
                disabled={isSubmitting}
                className="w-full px-6 py-4 text-base border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors"
              />

              <input
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="LinkedIn profile (optional)"
                disabled={isSubmitting}
                className="w-full px-6 py-4 text-base border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors"
              />

              <button
                type="submit"
                disabled={isSubmitting || !email || !name || !expertise}
                className={`w-full py-4 px-6 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${
                  isSubmitting || !email || !name || !expertise
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Submit
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Positions will open in Q2 2026
            </p>
          </>
        ) : (
          <div className="text-center animate-fadeIn">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-semibold mb-3">Thank you for your interest</h2>
            <p className="text-gray-600 text-lg">
              We&apos;ll reach out when positions open.
              Exceptional talent shapes the future of healthcare AI.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}