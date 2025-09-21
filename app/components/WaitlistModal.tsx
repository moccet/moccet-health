'use client';

import { useState, FormEvent } from 'react';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowSuccess(true);

    setTimeout(() => {
      onClose();
      setTimeout(() => {
        setShowSuccess(false);
      }, 500);
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl p-8 w-[440px] max-w-[90%] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-xl"
        >
          ×
        </button>

        {!showSuccess ? (
          <>
            <h2 className="text-2xl font-semibold mb-2">Join the moccet health waitlist</h2>
            <p className="text-sm text-gray-600 mb-6">
              Be first to experience personal health AI with complete privacy
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">I'm interested in moccet health for:</label>
                <select
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white cursor-pointer"
                >
                  <option value="">Select an option</option>
                  <option value="personal">Personal health tracking</option>
                  <option value="family">Family health management</option>
                  <option value="hospital">Hospital or healthcare system</option>
                  <option value="clinic">Private clinic or practice</option>
                  <option value="wellness">The Wellness partnership</option>
                  <option value="research">Medical research</option>
                  <option value="enterprise">Enterprise health programs</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Organization (optional)</label>
                <input
                  type="text"
                  placeholder="Hospital, clinic, or company name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex items-start gap-2 my-5">
                <input
                  type="checkbox"
                  id="privacy"
                  required
                  className="mt-0.5"
                />
                <label htmlFor="privacy" className="text-[13px] text-gray-600">
                  I understand moccet health will use end-to-end encryption and I will hold my own data keys.
                  I agree to receive updates about moccet health.
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-black text-white py-2.5 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Join Waitlist
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-5 text-white text-[32px]">
              ✓
            </div>
            <h2 className="text-2xl font-semibold mb-2">You're on the list!</h2>
            <p className="text-sm text-gray-600">
              We'll email you when moccet health launches. You'll be among the first to experience
              personal health AI with complete privacy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}