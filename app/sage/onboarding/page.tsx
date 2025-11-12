'use client';

import { useState, useEffect } from 'react';
import './onboarding.css';

type Screen =
  | 'intro' | 'welcome' | 'name' | 'age' | 'gender' | 'weight' | 'height'
  | 'email' | 'ikigai-intro' | 'main-priority' | 'driving-goal'
  | 'baseline-intro' | 'allergies' | 'medications' | 'supplements' | 'medical-conditions'
  | 'form-intro' | 'workout-time' | 'workout-days' | 'gym-equipment'
  | 'fuel-intro' | 'eating-style' | 'first-meal' | 'energy-crash' | 'protein-sources' | 'food-dislikes'
  | 'meals-cooked' | 'alcohol-consumption' | 'completion' | 'final-step-intro' | 'ecosystem-integration' | 'lab-upload' | 'final-completion' | 'gmail-connect' | 'slack-connect';

export default function SageOnboarding() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('intro');
  const [labFileUploading, setLabFileUploading] = useState(false);
  const [labFileError, setLabFileError] = useState('');
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeam, setSlackTeam] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    gender: '',
    weight: '',
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
    workoutTime: '',
    workoutDays: '',
    gymEquipment: [] as string[],
    otherEquipment: '',
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


  // Auto-transition from intro to welcome after 5 seconds
  useEffect(() => {
    if (currentScreen === 'intro') {
      const timer = setTimeout(() => {
        setCurrentScreen('welcome');
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Check if Gmail and Slack are already connected on mount
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const gmailEmailCookie = cookies.find(c => c.trim().startsWith('gmail_email='));
    const slackTeamCookie = cookies.find(c => c.trim().startsWith('slack_team='));

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
  }, []);

  const handleConnectGmail = async () => {
    try {
      const response = await fetch('/api/gmail/auth');
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
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
      window.location.reload();
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
    }
  };

  const handleConnectSlack = async () => {
    try {
      const response = await fetch('/api/slack/auth');
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
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
      window.location.reload();
    } catch (err) {
      console.error('Error disconnecting Slack:', err);
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
      const formDataPayload = new FormData();
      formDataPayload.append('bloodTest', file);

      const response = await fetch('/api/analyze-health-data', {
        method: 'POST',
        body: formDataPayload,
      });

      const data = await response.json();

      if (data.success) {
        // Store the analysis results
        handleInputChange('labFile', file);
        console.log('Lab analysis complete:', data.insights);
      } else {
        setLabFileError(data.error || 'Failed to analyze lab data');
      }
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

  const toggleArrayValue = (field: 'allergies' | 'medicalConditions' | 'gymEquipment' | 'proteinSources' | 'integrations', value: string) => {
    setFormData(prev => {
      const currentArray = prev[field];
      if (currentArray.includes(value)) {
        return { ...prev, [field]: currentArray.filter(v => v !== value) };
      } else {
        return { ...prev, [field]: [...currentArray, value] };
      }
    });
  };

  const handleContinue = (nextScreen: Screen) => {
    setCurrentScreen(nextScreen);
  };

  const handleBack = () => {
    const screens: Screen[] = [
      'intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
      'email', 'ikigai-intro', 'main-priority', 'driving-goal',
      'baseline-intro', 'allergies', 'medications', 'supplements', 'medical-conditions',
      'form-intro', 'workout-time', 'workout-days', 'gym-equipment',
      'fuel-intro', 'eating-style', 'first-meal', 'energy-crash', 'protein-sources', 'food-dislikes',
      'meals-cooked', 'alcohol-consumption', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'final-completion', 'gmail-connect', 'slack-connect'
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

    try {
      const response = await fetch('/api/sage-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingData),
      });

      if (response.ok) {
        console.log('Onboarding data submitted successfully');
        window.location.href = '/sage';
      } else {
        console.error('Failed to submit onboarding data');
      }
    } catch (error) {
      console.error('Error submitting onboarding data:', error);
    }
  };

  return (
    <div className="onboarding-container">
      {/* Intro Screen */}
      <div className={`intro-screen ${currentScreen === 'intro' ? 'active' : 'hidden'}`}>
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
          <div className="welcome-brand">sage</div>
        </div>
      </div>

      {/* Name Screen */}
      <div className={`typeform-screen ${currentScreen === 'name' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">What&apos;s your full name?</h1>
          <p className="typeform-subtitle">We&apos;ll use this to personalize your sage experience and keep your profile secure.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('age')} disabled={!formData.fullName.trim()}>Continue</button>
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
            <input type="number" className="typeform-input" placeholder="Type your answer here" value={formData.age} onChange={(e) => handleInputChange('age', e.target.value)} autoFocus />
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
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.weight} onChange={(e) => handleInputChange('weight', e.target.value)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
          <p className="typeform-subtitle">Please enter your height, this helps us create your personalized plan.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.height} onChange={(e) => handleInputChange('height', e.target.value)} autoFocus />
            <svg className="microphone-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13C11.6569 13 13 11.6569 13 10V5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5V10C7 11.6569 8.34315 13 10 13Z" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16V18" stroke="#c9d5c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
            <input type="email" className="typeform-input" placeholder="name@example.com" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} autoFocus />
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('ikigai-intro')} disabled={!formData.email.trim()}>Continue</button>
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
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.medications} onChange={(e) => handleInputChange('medications', e.target.value)} autoFocus />
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
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.supplements} onChange={(e) => handleInputChange('supplements', e.target.value)} autoFocus />
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
            <button className="typeform-button" onClick={() => handleContinue('form-intro')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Section 3: The Form - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'form-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">3 The Form</h1>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('workout-time')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Workout Time Screen */}
      <div className={`typeform-screen ${currentScreen === 'workout-time' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Form</p>
          <h1 className="typeform-title">How much time can you commit to working out?</h1>
          <div className="options-container">
            <button className={`option-button ${formData.workoutTime === '15-min' ? 'selected' : ''}`} onClick={() => handleInputChange('workoutTime', '15-min')}>15 Minutes</button>
            <button className={`option-button ${formData.workoutTime === '30-min' ? 'selected' : ''}`} onClick={() => handleInputChange('workoutTime', '30-min')}>30 Minutes</button>
            <button className={`option-button ${formData.workoutTime === '45-min' ? 'selected' : ''}`} onClick={() => handleInputChange('workoutTime', '45-min')}>45 Minutes</button>
            <button className={`option-button ${formData.workoutTime === '1-hour' ? 'selected' : ''}`} onClick={() => handleInputChange('workoutTime', '1-hour')}>1 Hour</button>
            <button className={`option-button ${formData.workoutTime === 'more-than-1-hour' ? 'selected' : ''}`} onClick={() => handleInputChange('workoutTime', 'more-than-1-hour')}>More than 1 hour</button>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('workout-days')} disabled={!formData.workoutTime}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Workout Days Screen */}
      <div className={`typeform-screen ${currentScreen === 'workout-days' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Form</p>
          <h1 className="typeform-title">How many days per week can you work out?</h1>
          <div className="options-container">
            {['1', '2', '3', '4', '5', '6', '7'].map((day) => (
              <button key={day} className={`option-button ${formData.workoutDays === day ? 'selected' : ''}`} onClick={() => handleInputChange('workoutDays', day)}>{day}</button>
            ))}
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('gym-equipment')} disabled={!formData.workoutDays}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Gym Equipment Screen */}
      <div className={`typeform-screen ${currentScreen === 'gym-equipment' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">3 The Form</p>
          <h1 className="typeform-title">Do you have any gym equipment? If so, what kind?</h1>
          <div className="options-container">
            {['dumbbells', 'barbell', 'kettlebells', 'resistance-bands', 'pull-up-bar', 'bench', 'full-gym', 'none'].map((equipment) => (
              <button key={equipment} className={`option-button checkbox ${formData.gymEquipment.includes(equipment) ? 'selected' : ''}`} onClick={() => toggleArrayValue('gymEquipment', equipment)}>
                {equipment === 'dumbbells' && 'Dumbbells'}
                {equipment === 'barbell' && 'Barbell'}
                {equipment === 'kettlebells' && 'Kettlebells'}
                {equipment === 'resistance-bands' && 'Resistance Bands'}
                {equipment === 'pull-up-bar' && 'Pull-up Bar'}
                {equipment === 'bench' && 'Bench'}
                {equipment === 'full-gym' && 'Full Gym Access'}
                {equipment === 'none' && 'None'}
              </button>
            ))}
            <div className="option-button-other">
              <span>Other</span>
              <input type="text" placeholder="Please specify ...." value={formData.otherEquipment} onChange={(e) => handleInputChange('otherEquipment', e.target.value)} />
            </div>
          </div>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('fuel-intro')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Section 4: The Fuel - Intro */}
      <div className={`typeform-screen section-screen ${currentScreen === 'fuel-intro' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="section-title">4 The Fuel</h1>
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
          <p className="section-label">4 The Fuel</p>
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
          <p className="section-label">4 The Fuel</p>
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
          <p className="section-label">4 The Fuel</p>
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
          <p className="section-label">4 The Fuel</p>
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
          <p className="section-label">4 The Fuel</p>
          <h1 className="typeform-title">Any foods you strongly dislike?</h1>
          <p className="typeform-subtitle">This helps us avoid recommending things you don&apos;t enjoy.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.foodDislikes} onChange={(e) => handleInputChange('foodDislikes', e.target.value)} autoFocus />
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
          <p className="section-label">4 The Fuel</p>
          <h1 className="typeform-title">How many meals per week do you cook at home?</h1>
          <p className="typeform-subtitle">Your perfect plan is the plan that fits in your schedule.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.mealsCooked} onChange={(e) => handleInputChange('mealsCooked', e.target.value)} autoFocus />
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
          <p className="section-label">4 The Fuel</p>
          <h1 className="typeform-title">How much alcohol do you consumer per week?</h1>
          <p className="typeform-subtitle">Your perfect plan is the plan that works around your habits.</p>
          <div className="input-container">
            <input type="text" className="typeform-input" placeholder="Type your answer here" value={formData.alcoholConsumption} onChange={(e) => handleInputChange('alcoholConsumption', e.target.value)} autoFocus />
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
        <div className="typeform-content">
          <h1 className="typeform-title" style={{fontSize: '64px', marginBottom: '30px'}}>You&apos;re all set.</h1>
          <p className="typeform-subtitle" style={{fontSize: '20px', marginBottom: '60px', maxWidth: '700px'}}>
            Thank you. Your sage profile is ready.<br />
            The final step is to connect your health data.
          </p>
          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('final-step-intro')}>Continue</button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
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
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Ecosystem Integration Screen */}
      <div className={`typeform-screen ${currentScreen === 'ecosystem-integration' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <p className="section-label">5 The Final Step</p>
          <h1 className="typeform-title">Integrate sage into your ecosystem.</h1>
          <p className="typeform-subtitle">Activity, sleep, and metabolic data help optimize meal content, calendar helps optimize timing.</p>
          <div className="options-container">
            {['oura-ring', 'whoop', 'cgm', 'apple-health', 'apple-calendar', 'google-calendar', 'outlook', 'slack'].map((integration) => (
              <button key={integration} className={`option-button checkbox ${formData.integrations.includes(integration) ? 'selected' : ''}`} onClick={() => toggleArrayValue('integrations', integration)}>
                {integration === 'oura-ring' && 'Oura Ring'}
                {integration === 'whoop' && 'WHOOP'}
                {integration === 'cgm' && 'Continuous Glucose Monitor'}
                {integration === 'apple-health' && 'Apple Health'}
                {integration === 'apple-calendar' && 'Apple Calendar'}
                {integration === 'google-calendar' && 'Google Calendar'}
                {integration === 'outlook' && 'Outlook'}
                {integration === 'slack' && 'Slack'}
              </button>
            ))}
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
          <p className="typeform-subtitle" style={{marginTop: '40px', fontSize: '15px'}}>
            Don&apos;t have labs? No problem. <a href="#" style={{color: '#2d3a2d', textDecoration: 'underline'}}>Find out your options ↗</a> or skip to add later.
          </p>
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
            <button className="typeform-button" style={{fontSize: '18px', padding: '18px 32px'}} onClick={() => handleContinue('gmail-connect')}>
              Continue →
            </button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Gmail Connect Screen */}
      <div className={`typeform-screen ${currentScreen === 'gmail-connect' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">Connect your Gmail</h1>
          <p className="typeform-subtitle">Connect Gmail to enable automated meal planning and grocery ordering based on your schedule and preferences.</p>

          {gmailConnected ? (
            <div style={{marginBottom: '40px'}}>
              <div style={{
                padding: '20px',
                background: '#e8f5e9',
                borderRadius: '8px',
                border: '2px solid #66bb6a',
                marginBottom: '20px'
              }}>
                <div style={{fontSize: '16px', color: '#2e7d32', marginBottom: '8px', fontWeight: 500}}>
                  ✓ Connected to Gmail
                </div>
                <div style={{fontSize: '15px', color: '#388e3c'}}>
                  {gmailEmail}
                </div>
              </div>
              <button
                onClick={handleDisconnectGmail}
                style={{
                  padding: '10px 20px',
                  fontSize: '15px',
                  background: '#ffebee',
                  color: '#c62828',
                  border: '1px solid #ef5350',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Disconnect Gmail
              </button>
            </div>
          ) : (
            <div style={{marginBottom: '40px'}}>
              <div style={{
                padding: '40px',
                background: '#e8ede6',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginBottom: '16px'}}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <button
                  onClick={handleConnectGmail}
                  style={{
                    padding: '12px 32px',
                    fontSize: '16px',
                    background: '#4285f4',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Connect Gmail
                </button>
              </div>
              <p style={{fontSize: '14px', color: '#666', textAlign: 'center'}}>
                Your data is secure and will only be used for meal planning
              </p>
            </div>
          )}

          <div className="button-container">
            <button className="typeform-button" onClick={() => handleContinue('slack-connect')}>
              Continue
            </button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>

      {/* Slack Connect Screen */}
      <div className={`typeform-screen ${currentScreen === 'slack-connect' ? 'active' : 'hidden'}`}>
        <div className="typeform-content">
          <h1 className="typeform-title">Connect your Slack</h1>
          <p className="typeform-subtitle">Connect Slack to receive daily meal plans, reminders, and updates directly in your workspace.</p>

          {slackConnected ? (
            <div style={{marginBottom: '40px'}}>
              <div style={{
                padding: '20px',
                background: '#e8f5e9',
                borderRadius: '8px',
                border: '2px solid #66bb6a',
                marginBottom: '20px'
              }}>
                <div style={{fontSize: '16px', color: '#2e7d32', marginBottom: '8px', fontWeight: 500}}>
                  ✓ Connected to Slack
                </div>
                <div style={{fontSize: '15px', color: '#388e3c'}}>
                  {slackTeam}
                </div>
              </div>
              <button
                onClick={handleDisconnectSlack}
                style={{
                  padding: '10px 20px',
                  fontSize: '15px',
                  background: '#ffebee',
                  color: '#c62828',
                  border: '1px solid #ef5350',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Disconnect Slack
              </button>
            </div>
          ) : (
            <div style={{marginBottom: '40px'}}>
              <div style={{
                padding: '40px',
                background: '#e8ede6',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginBottom: '16px'}}>
                  <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" fill="currentColor"/>
                  <path d="M20.5 8H16V3.5C16 2.67 16.67 2 17.5 2S19 2.67 19 3.5V6h1.5c.83 0 1.5.67 1.5 1.5S21.33 9 20.5 9z" fill="currentColor"/>
                  <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" fill="currentColor"/>
                  <path d="M3.5 16H8v4.5c0 .83-.67 1.5-1.5 1.5S5 21.33 5 20.5V18H3.5c-.83 0-1.5-.67-1.5-1.5S2.67 15 3.5 15z" fill="currentColor"/>
                </svg>
                <button
                  onClick={handleConnectSlack}
                  style={{
                    padding: '12px 32px',
                    fontSize: '16px',
                    background: '#611f69',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Connect Slack
                </button>
              </div>
              <p style={{fontSize: '14px', color: '#666', textAlign: 'center'}}>
                Your data is secure and will only be used for notifications
              </p>
            </div>
          )}

          <div className="button-container">
            <button className="typeform-button" onClick={handleSubmit}>
              {slackConnected ? 'Complete Setup' : 'Skip for now'}
            </button>
            <button className="back-button" onClick={handleBack}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 6V10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6M6 12L9 9M6 12L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </div>
          <div className="typeform-brand">sage</div>
        </div>
      </div>
    </div>
  );
}
