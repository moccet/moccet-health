'use client';

import { useState } from 'react';
import './styles.css';

export default function ForgeGenerationTest() {
  const [email] = useState('test@example.com'); // You can change this to test different emails

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Final Completion Screen */}
      <div className="typeform-screen active" style={{
        backgroundImage: 'url(/images/forge-loading.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* Header with "Your plan is being generated." */}
        <div className="generation-header">
          Your plan is being generated.
        </div>

        {/* Footer Content */}
        <div className="generation-footer">
          <p className="generation-message">
            This typically takes 5-15 minutes. You&apos;ll receive an email at <strong>{email}</strong> when your plan is ready.
          </p>
        </div>
      </div>
    </div>
  );
}
