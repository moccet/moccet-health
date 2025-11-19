'use client';

import { useState, useEffect } from 'react';
import './onboarding.css';

type Screen =
  | 'intro' | 'welcome' | 'name' | 'age' | 'gender' | 'weight' | 'height'
  | 'email' | 'ikigai-intro' | 'main-priority' | 'driving-goal'
  | 'baseline-intro' | 'allergies' | 'medications' | 'supplements' | 'medical-conditions'
  | 'fuel-intro' | 'eating-style' | 'first-meal' | 'energy-crash' | 'protein-sources' | 'food-dislikes'
  | 'meals-cooked' | 'alcohol-consumption' | 'completion' | 'final-step-intro' | 'ecosystem-integration' | 'lab-upload' | 'final-completion';

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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalType, setUploadModalType] = useState<'oura-ring' | 'whoop' | 'cgm' | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Calculate progress percentage based on current screen
  const calculateProgress = () => {
    const screens: Screen[] = [
      'intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
      'email', 'ikigai-intro', 'main-priority', 'driving-goal',
      'baseline-intro', 'allergies', 'medications', 'supplements', 'medical-conditions',
      'fuel-intro', 'eating-style', 'first-meal', 'energy-crash', 'protein-sources', 'food-dislikes',
      'meals-cooked', 'alcohol-consumption', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'final-completion'
    ];
    const currentIndex = screens.indexOf(currentScreen);
    if (currentIndex === -1) return 0;
    return (currentIndex / (screens.length - 1)) * 100;
  };

  // Dev mode: Skip to plan with mock data
  const handleDevSkipToPlan = async () => {
    const mockData = {
      fullName: 'Rhouda Test',
      age: '32',
      gender: 'female',
      weight: '145',
      weightUnit: 'lbs',
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
      proteinSources: ['poultry', 'fish-seafood', 'eggs'],
      otherProtein: '',
      foodDislikes: 'Brussels sprouts',
      mealsCooked: '10-12',
      alcoholConsumption: '1-2 drinks per week',
      integrations: ['apple-health'],
      timestamp: new Date().toISOString(),
      completed: true,
    };

    try {
      // Submit mock data to onboarding API
      await fetch('/api/sage-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockData),
      });

      // Redirect to plan page
      window.location.href = `/sage/personalised-plan?email=${encodeURIComponent(mockData.email)}`;
    } catch (error) {
      console.error('Error in dev skip:', error);
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
    try {
      // For Apple Health, we'll use a simple popup/modal approach
      // In a real implementation, this would use Apple's HealthKit OAuth
      const response = await fetch('/api/apple-health/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open in a new window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
          data.authUrl,
          'apple-health-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const cookies = document.cookie.split(';');
          const appleHealthCookie = cookies.find(c => c.trim().startsWith('apple_health_connected='));

          if (appleHealthCookie) {
            setAppleHealthConnected(true);
            // Add apple-health to integrations if not already present
            setFormData(prev => ({
              ...prev,
              integrations: prev.integrations.includes('apple-health')
                ? prev.integrations
                : [...prev.integrations, 'apple-health']
            }));
            clearInterval(pollInterval);
          }
        }, 1000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err) {
      console.error('Error connecting Apple Health:', err);
      alert('Failed to connect Apple Health');
    }
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

  const handleOpenUploadModal = (type: 'oura-ring' | 'whoop' | 'cgm') => {
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

  const toggleArrayValue = (field: 'allergies' | 'medicalConditions' | 'proteinSources' | 'integrations', value: string) => {
    setFormData(prev => {
      const currentArray = prev[field];
      if (currentArray.includes(value)) {
        return { ...prev, [field]: currentArray.filter((v: string) => v !== value) };
      } else {
        return { ...prev, [field]: [...currentArray, value] };
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

  const handleBack = () => {
    const screens: Screen[] = [
      'intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
      'email', 'ikigai-intro', 'main-priority', 'driving-goal',
      'baseline-intro', 'allergies', 'medications', 'supplements', 'medical-conditions',
      'fuel-intro', 'eating-style', 'first-meal', 'energy-crash', 'protein-sources', 'food-dislikes',
      'meals-cooked', 'alcohol-consumption', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'final-completion'
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

      // If user uploaded a lab file, analyze it with AI (AWAIT this - it needs to complete first)
      if (formData.labFile) {
        console.log('Uploading and analyzing lab file with AI...');
        const labFormData = new FormData();
        labFormData.append('bloodTest', formData.labFile);
        labFormData.append('email', formData.email);

        try {
          await fetch('/api/analyze-blood-results', {
            method: 'POST',
            body: labFormData,
          });
          console.log('Lab file analysis initiated successfully');
        } catch (err) {
          console.error('Error analyzing lab file:', err);
          // Continue even if analysis fails
        }
      }

      // Trigger background plan generation (this will wait for analysis to complete server-side)
      console.log('Starting background plan generation...');
      fetch('/api/generate-plan-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          uniqueCode: uniqueCode,
          fullName: userFirstName,
        }),
      }).catch(err => {
        console.error('Error starting plan generation:', err);
      });

      setLoadingProgress(100);

      // Redirect to plan page after a short delay
      setTimeout(() => {
        clearInterval(progressInterval);
        setIsLoading(false);

        const redirectUrl = uniqueCode
          ? `/sage/personalised-plan?code=${uniqueCode}`
          : `/sage/personalised-plan?email=${encodeURIComponent(formData.email)}`;

        window.location.href = redirectUrl;
      }, 2000);
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
          playsInline
          className="intro-video"
          preload="auto"
        >
          <source src="/videos/sage.mp4" type="video/mp4" />
        </video>
        <button
          className="skip-intro-button"
          onClick={() => setCurrentScreen('welcome')}
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

          <div className="welcome-brand">sage</div>
        </div>
      </div>

      {/* Name Screen */}
      <div className={`typeform-screen ${currentScreen === 'name' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What&apos;s your full name?</h1>
          <p className="typeform-subtitle">We&apos;ll use this to personalize your sage experience and keep your profile secure.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'age', !formData.fullName.trim() || formData.fullName.trim().split(/\s+/).length < 2)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Height Screen */}
      <div className={`typeform-screen ${currentScreen === 'height' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What is your height?</h1>
          <p className="typeform-subtitle">Please enter your height in centimeters, this helps us create your personalized plan.</p>
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
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('email')} disabled={!formData.height.trim()}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className={`option-button with-subtitle ${formData.mainPriority === 'longevity' ? 'selected' : ''}`} onClick={() => handleInputChange('mainPriority', 'longevity')}>
              <div className="option-main">Longevity and Aging</div>
              <div className="option-sub">Preventing disease & increasing long-term health</div>
            </button>
            <button className={`option-button with-subtitle ${formData.mainPriority === 'cognitive' ? 'selected' : ''}`} onClick={() => handleInputChange('mainPriority', 'cognitive')}>
              <div className="option-main">Cognitive Performance</div>
              <div className="option-sub">Better focus & mental clarity</div>
            </button>
            <button className={`option-button with-subtitle ${formData.mainPriority === 'physical' ? 'selected' : ''}`} onClick={() => handleInputChange('mainPriority', 'physical')}>
              <div className="option-main">Physical performance</div>
              <div className="option-sub">More stamina & less fatigue</div>
            </button>
            <button className={`option-button with-subtitle ${formData.mainPriority === 'body-composition' ? 'selected' : ''}`} onClick={() => handleInputChange('mainPriority', 'body-composition')}>
              <div className="option-main">Body composition</div>
              <div className="option-sub">Losing fat & building muscle</div>
            </button>
            <button className={`option-button with-subtitle ${formData.mainPriority === 'emotional' ? 'selected' : ''}`} onClick={() => handleInputChange('mainPriority', 'emotional')}>
              <div className="option-main">Emotional Balance</div>
              <div className="option-sub">Reducing stress & improving mood</div>
            </button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('driving-goal')} disabled={!formData.mainPriority}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className={`option-button ${formData.drivingGoal === 'career' ? 'selected' : ''}`} onClick={() => handleInputChange('drivingGoal', 'career')}>Career & Performance</button>
            <button className={`option-button ${formData.drivingGoal === 'family' ? 'selected' : ''}`} onClick={() => handleInputChange('drivingGoal', 'family')}>Family & Relationships</button>
            <button className={`option-button ${formData.drivingGoal === 'athletic' ? 'selected' : ''}`} onClick={() => handleInputChange('drivingGoal', 'athletic')}>An Athletic or Personal Goal</button>
            <button className={`option-button ${formData.drivingGoal === 'health' ? 'selected' : ''}`} onClick={() => handleInputChange('drivingGoal', 'health')}>General Health & Well-being</button>
            <button className={`option-button ${formData.drivingGoal === 'condition' ? 'selected' : ''}`} onClick={() => handleInputChange('drivingGoal', 'condition')}>Managing a Health Condition</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('baseline-intro')} disabled={!formData.drivingGoal}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
              <button key={option} className={`option-button checkbox ${formData.allergies.includes(option) ? 'selected' : ''}`} onClick={() => toggleArrayValue('allergies', option)}>
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
              <input type="text" placeholder="Please specify ...." value={formData.otherAllergy} onChange={(e) => handleInputChange('otherAllergy', e.target.value)} />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('medications')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
              <button key={option} className={`option-button checkbox ${formData.medicalConditions.includes(option) ? 'selected' : ''}`} onClick={() => toggleArrayValue('medicalConditions', option)}>
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
              <input type="text" placeholder="Please specify ...." value={formData.otherCondition} onChange={(e) => handleInputChange('otherCondition', e.target.value)} />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('fuel-intro')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Eating Style Screen */}
      <div className={`typeform-screen ${currentScreen === 'eating-style' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Fuel</p>
          <h1 className="typeform-title">Which best describes your typical eating style?</h1>
          <div className="options-container image-cards">
            <button className={`option-button image-card ${formData.eatingStyle === '3-meals' ? 'selected' : ''}`} onClick={() => handleInputChange('eatingStyle', '3-meals')}>
              <div className="image-placeholder" style={{backgroundImage: 'url(/images/eating-styles/3-meals.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
              <div className="image-card-label">3 meals a day</div>
            </button>
            <button className={`option-button image-card ${formData.eatingStyle === 'intermittent-fasting' ? 'selected' : ''}`} onClick={() => handleInputChange('eatingStyle', 'intermittent-fasting')}>
              <div className="image-placeholder" style={{backgroundImage: 'url(/images/eating-styles/intermittent-fasting.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
              <div className="image-card-label">Intermittent Fasting</div>
            </button>
            <button className={`option-button image-card ${formData.eatingStyle === 'snacking-grazing' ? 'selected' : ''}`} onClick={() => handleInputChange('eatingStyle', 'snacking-grazing')}>
              <div className="image-placeholder" style={{backgroundImage: 'url(/images/eating-styles/snacking.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
              <div className="image-card-label">Snacking / Grazing</div>
            </button>
            <button className={`option-button image-card ${formData.eatingStyle === 'no-pattern' ? 'selected' : ''}`} onClick={() => handleInputChange('eatingStyle', 'no-pattern')}>
              <div className="image-placeholder" style={{backgroundImage: 'url(/images/eating-styles/no-pattern.png)', backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
              <div className="image-card-label">no set pattern</div>
            </button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('first-meal')} disabled={!formData.eatingStyle}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
          <div className="typeform-brand">sage</div>
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
          <div className="typeform-brand">sage</div>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.mealsCooked} onChange={(e) => handleInputChange('mealsCooked', e.target.value)} onKeyPress={(e) => handleKeyPress(e, 'alcohol-consumption', false)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('alcohol-consumption')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
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
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('completion')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
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
            {(gmailConnected || appleHealthConnected || appleCalendarConnected || outlookConnected || slackConnected || formData.integrations.length > 0) && (
              <>
                <div className="integration-section-header">
                  <h2 className="integration-section-title">Connected</h2>
                  <p className="integration-section-description">These integrations are active and providing data</p>
                </div>
                <div className="integrations-grid connected-grid">
                {gmailConnected && (
                  <div className="integration-item">
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

                {appleCalendarConnected && (
                  <div className="integration-item">
                    <div className="integration-info">
                      <h3 className="integration-name">Apple Calendar</h3>
                      <p className="integration-description">Optimize meal timing based on your schedule</p>
                    </div>
                    <button className="connect-button connected" onClick={handleDisconnectAppleCalendar}>
                      ✓ Connected
                    </button>
                  </div>
                )}

                {outlookConnected && (
                  <div className="integration-item">
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
              </div>
            </>
          )}

          {/* Available Integrations Section */}
          <div className="integration-section-header" style={{marginTop: (gmailConnected || appleHealthConnected || appleCalendarConnected || outlookConnected || slackConnected || formData.integrations.length > 0) ? '32px' : '0'}}>
            <h2 className="integration-section-title">Available</h2>
            <p className="integration-section-description">Connect your tools to provide Sage with richer data</p>
          </div>
          <div className="integrations-grid">
            {!gmailConnected && (
              <div className="integration-item">
                <div className="integration-info">
                  <h3 className="integration-name">Google Calendar</h3>
                  <p className="integration-description">Sync your schedule for meal timing optimization</p>
                </div>
                <button className="connect-button" onClick={handleConnectGmail}>
                  Connect
                </button>
              </div>
            )}

            {!appleHealthConnected && (
              <div className="integration-item">
                <div className="integration-info">
                  <h3 className="integration-name">Apple Health</h3>
                  <p className="integration-description">Track activity, sleep, and health metrics</p>
                </div>
                <button className="connect-button" onClick={handleConnectAppleHealth}>
                  Connect
                </button>
              </div>
            )}

            {!appleCalendarConnected && (
              <div className="integration-item">
                <div className="integration-info">
                  <h3 className="integration-name">Apple Calendar</h3>
                  <p className="integration-description">Optimize meal timing based on your schedule</p>
                </div>
                <button className="connect-button" onClick={handleConnectAppleCalendar}>
                  Connect
                </button>
              </div>
            )}

            {!outlookConnected && (
              <div className="integration-item">
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
                <div className="integration-info">
                  <h3 className="integration-name">Slack</h3>
                  <p className="integration-description">Receive daily meal plans and reminders</p>
                </div>
                <button className="connect-button" onClick={handleConnectSlack}>
                  Connect
                </button>
              </div>
            )}

            {!formData.integrations.includes('oura-ring') && (
              <div className="integration-item">
                <div className="integration-info">
                  <h3 className="integration-name">Oura Ring</h3>
                  <p className="integration-description">Upload your sleep and activity data</p>
                </div>
                <button className="connect-button" onClick={() => handleOpenUploadModal('oura-ring')}>
                  Connect
                </button>
              </div>
            )}

            {!formData.integrations.includes('whoop') && (
              <div className="integration-item">
                <div className="integration-info">
                  <h3 className="integration-name">WHOOP</h3>
                  <p className="integration-description">Upload your recovery and strain data</p>
                </div>
                <button className="connect-button" onClick={() => handleOpenUploadModal('whoop')}>
                  Connect
                </button>
              </div>
            )}

            {!formData.integrations.includes('cgm') && (
              <div className="integration-item">
                <div className="integration-info">
                  <h3 className="integration-name">Continuous Glucose Monitor</h3>
                  <p className="integration-description">Upload your glucose readings</p>
                </div>
                <button className="connect-button" onClick={() => handleOpenUploadModal('cgm')}>
                  Connect
                </button>
              </div>
            )}
          </div>
          </div>

          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('lab-upload')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Lab Upload Screen */}
      <div className={`typeform-screen ${currentScreen === 'lab-upload' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">4 The Final Step</p>
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
                  <div style={{fontSize: '14px', color: '#999'}}>PDF, PNG, JPEG • max 10MB</div>
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
            <button className="typeform-button" onClick={() => handleContinue('final-completion')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Final Completion Screen */}
      <div className={`typeform-screen ${currentScreen === 'final-completion' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title" style={{fontSize: '56px', marginBottom: '24px', lineHeight: '1.2'}}>
            Today,<br />
            you take meaningful action toward your goals.
          </h1>
          <p className="typeform-subtitle" style={{fontSize: '18px', marginBottom: '60px', maxWidth: '650px'}}>
            Your nutrition plan is ready. Your best self is waiting for you.
          </p>
          <div className="button-container">
            <button className="typeform-button" style={{fontSize: '18px', padding: '18px 32px'}} onClick={handleSubmit}>
              View My Plan →
            </button>
          </div>
          <div className="typeform-brand">sage</div>
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
