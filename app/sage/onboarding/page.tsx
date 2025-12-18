'use client';

import { useState, useEffect, useRef } from 'react';
import MultiFileUpload from '@/components/MultiFileUpload';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useOnboardingTracker } from '@/lib/hooks/useOnboardingTracker';
import './onboarding.css';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Screen =
  | 'intro' | 'welcome' | 'name' | 'age' | 'gender' | 'weight' | 'height'
  | 'email' | 'ikigai-intro' | 'main-priority' | 'driving-goal'
  | 'baseline-intro' | 'allergies' | 'medications' | 'supplements' | 'medical-conditions'
  | 'fuel-intro' | 'eating-style' | 'first-meal' | 'energy-crash' | 'protein-sources' | 'food-dislikes'
  | 'meals-cooked' | 'completion' | 'final-step-intro' | 'ecosystem-integration' | 'lab-upload' | 'payment' | 'final-completion';

// Stripe Payment Form Component
function SagePaymentForm({
  email,
  fullName,
  onSuccess,
  onError
}: {
  email: string;
  fullName: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    onError('');

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/sage/onboarding`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed');
        setProcessing(false);
      } else {
        // Payment succeeded - trigger plan generation via webhook
        // The webhook will handle plan generation automatically
        onSuccess();
      }
    } catch (err) {
      console.error('Payment error:', err);
      onError('An unexpected error occurred');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '24px' }}>
        <PaymentElement />
      </div>
      <button
        type="submit"
        disabled={!stripe || processing}
        className="typeform-button"
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '18px',
          fontWeight: 600,
          opacity: !stripe || processing ? 0.6 : 1,
          cursor: !stripe || processing ? 'not-allowed' : 'pointer'
        }}
      >
        {processing ? 'Processing...' : 'Complete Payment'}
      </button>
    </form>
  );
}

export default function SageOnboarding() {
  // Skip intro video in development mode
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    process.env.NODE_ENV === 'development' ? 'welcome' : 'intro'
  );
  const [labFileUploading, setLabFileUploading] = useState(false);
  const [labFileError, setLabFileError] = useState('');
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeam, setSlackTeam] = useState('');
  const [appleHealthConnected, setAppleHealthConnected] = useState(false);
  const [appleCalendarConnected, setAppleCalendarConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookEmail, setOutlookEmail] = useState('');
  const [ouraConnected, setOuraConnected] = useState(false);
  const [dexcomConnected, setDexcomConnected] = useState(false);
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [vitalConnected, setVitalConnected] = useState(false);
  const [vitalUserId, setVitalUserId] = useState('');
  const [teamsConnected, setTeamsConnected] = useState(false);
  const [teamsEmail, setTeamsEmail] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalType, setUploadModalType] = useState<'oura-ring' | 'whoop' | 'cgm' | 'flo' | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showGoogleWarningModal, setShowGoogleWarningModal] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [asyncGenerationStarted, setAsyncGenerationStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeError, setPromoCodeError] = useState('');
  const [promoCodeVerified, setPromoCodeVerified] = useState(false);
  const [promoCodeVerifying, setPromoCodeVerifying] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [uniqueCode, setUniqueCode] = useState('');

  // Video sound controls
  const [introVideoMuted, setIntroVideoMuted] = useState(true);
  const introVideoRef = useRef<HTMLVideoElement>(null);

  const toggleIntroSound = () => {
    if (introVideoRef.current) {
      introVideoRef.current.muted = !introVideoMuted;
      setIntroVideoMuted(!introVideoMuted);
    }
  };

  // Enable scrolling on payment screen
  useEffect(() => {
    if (currentScreen === 'payment') {
      document.documentElement.classList.add('payment-screen-active');
      document.body.classList.add('payment-screen-active');
    } else {
      document.documentElement.classList.remove('payment-screen-active');
      document.body.classList.remove('payment-screen-active');
    }

    return () => {
      document.documentElement.classList.remove('payment-screen-active');
      document.body.classList.remove('payment-screen-active');
    };
  }, [currentScreen]);

  // Speech recognition functionality
  const startDictation = (fieldName: keyof typeof formData) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setActiveField(fieldName);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleInputChange(fieldName, transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setActiveField(null);
      if (event.error === 'no-speech') {
        alert('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        alert('Microphone access was denied. Please allow microphone access in your browser settings.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setActiveField(null);
    };

    recognition.start();
  };

  // Calculate progress percentage based on current screen
  const calculateProgress = () => {
    const screens: Screen[] = [
      'intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
      'email', 'ikigai-intro', 'main-priority', 'driving-goal',
      'baseline-intro', 'allergies', 'medications', 'supplements', 'medical-conditions',
      'fuel-intro', 'eating-style', 'first-meal', 'energy-crash', 'protein-sources', 'food-dislikes',
      'meals-cooked', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'payment', 'final-completion'
    ];
    const currentIndex = screens.indexOf(currentScreen);
    if (currentIndex === -1) return 0;
    return (currentIndex / (screens.length - 1)) * 100;
  };

  // Dev mode: Skip to plan with mock data
  const handleDevSkipToPlan = async () => {
    const mockData = {
      firstName: 'Dev',
      lastName: 'User',
      fullName: 'Dev User',
      age: '32',
      gender: 'female',
      weight: '145',
      weightUnit: 'lbs' as 'lbs' | 'kg',
      height: '5\'6"',
      email: 'dev-test@sage.local',
      mainPriority: 'longevity',
      drivingGoal: 'health',
      allergies: ['none'],
      otherAllergy: '',
      medications: 'None',
      supplements: 'Vitamin D, Magnesium',
      medicalConditions: ['none'],
      otherCondition: '',
      eatingStyle: 'intermittent-fasting',
      firstMeal: '9-11am',
      energyCrash: 'snack',
      proteinSources: ['chicken', 'fish-seafood', 'eggs'],
      otherProtein: '',
      foodDislikes: 'Brussels sprouts',
      mealsCooked: '10-12',
      alcoholConsumption: '1-2 drinks per week',
      integrations: ['apple-health'],
      timestamp: new Date().toISOString(),
      completed: true,
      hasLabFile: true, // Simulate that user uploaded a lab file
    };

    // Show loading screen
    setIsLoading(true);
    setLoadingProgress(0);

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + 5;
      });
    }, 200);

    try {
      // Submit mock data to onboarding API
      const response = await fetch('/api/sage-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockData),
      });

      if (!response.ok) {
        console.error('Failed to submit mock onboarding data');
        clearInterval(progressInterval);
        setIsLoading(false);
        return;
      }

      const result = await response.json();
      console.log('Mock onboarding data submitted successfully');

      // Get unique code and user's name
      const returnedUniqueCode = result.data?.uniqueCode;
      const userFirstName = mockData.fullName.split(' ')[0];

      // Store unique code in state and cookie for OAuth integrations
      if (returnedUniqueCode) {
        setUniqueCode(returnedUniqueCode);
        document.cookie = `user_code=${encodeURIComponent(returnedUniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      // Upload mock lab file first (simulating real user flow)
      const mockPdfContent = '%PDF-1.4\nMock lab results PDF for testing';
      const blob = new Blob([mockPdfContent], { type: 'application/pdf' });
      const mockLabFile = new File([blob], 'mock-lab-results.pdf', { type: 'application/pdf' });

      console.log('Uploading mock lab file...');
      const labFormData = new FormData();
      labFormData.append('bloodTest', mockLabFile);
      labFormData.append('email', mockData.email);

      try {
        await fetch('/api/analyze-blood-results', {
          method: 'POST',
          body: labFormData,
        });
        console.log('✅ Mock lab file uploaded');
      } catch (err) {
        console.error('Error uploading mock lab file:', err);
      }

      // Start plan generation
      console.log('Starting plan generation (this will take a few minutes)...');

      const planFormData = new FormData();
      planFormData.append('email', mockData.email);
      planFormData.append('uniqueCode', returnedUniqueCode);
      planFormData.append('fullName', userFirstName);

      // Start the async call (don't await yet)
      const planPromise = fetch('/api/generate-plan-async', {
        method: 'POST',
        body: planFormData,
      });

      // Mark that async generation has started - user can close window now
      setAsyncGenerationStarted(true);
      console.log('✅ Async generation started - safe to close window');

      // Now await the completion
      const planResponse = await planPromise;

      if (!planResponse.ok) {
        console.error('Plan generation failed');
        clearInterval(progressInterval);
        setIsLoading(false);
        setAsyncGenerationStarted(false);
        alert('Plan generation failed - please try again');
        return;
      }

      console.log('✅ Plan generation completed!');
      setLoadingProgress(100);

      // Redirect to plan page now that it's ready
      setTimeout(() => {
        clearInterval(progressInterval);
        setIsLoading(false);

        const redirectUrl = returnedUniqueCode
          ? `/sage/personalised-plan?code=${returnedUniqueCode}`
          : `/sage/personalised-plan?email=${encodeURIComponent(mockData.email)}`;

        window.location.href = redirectUrl;
      }, 500);

    } catch (error) {
      console.error('Error in dev skip:', error);
      clearInterval(progressInterval);
      setIsLoading(false);
      alert('Dev skip failed - check console');
    }
  };

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    fullName: '',
    age: '',
    gender: '',
    weight: '',
    weightUnit: 'lbs' as 'lbs' | 'kg',
    height: '',
    heightUnit: 'cm' as 'cm' | 'ft',
    heightFeet: '',
    heightInches: '',
    email: '',
    mainPriority: '',
    drivingGoal: '',
    allergies: [] as string[],
    otherAllergy: '',
    medications: '',
    supplements: '',
    medicalConditions: [] as string[],
    otherCondition: '',
    eatingStyle: '',
    firstMeal: '',
    energyCrash: '',
    proteinSources: [] as string[],
    otherProtein: '',
    foodDislikes: '',
    mealsCooked: '',
    alcoholConsumption: '',
    integrations: [] as string[],
    labFiles: [] as File[],
  });

  // Track onboarding progress
  useOnboardingTracker({
    product: 'sage',
    currentScreen,
    email: formData.email,
    fullName: formData.fullName,
  });

  // Auto-transition from intro to welcome when video ends
  useEffect(() => {
    if (currentScreen === 'intro') {
      const video = document.querySelector('.intro-video') as HTMLVideoElement;

      const handleVideoEnd = () => {
        setCurrentScreen('welcome');
      };

      if (video) {
        // Try to play with sound
        const playPromise = video.play();

        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Autoplay with sound failed, trying muted:', error);
            // If autoplay with sound fails, play muted
            video.muted = true;
            video.play().catch(e => console.error('Muted autoplay also failed:', e));
          });
        }

        video.addEventListener('ended', handleVideoEnd);
        return () => video.removeEventListener('ended', handleVideoEnd);
      }
    }
  }, [currentScreen]);

  // Clear cart when starting new onboarding flow
  useEffect(() => {
    const clearCartOnStart = async () => {
      const cookies = document.cookie.split(';');
      const emailCookie = cookies.find(c => c.trim().startsWith('gmail_email=') || c.trim().startsWith('user_email='));

      if (emailCookie) {
        const email = emailCookie.split('=')[1]?.trim();
        if (email) {
          try {
            await fetch('/api/cart/clear', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: decodeURIComponent(email) }),
            });
            console.log('[Sage Onboarding] Cart cleared for new plan generation');
          } catch (error) {
            console.error('[Sage Onboarding] Failed to clear cart:', error);
          }
        }
      }
    };

    clearCartOnStart();
  }, []); // Run once on mount

  // Check URL parameters for OAuth callback (mobile redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authProvider = params.get('auth');
    const success = params.get('success');

    if (authProvider && success === 'true') {
      // Handle successful OAuth redirect from mobile
      if (authProvider === 'strava') {
        setStravaConnected(true);
        setFormData(prev => ({
          ...prev,
          integrations: prev.integrations.includes('strava')
            ? prev.integrations
            : [...prev.integrations, 'strava']
        }));
      } else if (authProvider === 'fitbit') {
        setFitbitConnected(true);
        setFormData(prev => ({
          ...prev,
          integrations: prev.integrations.includes('fitbit')
            ? prev.integrations
            : [...prev.integrations, 'fitbit']
        }));
      } else if (authProvider === 'oura') {
        setOuraConnected(true);
        setFormData(prev => ({
          ...prev,
          integrations: prev.integrations.includes('oura')
            ? prev.integrations
            : [...prev.integrations, 'oura']
        }));
      }

      // Clean up URL parameters
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // NOTE: localStorage persistence removed - users start fresh each time they visit onboarding


  // NOTE: We intentionally do NOT auto-detect connector status from cookies here.
  // This prevents connectors from appearing "connected" when starting a new onboarding
  // after completing a different product's onboarding (e.g., Forge -> Sage).
  // Connectors should only show as connected when explicitly connected during THIS session.
  // The actual tokens remain stored and will be used when fetching data.

  // Show warning modal before connecting Gmail
  const handleConnectGmail = () => {
    setShowGoogleWarningModal(true);
  };

  // Actually proceed with Gmail connection after user acknowledges
  const proceedWithGmailConnection = async () => {
    setShowGoogleWarningModal(false);
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      const response = await fetch('/api/gmail/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
          data.authUrl,
          'gmail-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const cookies = document.cookie.split(';');
          const gmailEmailCookie = cookies.find(c => c.trim().startsWith('gmail_email='));

          if (gmailEmailCookie) {
            const email = gmailEmailCookie.split('=')[1];
            setGmailConnected(true);
            setGmailEmail(decodeURIComponent(email));
            // Add google-calendar to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('google-calendar')
                ? prev.integrations
                : [...prev.integrations, 'google-calendar']
            }));
            clearInterval(pollInterval);
          }
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err) {
      console.error('Error connecting Gmail:', err);
      alert('Failed to connect Gmail');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await fetch('/api/gmail/disconnect', { method: 'POST' });
      setGmailConnected(false);
      setGmailEmail('');
      // Remove google-calendar from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'google-calendar')
      }));
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
    }
  };

  const handleConnectSlack = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      const response = await fetch('/api/slack/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
          data.authUrl,
          'slack-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const cookies = document.cookie.split(';');
          const slackTeamCookie = cookies.find(c => c.trim().startsWith('slack_team='));

          if (slackTeamCookie) {
            const team = slackTeamCookie.split('=')[1];
            setSlackConnected(true);
            setSlackTeam(decodeURIComponent(team));
            // Add slack to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('slack')
                ? prev.integrations
                : [...prev.integrations, 'slack']
            }));
            clearInterval(pollInterval);
          }
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err) {
      console.error('Error connecting Slack:', err);
      alert('Failed to connect Slack');
    }
  };

  const handleDisconnectSlack = async () => {
    try {
      await fetch('/api/slack/disconnect', { method: 'POST' });
      setSlackConnected(false);
      setSlackTeam('');
      // Remove slack from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'slack')
      }));
    } catch (err) {
      console.error('Error disconnecting Slack:', err);
    }
  };

  const handleConnectAppleHealth = async () => {
    // Apple Health data can only be accessed via file upload
    // User needs to export from iPhone: Health app → Profile → Export All Health Data

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,.zip';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('healthData', file);
        formData.append('email', formData.get('email') as string || '');

        const response = await fetch('/api/apple-health/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          setAppleHealthConnected(true);
          setFormData(prev => ({
            ...prev,
            integrations: prev.integrations.includes('apple-health')
              ? prev.integrations
              : [...prev.integrations, 'apple-health']
          }));
          alert('Apple Health data uploaded successfully!');
        } else {
          const error = await response.json();
          alert(`Failed to upload: ${error.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Error uploading Apple Health data:', err);
        alert('Failed to upload Apple Health data');
      }
    };

    input.click();
  };

  const handleDisconnectAppleHealth = async () => {
    try {
      await fetch('/api/apple-health/disconnect', { method: 'POST' });
      setAppleHealthConnected(false);
      // Remove apple-health from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'apple-health')
      }));
    } catch (err) {
      console.error('Error disconnecting Apple Health:', err);
    }
  };

  const handleConnectAppleCalendar = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      const response = await fetch('/api/apple-calendar/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
          data.authUrl,
          'apple-calendar-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const cookies = document.cookie.split(';');
          const appleCalendarCookie = cookies.find(c => c.trim().startsWith('apple_calendar_connected='));

          if (appleCalendarCookie) {
            setAppleCalendarConnected(true);
            // Add apple-calendar to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('apple-calendar')
                ? prev.integrations
                : [...prev.integrations, 'apple-calendar']
            }));
            clearInterval(pollInterval);
          }
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err) {
      console.error('Error connecting Apple Calendar:', err);
      alert('Failed to connect Apple Calendar');
    }
  };

  const handleDisconnectAppleCalendar = async () => {
    try {
      await fetch('/api/apple-calendar/disconnect', { method: 'POST' });
      setAppleCalendarConnected(false);
      // Remove apple-calendar from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'apple-calendar')
      }));
    } catch (err) {
      console.error('Error disconnecting Apple Calendar:', err);
    }
  };

  const handleConnectOutlook = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      const response = await fetch('/api/outlook/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const popup = window.open(
          data.authUrl,
          'outlook-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Check if popup was blocked
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          alert('Popup was blocked. Please allow popups for this site and try again, or click OK to redirect to the authentication page.');
          window.location.href = data.authUrl;
          return;
        }

        // Listen for postMessage from the popup
        const handleMessage = (event: MessageEvent) => {
          // Verify origin for security
          if (event.origin !== window.location.origin) return;

          if (event.data.type === 'outlook_connected') {
            const email = event.data.email;
            setOutlookConnected(true);
            setOutlookEmail(email);
            // Add outlook to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('outlook')
                ? prev.integrations
                : [...prev.integrations, 'outlook']
            }));
            // Remove listener after successful connection
            window.removeEventListener('message', handleMessage);
          }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup listener after 5 minutes (timeout)
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
        }, 300000);
      }
    } catch (err) {
      console.error('Error connecting Outlook:', err);
      alert('Failed to connect Outlook');
    }
  };

  const handleDisconnectOutlook = async () => {
    try {
      await fetch('/api/outlook/disconnect', { method: 'POST' });
      setOutlookConnected(false);
      setOutlookEmail('');
      // Remove outlook from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'outlook')
      }));
    } catch (err) {
      console.error('Error disconnecting Outlook:', err);
    }
  };

  const handleConnectOura = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      // Include return path and code in state for mobile redirects
      const state = encodeURIComponent(JSON.stringify({ returnPath: '/sage/onboarding', code: uniqueCode || undefined }));
      const response = await fetch(`/api/oura/auth?state=${state}`);
      const data = await response.json();

      if (data.authUrl) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
          // Mobile redirect - user will need to reconnect if they leave
          window.location.href = data.authUrl;
        } else {
          const width = 600;
          const height = 700;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;

          window.open(
            data.authUrl,
            'oura-auth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
          );

          // Poll for connection status
          const pollInterval = setInterval(async () => {
            const cookies = document.cookie.split(';');
            const ouraUserIdCookie = cookies.find(c => c.trim().startsWith('oura_user_id='));

            if (ouraUserIdCookie) {
              setOuraConnected(true);
              // Add oura-ring to integrations if not already present
              setFormData(prev => ({
                ...prev,
                integrations: prev.integrations.includes('oura-ring')
                  ? prev.integrations
                  : [...prev.integrations, 'oura-ring']
              }));
              clearInterval(pollInterval);
            }
          }, 1000);

          // Stop polling after 5 minutes
          setTimeout(() => clearInterval(pollInterval), 300000);
        }
      }
    } catch (err) {
      console.error('Error connecting Oura:', err);
      alert('Failed to connect Oura Ring');
    }
  };

  const handleDisconnectOura = async () => {
    try {
      await fetch('/api/oura/disconnect', { method: 'POST' });
      setOuraConnected(false);
      // Remove oura-ring from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'oura-ring')
      }));
    } catch (err) {
      console.error('Error disconnecting Oura:', err);
    }
  };

  const handleConnectDexcom = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      const response = await fetch('/api/dexcom/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
          data.authUrl,
          'dexcom-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const cookies = document.cookie.split(';');
          const dexcomConnectedCookie = cookies.find(c => c.trim().startsWith('dexcom_connected='));

          if (dexcomConnectedCookie) {
            setDexcomConnected(true);
            // Add dexcom to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('dexcom')
                ? prev.integrations
                : [...prev.integrations, 'dexcom']
            }));
            clearInterval(pollInterval);
          }
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err) {
      console.error('Error connecting Dexcom:', err);
      alert('Failed to connect Dexcom CGM');
    }
  };

  const handleDisconnectDexcom = async () => {
    try {
      await fetch('/api/dexcom/disconnect', { method: 'POST' });
      setDexcomConnected(false);
      // Remove dexcom from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'dexcom')
      }));
    } catch (err) {
      console.error('Error disconnecting Dexcom:', err);
    }
  };

  const handleConnectFitbit = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      // Include return path and code in state for mobile redirects
      const state = encodeURIComponent(JSON.stringify({ returnPath: '/sage/onboarding', code: uniqueCode || undefined }));
      const response = await fetch(`/api/fitbit/auth?state=${state}`);
      const data = await response.json();

      if (data.authUrl) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
          // Mobile redirect - user will need to reconnect if they leave
          window.location.href = data.authUrl;
        } else {
          const width = 600;
          const height = 700;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;

          window.open(
            data.authUrl,
            'fitbit-auth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
          );

          const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'fitbit-connected') {
              setFitbitConnected(true);
              setFormData(prev => ({
                ...prev,
                integrations: [...prev.integrations, 'fitbit']
              }));
              window.removeEventListener('message', handleMessage);
            }
          };

          window.addEventListener('message', handleMessage);
        }
      }
    } catch (err) {
      console.error('Error connecting to Fitbit:', err);
    }
  };

  const handleDisconnectFitbit = async () => {
    try {
      await fetch('/api/fitbit/disconnect', { method: 'POST' });
      setFitbitConnected(false);
      // Remove fitbit from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'fitbit')
      }));
    } catch (err) {
      console.error('Error disconnecting Fitbit:', err);
    }
  };

  const handleConnectStrava = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      // Include return path and code in state for mobile redirects
      const state = encodeURIComponent(JSON.stringify({ returnPath: '/sage/onboarding', code: uniqueCode || undefined }));
      const response = await fetch(`/api/strava/auth?state=${state}`);
      const data = await response.json();

      if (data.authUrl) {
        // Detect if mobile Safari or any mobile browser
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
          // Mobile redirect - user will need to reconnect if they leave
          window.location.href = data.authUrl;
        } else {
          // Desktop: Open in popup window
          const width = 600;
          const height = 700;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;

          window.open(
            data.authUrl,
            'strava-auth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
          );

          // Listen for messages from popup
          const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'strava-connected') {
              setStravaConnected(true);
              setFormData(prev => ({
                ...prev,
                integrations: [...prev.integrations, 'strava']
              }));
              window.removeEventListener('message', handleMessage);
            }
          };

          window.addEventListener('message', handleMessage);
        }
      }
    } catch (err) {
      console.error('Error connecting to Strava:', err);
    }
  };

  const handleDisconnectStrava = async () => {
    try {
      await fetch('/api/strava/disconnect', { method: 'POST' });
      setStravaConnected(false);
      // Remove strava from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'strava')
      }));
    } catch (err) {
      console.error('Error disconnecting Strava:', err);
    }
  };

  const handleConnectWhoop = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      // Include return path, email, and code in state for the callback
      const state = encodeURIComponent(JSON.stringify({
        returnPath: '/sage/onboarding',
        email: formData.email,
        code: uniqueCode || undefined
      }));
      const response = await fetch(`/api/whoop/auth?state=${state}`);
      const data = await response.json();

      if (data.authUrl) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
          // Mobile redirect - user will need to reconnect if they leave
          window.location.href = data.authUrl;
        } else {
          // Open in a new window
          const width = 600;
          const height = 700;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;

          window.open(
            data.authUrl,
            'whoop-auth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
          );

          // Listen for messages from popup
          const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'whoop-connected') {
              console.log('[Whoop] Connection confirmed via message');
              setWhoopConnected(true);
              setFormData(prev => ({
                ...prev,
                integrations: prev.integrations.includes('whoop')
                  ? prev.integrations
                  : [...prev.integrations, 'whoop']
              }));
              window.removeEventListener('message', handleMessage);
            } else if (event.data.type === 'whoop-error') {
              console.error('[Whoop] Connection failed');
              window.removeEventListener('message', handleMessage);
            }
          };

          window.addEventListener('message', handleMessage);
        }
      }
    } catch (err) {
      console.error('Error connecting to Whoop:', err);
    }
  };

  const handleDisconnectWhoop = async () => {
    try {
      await fetch('/api/whoop/disconnect', { method: 'POST' });
      setWhoopConnected(false);
      // Remove whoop from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'whoop')
      }));
    } catch (err) {
      console.error('Error disconnecting Whoop:', err);
    }
  };

  const handleConnectVital = async () => {
    try {
      console.log('[Vital] Starting connection...');

      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      // Generate a unique user ID for Vital (using email as base)
      const userId = formData.email || `user_${Date.now()}`;
      console.log('[Vital] User ID:', userId);

      // Get link token from Vital
      const response = await fetch('/api/vital/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      console.log('[Vital] API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Vital] API error:', errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[Vital] API response data:', data);

      if (data.linkToken) {
        // Open Vital Link Widget
        const linkUrl = data.environment === 'sandbox'
          ? `https://sandbox.link.tryvital.io/${data.linkToken}`
          : `https://link.tryvital.io/${data.linkToken}`;
        console.log('[Vital] Opening link URL:', linkUrl);

        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const popup = window.open(
          linkUrl,
          'vital-link',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        if (!popup) {
          alert('Please allow popups for this site to connect Vital');
          return;
        }

        // Store userId for later use
        setVitalUserId(userId);

        // Listen for messages from popup
        window.addEventListener('message', (event) => {
          if (event.data.type === 'vital-connected') {
            console.log('[Vital] Connection confirmed via message');
            setVitalConnected(true);
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('vital')
                ? prev.integrations
                : [...prev.integrations, 'vital']
            }));
          }
        });

        // For demo purposes, mark as connected after opening
        // In production, you'd use webhooks to confirm connection
        setTimeout(() => {
          console.log('[Vital] Auto-marking as connected');
          setVitalConnected(true);
          setFormData(prev => ({
            ...prev,
            integrations: prev.integrations.includes('vital')
              ? prev.integrations
              : [...prev.integrations, 'vital']
          }));
        }, 3000);
      } else {
        throw new Error('No link token received from API');
      }
    } catch (err) {
      console.error('[Vital] Error connecting:', err);
      alert(`Failed to connect Vital: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDisconnectVital = async () => {
    try {
      await fetch('/api/vital/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: vitalUserId }),
      });
      setVitalConnected(false);
      setVitalUserId('');
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'vital')
      }));
    } catch (err) {
      console.error('Error disconnecting Vital:', err);
    }
  };

  const handleConnectTeams = async () => {
    try {
      // Set user_email and user_code cookies so the callback can store the token
      if (formData.email) {
        document.cookie = `user_email=${encodeURIComponent(formData.email)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }
      if (uniqueCode) {
        document.cookie = `user_code=${encodeURIComponent(uniqueCode)}; path=/; max-age=${60 * 60 * 24 * 30}`;
      }

      const response = await fetch('/api/teams/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const popup = window.open(
          data.authUrl,
          'teams-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Check if popup was blocked
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          alert('Popup was blocked. Please allow popups for this site and try again, or click OK to redirect to the authentication page.');
          window.location.href = data.authUrl;
          return;
        }

        // Listen for postMessage from the popup
        const handleMessage = (event: MessageEvent) => {
          // Verify origin for security
          if (event.origin !== window.location.origin) return;

          if (event.data.type === 'teams_connected') {
            const email = event.data.email;
            setTeamsConnected(true);
            setTeamsEmail(email);
            // Add teams to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('teams')
                ? prev.integrations
                : [...prev.integrations, 'teams']
            }));
            // Remove listener after successful connection
            window.removeEventListener('message', handleMessage);
          }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup listener after 5 minutes (timeout)
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
        }, 300000);
      }
    } catch (err) {
      console.error('Error connecting Teams:', err);
      alert('Failed to connect Microsoft Teams');
    }
  };

  const handleDisconnectTeams = async () => {
    try {
      await fetch('/api/teams/disconnect', { method: 'POST' });
      setTeamsConnected(false);
      setTeamsEmail('');
      // Remove teams from integrations
      setFormData(prev => ({
        ...prev,
        integrations: prev.integrations.filter(i => i !== 'teams')
      }));
    } catch (err) {
      console.error('Error disconnecting Teams:', err);
    }
  };

  const handleOpenUploadModal = (type: 'oura-ring' | 'whoop' | 'cgm' | 'flo') => {
    setUploadModalType(type);
    setUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    setUploadModalOpen(false);
    setUploadModalType(null);
  };

  const handleFileUpload = async (file: File) => {
    if (!uploadModalType) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadModalType);

      const response = await fetch('/api/health-data/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();

        // Add to integrations
        setFormData(prev => ({
          ...prev,
          integrations: prev.integrations.includes(uploadModalType)
            ? prev.integrations
            : [...prev.integrations, uploadModalType]
        }));

        // Show analysis results
        if (result.analysis) {
          const insights = result.analysis.insights?.join('\n• ') || 'Data analyzed successfully';
          const metrics = result.analysis.metrics ?
            Object.entries(result.analysis.metrics)
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n') : '';

          alert(`Upload successful!\n\nAnalysis:\n${metrics}\n\nInsights:\n• ${insights}`);
        } else {
          alert('Data uploaded and analyzed successfully!');
        }

        handleCloseUploadModal();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingFile(false);
    }
  };

  const [clickingGetStarted, setClickingGetStarted] = useState(false);

  const handleGetStarted = () => {
    setClickingGetStarted(true);
    setTimeout(() => {
      setClickingGetStarted(false);
      setCurrentScreen('name');
    }, 400);
  };

  const [clickingOption, setClickingOption] = useState<string | null>(null);

  const handleInputChange = (field: keyof typeof formData, value: string | string[] | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle option click with Typeform-style flicker animation
  const handleOptionClick = (field: keyof typeof formData, value: string, optionKey: string) => {
    // Trigger the clicking animation
    setClickingOption(optionKey);

    // Update the form data
    handleInputChange(field, value);

    // Remove the clicking class after animation completes
    setTimeout(() => {
      setClickingOption(null);
    }, 400);
  };

  // Handler for multi-file lab upload
  const handleLabFilesChange = (files: File[]) => {
    setFormData(prev => ({ ...prev, labFiles: files, hasLabFile: files.length > 0 }));
    console.log('Lab files updated:', files.map(f => f.name).join(', '), '| hasLabFile:', files.length > 0);
  };

  const toggleArrayValue = (field: 'allergies' | 'medicalConditions' | 'proteinSources' | 'integrations', value: string) => {
    setFormData(prev => {
      const currentArray = prev[field];

      // Handle "none" option logic
      if (value === 'none') {
        // If "none" is being selected, clear all other options and only keep "none"
        if (currentArray.includes('none')) {
          // If "none" is already selected, uncheck it
          return { ...prev, [field]: [] };
        } else {
          // Select only "none", clear all other options
          return { ...prev, [field]: ['none'] };
        }
      } else {
        // If any other option is being selected, remove "none" if it's present
        let newArray;
        if (currentArray.includes(value)) {
          // Uncheck the current value
          newArray = currentArray.filter((v: string) => v !== value);
        } else {
          // Check the current value and remove "none" if present
          newArray = [...currentArray.filter((v: string) => v !== 'none'), value];
        }
        return { ...prev, [field]: newArray };
      }
    });
  };

  // Toggle array value with clicking animation
  const handleCheckboxClick = (field: 'allergies' | 'medicalConditions' | 'proteinSources' | 'integrations', value: string, optionKey: string) => {
    setClickingOption(optionKey);
    toggleArrayValue(field, value);
    setTimeout(() => {
      setClickingOption(null);
    }, 400);
  };

  const handleContinue = (nextScreen: Screen) => {
    setCurrentScreen(nextScreen);
  };

  const handleKeyPress = (e: React.KeyboardEvent, nextScreen: Screen, isDisabled: boolean) => {
    if (e.key === 'Enter' && !isDisabled) {
      handleContinue(nextScreen);
    }
  };

  // Global keyboard navigation handler for all screens
  useEffect(() => {
    const handleGlobalKeyboard = (e: KeyboardEvent) => {
      // Handle Enter key or Right Arrow for forward navigation
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        // Don't handle if typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          // Allow Enter to work normally in text inputs
          return;
        }

      // Determine next screen and if Continue is disabled based on current screen
      let nextScreen: Screen | null = null;
      let isDisabled = false;

      // Check validation for each screen
      switch (currentScreen) {
        case 'name':
          isDisabled = !formData.fullName?.trim();
          nextScreen = 'age';
          break;
        case 'age':
          isDisabled = !formData.age || parseInt(formData.age) < 18 || parseInt(formData.age) > 120;
          nextScreen = 'gender';
          break;
        case 'gender':
          isDisabled = !formData.gender;
          nextScreen = 'weight';
          break;
        case 'weight':
          isDisabled = !formData.weight;
          nextScreen = 'height';
          break;
        case 'height':
          isDisabled = !formData.height;
          nextScreen = 'email';
          break;
        case 'email':
          isDisabled = !formData.email?.includes('@');
          nextScreen = 'ikigai-intro';
          break;
        case 'main-priority':
          isDisabled = !formData.mainPriority;
          nextScreen = 'driving-goal';
          break;
        case 'driving-goal':
          isDisabled = !formData.drivingGoal;
          nextScreen = 'baseline-intro';
          break;
        case 'eating-style':
          isDisabled = !formData.eatingStyle;
          nextScreen = 'first-meal';
          break;
        case 'first-meal':
          isDisabled = !formData.firstMeal;
          nextScreen = 'energy-crash';
          break;
        case 'energy-crash':
          isDisabled = !formData.energyCrash;
          nextScreen = 'protein-sources';
          break;
        // Intro screens don't need validation
        case 'intro':
          nextScreen = 'welcome';
          break;
        case 'welcome':
          nextScreen = 'name';
          break;
        case 'ikigai-intro':
          nextScreen = 'main-priority';
          break;
        case 'baseline-intro':
          nextScreen = 'allergies';
          break;
        case 'fuel-intro':
          nextScreen = 'eating-style';
          break;
        case 'final-step-intro':
          nextScreen = 'ecosystem-integration';
          break;
        // Multi-select screens can always continue
        case 'allergies':
          nextScreen = 'medications';
          break;
        case 'medications':
          nextScreen = 'supplements';
          break;
        case 'supplements':
          nextScreen = 'medical-conditions';
          break;
        case 'medical-conditions':
          nextScreen = 'fuel-intro';
          break;
        case 'protein-sources':
          nextScreen = 'food-dislikes';
          break;
        case 'food-dislikes':
          nextScreen = 'meals-cooked';
          break;
        case 'meals-cooked':
          nextScreen = 'completion';
          break;
        case 'completion':
          nextScreen = 'final-step-intro';
          break;
        case 'ecosystem-integration':
          nextScreen = 'lab-upload';
          break;
        case 'lab-upload':
          nextScreen = 'payment';
          break;
        // Payment screen should not auto-advance
        case 'payment':
          return;
        default:
          return;
      }

      if (nextScreen && !isDisabled) {
        e.preventDefault();
        handleContinue(nextScreen);
      }
      }

      // Handle Left Arrow for backward navigation
      if (e.key === 'ArrowLeft') {
        const currentIndex = screenOrder.indexOf(currentScreen);
        if (currentIndex > 0) {
          e.preventDefault();
          setCurrentScreen(screenOrder[currentIndex - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyboard);
    return () => window.removeEventListener('keydown', handleGlobalKeyboard);
  }, [currentScreen, formData]);

  // Screen order for navigation
  const screenOrder: Screen[] = [
    'intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
    'email', 'ikigai-intro', 'main-priority', 'driving-goal',
    'baseline-intro', 'allergies', 'medications', 'supplements', 'medical-conditions',
    'fuel-intro', 'eating-style', 'first-meal', 'energy-crash', 'protein-sources', 'food-dislikes',
    'meals-cooked', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'payment', 'final-completion'
  ];

  const handleBack = () => {
    const currentIndex = screenOrder.indexOf(currentScreen);
    if (currentIndex > 1) {
      setCurrentScreen(screenOrder[currentIndex - 1]);
    }
  };

  const handleForward = () => {
    const currentIndex = screenOrder.indexOf(currentScreen);
    if (currentIndex < screenOrder.length - 1) {
      setCurrentScreen(screenOrder[currentIndex + 1]);
    }
  };

  const canGoBack = () => {
    const currentIndex = screenOrder.indexOf(currentScreen);
    return currentIndex > 1;
  };

  const isContinueDisabled = (): boolean => {
    switch (currentScreen) {
      case 'name':
        return !formData.fullName?.trim();
      case 'age':
        return !formData.age || parseInt(formData.age) < 18 || parseInt(formData.age) > 120;
      case 'gender':
        return !formData.gender;
      case 'weight':
        return !formData.weight;
      case 'height':
        return !formData.height;
      case 'email':
        return !formData.email?.includes('@');
      case 'main-priority':
        return !formData.mainPriority;
      case 'driving-goal':
        return !formData.drivingGoal;
      case 'eating-style':
        return !formData.eatingStyle;
      case 'first-meal':
        return !formData.firstMeal;
      case 'energy-crash':
        return !formData.energyCrash;
      default:
        return false;
    }
  };

  const canGoForward = () => {
    const currentIndex = screenOrder.indexOf(currentScreen);
    return currentIndex < screenOrder.length - 1 && currentIndex >= 0 && !isContinueDisabled();
  };

  const handleSubmit = async () => {
    const onboardingData = {
      ...formData,
      timestamp: new Date().toISOString(),
      completed: true
    };

    // Show loading screen
    setIsLoading(true);
    setLoadingProgress(0);

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + 5;
      });
    }, 200);

    try {
      // Submit onboarding data
      const response = await fetch('/api/sage-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingData),
      });

      if (!response.ok) {
        console.error('Failed to submit onboarding data');
        clearInterval(progressInterval);
        setIsLoading(false);
        return;
      }

      const result = await response.json();
      console.log('Onboarding data submitted successfully');

      // Get unique code and user's name
      const uniqueCode = result.data?.uniqueCode;
      const userFirstName = formData.fullName.split(' ')[0];

      // If lab files uploaded, analyze them first
      // Blood analysis completion will trigger plan generation automatically
      const hasLabFiles = formData.labFiles.length > 0;

      if (hasLabFiles) {
        console.log(`Uploading and analyzing ${formData.labFiles.length} lab file(s)...`);
        const labFormData = new FormData();

        // Append all lab files
        formData.labFiles.forEach((file) => {
          labFormData.append('bloodTests', file);
        });
        labFormData.append('email', formData.email);

        try {
          await fetch('/api/analyze-blood-results', {
            method: 'POST',
            body: labFormData,
          });
          console.log('✅ Lab file analysis queued - plan generation will start when analysis completes');
        } catch (err) {
          console.error('Error analyzing lab files:', err);
          // Continue anyway - will queue plan without blood data
        }
      }

      // Only queue plan generation immediately if NO lab files were uploaded
      // If lab files exist, the blood analysis completion webhook will trigger plan generation
      if (!hasLabFiles) {
        console.log('Queueing plan generation (no lab files)...');

        const planFormData = new FormData();
        planFormData.append('email', formData.email);
        planFormData.append('uniqueCode', uniqueCode);
        planFormData.append('fullName', userFirstName);

        const planResponse = await fetch('/api/generate-plan-async', {
          method: 'POST',
          body: planFormData,
        });

        if (!planResponse.ok) {
          console.error('Failed to queue plan generation');
          clearInterval(progressInterval);
          setIsLoading(false);
          alert('Failed to queue plan generation - please try again');
          return;
        }

        const planResult = await planResponse.json();
        console.log('✅ Plan generation queued:', planResult.message);
      } else {
        console.log('✅ Plan will be generated after blood analysis completes');
      }
      setLoadingProgress(100);

      // Show success message - user will receive email when plan is ready
      setTimeout(() => {
        clearInterval(progressInterval);
        setIsLoading(false);

        // Move to a confirmation screen instead of redirecting
        setCurrentScreen('final-completion');
      }, 500);
    } catch (error) {
      console.error('Error submitting onboarding data:', error);
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding-container">
      {/* Progress Bar - Hidden on intro, welcome, and loading screens */}
      {!['intro', 'welcome'].includes(currentScreen) && !isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          zIndex: 9999
        }}>
          <div style={{
            height: '100%',
            width: `${calculateProgress()}%`,
            backgroundColor: '#2d3a2d',
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      {/* Fixed Navigation Arrows - Bottom Right */}
      {!['intro', 'welcome', 'final-completion'].includes(currentScreen) && !isLoading && (
        <div style={{
          position: 'fixed',
          bottom: 'clamp(16px, 4vw, 30px)',
          right: 'clamp(16px, 4vw, 30px)',
          display: 'flex',
          flexDirection: 'row',
          gap: 'clamp(8px, 2vw, 10px)',
          zIndex: 9999
        }}>
          <button
            onClick={handleBack}
            disabled={!canGoBack()}
            style={{
              width: 'clamp(44px, 12vw, 48px)',
              height: 'clamp(44px, 12vw, 48px)',
              minWidth: '44px',
              minHeight: '44px',
              border: 'none',
              background: 'transparent',
              color: canGoBack() ? '#2d3a2d' : '#cccccc',
              cursor: canGoBack() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(24px, 6vw, 28px)',
              transition: 'all 0.2s ease',
              opacity: canGoBack() ? 1 : 0.3,
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
            onMouseEnter={(e) => {
              if (canGoBack() && window.innerWidth > 768) {
                e.currentTarget.style.transform = 'scale(1.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (canGoBack() && window.innerWidth > 768) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
            onTouchStart={(e) => {
              if (canGoBack()) {
                e.currentTarget.style.transform = 'scale(0.9)';
              }
            }}
            onTouchEnd={(e) => {
              if (canGoBack()) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            ←
          </button>
          <button
            onClick={handleForward}
            disabled={!canGoForward()}
            style={{
              width: 'clamp(44px, 12vw, 48px)',
              height: 'clamp(44px, 12vw, 48px)',
              minWidth: '44px',
              minHeight: '44px',
              border: 'none',
              background: 'transparent',
              color: canGoForward() ? '#2d3a2d' : '#cccccc',
              cursor: canGoForward() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(24px, 6vw, 28px)',
              transition: 'all 0.2s ease',
              opacity: canGoForward() ? 1 : 0.3,
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
            onMouseEnter={(e) => {
              if (canGoForward() && window.innerWidth > 768) {
                e.currentTarget.style.transform = 'scale(1.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (canGoForward() && window.innerWidth > 768) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
            onTouchStart={(e) => {
              if (canGoForward()) {
                e.currentTarget.style.transform = 'scale(0.9)';
              }
            }}
            onTouchEnd={(e) => {
              if (canGoForward()) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            →
          </button>
        </div>
      )}

      {/* Intro Screen */}
      <div className={`intro-screen ${currentScreen === 'intro' ? 'active' : 'hidden'}`}>
        <video
          ref={introVideoRef}
          playsInline
          autoPlay
          muted
          className="intro-video"
          preload="auto"
        >
          <source src="/videos/sage.mp4" type="video/mp4" />
        </video>
        <button
          className="video-sound-toggle"
          onClick={toggleIntroSound}
          aria-label={introVideoMuted ? 'Unmute video' : 'Mute video'}
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '30px',
            background: 'rgba(0, 0, 0, 0.5)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
            zIndex: 10
          }}
        >
          {introVideoMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
        <button
          className="skip-intro-button"
          onClick={() => {
            if (introVideoRef.current) {
              introVideoRef.current.pause();
              introVideoRef.current.muted = true;
            }
            setCurrentScreen('welcome');
          }}
          aria-label="Skip intro video"
        >
          Skip
        </button>
      </div>

      {/* Welcome Screen */}
      <div className={`welcome-screen ${currentScreen === 'welcome' ? 'active' : 'hidden'}`}>
        <div className="welcome-content">
          <h1 className="welcome-title">Welcome to sage.</h1>
          <p className="welcome-subtitle">
            Your health is more than just food.<br />
            sage builds nutrition intelligence from your unique biology.
          </p>
          <button className={`welcome-button ${clickingGetStarted ? 'clicking' : ''}`} onClick={handleGetStarted}>
            <span>Let&apos;s get started</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="arrow-icon">
              <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Dev Mode Button */}
          {process.env.NODE_ENV === 'development' && (
            <button
              className="dev-skip-button"
              onClick={handleDevSkipToPlan}
              style={{
                marginTop: '20px',
                padding: '10px 24px',
                background: '#ff6b6b',
                color: '#fff',
                border: '2px solid #ff5252',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#ff5252'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#ff6b6b'}
            >
              🚀 DEV: Skip to Plan
            </button>
          )}

          <div className="welcome-brand">sage</div>
        </div>
      </div>

      {/* Name Screen */}
      <div className={`typeform-screen ${currentScreen === 'name' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What is your name?</h1>
          <p className="typeform-subtitle">We&apos;ll use this to personalize your sage experience and keep your profile secure.</p>
          <div className="input-container" style={{ marginBottom: '16px' }}>
            <input
              type="text"
              className="typeform-input"
              placeholder="First name"
              value={formData.firstName}
              onChange={(e) => {
                handleInputChange('firstName', e.target.value);
                setFormData(prev => ({ ...prev, fullName: `${e.target.value} ${prev.lastName}`.trim() }));
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && formData.firstName.trim() && formData.lastName.trim()) {
                  handleContinue('age');
                }
              }}
              autoFocus
            />
            <svg className={`microphone-icon ${isListening && activeField === 'firstName' ? 'listening' : ''}`} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={() => startDictation('firstName')} style={{cursor: 'pointer'}}>
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="input-container">
            <input
              type="text"
              className="typeform-input"
              placeholder="Last name"
              value={formData.lastName}
              onChange={(e) => {
                handleInputChange('lastName', e.target.value);
                setFormData(prev => ({ ...prev, fullName: `${prev.firstName} ${e.target.value}`.trim() }));
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && formData.firstName.trim() && formData.lastName.trim()) {
                  handleContinue('age');
                }
              }}
            />
            <svg className={`microphone-icon ${isListening && activeField === 'lastName' ? 'listening' : ''}`} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={() => startDictation('lastName')} style={{cursor: 'pointer'}}>
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button
              className="typeform-button"
              onClick={() => handleContinue('age')}
              disabled={!formData.firstName.trim() || !formData.lastName.trim()}
            >
              Continue
            </button>
            <span className="enter-hint">press <strong>Enter</strong> ↵</span>

          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Age Screen */}
      <div className={`typeform-screen ${currentScreen === 'age' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">How old are you?</h1>
          <p className="typeform-subtitle">Your age helps us tailor nutritional recommendations to your life stage.</p>
          <div className="input-container">
            <input type="number" className="typeform-input" placeholder="Type your answer here" value={formData.age} onChange={(e) => handleInputChange('age', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'gender', !formData.age.trim())} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('gender')} disabled={!formData.age.trim()}>Continue</button>
            <span className="enter-hint">press <strong>Enter</strong> ↵</span>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Gender Screen */}
      <div className={`typeform-screen ${currentScreen === 'gender' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What is your gender identity?</h1>
          <p className="typeform-subtitle">Understanding your biology helps us provide more accurate nutritional guidance.</p>
          <div className="options-container">
            {['male', 'female', 'non-binary', 'prefer-not-to-say'].map((option) => (
              <button
                key={option}
                className={`option-button ${formData.gender === option ? 'selected' : ''} ${clickingOption === `gender-${option}` ? 'clicking' : ''}`}
                onClick={() => handleOptionClick('gender', option, `gender-${option}`)}
              >
                {option === 'male' && 'Male'}
                {option === 'female' && 'Female'}
                {option === 'non-binary' && 'Non-Binary'}
                {option === 'prefer-not-to-say' && 'Prefer not to say'}
              </button>
            ))}
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('weight')} disabled={!formData.gender}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Weight Screen */}
      <div className={`typeform-screen ${currentScreen === 'weight' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What is your current weight?</h1>
          <p className="typeform-subtitle">Please enter your weight, this helps us calculate your nutritional needs.</p>
          <div className="input-with-unit-container">
            <div className="input-container">
              <input
                type="number"
                className="typeform-input"
                placeholder="Type your answer here"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, 'height', !formData.weight.trim())}
                autoFocus
              />
              <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <select
              className="unit-dropdown"
              value={formData.weightUnit}
              onChange={(e) => handleInputChange('weightUnit', e.target.value as 'lbs' | 'kg')}
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('height')} disabled={!formData.weight.trim()}>Continue</button>
            <span className="enter-hint">press <strong>Enter</strong> ↵</span>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Height Screen */}
      <div className={`typeform-screen ${currentScreen === 'height' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What is your height?</h1>
          <p className="typeform-subtitle">Please enter your height, this helps us create your personalized plan.</p>

          {/* Unit Toggle */}
          <div className="height-unit-toggle">
            <button
              className={`toggle-option ${formData.heightUnit === 'cm' ? 'active' : ''}`}
              onClick={() => handleInputChange('heightUnit', 'cm')}
              type="button"
            >
              cm
            </button>
            <button
              className={`toggle-option ${formData.heightUnit === 'ft' ? 'active' : ''}`}
              onClick={() => handleInputChange('heightUnit', 'ft')}
              type="button"
            >
              ft/in
            </button>
          </div>

          {/* Conditional Input Based on Unit */}
          {formData.heightUnit === 'cm' ? (
            <div className="input-with-unit-container">
              <div className="input-container">
                <input
                  type="number"
                  className="typeform-input"
                  placeholder="Type your answer here"
                  value={formData.height}
                  onChange={(e) => handleInputChange('height', e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 'email', !formData.height.trim())}
                  autoFocus
                />
                <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="unit-label">cm</div>
            </div>
          ) : (
            <div className="height-ft-in-container">
              <div className="input-with-unit-container">
                <div className="input-container">
                  <input
                    type="number"
                    className="typeform-input"
                    placeholder="Feet"
                    value={formData.heightFeet}
                    onChange={(e) => handleInputChange('heightFeet', e.target.value)}
                    autoFocus
                  />
                  <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="unit-label">ft</div>
              </div>
              <div className="input-with-unit-container">
                <div className="input-container">
                  <input
                    type="number"
                    className="typeform-input"
                    placeholder="Inches"
                    value={formData.heightInches}
                    onChange={(e) => handleInputChange('heightInches', e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, 'email', !formData.heightFeet.trim() && !formData.heightInches.trim())}
                  />
                  <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="unit-label">in</div>
              </div>
            </div>
          )}

          <div className="button-container">
            <button
              className="typeform-button"
              onClick={() => handleContinue('email')}
              disabled={formData.heightUnit === 'cm' ? !formData.height.trim() : !formData.heightFeet.trim() && !formData.heightInches.trim()}
            >
              Continue
            </button>
            <span className="enter-hint">press <strong>Enter</strong> ↵</span>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Email Screen */}
      <div className={`typeform-screen ${currentScreen === 'email' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">Tell us the email for results and updates.</h1>
          <p className="typeform-subtitle">We&apos;ll send your personalized sage nutrition plan and helpful tips to this email. We respect your privacy.</p>
          <div className="input-container">
            <input type="email" className="typeform-input" placeholder="name@example.com" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'ikigai-intro', !formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))} autoFocus />
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('ikigai-intro')} disabled={!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)}>Continue</button>
            <span className="enter-hint">press <strong>Enter</strong> ↵</span>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Section 1: The Ikigai - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'ikigai-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">1 The Ikigai</h1>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('main-priority')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Main Priority Screen */}
      <div className={`typeform-screen ${currentScreen === 'main-priority' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">1 The Ikigai</p>
          <h1 className="typeform-title">What is your main priority?</h1>
          <div className="options-container">
            <button className={`option-button with-subtitle ${formData.mainPriority === 'longevity' ? 'selected' : ''} ${clickingOption === 'mainPriority-longevity' ? 'clicking' : ''}`} onClick={() => handleOptionClick('mainPriority', 'longevity', 'mainPriority-longevity')}>
              <div className="option-main">Longevity and Aging</div>
              <div className="option-sub">Preventing disease & increasing long-term health</div>
            </button>
            <button className={`option-button with-subtitle ${formData.mainPriority === 'cognitive' ? 'selected' : ''} ${clickingOption === 'mainPriority-cognitive' ? 'clicking' : ''}`} onClick={() => handleOptionClick('mainPriority', 'cognitive', 'mainPriority-cognitive')}>
              <div className="option-main">Cognitive Performance</div>
              <div className="option-sub">Better focus & mental clarity</div>
            </button>
            <button className={`option-button with-subtitle ${formData.mainPriority === 'physical' ? 'selected' : ''} ${clickingOption === 'mainPriority-physical' ? 'clicking' : ''}`} onClick={() => handleOptionClick('mainPriority', 'physical', 'mainPriority-physical')}>
              <div className="option-main">Physical performance</div>
              <div className="option-sub">More stamina & less fatigue</div>
            </button>
            <button className={`option-button with-subtitle ${formData.mainPriority === 'body-composition' ? 'selected' : ''} ${clickingOption === 'mainPriority-body-composition' ? 'clicking' : ''}`} onClick={() => handleOptionClick('mainPriority', 'body-composition', 'mainPriority-body-composition')}>
              <div className="option-main">Body composition</div>
              <div className="option-sub">Losing fat & building muscle</div>
            </button>
            <button className={`option-button with-subtitle ${formData.mainPriority === 'emotional' ? 'selected' : ''} ${clickingOption === 'mainPriority-emotional' ? 'clicking' : ''}`} onClick={() => handleOptionClick('mainPriority', 'emotional', 'mainPriority-emotional')}>
              <div className="option-main">Emotional Balance</div>
              <div className="option-sub">Reducing stress & improving mood</div>
            </button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('driving-goal')} disabled={!formData.mainPriority}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Driving Goal Screen */}
      <div className={`typeform-screen ${currentScreen === 'driving-goal' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">1 The Ikigai</p>
          <h1 className="typeform-title">What is driving this goal?</h1>
          <div className="options-container">
            <button
              className={`option-button ${formData.drivingGoal === 'career' ? 'selected' : ''} ${clickingOption === 'goal-career' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('drivingGoal', 'career', 'goal-career')}
            >Career & Performance</button>
            <button
              className={`option-button ${formData.drivingGoal === 'family' ? 'selected' : ''} ${clickingOption === 'goal-family' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('drivingGoal', 'family', 'goal-family')}
            >Family & Relationships</button>
            <button
              className={`option-button ${formData.drivingGoal === 'athletic' ? 'selected' : ''} ${clickingOption === 'goal-athletic' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('drivingGoal', 'athletic', 'goal-athletic')}
            >An Athletic or Personal Goal</button>
            <button
              className={`option-button ${formData.drivingGoal === 'health' ? 'selected' : ''} ${clickingOption === 'goal-health' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('drivingGoal', 'health', 'goal-health')}
            >General Health & Wellbeing</button>
            <button
              className={`option-button ${formData.drivingGoal === 'condition' ? 'selected' : ''} ${clickingOption === 'goal-condition' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('drivingGoal', 'condition', 'goal-condition')}
            >Managing a Health Condition</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('baseline-intro')} disabled={!formData.drivingGoal}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Section 2: The Baseline - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'baseline-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">2 The Baseline</h1>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('allergies')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Allergies Screen */}
      <div className={`typeform-screen ${currentScreen === 'allergies' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">2 The Baseline</p>
          <h1 className="typeform-title">Any allergies or intolerances?</h1>
          <div className="options-container">
            {['peanuts', 'tree-nuts', 'dairy', 'gluten', 'soy', 'shellfish', 'none'].map((option) => (
              <button
                key={option}
                className={`option-button checkbox ${formData.allergies.includes(option) ? 'selected' : ''} ${clickingOption === `allergy-${option}` ? 'clicking' : ''}`}
                onClick={() => handleCheckboxClick('allergies', option, `allergy-${option}`)}
              >
                {option === 'peanuts' && 'Peanuts'}
                {option === 'tree-nuts' && 'Tree nuts'}
                {option === 'dairy' && 'Dairy'}
                {option === 'gluten' && 'Gluten'}
                {option === 'soy' && 'Soy'}
                {option === 'shellfish' && 'Shellfish'}
                {option === 'none' && 'None'}
              </button>
            ))}
            <div className="option-button-other">
              <span>Other</span>
              <input type="text" placeholder="Please specify ...." value={formData.otherAllergy} onChange={(e) => handleInputChange('otherAllergy', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'medications', false)} />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('medications')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Medications Screen */}
      <div className={`typeform-screen ${currentScreen === 'medications' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">2 The Baseline</p>
          <h1 className="typeform-title">Please list any medications you&apos;re currently taking.</h1>
          <p className="typeform-subtitle">This is crucial for us to check for any nutrient or food interactions.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.medications} onChange={(e) => handleInputChange('medications', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'supplements', false)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('supplements')}>Continue</button>
            <span className="enter-hint">press <strong>Enter</strong> ↵</span>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Supplements Screen */}
      <div className={`typeform-screen ${currentScreen === 'supplements' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">2 The Baseline</p>
          <h1 className="typeform-title">And any current supplements?</h1>
          <p className="typeform-subtitle">This helps us avoid recommending anything you&apos;re already taking.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.supplements} onChange={(e) => handleInputChange('supplements', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'medical-conditions', false)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('medical-conditions')}>Continue</button>
            <span className="enter-hint">press <strong>Enter</strong> ↵</span>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Medical Conditions Screen */}
      <div className={`typeform-screen ${currentScreen === 'medical-conditions' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">2 The Baseline</p>
          <h1 className="typeform-title">Do you have any diagnosed medical conditions?</h1>
          <div className="options-container">
            {['high-blood-pressure', 'high-cholesterol', 'diabetes', 'hypothyroidism', 'pcos', 'ibs-ibd', 'none'].map((option) => (
              <button
                key={option}
                className={`option-button checkbox ${formData.medicalConditions.includes(option) ? 'selected' : ''} ${clickingOption === `condition-${option}` ? 'clicking' : ''}`}
                onClick={() => handleCheckboxClick('medicalConditions', option, `condition-${option}`)}
              >
                {option === 'high-blood-pressure' && 'High Blood Pressure'}
                {option === 'high-cholesterol' && 'High cholesterol'}
                {option === 'diabetes' && 'Type 2 Diabetes / Pre-Diabetes'}
                {option === 'hypothyroidism' && 'Hypothyroidism'}
                {option === 'pcos' && 'PCOS'}
                {option === 'ibs-ibd' && 'IBS / IBD'}
                {option === 'none' && 'None'}
              </button>
            ))}
            <div className="option-button-other">
              <span>Other</span>
              <input type="text" placeholder="Please specify ...." value={formData.otherCondition} onChange={(e) => handleInputChange('otherCondition', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'fuel-intro', false)} />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('fuel-intro')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Section 3: The Fuel - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'fuel-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">3 The Fuel</h1>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('eating-style')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Eating Style Screen */}
      <div className={`typeform-screen ${currentScreen === 'eating-style' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">Which best describes your typical eating style?</h1>
          <div className="scrollable-options-wrapper">
            <div className="options-container image-cards">
              <button
                className={`option-button image-card ${formData.eatingStyle === '3-meals' ? 'selected' : ''} ${clickingOption === 'eating-3meals' ? 'clicking' : ''}`}
                onClick={() => handleOptionClick('eatingStyle', '3-meals', 'eating-3meals')}
              >
                <div className="image-placeholder" style={{backgroundImage: 'url(/images/eating-styles/3-meals.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
                <div className="image-card-label">3 meals a day</div>
              </button>
              <button
                className={`option-button image-card ${formData.eatingStyle === 'intermittent-fasting' ? 'selected' : ''} ${clickingOption === 'eating-fasting' ? 'clicking' : ''}`}
                onClick={() => handleOptionClick('eatingStyle', 'intermittent-fasting', 'eating-fasting')}
              >
                <div className="image-placeholder" style={{backgroundImage: 'url(/images/eating-styles/intermittent-fasting.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
                <div className="image-card-label">Intermittent Fasting</div>
              </button>
              <button
                className={`option-button image-card ${formData.eatingStyle === 'snacking-grazing' ? 'selected' : ''} ${clickingOption === 'eating-snacking' ? 'clicking' : ''}`}
                onClick={() => handleOptionClick('eatingStyle', 'snacking-grazing', 'eating-snacking')}
              >
                <div className="image-placeholder" style={{backgroundImage: 'url(/images/eating-styles/snacking.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
                <div className="image-card-label">Snacking / Grazing</div>
              </button>
              <button
                className={`option-button image-card ${formData.eatingStyle === 'no-pattern' ? 'selected' : ''} ${clickingOption === 'eating-nopattern' ? 'clicking' : ''}`}
                onClick={() => handleOptionClick('eatingStyle', 'no-pattern', 'eating-nopattern')}
              >
                <div className="image-placeholder" style={{backgroundImage: 'url(/images/eating-styles/no-pattern.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
                <div className="image-card-label">no set pattern</div>
              </button>
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('first-meal')} disabled={!formData.eatingStyle}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* First Meal Screen */}
      <div className={`typeform-screen ${currentScreen === 'first-meal' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">When do you typically eat your first meal?</h1>
          <div className="options-container">
            <button
              className={`option-button ${formData.firstMeal === 'before-7am' ? 'selected' : ''} ${clickingOption === 'meal-before7' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('firstMeal', 'before-7am', 'meal-before7')}
            >before 7 am</button>
            <button
              className={`option-button ${formData.firstMeal === '7-9am' ? 'selected' : ''} ${clickingOption === 'meal-79' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('firstMeal', '7-9am', 'meal-79')}
            >between 7-9 am</button>
            <button
              className={`option-button ${formData.firstMeal === '9-11am' ? 'selected' : ''} ${clickingOption === 'meal-911' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('firstMeal', '9-11am', 'meal-911')}
            >between 9-11 am</button>
            <button
              className={`option-button ${formData.firstMeal === 'after-11am' ? 'selected' : ''} ${clickingOption === 'meal-after11' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('firstMeal', 'after-11am', 'meal-after11')}
            >after 11 am</button>
            <button
              className={`option-button ${formData.firstMeal === 'varies' ? 'selected' : ''} ${clickingOption === 'meal-varies' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('firstMeal', 'varies', 'meal-varies')}
            >varies</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('energy-crash')} disabled={!formData.firstMeal}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Energy Crash Screen */}
      <div className={`typeform-screen ${currentScreen === 'energy-crash' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">When you feel an energy crash, what&apos;s your go-to?</h1>
          <div className="options-container">
            <button
              className={`option-button ${formData.energyCrash === 'caffeine' ? 'selected' : ''} ${clickingOption === 'energy-caffeine' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('energyCrash', 'caffeine', 'energy-caffeine')}
            >Caffeine (coffee, tea, energy drink)</button>
            <button
              className={`option-button ${formData.energyCrash === 'snack' ? 'selected' : ''} ${clickingOption === 'energy-snack' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('energyCrash', 'snack', 'energy-snack')}
            >A quick snack</button>
            <button
              className={`option-button ${formData.energyCrash === 'break' ? 'selected' : ''} ${clickingOption === 'energy-break' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('energyCrash', 'break', 'energy-break')}
            >Take a break / move / stretch</button>
            <button
              className={`option-button ${formData.energyCrash === 'push-through' ? 'selected' : ''} ${clickingOption === 'energy-push' ? 'clicking' : ''}`}
              onClick={() => handleOptionClick('energyCrash', 'push-through', 'energy-push')}
            >Push through</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('protein-sources')} disabled={!formData.energyCrash}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Protein Sources Screen */}
      <div className={`typeform-screen ${currentScreen === 'protein-sources' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">What are your preferred protein sources?</h1>
          <div className="options-container">
            {['chicken', 'red-meat', 'fish-seafood', 'eggs', 'dairy', 'plant-based', 'protein-powder'].map((protein) => (
              <button
                key={protein}
                className={`option-button checkbox ${formData.proteinSources.includes(protein) ? 'selected' : ''} ${clickingOption === `protein-${protein}` ? 'clicking' : ''}`}
                onClick={() => handleCheckboxClick('proteinSources', protein, `protein-${protein}`)}
              >
                {protein === 'chicken' && 'Chicken'}
                {protein === 'red-meat' && 'Red meat'}
                {protein === 'fish-seafood' && 'Fish / Seafood'}
                {protein === 'eggs' && 'Eggs'}
                {protein === 'dairy' && 'Dairy'}
                {protein === 'plant-based' && 'Plant-based'}
                {protein === 'protein-powder' && 'Protein powder'}
              </button>
            ))}
            <div className="option-button-other">
              <span>Other</span>
              <input type="text" placeholder="Please specify ...." value={formData.otherProtein} onChange={(e) => handleInputChange('otherProtein', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'food-dislikes', false)} />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('food-dislikes')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Food Dislikes Screen */}
      <div className={`typeform-screen ${currentScreen === 'food-dislikes' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">Any foods you strongly dislike?</h1>
          <p className="typeform-subtitle">This helps us avoid recommending things you don&apos;t enjoy.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.foodDislikes} onChange={(e) => handleInputChange('foodDislikes', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'meals-cooked', false)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('meals-cooked')}>Continue</button>
            <span className="enter-hint">press <strong>Enter</strong> ↵</span>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Meals Cooked Screen */}
      <div className={`typeform-screen ${currentScreen === 'meals-cooked' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">How many meals per week do you cook at home?</h1>
          <p className="typeform-subtitle">Your perfect plan is the plan that fits in your schedule.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.mealsCooked} onChange={(e) => handleInputChange('mealsCooked', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'completion', false)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('completion')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Completion Screen */}
      <div className={`typeform-screen ${currentScreen === 'completion' ? 'active' : 'hidden'}`} style={{justifyContent: 'center', alignItems: 'center'}}>
        <div className="typeform-content" style={{textAlign: 'center'}}>
          <h1 className="typeform-title" style={{fontSize: '64px', marginBottom: '30px', textAlign: 'center'}}>You&apos;re all set.</h1>
          <p className="typeform-subtitle" style={{fontSize: '20px', marginBottom: '60px', maxWidth: '700px', textAlign: 'center', marginLeft: 'auto', marginRight: 'auto'}}>
            Thank you. Your sage profile is ready.<br />
            The final step is to connect your health data.
          </p>
          <div className="button-container" style={{justifyContent: 'center', paddingLeft: '0'}}>
            <button className="typeform-button" onClick={() => handleContinue('final-step-intro')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Section 5: The Final Step - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'final-step-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">4 The Final Step</h1>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('ecosystem-integration')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Ecosystem Integration Screen */}
      <div className={`typeform-screen ${currentScreen === 'ecosystem-integration' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Final Step</p>
          <h1 className="typeform-title">Integrate sage into your ecosystem.</h1>
          <p className="typeform-subtitle">Activity, sleep, and metabolic data help optimize meal content, calendar helps optimize timing.</p>

          <div className="integrations-scroll-container">
            {/* Connected Integrations Section */}
            {(gmailConnected || outlookConnected || slackConnected || vitalConnected || whoopConnected || ouraConnected || formData.integrations.length > 0) && (
              <>
                <div className="integration-section-header">
                  <h2 className="integration-section-title">Connected</h2>
                  <p className="integration-section-description">These integrations are active and providing data</p>
                </div>
                <div className="integrations-grid connected-grid">
                {/* Apple Health removed - not available */}
                {/* Apple Calendar removed - not available via web API */}

                {outlookConnected && (
                  <div className="integration-item">
                    <div className="integration-logo">
                      <img src="/images/outlook.png" alt="Outlook" />
                    </div>
                    <div className="integration-info">
                      <h3 className="integration-name">Outlook</h3>
                      <p className="integration-description">Sync your Outlook calendar for meal timing</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectOutlook}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {slackConnected && (
                  <div className="integration-item">
                    <div className="integration-logo">
                      <img src="/images/slack.png" alt="Slack" />
                    </div>
                    <div className="integration-info">
                      <h3 className="integration-name">Slack</h3>
                      <p className="integration-description">Learn your work habits</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectSlack}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {vitalConnected && (
                  <div className="integration-item">
                    <div className="integration-logo">
                      <img src="/images/vital.jpg" alt="Vital Health" />
                    </div>
                    <div className="integration-info">
                      <h3 className="integration-name">Vital Health</h3>
                      <p className="integration-description">Connect Fitbit, Apple Health, WHOOP, Libre & more</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectVital}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {gmailConnected && (
                  <div className="integration-item">
                    <div className="integration-logo">
                      <img src="/images/google.png" alt="Gmail with Google Calendar" />
                    </div>
                    <div className="integration-info">
                      <h3 className="integration-name">Gmail with Google Calendar</h3>
                      <p className="integration-description">Sync your schedule and email for meal timing optimization</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectGmail}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {teamsConnected && (
                  <div className="integration-item">
                    <div className="integration-logo">
                      <img src="/images/teams.png" alt="Microsoft Teams" />
                    </div>
                    <div className="integration-info">
                      <h3 className="integration-name">Microsoft Teams</h3>
                      <p className="integration-description">Connected: {teamsEmail}</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectTeams}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {formData.integrations.includes('oura-ring') && (
                  <div className="integration-item">
                    <div className="integration-logo">
                      <img src="/images/oura.png" alt="Oura Ring" />
                    </div>
                    <div className="integration-info">
                      <h3 className="integration-name">Oura Ring</h3>
                      <p className="integration-description">Upload your sleep and activity data</p>
                    </div>
                    <button className="connect-button connected" onClick={() => handleOpenUploadModal('oura-ring')}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {(whoopConnected || formData.integrations.includes('whoop')) && (
                  <div className="integration-item">
                    <div className="integration-logo">
                      <img src="/images/whoop.png" alt="WHOOP" />
                    </div>
                    <div className="integration-info">
                      <h3 className="integration-name">WHOOP</h3>
                      <p className="integration-description">Sync your recovery, strain, and HRV data</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectWhoop}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {formData.integrations.includes('cgm') && (
                  <div className="integration-item">
                    <div className="integration-info">
                      <h3 className="integration-name">Continuous Glucose Monitor</h3>
                      <p className="integration-description">Upload your glucose readings</p>
                    </div>
                    <button className="connect-button connected" onClick={() => handleOpenUploadModal('cgm')}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {formData.integrations.includes('flo') && (
                  <div className="integration-item">
                    <div className="integration-info">
                      <h3 className="integration-name">Flo</h3>
                      <p className="integration-description">Sync menstrual cycle and hormone tracking data</p>
                    </div>
                    <button className="connect-button connected" onClick={() => handleOpenUploadModal('flo')}>
                      ✓ Connected
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Available Integrations Section */}
          <div className="integration-section-header" style={{marginTop: (gmailConnected || outlookConnected || slackConnected || vitalConnected || whoopConnected || ouraConnected || formData.integrations.length > 0) ? '32px' : '0'}}>
            <h2 className="integration-section-title">Available</h2>
            <p className="integration-section-description">Connect your tools to provide Sage with richer data</p>
          </div>
          <div className="integrations-grid">
            {/* Apple Health removed - users can use Oura Ring or WHOOP instead */}
            {/* Apple Calendar: Not available - Apple doesn't provide public calendar API for web */}
            {/* Users should use Google Calendar instead, which is already included via Gmail OAuth */}

            {!outlookConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/outlook.png" alt="Outlook" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Outlook</h3>
                  <p className="integration-description">Sync your Outlook calendar for meal timing</p>
                </div>
                <button className="connect-button" onClick={handleConnectOutlook}>
                  Connect
                </button>
              </div>
            )}

            {!slackConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/slack.png" alt="Slack" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Slack</h3>
                  <p className="integration-description">Learn your work habits</p>
                </div>
                <button className="connect-button" onClick={handleConnectSlack}>
                  Connect
                </button>
              </div>
            )}

            {!ouraConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/oura.png" alt="Oura Ring" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Oura Ring</h3>
                  <p className="integration-description">Sync your sleep, activity, and readiness data</p>
                </div>
                <button className="connect-button" onClick={handleConnectOura}>
                  Connect
                </button>
              </div>
            )}

            {!fitbitConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/fitbit.png" alt="Fitbit" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Fitbit</h3>
                  <p className="integration-description">Sync your activity, sleep, and heart rate data</p>
                </div>
                <button className="connect-button" onClick={handleConnectFitbit}>
                  Connect
                </button>
              </div>
            )}

            {!stravaConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/strava.png" alt="Strava" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Strava</h3>
                  <p className="integration-description">Sync your runs, rides, and training activities</p>
                </div>
                <button className="connect-button" onClick={handleConnectStrava}>
                  Connect
                </button>
              </div>
            )}

            {fitbitConnected && (
              <div className="integration-item connected">
                <div className="integration-logo">
                  <img src="/images/fitbit.png" alt="Fitbit" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Fitbit</h3>
                  <p className="integration-description">Connected</p>
                </div>
                <button className="disconnect-button" onClick={handleDisconnectFitbit}>
                  Disconnect
                </button>
              </div>
            )}

            {stravaConnected && (
              <div className="integration-item connected">
                <div className="integration-logo">
                  <img src="/images/strava.png" alt="Strava" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Strava</h3>
                  <p className="integration-description">Connected</p>
                </div>
                <button className="disconnect-button" onClick={handleDisconnectStrava}>
                  Disconnect
                </button>
              </div>
            )}

            {!whoopConnected && !formData.integrations.includes('whoop') && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/whoop.png" alt="WHOOP" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">WHOOP</h3>
                  <p className="integration-description">Sync your recovery, strain, and HRV data</p>
                </div>
                <button className="connect-button" onClick={handleConnectWhoop}>
                  Connect
                </button>
              </div>
            )}

            {ouraConnected && (
              <div className="integration-item connected">
                <div className="integration-logo">
                  <img src="/images/oura.png" alt="Oura Ring" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Oura Ring</h3>
                  <p className="integration-description">Connected</p>
                </div>
                <button className="disconnect-button" onClick={handleDisconnectOura}>
                  Disconnect
                </button>
              </div>
            )}

            {!vitalConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/vital.jpg" alt="Vital Health" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Vital Health</h3>
                  <p className="integration-description">Connect Fitbit, Apple Health, WHOOP, Libre & more</p>
                </div>
                <button className="connect-button" onClick={handleConnectVital}>
                  Connect
                </button>
              </div>
            )}

            {vitalConnected && (
              <div className="integration-item connected">
                <div className="integration-logo">
                  <img src="/images/vital.jpg" alt="Vital Health" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Vital Health</h3>
                  <p className="integration-description">Connected</p>
                </div>
                <button className="disconnect-button" onClick={handleDisconnectVital}>
                  Disconnect
                </button>
              </div>
            )}

            {!gmailConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/google.png" alt="Gmail with Google Calendar" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Gmail with Google Calendar</h3>
                  <p className="integration-description">Sync your schedule and email for meal timing optimization</p>
                </div>
                <button className="connect-button" onClick={handleConnectGmail}>
                  Connect
                </button>
              </div>
            )}

            {!teamsConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/teams.png" alt="Microsoft Teams" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Microsoft Teams</h3>
                  <p className="integration-description">Sync your Teams to learn from your work patterns and meetings</p>
                </div>
                <button className="connect-button" onClick={handleConnectTeams}>
                  Connect
                </button>
              </div>
            )}

            {!dexcomConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/dexcom.png" alt="Dexcom CGM" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Dexcom CGM</h3>
                  <p className="integration-description">Sync your continuous glucose monitoring data</p>
                </div>
                <button className="connect-button" onClick={handleConnectDexcom}>
                  Connect
                </button>
              </div>
            )}

            {dexcomConnected && (
              <div className="integration-item connected">
                <div className="integration-logo">
                  <img src="/images/dexcom.png" alt="Dexcom CGM" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Dexcom CGM</h3>
                  <p className="integration-description">Connected</p>
                </div>
                <button className="disconnect-button" onClick={handleDisconnectDexcom}>
                  Disconnect
                </button>
              </div>
            )}

            {/* Flo integration removed */}
          </div>
          </div>

          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('lab-upload')}>Continue</button>
            
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Lab Upload Screen */}
      <div className={`typeform-screen ${currentScreen === 'lab-upload' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Final Step</p>
          <h1 className="typeform-title">Upload your labs and bloodwork.</h1>
          <p className="typeform-subtitle">Please upload your most recent blood test results to unlock your personalized plan. You can upload multiple files including PDFs and screenshots.</p>
          <div className="upload-container">
            <MultiFileUpload
              files={formData.labFiles}
              onFilesChange={handleLabFilesChange}
              isUploading={labFileUploading}
              error={labFileError}
              onError={setLabFileError}
              maxSizeMB={10}
            />
          </div>
          {/* <p className="typeform-subtitle" style={{marginTop: '40px', fontSize: '15px'}}>
            Don&apos;t have labs? No problem. <a href="#" style={{color: '#2d3a2d', textDecoration: 'underline'}}>Find out your options ↗</a> or skip to add later.
          </p> */}
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('payment')}>Continue</button>

          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Payment Screen */}
      <div className={`typeform-screen payment-screen ${currentScreen === 'payment' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label" style={{textAlign: 'center'}}>5 Complete Your Plan</p>
          <h1 style={{
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '48px',
            fontWeight: 500,
            fontStretch: 'expanded',
            color: '#000000',
            lineHeight: '1.15',
            letterSpacing: '0.5px',
            marginBottom: '16px',
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
          }}>
            Unlock Your Personalized Plan
          </h1>
          <p style={{
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '18px',
            fontWeight: 400,
            color: 'rgba(0, 0, 0, 0.8)',
            lineHeight: '1.6',
            marginBottom: '48px',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto 48px auto'
          }}>
            Your custom nutrition plan is ready to be generated. Complete payment to receive your personalized Sage plan.
          </p>

          <div style={{
            maxWidth: '500px',
            margin: '0 auto',
            padding: '32px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <span style={{fontSize: '18px', fontWeight: 500}}>Sage Nutrition Plan</span>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                {promoCodeVerified && (
                  <span style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    textDecoration: 'line-through',
                    color: 'rgba(0, 0, 0, 0.4)'
                  }}>$18</span>
                )}
                <span style={{fontSize: '24px', fontWeight: 600}}>
                  {promoCodeVerified ? '$0' : '$18'}
                </span>
              </div>
            </div>

            {/* Referral Code - Always Visible */}
            <div style={{marginBottom: '24px'}}>
              <label style={{display: 'block', marginBottom: '8px', fontSize: '14px'}}>
                Referral Code (Optional)
              </label>
              <div style={{display: 'flex', gap: '8px'}}>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoCodeError('');
                    setPromoCodeVerified(false);
                  }}
                  placeholder="Enter referral code"
                  disabled={promoCodeVerified}
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontSize: '16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: promoCodeVerified ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
                    color: '#000000',
                    opacity: promoCodeVerified ? 0.7 : 1
                  }}
                />
                {!promoCodeVerified ? (
                  <button
                    onClick={async () => {
                      if (!promoCode.trim()) {
                        setPromoCodeError('Please enter a referral code');
                        return;
                      }

                      setPromoCodeVerifying(true);
                      setPromoCodeError('');

                      try {
                        // Verify the promo code by calling the payment intent API
                        const response = await fetch('/api/checkout/create-plan-payment-intent', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: formData.email,
                            fullName: formData.fullName,
                            planType: 'Sage',
                            promoCode: promoCode,
                            verifyOnly: true
                          }),
                        });

                        const data = await response.json();

                        if (response.ok && data.amount === 0 && data.referralCodeApplied) {
                          setPromoCodeVerified(true);
                          setPromoCodeError('');
                          // If payment UI is already open and discount is 100%, close it
                          if (clientSecret) {
                            setClientSecret('');
                          }
                        } else if (response.ok && data.amount > 0) {
                          setPromoCodeError('Invalid referral code');
                        } else {
                          setPromoCodeError(data.error || 'Invalid referral code');
                        }
                      } catch (error) {
                        console.error('Promo code verification error:', error);
                        setPromoCodeError('Failed to verify code. Please try again.');
                      } finally {
                        setPromoCodeVerifying(false);
                      }
                    }}
                    disabled={promoCodeVerifying || !promoCode.trim()}
                    style={{
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: 'none',
                      background: '#000000',
                      color: '#ffffff',
                      cursor: (promoCodeVerifying || !promoCode.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (promoCodeVerifying || !promoCode.trim()) ? 0.5 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {promoCodeVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 24px',
                    fontSize: '16px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.1)',
                    color: '#000000'
                  }}>
                    ✓ Verified
                  </div>
                )}
              </div>
              {promoCodeError && (
                <p style={{color: '#ff6b6b', fontSize: '14px', marginTop: '8px'}}>{promoCodeError}</p>
              )}
            </div>

            {paymentError && (
              <div style={{
                padding: '16px',
                marginBottom: '24px',
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                borderRadius: '8px',
                color: '#ff6b6b',
                fontSize: '14px'
              }}>
                {paymentError}
              </div>
            )}

            {!clientSecret ? (
              <>

                <button
                  className="typeform-button"
                  onClick={async () => {
                    setPaymentProcessing(true);
                    setPaymentError('');

                    try {
                      // Create payment intent FIRST (fast) - this is what user needs to see the payment UI
                      const paymentResponse = await fetch('/api/checkout/create-plan-payment-intent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: formData.email,
                          fullName: formData.fullName,
                          planType: 'Sage',
                          promoCode: promoCode || undefined,
                        }),
                      });

                      if (!paymentResponse.ok) {
                        const errorData = await paymentResponse.json();
                        throw new Error(errorData.error || 'Failed to create payment');
                      }

                      const paymentData = await paymentResponse.json();

                      // Show payment UI immediately or proceed with free plan
                      if (paymentData.clientSecret) {
                        setClientSecret(paymentData.clientSecret);
                        setPaymentProcessing(false);
                      } else if (paymentData.amount === 0 && paymentData.referralCodeApplied) {
                        // If referral code made it free, show video loading screen immediately
                        setIsLoading(true);

                        // Save onboarding data in background (non-blocking)
                        const onboardingData = {
                          ...formData,
                          timestamp: new Date().toISOString(),
                          completed: true
                        };

                        let uniqueCodePromise = fetch('/api/sage-onboarding', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(onboardingData),
                        })
                          .then(res => res.json())
                          .then(result => result.data?.uniqueCode)
                          .catch(err => {
                            console.error('Error saving onboarding data (background):', err);
                            return null;
                          });

                        // Analyze lab files in background (non-blocking) - this was the main bottleneck
                        if (formData.labFiles.length > 0) {
                          const labFormData = new FormData();
                          formData.labFiles.forEach((file) => {
                            labFormData.append('bloodTests', file);
                          });
                          labFormData.append('email', formData.email);

                          fetch('/api/analyze-blood-results', {
                            method: 'POST',
                            body: labFormData,
                          }).catch(err => {
                            console.error('Error analyzing lab files (background):', err);
                          });
                        }

                        // Wait for unique code from background save
                        const uniqueCode = await uniqueCodePromise;

                        if (uniqueCode) {
                          // Queue plan generation
                          const planFormData = new FormData();
                          planFormData.append('email', formData.email);
                          planFormData.append('uniqueCode', uniqueCode);
                          planFormData.append('fullName', formData.fullName.split(' ')[0]);
                          planFormData.append('referralCode', paymentData.referralCode);

                          await fetch('/api/generate-plan-async', {
                            method: 'POST',
                            body: planFormData,
                          });
                        }

                        setIsLoading(false);
                        setCurrentScreen('final-completion');
                      }
                    } catch (error) {
                      console.error('Payment error:', error);
                      setPaymentError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
                      setPaymentProcessing(false);
                      setIsLoading(false);
                    }
                  }}
                  disabled={paymentProcessing}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    fontWeight: 600,
                    opacity: paymentProcessing ? 0.6 : 1,
                    cursor: paymentProcessing ? 'not-allowed' : 'pointer'
                  }}
                >
                  {paymentProcessing ? 'Processing...' : 'Continue'}
                </button>
              </>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <SagePaymentForm
                  email={formData.email}
                  fullName={formData.fullName}
                  onSuccess={() => setCurrentScreen('final-completion')}
                  onError={(error) => setPaymentError(error)}
                />
              </Elements>
            )}

            <p style={{
              marginTop: '16px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.6)',
              textAlign: 'center'
            }}>
              Secure payment powered by Stripe
            </p>
          </div>

          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Final Completion Screen */}
      <div className={`typeform-screen ${currentScreen === 'final-completion' ? 'active' : 'hidden'}`} style={{
        backgroundImage: 'url(/images/sage-intro.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'center',
          paddingLeft: '40px',
          paddingRight: '40px'
        }}>
          <h1 style={{
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: 'clamp(32px, 6vw, 48px)',
            fontWeight: 500,
            fontStretch: 'expanded',
            color: '#ffffff',
            lineHeight: '1.15',
            letterSpacing: '0.5px',
            marginBottom: 'clamp(20px, 4vw, 32px)',
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
            padding: '0 20px'
          }}>
            Your plan is being generated.
          </h1>
        </div>
        <div style={{
          position: 'fixed',
          bottom: '0',
          left: '0',
          right: '0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingBottom: 'clamp(24px, 5vw, 40px)',
          paddingLeft: '20px',
          paddingRight: '20px'
        }}>
          <p style={{
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: 'clamp(14px, 3vw, 18px)',
            fontWeight: 500,
            fontStretch: 'expanded',
            color: '#ffffff',
            marginBottom: 'clamp(24px, 4vw, 40px)',
            textAlign: 'center',
            letterSpacing: '0.5px',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
            maxWidth: '90%',
            lineHeight: '1.5'
          }}>
            This typically takes 5-15 minutes. You&apos;ll receive an email at <strong>{formData.email}</strong> when your plan is ready.
          </p>
          <div style={{
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '18px',
            fontWeight: 500,
            fontStretch: 'expanded',
            color: '#ffffff',
            letterSpacing: '0.5px'
          }}>sage</div>
        </div>
      </div>

      {/* Google Verification Warning Modal */}
      {showGoogleWarningModal && (
        <div
          className="upload-modal-overlay"
          onClick={() => setShowGoogleWarningModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: 'clamp(24px, 5vw, 32px)',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowGoogleWarningModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '4px',
                lineHeight: 1,
              }}
            >
              ×
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{
                fontSize: 'clamp(18px, 4vw, 22px)',
                fontWeight: 600,
                color: '#1a1a1a',
                margin: '0 0 8px 0',
                fontFamily: '"Playfair Display", Georgia, serif',
              }}>
                Google Verification Pending
              </h2>
            </div>

            <p style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: '#4a4a4a',
              margin: '0 0 20px 0',
              textAlign: 'center',
            }}>
              We are currently awaiting verification from Google. Your data remains private and is only used to create your personalised plan.
            </p>

            <div style={{
              backgroundColor: '#F9FAFB',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <p style={{
                fontSize: '14px',
                lineHeight: 1.5,
                color: '#374151',
                margin: 0,
              }}>
                <strong>To proceed:</strong> When you see &quot;Google hasn&apos;t verified this app&quot;, click <strong>Advanced</strong>, then click <strong>Go to moccet.ai</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowGoogleWarningModal(false)}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={proceedWithGmailConnection}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  backgroundColor: '#3d5a3d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Health Data Upload Modal */}
      {uploadModalOpen && uploadModalType && (
        <div className="upload-modal-overlay" onClick={handleCloseUploadModal}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseUploadModal}>×</button>

            <h2 className="modal-title">
              Upload {uploadModalType === 'oura-ring' ? 'Oura Ring' : uploadModalType === 'whoop' ? 'WHOOP' : 'CGM'} Data
            </h2>

            <div className="modal-instructions">
              <h3>How to export your data:</h3>
              {uploadModalType === 'oura-ring' && (
                <>
                  <ol>
                    <li>Open the Oura app on your phone</li>
                    <li>Go to Settings → Account → Export Data</li>
                    <li>Select date range and export as CSV</li>
                    <li>Transfer the files to this device</li>
                  </ol>
                  <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '6px', fontSize: '14px' }}>
                    <strong>Oura Ring exports multiple CSV files:</strong>
                    <ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
                      <li>dailyactivity.csv</li>
                      <li>daytimestress.csv</li>
                      <li>heartrate.csv</li>
                      <li>ringbatterylevel.csv</li>
                      <li>sleepmodel.csv</li>
                      <li>temperature.csv</li>
                      <li>applicationdebugstate.csv</li>
                      <li>bloodglucose.csv</li>
                      <li>dailycardiovascularage.csv</li>
                      <li>dailycyclephases.csv</li>
                    </ul>
                    <p style={{ marginTop: '8px', marginBottom: '0', fontSize: '13px', color: '#666' }}>
                      Upload each file separately for complete health data analysis.
                    </p>
                  </div>
                </>
              )}
              {uploadModalType === 'whoop' && (
                <ol>
                  <li>Log in to your WHOOP account on web</li>
                  <li>Navigate to Profile → Settings</li>
                  <li>Click &quot;Export Data&quot; and request CSV export</li>
                  <li>Check your email for the download link</li>
                  <li>Download and upload the CSV file below</li>
                </ol>
              )}
              {uploadModalType === 'cgm' && (
                <ol>
                  <li>Open your CGM app (Dexcom, Libre, etc.)</li>
                  <li>Go to Settings or Data Management</li>
                  <li>Export your glucose readings as CSV</li>
                  <li>Select last 14-30 days for best results</li>
                  <li>Upload the exported file below</li>
                </ol>
              )}
            </div>

            <div
              className="upload-drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith('.csv')) {
                  handleFileUpload(file);
                } else {
                  alert('Please upload a CSV file');
                }
              }}
              onClick={() => document.getElementById('modal-file-input')?.click()}
            >
              {uploadingFile ? (
                <div className="uploading-state">
                  <div className="spinner"></div>
                  <p>Uploading...</p>
                </div>
              ) : (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15V3M12 3L8 7M12 3L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L2 19C2 20.1046 2.89543 21 4 21L20 21C21.1046 21 22 20.1046 22 19L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>Click to upload or drag and drop</p>
                  <span>CSV files only</span>
                </>
              )}
            </div>

            <input
              id="modal-file-input"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Loading Screen */}
      {isLoading && (
        <div className="loading-screen">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="loading-video"
          >
            <source src="/videos/sage.mp4" type="video/mp4" />
          </video>
          <div className="loading-overlay">
            <div className="loading-content">
              {asyncGenerationStarted && (
                <div className="loading-message" style={{
                  fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: 500,
                  fontStretch: 'expanded',
                  letterSpacing: '0.5px',
                  color: '#999',
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: '16px', marginBottom: '12px' }}>
                    moccet sage Agents are building your plan.
                  </p>
                  <p style={{ fontSize: '15px', marginBottom: '12px' }}>
                    This may take up to 5 minutes.
                  </p>
                  <p style={{ fontSize: '15px', marginBottom: '24px' }}>
                    You can close this screen and sage will email you once your plan is ready.
                  </p>
                </div>
              )}
              <div className="loading-text">loading sage plan</div>
              <div className="loading-bar-container">
                <div
                  className="loading-bar-fill"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
