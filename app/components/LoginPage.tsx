'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface LoginPageProps {
  onClose: () => void;
}

export default function LoginPage({ onClose }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsSubmitting(false);
        return;
      }

      // Send Slack notification
      try {
        await fetch('/api/slack-notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'signup',
            data: {
              email
            }
          })
        });
      } catch {
        // Silently fail for Slack notifications
      }

      setIsSubmitting(false);
      setShowSuccess(true);

      // Don't auto-close, let user see the success message
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
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
            <div className="text-center mb-12">
              <h1 className="text-5xl font-bold mb-4 tracking-tight">Join moccet</h1>
              <p className="text-gray-600 text-lg">
                Enter your email to get started with your personal health AI
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={isSubmitting}
                  className="w-full px-6 py-4 text-lg border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !email}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all ${
                    isSubmitting || !email
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-black text-white hover:bg-gray-800'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowRight size={20} />
                  )}
                </button>
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <div className="text-center">
                <p className="text-sm text-gray-500">
                  By continuing, you agree to moccet&apos;s{' '}
                  <a href="#" className="text-black hover:underline">Terms</a> and{' '}
                  <a href="#" className="text-black hover:underline">Privacy Policy</a>
                </p>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center animate-fadeIn">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-semibold mb-3">Check your email</h2>
            <p className="text-gray-600 text-lg mb-6">
              We&apos;ve sent a magic link to <span className="font-semibold">{email}</span>
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Click the link in your email to sign in to moccet. The link expires in 1 hour.
            </p>
            <button
              onClick={onClose}
              className="bg-black text-white px-8 py-3 rounded-full text-base font-medium cursor-pointer transition-all hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}