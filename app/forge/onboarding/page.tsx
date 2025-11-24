'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import './onboarding.css';

type Screen =
  | 'intro' | 'welcome' | 'name' | 'age' | 'gender' | 'weight' | 'height'
  | 'email' | 'objective-intro' | 'primary-goal' | 'time-horizon' | 'training-days'
  | 'baseline-intro' | 'injuries' | 'movement-restrictions' | 'medications' | 'supplements' | 'medical-conditions'
  | 'environment-intro' | 'equipment' | 'training-location' | 'session-length' | 'exercise-time'
  | 'sleep-quality' | 'stress-level' | 'forge-intake-intro' | 'training-experience' | 'skills-priority'
  | 'effort-familiarity' | 'current-bests' | 'conditioning-preferences' | 'soreness-preference'
  | 'daily-activity' | 'first-meal' | 'energy-crash' | 'protein-sources' | 'food-dislikes' | 'meals-cooked' | 'alcohol-consumption'
  | 'completion' | 'final-step-intro' | 'ecosystem-integration' | 'lab-upload' | 'final-completion';

export default function ForgeOnboarding() {
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
  const [vitalConnected, setVitalConnected] = useState(false);
  const [vitalUserId, setVitalUserId] = useState('');
  const [teamsConnected, setTeamsConnected] = useState(false);
  const [teamsEmail, setTeamsEmail] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalType, setUploadModalType] = useState<'oura-ring' | 'whoop' | 'cgm' | 'flo' | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [asyncGenerationStarted, setAsyncGenerationStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);

  // Video sound controls
  const [introVideoMuted, setIntroVideoMuted] = useState(true);
  const [loadingVideoMuted, setLoadingVideoMuted] = useState(true);
  const introVideoRef = useRef<HTMLVideoElement>(null);
  const loadingVideoRef = useRef<HTMLVideoElement>(null);

  const toggleIntroSound = () => {
    if (introVideoRef.current) {
      introVideoRef.current.muted = !introVideoMuted;
      setIntroVideoMuted(!introVideoMuted);
    }
  };

  const toggleLoadingSound = () => {
    if (loadingVideoRef.current) {
      loadingVideoRef.current.muted = !loadingVideoMuted;
      setLoadingVideoMuted(!loadingVideoMuted);
    }
  };

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
      'email', 'objective-intro', 'primary-goal', 'time-horizon', 'training-days',
      'baseline-intro', 'injuries', 'movement-restrictions', 'medical-conditions',
      'environment-intro', 'equipment', 'training-location', 'session-length', 'exercise-time',
      'sleep-quality', 'stress-level', 'forge-intake-intro', 'training-experience', 'skills-priority',
      'effort-familiarity', 'current-bests', 'conditioning-preferences', 'soreness-preference',
      'daily-activity', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'final-completion'
    ];
    const currentIndex = screens.indexOf(currentScreen);
    if (currentIndex === -1) return 0;
    return (currentIndex / (screens.length - 1)) * 100;
  };

  // Dev mode: Skip to plan with mock data
  const handleDevSkipToPlan = async () => {
    const mockData = {
      fullName: 'Dev Test User',
      age: '32',
      gender: 'male',
      weight: '185',
      weightUnit: 'lbs' as 'lbs' | 'kg',
      height: '5\'11"',
      email: 'dev-test@forge.local',
      primaryGoal: 'Build muscle',
      timeHorizon: '6-12 months',
      trainingDays: '4',
      injuries: ['none'],
      movementRestrictions: 'None',
      medicalConditions: ['none'],
      otherCondition: '',
      equipment: ['Full gym access'],
      trainingLocation: 'Gym',
      sessionLength: '60-90 minutes',
      exerciseTime: 'Morning',
      sleepQuality: '7',
      stressLevel: '4',
      trainingExperience: '2-3 years',
      skillsPriority: ['Strength', 'Hypertrophy'],
      effortFamiliarity: 'Yes',
      currentBests: 'Squat 5RM 315 lbs; Bench 5RM 225 lbs; Deadlift 5RM 405 lbs',
      conditioningPreferences: ['LISS cardio'],
      sorenessPreference: '6',
      dailyActivity: 'Moderately active',
      integrations: ['apple-health'],
      timestamp: new Date().toISOString(),
      completed: true,
      hasLabFile: false,
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
      const response = await fetch('/api/forge-onboarding', {
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
      const uniqueCode = result.data?.uniqueCode;
      const userFirstName = mockData.fullName.split(' ')[0];

      // Upload mock lab file first (simulating real user flow)
      const mockPdfContent = '%PDF-1.4\nMock lab results PDF for testing';
      const blob = new Blob([mockPdfContent], { type: 'application/pdf' });
      const mockLabFile = new File([blob], 'mock-lab-results.pdf', { type: 'application/pdf' });

      console.log('Uploading mock lab file...');
      const labFormData = new FormData();
      labFormData.append('bloodTest', mockLabFile);
      labFormData.append('email', mockData.email);

      try {
        await fetch('/api/forge-analyze-blood-results', {
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
      planFormData.append('uniqueCode', uniqueCode);
      planFormData.append('fullName', userFirstName);

      // Start the async call (don't await yet)
      const planPromise = fetch('/api/forge-generate-plan-async', {
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

        const redirectUrl = uniqueCode
          ? `/forge/personalised-plan?code=${uniqueCode}`
          : `/forge/personalised-plan?email=${encodeURIComponent(mockData.email)}`;

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
    primaryGoal: '',
    timeHorizon: '',
    trainingDays: '',
    injuries: [] as string[],
    movementRestrictions: '',
    medicalConditions: [] as string[],
    otherCondition: '',
    equipment: [] as string[],
    trainingLocation: '',
    sessionLength: '',
    exerciseTime: '',
    sleepQuality: '5',
    stressLevel: '5',
    trainingExperience: '',
    skillsPriority: [] as string[],
    effortFamiliarity: '',
    currentBests: '',
    conditioningPreferences: [] as string[],
    sorenessPreference: '5',
    dailyActivity: '',
    // Legacy nutrition fields (to be replaced with fitness screens)
    allergies: [] as string[],
    otherAllergy: '',
    medications: '',
    supplements: '',
    eatingStyle: '',
    firstMeal: '',
    energyCrash: '',
    proteinSources: [] as string[],
    otherProtein: '',
    foodDislikes: '',
    mealsCooked: '',
    alcoholConsumption: '',
    integrations: [] as string[],
    labFile: null as File | null,
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

  // Check if integrations are already connected on mount
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const gmailEmailCookie = cookies.find(c => c.trim().startsWith('gmail_email='));
    const slackTeamCookie = cookies.find(c => c.trim().startsWith('slack_team='));
    const appleHealthCookie = cookies.find(c => c.trim().startsWith('apple_health_connected='));
    const appleCalendarCookie = cookies.find(c => c.trim().startsWith('apple_calendar_connected='));
    const outlookEmailCookie = cookies.find(c => c.trim().startsWith('outlook_email='));

    if (gmailEmailCookie) {
      const email = gmailEmailCookie.split('=')[1];
      setGmailConnected(true);
      setGmailEmail(decodeURIComponent(email));
    }

    if (slackTeamCookie) {
      const team = slackTeamCookie.split('=')[1];
      setSlackConnected(true);
      setSlackTeam(decodeURIComponent(team));
    }

    if (appleHealthCookie) {
      setAppleHealthConnected(true);
    }

    if (appleCalendarCookie) {
      setAppleCalendarConnected(true);
    }

    if (outlookEmailCookie) {
      const email = outlookEmailCookie.split('=')[1];
      setOutlookConnected(true);
      setOutlookEmail(decodeURIComponent(email));
    }

    const ouraUserIdCookie = cookies.find(c => c.trim().startsWith('oura_user_id='));
    if (ouraUserIdCookie) {
      setOuraConnected(true);
    }

    const dexcomConnectedCookie = cookies.find(c => c.trim().startsWith('dexcom_connected='));
    if (dexcomConnectedCookie) {
      setDexcomConnected(true);
    }

    const teamsEmailCookie = cookies.find(c => c.trim().startsWith('teams_user_email='));
    if (teamsEmailCookie) {
      const email = teamsEmailCookie.split('=')[1];
      setTeamsConnected(true);
      setTeamsEmail(decodeURIComponent(email));
    }
  }, []);

  const handleConnectGmail = async () => {
    try {
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
      const response = await fetch('/api/outlook/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
          data.authUrl,
          'outlook-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const cookies = document.cookie.split(';');
          const outlookEmailCookie = cookies.find(c => c.trim().startsWith('outlook_email='));

          if (outlookEmailCookie) {
            const email = outlookEmailCookie.split('=')[1];
            setOutlookConnected(true);
            setOutlookEmail(decodeURIComponent(email));
            // Add outlook to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('outlook')
                ? prev.integrations
                : [...prev.integrations, 'outlook']
            }));
            clearInterval(pollInterval);
          }
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
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
      const response = await fetch('/api/oura/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
          data.authUrl,
          'oura-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Listen for messages from popup
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'oura-connected') {
            console.log('[Oura] Connection confirmed via message');
            setOuraConnected(true);
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('oura-ring')
                ? prev.integrations
                : [...prev.integrations, 'oura-ring']
            }));
            window.removeEventListener('message', handleMessage);
          } else if (event.data.type === 'oura-error') {
            console.error('[Oura] Connection failed');
            window.removeEventListener('message', handleMessage);
          }
        };

        window.addEventListener('message', handleMessage);

        // Poll for connection status (backup mechanism)
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
            window.removeEventListener('message', handleMessage);
          }
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          window.removeEventListener('message', handleMessage);
        }, 300000);
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

  const handleConnectVital = async () => {
    try {
      console.log('[Vital] Starting connection...');

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
        const linkUrl = `https://link.${data.environment}.tryvital.io/${data.linkToken}`;
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
      const response = await fetch('/api/teams/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
          data.authUrl,
          'teams-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const cookies = document.cookie.split(';');
          const teamsEmailCookie = cookies.find(c => c.trim().startsWith('teams_user_email='));

          if (teamsEmailCookie) {
            const email = teamsEmailCookie.split('=')[1];
            setTeamsConnected(true);
            setTeamsEmail(decodeURIComponent(email));
            // Add teams to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('teams')
                ? prev.integrations
                : [...prev.integrations, 'teams']
            }));
            clearInterval(pollInterval);
          }
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
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

  const handleGetStarted = () => {
    setCurrentScreen('name');
  };

  const handleInputChange = (field: keyof typeof formData, value: string | string[] | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLabFileUpload = async (file: File) => {
    setLabFileUploading(true);
    setLabFileError('');

    try {
      // Just store the file - analysis will happen in the personalized plan page
      handleInputChange('labFile', file);
      console.log('Lab file uploaded:', file.name);
    } catch (err) {
      setLabFileError('Error uploading lab file');
      console.error(err);
    } finally {
      setLabFileUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (labFileUploading) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      // Check file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (validTypes.includes(file.type)) {
        handleLabFileUpload(file);
      } else {
        setLabFileError('Please upload a PDF, PNG, or JPEG file');
      }
    }
  };

  const toggleArrayValue = (field: 'injuries' | 'allergies' | 'medicalConditions' | 'equipment' | 'skillsPriority' | 'conditioningPreferences' | 'proteinSources' | 'integrations', value: string) => {
    setFormData(prev => {
      const currentArray = prev[field];

      // Special handling for "none" or "minimal-none" option (exclusive options)
      const isNoneOption = value === 'none' || value === 'minimal-none';

      if (isNoneOption) {
        // If clicking a "none" option, clear all other selections and set only this option
        if (currentArray.includes(value)) {
          // If the "none" option is already selected, unselect it
          return { ...prev, [field]: [] };
        } else {
          // Select only this "none" option, clear everything else
          return { ...prev, [field]: [value] };
        }
      } else {
        // If clicking any option other than "none"
        if (currentArray.includes(value)) {
          // Unselect this option
          return { ...prev, [field]: currentArray.filter((v: string) => v !== value) };
        } else {
          // Select this option and remove any "none" options if they were selected
          const newArray = currentArray.filter((v: string) => v !== 'none' && v !== 'minimal-none');
          return { ...prev, [field]: [...newArray, value] };
        }
      }
    });
  };

  const handleContinue = (nextScreen: Screen) => {
    setCurrentScreen(nextScreen);
  };

  const handleKeyPress = (e: React.KeyboardEvent, nextScreen: Screen, isDisabled: boolean) => {
    if (e.key === 'Enter' && !isDisabled) {
      handleContinue(nextScreen);
    }
  };

  // Navigation mapping for global Enter key handler
  const getNextScreen = useCallback((): Screen | null => {
    const navigationMap: Record<Screen, Screen | null> = {
      'intro': 'welcome',
      'welcome': 'name',
      'name': 'age',
      'age': 'gender',
      'gender': 'weight',
      'weight': 'height',
      'height': 'email',
      'email': 'objective-intro',
      'objective-intro': 'primary-goal',
      'primary-goal': 'time-horizon',
      'time-horizon': 'training-days',
      'training-days': 'baseline-intro',
      'baseline-intro': 'injuries',
      'injuries': 'movement-restrictions',
      'movement-restrictions': 'medications',
      'medications': 'supplements',
      'supplements': 'medical-conditions',
      'medical-conditions': 'environment-intro',
      'environment-intro': 'equipment',
      'equipment': 'training-location',
      'training-location': 'session-length',
      'session-length': 'exercise-time',
      'exercise-time': 'sleep-quality',
      'sleep-quality': 'stress-level',
      'stress-level': 'forge-intake-intro',
      'forge-intake-intro': 'training-experience',
      'training-experience': 'skills-priority',
      'skills-priority': 'effort-familiarity',
      'effort-familiarity': 'current-bests',
      'current-bests': 'conditioning-preferences',
      'conditioning-preferences': 'soreness-preference',
      'soreness-preference': 'daily-activity',
      'daily-activity': 'completion',
      'first-meal': 'energy-crash',
      'energy-crash': 'protein-sources',
      'protein-sources': 'food-dislikes',
      'food-dislikes': 'meals-cooked',
      'meals-cooked': 'alcohol-consumption',
      'alcohol-consumption': 'completion',
      'completion': 'final-step-intro',
      'final-step-intro': 'ecosystem-integration',
      'ecosystem-integration': 'lab-upload',
      'lab-upload': null,
      'final-completion': null,
    };
    return navigationMap[currentScreen];
  }, [currentScreen]);

  // Check if current screen's Continue button would be disabled
  const isContinueDisabled = useCallback((): boolean => {
    switch (currentScreen) {
      case 'name':
        return !formData.fullName.trim() || formData.fullName.trim().split(/\s+/).length < 2;
      case 'age':
        return !formData.age.trim();
      case 'gender':
        return !formData.gender;
      case 'weight':
        return !formData.weight.trim();
      case 'height':
        return formData.heightUnit === 'cm'
          ? !formData.height.trim()
          : !formData.heightFeet.trim() && !formData.heightInches.trim();
      case 'email':
        return !formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 'primary-goal':
        return !formData.primaryGoal;
      case 'time-horizon':
        return !formData.timeHorizon;
      case 'training-days':
        return !formData.trainingDays;
      case 'injuries':
        return formData.injuries.length === 0;
      case 'medical-conditions':
        return formData.medicalConditions.length === 0;
      case 'equipment':
        return formData.equipment.length === 0;
      case 'skills-priority':
        return formData.skillsPriority.length === 0;
      case 'conditioning-preferences':
        return formData.conditioningPreferences.length === 0;
      case 'training-location':
        return !formData.trainingLocation;
      case 'exercise-time':
        return !formData.exerciseTime;
      case 'sleep-quality':
        return !formData.sleepQuality;
      case 'stress-level':
        return !formData.stressLevel;
      case 'effort-familiarity':
        return !formData.effortFamiliarity;
      case 'soreness-preference':
        return !formData.sorenessPreference;
      case 'daily-activity':
        return !formData.dailyActivity;
      case 'first-meal':
        return !formData.firstMeal;
      case 'energy-crash':
        return !formData.energyCrash;
      default:
        return false;
    }
  }, [currentScreen, formData]);

  // Global Enter key handler
  useEffect(() => {
    const handleGlobalEnter = (e: KeyboardEvent) => {
      // Only handle Enter key
      if (e.key !== 'Enter') return;

      // Don't handle if Continue button is disabled
      if (isContinueDisabled()) return;

      // Get next screen (lab-upload returns null, so it won't auto-advance)
      const nextScreen = getNextScreen();
      if (nextScreen) {
        e.preventDefault();
        setCurrentScreen(nextScreen);
      }
    };

    window.addEventListener('keydown', handleGlobalEnter);
    return () => window.removeEventListener('keydown', handleGlobalEnter);
  }, [currentScreen, formData, getNextScreen, isContinueDisabled]);

  const handleBack = () => {
    const screens: Screen[] = [
      'intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
      'email', 'objective-intro', 'primary-goal', 'time-horizon', 'training-days',
      'baseline-intro', 'injuries', 'movement-restrictions', 'medical-conditions',
      'environment-intro', 'equipment', 'training-location', 'session-length', 'exercise-time',
      'sleep-quality', 'stress-level', 'forge-intake-intro', 'training-experience', 'skills-priority',
      'effort-familiarity', 'current-bests', 'conditioning-preferences', 'soreness-preference',
      'daily-activity', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'final-completion'
    ];
    const currentIndex = screens.indexOf(currentScreen);
    if (currentIndex > 1) {
      setCurrentScreen(screens[currentIndex - 1]);
    }
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
      const response = await fetch('/api/forge-onboarding', {
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

      // If lab file uploaded, analyze it first (on frontend)
      if (formData.labFile) {
        console.log('Uploading and analyzing lab file...');
        const labFormData = new FormData();
        labFormData.append('bloodTest', formData.labFile);
        labFormData.append('email', formData.email);

        try {
          await fetch('/api/forge-analyze-blood-results', {
            method: 'POST',
            body: labFormData,
          });
          console.log('✅ Lab file analysis completed');
        } catch (err) {
          console.error('Error analyzing lab file:', err);
          // Continue anyway
        }
      }

      // Queue async plan generation via QStash (doesn't include lab file anymore)
      console.log('Queueing plan generation...');

      const planFormData = new FormData();
      planFormData.append('email', formData.email);
      planFormData.append('uniqueCode', uniqueCode);
      planFormData.append('fullName', userFirstName);

      const planResponse = await fetch('/api/forge-generate-plan-async', {
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

      {/* Intro Screen */}
      <div className={`intro-screen ${currentScreen === 'intro' ? 'active' : 'hidden'}`}>
        <video
          ref={introVideoRef}
          playsInline
          autoPlay
          muted
          loop
          className="intro-video"
          preload="auto"
        >
          <source src="/videos/forge.mp4" type="video/mp4" />
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
          <h1 className="welcome-title">Welcome to forge.</h1>
          <p className="welcome-subtitle">
            Your fitness journey is uniquely yours.<br />
            forge builds fitness intelligence from your unique biology.
          </p>
          <button className="welcome-button" onClick={handleGetStarted}>
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

          <div className="welcome-brand">forge</div>
        </div>
      </div>

      {/* Name Screen */}
      <div className={`typeform-screen ${currentScreen === 'name' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What&apos;s your full name?</h1>
          <p className="typeform-subtitle">We&apos;ll use this to personalize your forge experience and keep your profile secure.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'age', !formData.fullName.trim() || formData.fullName.trim().split(/\s+/).length < 2)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {formData.fullName.trim() && formData.fullName.trim().split(/\s+/).length < 2 && (
            <p className="validation-error">Please enter your full name (first and last name)</p>
          )}
          <div className="button-container">
            <button
              className="typeform-button"
              onClick={() => handleContinue('age')}
              disabled={!formData.fullName.trim() || formData.fullName.trim().split(/\s+/).length < 2}
            >
              Continue
            </button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
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
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('gender')} disabled={!formData.age.trim()}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Gender Screen */}
      <div className={`typeform-screen ${currentScreen === 'gender' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What is your gender identity?</h1>
          <p className="typeform-subtitle">Understanding your biology helps us provide more accurate nutritional guidance.</p>
          <div className="options-container">
            {['male', 'female', 'non-binary', 'prefer-not-to-say'].map((option) => (
              <button key={option} className={`option-button ${formData.gender === option ? 'selected' : ''}`} onClick={() => handleInputChange('gender', option)}>
                {option === 'male' && 'Male'}
                {option === 'female' && 'Female'}
                {option === 'non-binary' && 'Non-Binary'}
                {option === 'prefer-not-to-say' && 'Prefer not to say'}
              </button>
            ))}
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('weight')} disabled={!formData.gender}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
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
                <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
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
                  <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                    <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                    <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Email Screen */}
      <div className={`typeform-screen ${currentScreen === 'email' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">Tell us the email for results and updates.</h1>
          <p className="typeform-subtitle">We&apos;ll send your personalized forge fitness plan and helpful tips to this email. We respect your privacy.</p>
          <div className="input-container">
            <input type="email" className="typeform-input" placeholder="name@example.com" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'objective-intro', !formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))} autoFocus />
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('objective-intro')} disabled={!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Section 1: The Objective - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'objective-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">1 The Objective</h1>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('primary-goal')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Primary Goal Screen */}
      <div className={`typeform-screen ${currentScreen === 'primary-goal' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">1 The Objective</p>
          <h1 className="typeform-title">What is your primary goal right now?</h1>
          <div className="options-container">
            <button className={`option-button with-subtitle ${formData.primaryGoal === 'longevity' ? 'selected' : ''}`} onClick={() => handleInputChange('primaryGoal', 'longevity')}>
              <div className="option-main">Longevity and Aging</div>
              <div className="option-sub">Preventing disease & increasing long-term health</div>
            </button>
            <button className={`option-button with-subtitle ${formData.primaryGoal === 'rehabilitation' ? 'selected' : ''}`} onClick={() => handleInputChange('primaryGoal', 'rehabilitation')}>
              <div className="option-main">Rehabilitation</div>
              <div className="option-sub">Recover from injury</div>
            </button>
            <button className={`option-button with-subtitle ${formData.primaryGoal === 'physical-performance' ? 'selected' : ''}`} onClick={() => handleInputChange('primaryGoal', 'physical-performance')}>
              <div className="option-main">Physical performance</div>
              <div className="option-sub">More stamina & less fatigue</div>
            </button>
            <button className={`option-button with-subtitle ${formData.primaryGoal === 'build-up' ? 'selected' : ''}`} onClick={() => handleInputChange('primaryGoal', 'build-up')}>
              <div className="option-main">Build up</div>
              <div className="option-sub">Building muscle and strength</div>
            </button>
            <button className={`option-button with-subtitle ${formData.primaryGoal === 'slim-down' ? 'selected' : ''}`} onClick={() => handleInputChange('primaryGoal', 'slim-down')}>
              <div className="option-main">Slim down</div>
              <div className="option-sub">Losing fat and general weight loss</div>
            </button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('time-horizon')} disabled={!formData.primaryGoal}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Time Horizon Screen */}
      <div className={`typeform-screen ${currentScreen === 'time-horizon' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">1 The Objective</p>
          <h1 className="typeform-title">What time horizon are you planning for?</h1>
          <div className="options-container">
            <button className={`option-button ${formData.timeHorizon === 'short-term' ? 'selected' : ''}`} onClick={() => handleInputChange('timeHorizon', 'short-term')}>Short-term (up to 12 weeks)</button>
            <button className={`option-button ${formData.timeHorizon === 'medium-term' ? 'selected' : ''}`} onClick={() => handleInputChange('timeHorizon', 'medium-term')}>Medium term (3-12 months)</button>
            <button className={`option-button ${formData.timeHorizon === 'long-term' ? 'selected' : ''}`} onClick={() => handleInputChange('timeHorizon', 'long-term')}>Long-term (more than one year)</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('training-days')} disabled={!formData.timeHorizon}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Training Days Screen */}
      <div className={`typeform-screen ${currentScreen === 'training-days' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">1 The Objective</p>
          <h1 className="typeform-title">How many days per week can you train?</h1>
          <p className="typeform-subtitle">Reflect on your weekly time for exercise.<br />The best plan is the one that works with your schedule.</p>
          <div className="options-container" style={{flexDirection: 'row', justifyContent: 'center', gap: '20px'}}>
            <button className={`option-button ${formData.trainingDays === '1' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingDays', '1')} style={{minWidth: '80px', fontSize: '24px', padding: '20px'}}>1</button>
            <button className={`option-button ${formData.trainingDays === '2' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingDays', '2')} style={{minWidth: '80px', fontSize: '24px', padding: '20px'}}>2</button>
            <button className={`option-button ${formData.trainingDays === '3' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingDays', '3')} style={{minWidth: '80px', fontSize: '24px', padding: '20px'}}>3</button>
            <button className={`option-button ${formData.trainingDays === '4' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingDays', '4')} style={{minWidth: '80px', fontSize: '24px', padding: '20px'}}>4</button>
            <button className={`option-button ${formData.trainingDays === '5+' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingDays', '5+')} style={{minWidth: '80px', fontSize: '24px', padding: '20px'}}>5+</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('baseline-intro')} disabled={!formData.trainingDays}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Section 2: The Baseline - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'baseline-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">2 The Baseline</h1>
          <p className="typeform-subtitle">We want to make your training safer and more effective. Help us understand your starting point.</p>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('injuries')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Injuries Screen */}
      <div className={`typeform-screen ${currentScreen === 'injuries' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">2 The Baseline</p>
          <h1 className="typeform-title">Do you have any current or recent injuries?</h1>
          <div className="options-container">
            {['shoulder', 'elbow-wrist', 'lower-back', 'hip', 'knee', 'ankle-foot', 'none'].map((option) => (
              <button key={option} className={`option-button checkbox ${formData.injuries.includes(option) ? 'selected' : ''}`} onClick={() => toggleArrayValue('injuries', option)}>
                {option === 'shoulder' && 'Shoulder'}
                {option === 'elbow-wrist' && 'Elbow / wrist'}
                {option === 'lower-back' && 'Lower back'}
                {option === 'hip' && 'Hip'}
                {option === 'knee' && 'Knee'}
                {option === 'ankle-foot' && 'Ankle / foot'}
                {option === 'none' && 'None'}
              </button>
            ))}
            <div className="option-button-other">
              <span>Other</span>
              <input type="text" placeholder="Please specify ...." />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('movement-restrictions')} disabled={formData.injuries.length === 0}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Movement Restrictions Screen */}
      <div className={`typeform-screen ${currentScreen === 'movement-restrictions' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">2 The Baseline</p>
          <h1 className="typeform-title">List any movements you must avoid or modify.</h1>
          <p className="typeform-subtitle">E.g. &apos;No overhead pressing,&apos; &apos;Avoid deep squats.&apos; If none, write &apos;None.&apos;</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.movementRestrictions} onChange={(e) => handleInputChange('movementRestrictions', e.target.value)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('medical-conditions')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
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
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('supplements')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
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
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('medical-conditions')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Medical Conditions Screen */}
      <div className={`typeform-screen ${currentScreen === 'medical-conditions' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">2 The Baseline</p>
          <h1 className="typeform-title">Any diagnosed conditions we should consider?</h1>
          <div className="options-container">
            {['high-blood-pressure', 'high-cholesterol', 'diabetes', 'thyroid', 'pcos', 'ibs-ibd', 'none'].map((option) => (
              <button key={option} className={`option-button checkbox ${formData.medicalConditions.includes(option) ? 'selected' : ''}`} onClick={() => toggleArrayValue('medicalConditions', option)}>
                {option === 'high-blood-pressure' && 'High Blood Pressure'}
                {option === 'high-cholesterol' && 'High cholesterol'}
                {option === 'diabetes' && 'Type 2 Diabetes / Pre-Diabetes'}
                {option === 'thyroid' && 'Thyroid condition'}
                {option === 'pcos' && 'PCOS'}
                {option === 'ibs-ibd' && 'IBS / IBD'}
                {option === 'none' && 'None'}
              </button>
            ))}
            <div className="option-button-other">
              <span>Other</span>
              <input type="text" placeholder="Please specify ...." value={formData.otherCondition} onChange={(e) => handleInputChange('otherCondition', e.target.value)} />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('environment-intro')} disabled={formData.medicalConditions.length === 0}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Section 3: The Environment - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'environment-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">3 The Environment</h1>
          <p className="typeform-subtitle">Let&apos;s explore the resources and setting you have for training, so your plan fits your actual environment.</p>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('equipment')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Equipment Screen */}
      <div className={`typeform-screen ${currentScreen === 'equipment' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Environment</p>
          <h1 className="typeform-title">What equipment do you have regular access to?</h1>
          <div className="options-container">
            {['commercial-gym', 'power-rack-barbell-plates', 'dumbbells', 'kettlebells', 'cables-machines', 'resistance-bands', 'bodyweight-only', 'cardio-machines'].map((option) => (
              <button key={option} className={`option-button checkbox ${formData.equipment.includes(option) ? 'selected' : ''}`} onClick={() => toggleArrayValue('equipment', option)}>
                {option === 'commercial-gym' && 'Commercial Gym'}
                {option === 'power-rack-barbell-plates' && 'Power Rack + Barbell + Plates'}
                {option === 'dumbbells' && 'Dumbbells'}
                {option === 'kettlebells' && 'Kettlebells'}
                {option === 'cables-machines' && 'Cables or Machines'}
                {option === 'resistance-bands' && 'Resistance Bands'}
                {option === 'bodyweight-only' && 'Body Weight Only'}
                {option === 'cardio-machines' && 'Cardio Machines'}
              </button>
            ))}
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('training-location')} disabled={formData.equipment.length === 0}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Training Location Screen */}
      <div className={`typeform-screen ${currentScreen === 'training-location' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Environment</p>
          <h1 className="typeform-title">Where do you usually train?</h1>
          <div className="options-container">
            <button className={`option-button ${formData.trainingLocation === 'gym' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingLocation', 'gym')}>Gym</button>
            <button className={`option-button ${formData.trainingLocation === 'home' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingLocation', 'home')}>Home</button>
            <button className={`option-button ${formData.trainingLocation === 'outdoors' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingLocation', 'outdoors')}>Outdoors</button>
            <button className={`option-button ${formData.trainingLocation === 'mix' ? 'selected' : ''}`} onClick={() => handleInputChange('trainingLocation', 'mix')}>Mix of these</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('session-length')} disabled={!formData.trainingLocation}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Session Length Screen */}
      <div className={`typeform-screen ${currentScreen === 'session-length' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Environment</p>
          <h1 className="typeform-title">How long is your average training session?</h1>
          <p className="typeform-subtitle">So we can better understand your daily rhythm.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.sessionLength} onChange={(e) => handleInputChange('sessionLength', e.target.value)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('exercise-time')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Exercise Time Screen */}
      <div className={`typeform-screen ${currentScreen === 'exercise-time' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Environment</p>
          <h1 className="typeform-title">When do you usually exercise?</h1>
          <div className="options-container" style={{flexDirection: 'row', justifyContent: 'center', gap: '20px', flexWrap: 'wrap'}}>
            <button className={`option-button ${formData.exerciseTime === 'Morning' ? 'selected' : ''}`} onClick={() => handleInputChange('exerciseTime', 'morning')} style={{minWidth: '150px'}}>morning</button>
            <button className={`option-button ${formData.exerciseTime === 'Midday' ? 'selected' : ''}`} onClick={() => handleInputChange('exerciseTime', 'midday')} style={{minWidth: '150px'}}>midday</button>
            <button className={`option-button ${formData.exerciseTime === 'Evening' ? 'selected' : ''}`} onClick={() => handleInputChange('exerciseTime', 'evening')} style={{minWidth: '150px'}}>evening</button>
            <button className={`option-button ${formData.exerciseTime === 'It-varies' ? 'selected' : ''}`} onClick={() => handleInputChange('exerciseTime', 'it-varies')} style={{minWidth: '150px'}}>it varies</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('sleep-quality')} disabled={!formData.exerciseTime}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Sleep Quality Screen */}
      <div className={`typeform-screen ${currentScreen === 'sleep-quality' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Environment</p>
          <h1 className="typeform-title">How well did you sleep the past 2 weeks?</h1>
          <p className="typeform-subtitle">Reflect on your sleep quality and select a number that you feel describes it best, with 1 being poor and 10 being excellent.</p>
          <div className="options-container" style={{flexDirection: 'row', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', maxHeight: '250px', overflowY: 'auto'}}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((num) => (
              <button key={num} className={`option-button ${formData.sleepQuality === num ? 'selected' : ''}`} onClick={() => handleInputChange('sleepQuality', num)} style={{minWidth: '60px', fontSize: '20px', padding: '10px 15px'}}>{num}</button>
            ))}
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('stress-level')} disabled={!formData.sleepQuality}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Stress Level Screen */}
      <div className={`typeform-screen ${currentScreen === 'stress-level' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Environment</p>
          <h1 className="typeform-title">What is your average daily stress level?</h1>
          <p className="typeform-subtitle">Reflect on your daily stress and select a number that you feel describes it best, with 1 being little to no stress and 10 being the maximum amount of stress.</p>
          <div className="options-container" style={{flexDirection: 'row', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', maxHeight: '250px', overflowY: 'auto'}}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((num) => (
              <button key={num} className={`option-button ${formData.stressLevel === num ? 'selected' : ''}`} onClick={() => handleInputChange('stressLevel', num)} style={{minWidth: '60px', fontSize: '20px', padding: '10px 15px'}}>{num}</button>
            ))}
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('forge-intake-intro')} disabled={!formData.stressLevel}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Section 4: The Forge Intake - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'forge-intake-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">4 The Forge Intake</h1>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('training-experience')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Training Experience Screen */}
      <div className={`typeform-screen ${currentScreen === 'training-experience' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Forge Intake</p>
          <h1 className="typeform-title">How long have you been training?</h1>
          <p className="typeform-subtitle">So we can better understand your fitness experience.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.trainingExperience} onChange={(e) => handleInputChange('trainingExperience', e.target.value)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('skills-priority')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Skills Priority Screen */}
      <div className={`typeform-screen ${currentScreen === 'skills-priority' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Forge Intake</p>
          <h1 className="typeform-title">Which skills do you want to prioritize?</h1>
          <div className="options-container">
            {['mobility', 'endurance-stamina', 'running-speed', 'olympic-lifts', 'upper-body-strength', 'lower-body-strength', 'flexibility'].map((option) => (
              <button key={option} className={`option-button checkbox ${formData.skillsPriority.includes(option) ? 'selected' : ''}`} onClick={() => toggleArrayValue('skillsPriority', option)}>
                {option === 'mobility' && 'Mobility'}
                {option === 'endurance-stamina' && 'Endurance and Stamina'}
                {option === 'running-speed' && 'Running Speed'}
                {option === 'olympic-lifts' && 'Olympic Lifts'}
                {option === 'upper-body-strength' && 'Upper Body Strength'}
                {option === 'lower-body-strength' && 'Lower Body Strength'}
                {option === 'flexibility' && 'Flexibility'}
              </button>
            ))}
            <div className="option-button-other">
              <span>Other</span>
              <input type="text" placeholder="Please specify ...." />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('effort-familiarity')} disabled={formData.skillsPriority.length === 0}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Effort Familiarity Screen */}
      <div className={`typeform-screen ${currentScreen === 'effort-familiarity' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Forge Intake</p>
          <h1 className="typeform-title">Are you comfortable using RPE or RIR for effort?</h1>
          <div className="options-container">
            <button className={`option-button ${formData.effortFamiliarity === 'yes' ? 'selected' : ''}`} onClick={() => handleInputChange('effortFamiliarity', 'yes')}>Yes</button>
            <button className={`option-button ${formData.effortFamiliarity === 'no' ? 'selected' : ''}`} onClick={() => handleInputChange('effortFamiliarity', 'no')}>No</button>
            <button className={`option-button ${formData.effortFamiliarity === 'learn' ? 'selected' : ''}`} onClick={() => handleInputChange('effortFamiliarity', 'learn')}>I would like to learn it</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('current-bests')} disabled={!formData.effortFamiliarity}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Current Bests Screen */}
      <div className={`typeform-screen ${currentScreen === 'current-bests' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Forge Intake</p>
          <h1 className="typeform-title">What are your current bests?</h1>
          <p className="typeform-subtitle">Example: Squat 5RM 100 kg; Bench 5RM 80 kg; Deadlift 5RM 140 kg; Pull ups max 8</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.currentBests} onChange={(e) => handleInputChange('currentBests', e.target.value)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('conditioning-preferences')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Conditioning Preferences Screen */}
      <div className={`typeform-screen ${currentScreen === 'conditioning-preferences' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Forge Intake</p>
          <h1 className="typeform-title">What are your conditioning preferences?</h1>
          <div className="options-container">
            {['zone2-cardio', 'intervals-hiit', 'circuits-metcons', 'sport-specific', 'minimal-none'].map((option) => (
              <button key={option} className={`option-button checkbox ${formData.conditioningPreferences.includes(option) ? 'selected' : ''}`} onClick={() => toggleArrayValue('conditioningPreferences', option)}>
                {option === 'zone2-cardio' && 'Zone 2 Cardio'}
                {option === 'intervals-hiit' && 'Intervals or HIIT'}
                {option === 'circuits-metcons' && 'Circuits or Metcons'}
                {option === 'sport-specific' && 'Sport specific'}
                {option === 'minimal-none' && 'Minimal or None'}
              </button>
            ))}
            <div className="option-button-other">
              <span>Other</span>
              <input type="text" placeholder="Please specify ...." />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('soreness-preference')} disabled={formData.conditioningPreferences.length === 0}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Soreness Preference Screen */}
      <div className={`typeform-screen ${currentScreen === 'soreness-preference' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Forge Intake</p>
          <h1 className="typeform-title">What is your preferred soreness level after sessions?</h1>
          <p className="typeform-subtitle">Reflect on your preferred soreness level and select a number that you feel describes it best, with 1 being little to no soreness and 10 being the maximum amount of soreness.</p>
          <div className="options-container" style={{flexDirection: 'row', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', maxHeight: '250px', overflowY: 'auto'}}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((num) => (
              <button key={num} className={`option-button ${formData.sorenessPreference === num ? 'selected' : ''}`} onClick={() => handleInputChange('sorenessPreference', num)} style={{minWidth: '60px', fontSize: '20px', padding: '10px 15px'}}>{num}</button>
            ))}
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('daily-activity')} disabled={!formData.sorenessPreference}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Daily Activity Screen */}
      <div className={`typeform-screen ${currentScreen === 'daily-activity' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Forge Intake</p>
          <h1 className="typeform-title">How active are you during the day?</h1>
          <div className="options-container">
            <button className={`option-button with-subtitle ${formData.dailyActivity === 'sedentary' ? 'selected' : ''}`} onClick={() => handleInputChange('dailyActivity', 'sedentary')}>
              <div className="option-main">Mostly Sedentary</div>
              <div className="option-sub">You&apos;re seated for most of the day (desk job, driving, watching TV)</div>
            </button>
            <button className={`option-button with-subtitle ${formData.dailyActivity === 'mixed' ? 'selected' : ''}`} onClick={() => handleInputChange('dailyActivity', 'mixed')}>
              <div className="option-main">Mixed Activity</div>
              <div className="option-sub">You&apos;re on your feet for part of the day with light movement (teaching, shopping, light housework)</div>
            </button>
            <button className={`option-button with-subtitle ${formData.dailyActivity === 'active' ? 'selected' : ''}`} onClick={() => handleInputChange('dailyActivity', 'active')}>
              <div className="option-main">Active</div>
              <div className="option-sub">You&apos;re moving most of the day and doing physical tasks (construction work, physical labor, constant walking)</div>
            </button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('completion')} disabled={!formData.dailyActivity}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* First Meal Screen */}
      <div className={`typeform-screen ${currentScreen === 'first-meal' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">When do you typically eat your first meal?</h1>
          <div className="options-container">
            <button className={`option-button ${formData.firstMeal === 'before-7am' ? 'selected' : ''}`} onClick={() => handleInputChange('firstMeal', 'before-7am')}>before 7 am</button>
            <button className={`option-button ${formData.firstMeal === '7-9am' ? 'selected' : ''}`} onClick={() => handleInputChange('firstMeal', '7-9am')}>between 7-9 am</button>
            <button className={`option-button ${formData.firstMeal === '9-11am' ? 'selected' : ''}`} onClick={() => handleInputChange('firstMeal', '9-11am')}>between 9-11 am</button>
            <button className={`option-button ${formData.firstMeal === 'after-11am' ? 'selected' : ''}`} onClick={() => handleInputChange('firstMeal', 'after-11am')}>after 11 am</button>
            <button className={`option-button ${formData.firstMeal === 'varies' ? 'selected' : ''}`} onClick={() => handleInputChange('firstMeal', 'varies')}>varies</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('energy-crash')} disabled={!formData.firstMeal}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Energy Crash Screen */}
      <div className={`typeform-screen ${currentScreen === 'energy-crash' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">When you feel an energy crash, what&apos;s your go-to?</h1>
          <div className="options-container">
            <button className={`option-button ${formData.energyCrash === 'caffeine' ? 'selected' : ''}`} onClick={() => handleInputChange('energyCrash', 'caffeine')}>Caffeine (coffee, tea, energy drink)</button>
            <button className={`option-button ${formData.energyCrash === 'snack' ? 'selected' : ''}`} onClick={() => handleInputChange('energyCrash', 'snack')}>A quick snack</button>
            <button className={`option-button ${formData.energyCrash === 'break' ? 'selected' : ''}`} onClick={() => handleInputChange('energyCrash', 'break')}>Take a break / move / stretch</button>
            <button className={`option-button ${formData.energyCrash === 'push-through' ? 'selected' : ''}`} onClick={() => handleInputChange('energyCrash', 'push-through')}>Push through</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('protein-sources')} disabled={!formData.energyCrash}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Protein Sources Screen */}
      <div className={`typeform-screen ${currentScreen === 'protein-sources' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">What are your preferred protein sources?</h1>
          <div className="options-container">
            {['poultry', 'red-meat', 'fish-seafood', 'eggs', 'dairy', 'plant-based', 'protein-powder'].map((protein) => (
              <button key={protein} className={`option-button checkbox ${formData.proteinSources.includes(protein) ? 'selected' : ''}`} onClick={() => toggleArrayValue('proteinSources', protein)}>
                {protein === 'poultry' && 'Poultry'}
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
              <input type="text" placeholder="Please specify ...." value={formData.otherProtein} onChange={(e) => handleInputChange('otherProtein', e.target.value)} />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('food-dislikes')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
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
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('meals-cooked')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Meals Cooked Screen */}
      <div className={`typeform-screen ${currentScreen === 'meals-cooked' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">How many meals per week do you cook at home?</h1>
          <p className="typeform-subtitle">Your perfect plan is the plan that fits in your schedule.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.mealsCooked} onChange={(e) => handleInputChange('mealsCooked', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'alcohol-consumption', false)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('alcohol-consumption')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Alcohol Consumption Screen */}
      <div className={`typeform-screen ${currentScreen === 'alcohol-consumption' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">How much alcohol do you consumer per week?</h1>
          <p className="typeform-subtitle">Your perfect plan is the plan that works around your habits.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.alcoholConsumption} onChange={(e) => handleInputChange('alcoholConsumption', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'completion', false)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#D4A59A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('completion')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Completion Screen */}
      <div className={`typeform-screen ${currentScreen === 'completion' ? 'active' : 'hidden'}`} style={{justifyContent: 'center', alignItems: 'center'}}>
        <div className="typeform-content" style={{textAlign: 'center'}}>
          <h1 className="typeform-title" style={{fontSize: '64px', marginBottom: '30px', textAlign: 'center'}}>You&apos;re all set.</h1>
          <p className="typeform-subtitle" style={{fontSize: '20px', marginBottom: '60px', maxWidth: '700px', textAlign: 'center', marginLeft: 'auto', marginRight: 'auto'}}>
            Thank you. Your forge profile is ready.<br />
            The final step is to connect your health data.
          </p>
          <div className="button-container" style={{justifyContent: 'center', paddingLeft: '0'}}>
            <button className="typeform-button" onClick={() => handleContinue('final-step-intro')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Section 5: The Final Step - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'final-step-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">5 The Final Step</h1>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('ecosystem-integration')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Ecosystem Integration Screen */}
      <div className={`typeform-screen ${currentScreen === 'ecosystem-integration' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">5 The Final Step</p>
          <h1 className="typeform-title">Integrate forge into your ecosystem.</h1>
          <p className="typeform-subtitle">Activity, sleep, and metabolic data help optimize meal content, calendar helps optimize timing.</p>

          <div className="integrations-scroll-container">
            {/* Connected Integrations Section */}
            {(gmailConnected || appleHealthConnected || appleCalendarConnected || outlookConnected || slackConnected || formData.integrations.length > 0) && (
              <>
                <div className="integration-section-header">
                  <h2 className="integration-section-title">Connected</h2>
                  <p className="integration-section-description">These integrations are active and providing data</p>
                </div>
                <div className="integrations-grid connected-grid">
                {gmailConnected && (
                  <div className="integration-item">
                    <div className="integration-logo">
                      <img src="/images/google.png" alt="Google Calendar" />
                    </div>
                    <div className="integration-info">
                      <h3 className="integration-name">Google Calendar</h3>
                      <p className="integration-description">Sync your schedule for meal timing optimization</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectGmail}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {appleHealthConnected && (
                  <div className="integration-item">
                    <div className="integration-info">
                      <h3 className="integration-name">Apple Health</h3>
                      <p className="integration-description">Track activity, sleep, and health metrics</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectAppleHealth}>
                      ✓ Connected
                    </button>
                  </div>
                )}

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
                      <p className="integration-description">Receive daily meal plans and reminders</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectSlack}>
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

                {formData.integrations.includes('whoop') && (
                  <div className="integration-item">
                    <div className="integration-info">
                      <h3 className="integration-name">WHOOP</h3>
                      <p className="integration-description">Upload your recovery and strain data</p>
                    </div>
                    <button className="connect-button connected" onClick={() => handleOpenUploadModal('whoop')}>
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
          <div className="integration-section-header" style={{marginTop: (gmailConnected || appleHealthConnected || appleCalendarConnected || outlookConnected || slackConnected || formData.integrations.length > 0) ? '32px' : '0'}}>
            <h2 className="integration-section-title">Available</h2>
            <p className="integration-section-description">Connect your tools to provide Forge with richer data</p>
          </div>
          <div className="integrations-grid">
            {!gmailConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/google.png" alt="Google Calendar" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Google Calendar</h3>
                  <p className="integration-description">Sync your schedule for meal timing optimization</p>
                </div>
                <button className="connect-button" onClick={handleConnectGmail}>
                  Connect
                </button>
              </div>
            )}

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
                  <p className="integration-description">Receive daily meal plans and reminders</p>
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

            {!teamsConnected && (
              <div className="integration-item">
                <div className="integration-logo">
                  <img src="/images/teams.png" alt="Microsoft Teams" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Microsoft Teams</h3>
                  <p className="integration-description">Search and send messages in Teams</p>
                </div>
                <button className="connect-button" onClick={handleConnectTeams}>
                  Connect
                </button>
              </div>
            )}

            {teamsConnected && (
              <div className="integration-item connected">
                <div className="integration-logo">
                  <img src="/images/teams.png" alt="Microsoft Teams" />
                </div>
                <div className="integration-info">
                  <h3 className="integration-name">Microsoft Teams</h3>
                  <p className="integration-description">Connected: {teamsEmail}</p>
                </div>
                <button className="disconnect-button" onClick={handleDisconnectTeams}>
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
                  <img src="/images/vital.png" alt="Vital Health" />
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Lab Upload Screen */}
      <div className={`typeform-screen ${currentScreen === 'lab-upload' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">5 The Final Step</p>
          <h1 className="typeform-title">Upload your labs and bloodwork.</h1>
          <p className="typeform-subtitle">Please upload your most recent blood test results to unlock your personalized plan.</p>
          <div className="upload-container">
            <div
              className="upload-box"
              style={{cursor: labFileUploading ? 'not-allowed' : 'pointer', opacity: labFileUploading ? 0.6 : 1}}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => !labFileUploading && document.getElementById('lab-upload-input')?.click()}
            >
              {labFileUploading ? (
                <>
                  <div style={{fontSize: '16px', marginBottom: '8px'}}>Analyzing your lab results...</div>
                  <div style={{fontSize: '14px', color: '#666'}}>This may take a moment</div>
                </>
              ) : (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginBottom: '16px', opacity: 0.5}}>
                    <path d="M12 15V3M12 3L8 7M12 3L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L2 19C2 20.1046 2.89543 21 4 21L20 21C21.1046 21 22 20.1046 22 19L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div style={{fontWeight: 500, marginBottom: '8px'}}>Click to upload or drag and drop</div>
                  <div style={{fontSize: '14px', color: '#999'}}>PDF, PNG, JPG • max 10MB</div>
                </>
              )}
            </div>
            <input
              id="lab-upload-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={labFileUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLabFileUpload(file);
              }}
              style={{display: 'none'}}
            />
            {labFileError && (
              <div style={{marginTop: '16px', padding: '12px', background: '#ffebee', borderRadius: '8px', fontSize: '14px', color: '#c62828'}}>
                Error: {labFileError}
              </div>
            )}
            {formData.labFile && !labFileError && (
              <div style={{marginTop: '16px', padding: '12px', background: '#e8f5e9', borderRadius: '8px', fontSize: '14px', color: '#2e7d32'}}>
                ✓ Lab results uploaded and analyzed: {formData.labFile.name}
              </div>
            )}
          </div>
          {/* <p className="typeform-subtitle" style={{marginTop: '40px', fontSize: '15px'}}>
            Don&apos;t have labs? No problem. <a href="#" style={{color: '#2d3a2d', textDecoration: 'underline'}}>Find out your options ↗</a> or skip to add later.
          </p> */}
          <div className="button-container">
            <button className="typeform-button" onClick={handleSubmit}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

      {/* Final Completion Screen */}
      <div className={`typeform-screen ${currentScreen === 'final-completion' ? 'active' : 'hidden'}`} style={{
        backgroundImage: 'url(/images/forge-loading.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        <div className="typeform-content">
          <h1 style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '56px',
            fontWeight: 400,
            color: '#ffffff',
            marginBottom: '24px',
            lineHeight: '1.2',
            letterSpacing: '-0.5px',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}>
            Your plan is<br />
            being generated.
          </h1>
          <p style={{
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '18px',
            fontWeight: 400,
            color: '#ffffff',
            marginBottom: '32px',
            maxWidth: '650px',
            lineHeight: '1.6',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
          }}>
            We&apos;re analyzing your unique biology, health data, and goals to create your personalized fitness plan.
          </p>
          <p style={{
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            fontWeight: 400,
            color: '#ffffff',
            marginBottom: '60px',
            maxWidth: '650px',
            lineHeight: '1.6',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
          }}>
            This typically takes 5-15 minutes. You&apos;ll receive an email at <strong>{formData.email}</strong> when your plan is ready.
          </p>
          <div className="typeform-brand">forge</div>
        </div>
      </div>

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
            ref={loadingVideoRef}
            autoPlay
            muted
            loop
            playsInline
            className="loading-video"
          >
            <source src="/videos/forge.mp4" type="video/mp4" />
          </video>
          <button
            className="video-sound-toggle"
            onClick={toggleLoadingSound}
            aria-label={loadingVideoMuted ? 'Unmute video' : 'Mute video'}
            style={{
              position: 'absolute',
              bottom: '30px',
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
            {loadingVideoMuted ? (
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
                    moccet forge Agents are building your plan.
                  </p>
                  <p style={{ fontSize: '15px', marginBottom: '12px' }}>
                    This may take up to 5 minutes.
                  </p>
                  <p style={{ fontSize: '15px', marginBottom: '24px' }}>
                    You can close this screen and forge will email you once your plan is ready.
                  </p>
                </div>
              )}
              <div className="loading-text">loading forge plan</div>
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
