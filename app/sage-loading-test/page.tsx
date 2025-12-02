'use client';

/**
 * Test page for Sage loading UI
 * Access at: http://localhost:3000/sage-loading-test
 *
 * This page displays the "Your plan is being generated" loading state
 * without actually triggering any plan generation or database calls.
 */

export default function SageLoadingTestPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8f8f8',
      paddingTop: '20px',
      paddingLeft: '20px',
      paddingRight: '20px',
      paddingBottom: '20px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
        <h2 style={{
          fontSize: '32px !important',
          marginBottom: '16px',
          color: '#1a1a1a !important',
          fontWeight: '500 !important',
          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important',
          letterSpacing: '-0.5px',
          textAlign: 'center !important'
        } as React.CSSProperties}>
          Your plan is being generated
        </h2>
        <p style={{
          fontSize: '18px',
          marginBottom: '12px',
          color: '#666',
          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
        }}>
          We&apos;re analyzing your unique biology, health data, and goals to create your personalized nutrition plan.
        </p>
        <p style={{
          fontSize: '16px',
          color: '#999',
          marginTop: '24px',
          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
        }}>
          This typically takes 5-15 minutes. You&apos;ll receive an email when your plan is ready.
        </p>
        <p style={{
          fontSize: '14px',
          color: '#999',
          marginTop: '16px',
          fontStyle: 'italic',
          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'
        }}>
          Feel free to close this page - we&apos;ll email you when it&apos;s complete!
        </p>
      </div>
    </div>
  );
}
