'use client';

import { useState, useEffect } from 'react';
import './personalised-plan.css';

interface Biomarker {
  name: string;
  value: string;
  referenceRange: string;
  status: 'Optimal' | 'Excellent' | 'Good' | 'Normal' | 'Adequate' | 'Borderline' | 'High' | 'Low' | 'Needs Optimization';
  significance: string;
  implications: string;
}

interface BloodAnalysis {
  summary: string;
  biomarkers: Biomarker[];
  concerns: string[];
  positives: string[];
  recommendations: {
    lifestyle: string[];
    dietary: string[];
    supplements: string[];
    followUp: string[];
    retestTiming: string;
  };
  personalizedNotes?: string[];
}

interface NutritionPlan {
  personalizedGreeting: string;
  executiveSummary: string;
  nutritionOverview?: {
    goals: string[];
    nutritionStructure: {
      calories: string;
      protein: string;
      carbs: string;
      fiber: string;
      fat: string;
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyRecommendations?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  micronutrientFocus?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sampleMealPlan?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lifestyleIntegration?: any;
  preventiveFeatures?: string[];
}

interface FitnessPlan {
  personalizedGreeting: string;
  executiveSummary: string;
  trainingPhilosophy: {
    approach: string;
    keyPrinciples: string[];
    progressionStrategy: string;
  };
  weeklyStructure: {
    overview: string;
    trainingDays: number;
    focusAreas: string[];
    rationale?: string;
    volumeDistribution?: string;
    intensityFramework?: string;
  };
  sevenDayProgram?: {
    [key: string]: {
      dayName?: string;
      focus: string;
      duration: string;
      warmup: {
        description: string;
        exercises: Array<{
          name: string;
          sets: string;
          reps: string;
          notes: string;
        }>;
      };
      mainWorkout: Array<{
        exercise: string;
        sets: string;
        reps: string;
        rest: string;
        tempo: string;
        intensity: string;
        notes: string;
        progressionNotes: string;
      }>;
      cooldown: {
        description: string;
        exercises: Array<{
          name: string;
          duration: string;
          notes: string;
        }>;
      };
    };
  };
  weeklyProgram?: {
    [key: string]: {
      dayName?: string;
      focus: string;
      duration: string;
      warmup: {
        description: string;
        exercises: Array<{
          name: string;
          sets: string;
          reps: string;
          notes: string;
        }>;
      };
      mainWorkout: Array<{
        exercise: string;
        sets: string;
        reps: string;
        rest: string;
        tempo?: string;
        intensity: string;
        notes: string;
        progressionNotes?: string;
      }>;
      cooldown: {
        description: string;
        exercises: Array<{
          name: string;
          duration: string;
          notes: string;
        }>;
      };
    };
  };
  recoveryProtocol?: {
    dailyPractices?: string[];
    weeklyPractices?: string[];
    sleepOptimization?: string;
    stressManagement?: string;
    mobilityWork?: string;
    activeRecovery?: string;
    personalizedNotes?: string;
  };
  supplementRecommendations?: {
    essential?: Array<{
      supplement: string;
      dosage: string;
      timing: string;
      rationale: string;
      duration: string;
    }>;
    optional?: Array<{
      supplement: string;
      dosage: string;
      timing: string;
      rationale: string;
      duration: string;
    }>;
    essentialSupplements?: Array<{
      name: string;
      dosage: string;
      timing: string;
      rationale: string;
      benefits?: string;
    }>;
    optionalSupplements?: Array<{
      name: string;
      dosage: string;
      timing: string;
      rationale: string;
      benefits?: string;
    }>;
    considerations?: string;
    personalizedNotes?: string;
  };
  nutritionGuidance: {
    proteinTarget: string;
    calorieGuidance: string;
    mealTiming: string;
    hydration: string;
    macroBreakdown?: string;
    mealFrequency?: string;
    supplementTiming?: string;
  };
  progressTracking: {
    metricsOverview?: string;
    weeklyMetrics?: string[];
    monthlyMetrics?: string[];
    performanceBenchmarks?: string[];
    biometricTargets?: string;
    reassessmentSchedule?: string;
    progressionIndicators?: string;
    metrics?: string[]; // Old format
    benchmarks?: string[]; // Old format
    whenToReassess?: string; // Old format
  };
  injuryPrevention: {
    personalizedRiskAssessment?: string;
    commonRisks: string[];
    preventionStrategies: string[];
    warningSignals: string[];
    injuryProtocol?: string;
    mobilityPrescription?: string;
  };
  adaptiveFeatures: {
    energyBasedAdjustments?: string;
    highEnergyDay: string;
    normalEnergyDay?: string;
    lowEnergyDay: string;
    travelModifications: string;
    injuryModifications: string;
    scheduleAdaptations?: string;
    recoverStatus?: string;
  };
}

function isNutritionPlan(plan: FitnessPlan | NutritionPlan): plan is NutritionPlan {
  return 'nutritionOverview' in plan;
}

function isFitnessPlan(plan: FitnessPlan | NutritionPlan): plan is FitnessPlan {
  // Check for either sevenDayProgram (old structure) or weeklyProgram (new structure)
  return 'sevenDayProgram' in plan || 'weeklyProgram' in plan || 'trainingPhilosophy' in plan;
}

export default function PersonalisedPlanPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planStatus, setPlanStatus] = useState<'queued' | 'processing' | 'completed' | 'failed' | 'unknown'>('unknown');
  const [plan, setPlan] = useState<FitnessPlan | NutritionPlan | null>(null);
  const [bloodAnalysis, setBloodAnalysis] = useState<BloodAnalysis | null>(null);
  const [loadingBloodAnalysis, setLoadingBloodAnalysis] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);

  // Helper function to get the correct image path based on gender
  const getImagePath = (imageNumber: number): string => {
    const isFemale = gender?.toLowerCase() === 'female';

    if (isFemale) {
      // Map to female-specific images
      const femaleImages = [
        'studiosiraj_instructional_illustration_of_a_woman_doing_a_barbe_05211cb1-f012-4763-bd3d-94f6ff51f62a.png', // Training
        'studiosiraj_instructional_illustration_of_a_woman_doing_a_push__dfe579db-f247-4e76-97f4-f81d07bda077.png', // Workout program
        'studiosiraj_instructional_illustration_of_a_woman_doing_yoga_--_5fd75609-0566-48e3-bb4d-2e8f37c0bc0d.png', // Recovery
        'studiosiraj_instructional_illustration_of_a_woman_sprinting_--c_7c58aa6a-7612-4ccc-a9a1-0ed252c3aef6.png', // Progress tracking
        'studiosiraj_instructional_illustration_of_a_woman_legs_apart_el_c4cfa759-f6d3-4ae9-8e27-8fce4d8fe80f.png', // Injury prevention
        'studiosiraj_instructional_illustration_of_a_woman_doing_a_barbe_b105ca49-3fdf-49b5-a330-7df6fbc57ca3.png', // Adaptive training
        'studiosiraj_instructional_illustration_of_a_woman_doing_a_barbe_05211cb1-f012-4763-bd3d-94f6ff51f62a.png', // Final
      ];
      return `/images/forge-female/${femaleImages[imageNumber - 1]}`;
    }

    // Default male/generic images
    const maleImages = [
      '152B53DF-AD96-42ED-BDB2-DA150D3FF857.png', // Training
      '15C867CC-152F-4E9B-81E6-ACF57A9C1F73.png', // Workout program
      '3E33A2E7-42C9-4E27-88F6-57AF1A54DD8D.png', // Recovery
      '8B4AB139-C742-440C-849F-7AE394A3A037.png', // Progress tracking
      '498BA8A7-59A9-485F-8481-AB1C2122C236.png', // Injury prevention
      '7C9557A4-F309-4837-A1AF-58B6D4BB3051.png', // Adaptive training
      'A89F1709-0CA0-4C39-A794-854DED0A76F8.png', // Final
    ];
    return `/images/forge/${maleImages[imageNumber - 1]}`;
  };

  useEffect(() => {
    // Get code or email from URL params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const emailParam = params.get('email');

    // Set email state
    setEmail(emailParam);

    // Use code parameter if available, otherwise use email parameter
    const identifier = code || emailParam;

    if (!identifier) {
      setError('No plan identifier provided');
      setLoading(false);
      return;
    }

    // Store the identifier type for API calls
    const paramName = code ? 'code' : 'email';

    // Fetch all data - blood analysis first, then meal plan (to optimize for biomarkers)
    const fetchAllData = async () => {
      try {
        // Step 0: Check plan status first
        const statusResponse = await fetch(`/api/plan-status?${paramName}=${encodeURIComponent(identifier)}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setPlanStatus(statusData.status);

          // If plan is still being generated, show waiting message
          if (statusData.status === 'queued' || statusData.status === 'processing') {
            setLoading(false);
            return; // Don't fetch plan data yet
          }

          // If plan failed, show error
          if (statusData.status === 'failed') {
            setError(statusData.error || 'Plan generation failed');
            setLoading(false);
            return;
          }

          // If no plan found and status is unknown, it might be an old plan without status
          // Continue to try fetching it
        }

        setLoadingBloodAnalysis(true);

        // Step 1: Fetch plan data (lightweight - just reads from database)
        const planResponse = await fetch(`/api/get-plan?${paramName}=${encodeURIComponent(identifier)}`);

        if (!planResponse.ok) {
          throw new Error('Failed to fetch plan');
        }

        const planData = await planResponse.json();

        if (!planData.success) {
          throw new Error(planData.error || 'Plan not found');
        }

        // Set plan data
        setPlan(planData.plan);
        setPlanStatus(planData.status || 'completed');
        setGender(planData.gender || null);

        // Log plan type for debugging
        console.log('[PLAN DEBUG] Plan keys:', Object.keys(planData.plan || {}));
        console.log('[PLAN DEBUG] Has sevenDayProgram?', !!planData.plan?.sevenDayProgram);
        console.log('[PLAN DEBUG] Has weeklyProgram?', !!planData.plan?.weeklyProgram);
        console.log('[PLAN DEBUG] Has trainingPhilosophy?', !!planData.plan?.trainingPhilosophy);
        console.log('[PLAN DEBUG] Has sampleMealPlan?', !!planData.plan?.sampleMealPlan);

        if (planData.plan?.sevenDayProgram || planData.plan?.weeklyProgram || planData.plan?.trainingPhilosophy) {
          console.log('[PLAN TYPE] Fitness Plan detected');
          if (planData.plan?.sevenDayProgram) {
            console.log('[PLAN DEBUG] Using sevenDayProgram structure, length:', planData.plan.sevenDayProgram.length);
          } else if (planData.plan?.weeklyProgram) {
            console.log('[PLAN DEBUG] Using weeklyProgram structure, days:', Object.keys(planData.plan.weeklyProgram));
          }
        } else if (planData.plan?.sampleMealPlan) {
          console.log('[PLAN TYPE] Nutrition Plan detected (legacy)');
        } else {
          console.log('[PLAN TYPE] Unknown plan type or missing plan structure');
        }

        // Set blood analysis if available
        if (planData.bloodAnalysis) {
          setBloodAnalysis(planData.bloodAnalysis);
          console.log('[Blood Analysis] Loaded from database:', planData.bloodAnalysis);
        }

        setLoadingBloodAnalysis(false);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load your personalized plan');
        setLoadingBloodAnalysis(false);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) {
    return (
      <div className="plan-loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8f8f8'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 300,
            color: '#1a1a1a',
            marginBottom: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
          }}>
            loading forge plan
          </div>
          <div style={{
            width: '200px',
            height: '2px',
            background: '#e0e0e0',
            borderRadius: '1px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: '#1a1a1a',
              animation: 'loading 1.5s ease-in-out infinite'
            }}></div>
          </div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  // Show waiting message if plan is still being generated
  if (planStatus === 'queued' || planStatus === 'processing') {
    return (
      <div className="plan-loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8f8f8',
        padding: '20px',
        position: 'relative'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '600px' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '24px'
          }}>
            ⏳
          </div>
          <h2 style={{
            fontSize: '32px',
            marginBottom: '16px',
            color: '#2d3a2d',
            fontWeight: 300
          }}>
            Your plan is being generated
          </h2>
        </div>

        {/* Footer text with email notification */}
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: '16px',
          fontWeight: 400,
          color: '#999',
          letterSpacing: '0.3px'
        }}>
          This typically takes 5-15 minutes. You&apos;ll receive an email at {email || 'your email'} when your plan is ready.
        </div>

        {/* Brand footer */}
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: '18px',
          fontWeight: 500,
          fontStretch: 'expanded',
          color: '#999',
          letterSpacing: '0.5px'
        }}>
          forge
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plan-error" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center',
        background: '#f8f8f8'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '16px', color: '#2d3a2d' }}>Unable to Load Plan</h1>
        <p style={{ fontSize: '18px', marginBottom: '24px', color: '#666', maxWidth: '600px' }}>
          {error.includes('No plan found') || error.includes('Failed to fetch plan')
            ? 'Your plan is currently being generated. This typically takes 5-15 minutes. Please check your email for a notification when your plan is ready, or try refreshing this page in a few minutes.'
            : error
          }
        </p>
        <button
          onClick={() => window.location.href = '/forge'}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#2d3a2d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Return to Forge
        </button>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="plan-container">
      {/* Sidebar - Share buttons */}
      <div className="plan-sidebar">
        <button
          className="sidebar-icon-button"
          onClick={() => {
            const url = window.location.href;
            const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            window.open(shareUrl, '_blank', 'width=600,height=600');
          }}
          title="Share on LinkedIn"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </button>
        <button
          className="sidebar-icon-button"
          onClick={() => {
            const text = "Check out my personalized fitness plan from Forge!";
            const url = window.location.href;
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
            window.open(shareUrl, '_blank', 'width=600,height=600');
          }}
          title="Share on X"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </button>
      </div>

      {/* Hero Image */}
      <div className="hero-image-container">
        <img
          src="/images/forge-loading.png"
          alt="Forge Fitness Plan"
          className="hero-image"
        />
      </div>

      {/* Header */}
      <header className="plan-header">
        <h1 className="plan-main-title">Forge Fitness Plan</h1>
        <p className="plan-subtitle">A guide as unique as you.</p>
      </header>

      {/* Personalized Greeting */}
      <section className="plan-section greeting-section">
        <h2 className="section-heading">{plan.personalizedGreeting}</h2>
        <p className="section-subheading">Your biomarker data, your insights, your plan.</p>
        <p className="intro-text">
          This nutrition plan has been crafted especially for you in accordance with your unique biology.
          It takes into account your most recent lab results, daily wearable data and habitual information.
        </p>

        {/* Executive Summary */}
        <div className="executive-summary-container">
          <h2 className="section-title">Executive Summary</h2>
          <div className="executive-summary">
            {plan.executiveSummary.split('\n').map((paragraph, idx) => (
              paragraph.trim() && <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Blood Work Analysis Section - only show if blood analysis exists */}
      {bloodAnalysis && bloodAnalysis.biomarkers && bloodAnalysis.biomarkers.length > 0 && (
        <section className="plan-section blood-metrics-section">
          <h2 className="section-title">Personalized metrics | {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <p className="section-subtitle">Your lab results are in. These are the biomarkers that you should focus on.</p>

          <div className="biomarkers-table-container">
              <table className="biomarkers-table">
                <thead>
                  <tr>
                    <th>Biomarker</th>
                    <th>Value</th>
                    <th>Optimal Range</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bloodAnalysis.biomarkers.map((marker, idx) => (
                    <tr key={idx}>
                      <td className="biomarker-name">{marker.name}</td>
                      <td className="biomarker-value">{marker.value}</td>
                      <td className="biomarker-range">{marker.referenceRange || 'N/A'}</td>
                      <td className={`biomarker-status status-${marker.status.toLowerCase().replace(/\s+/g, '-')}`}>{marker.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </section>
      )}

      {/* Nutrition Plan Overview - Only for nutrition plans */}
      {isNutritionPlan(plan) && (
        <section className="plan-section">
          <h2 className="section-title">Nutrition Plan Overview</h2>
          <div className="overview-grid">
            <div className="overview-column">
              <h3 className="overview-heading">Goals</h3>
              <ul className="goals-list">
                {plan.nutritionOverview?.goals.map((goal, idx) => (
                  <li key={idx}>{goal}</li>
                ))}
              </ul>
            </div>
            <div className="overview-column">
              <h3 className="overview-heading">Nutrition Structure</h3>
              <div className="nutrition-structure">
                <p><strong>Total Daily Calories:</strong> {plan.nutritionOverview?.nutritionStructure.calories}</p>
                <p><strong>Protein:</strong> {plan.nutritionOverview?.nutritionStructure.protein}</p>
                <p><strong>Carbs:</strong> {plan.nutritionOverview?.nutritionStructure.carbs}</p>
                <p><strong>Total Fiber:</strong> {plan.nutritionOverview?.nutritionStructure.fiber}</p>
                <p><strong>Fat:</strong> {plan.nutritionOverview?.nutritionStructure.fat}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Fitness Plan Sections - Only for fitness plans */}
      {isFitnessPlan(plan) && (
        <>
          {/* Decorative Image 1 */}
          <div className="plan-image-container">
            <img src={getImagePath(1)} alt="Fitness training" className="plan-image" />
          </div>

          {/* Training Philosophy */}
          <section className="plan-section">
            <h2 className="section-title">Training Philosophy</h2>

            <div style={{ marginBottom: '30px' }}>
              <h3 className="overview-heading">Approach</h3>
              <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#1a1a1a' }}>
                {plan.trainingPhilosophy.approach.split('\n').map((paragraph: string, idx: number) => (
                  paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <h3 className="overview-heading">Key Principles</h3>
              <div style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '15px',
                  lineHeight: '1.8'
                }}>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {plan.trainingPhilosophy.keyPrinciples.map((principle: any, idx: number) => {
                      // Split on first colon
                      const colonIndex = principle.indexOf(':');
                      const title = colonIndex !== -1 ? principle.substring(0, colonIndex).trim() : principle;
                      const description = colonIndex !== -1 ? principle.substring(colonIndex + 1).trim() : '';

                      return (
                        <tr key={idx} style={{
                          borderBottom: idx < plan.trainingPhilosophy.keyPrinciples.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}>
                          <td style={{
                            padding: '16px 20px',
                            fontWeight: '600',
                            verticalAlign: 'top',
                            width: '35%',
                            color: '#1a1a1a'
                          }}>
                            {title}
                          </td>
                          <td style={{
                            padding: '16px 20px',
                            verticalAlign: 'top',
                            color: '#4a4a4a'
                          }}>
                            {description || title}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="overview-heading">Progression Strategy</h3>
              <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#1a1a1a' }}>
                {plan.trainingPhilosophy.progressionStrategy.split('\n').map((paragraph: string, idx: number) => (
                  paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>

          {/* Weekly Structure */}
          <section className="plan-section">
            <h2 className="section-title">Weekly Structure</h2>

            <div style={{ marginBottom: '30px' }}>
              <h3 className="overview-heading">Overview</h3>
              <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#1a1a1a' }}>
                {plan.weeklyStructure.overview.split('\n').map((paragraph: string, idx: number) => (
                  paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px', marginBottom: '30px' }}>
              <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
                <h3 className="overview-heading">Training Days Per Week</h3>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#000', marginBottom: '10px' }}>{plan.weeklyStructure.trainingDays}</p>
              </div>
            </div>

            {plan.weeklyStructure.rationale && (
              <div style={{ marginBottom: '30px' }}>
                <h3 className="overview-heading">Rationale</h3>
                <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#1a1a1a' }}>
                  {plan.weeklyStructure.rationale.split('\n').map((paragraph: string, idx: number) => (
                    paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {plan.weeklyStructure.volumeDistribution && (
              <div style={{ marginBottom: '30px' }}>
                <h3 className="overview-heading">Volume Distribution</h3>
                <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#1a1a1a' }}>
                  {plan.weeklyStructure.volumeDistribution.split('\n').map((paragraph: string, idx: number) => (
                    paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {plan.weeklyStructure.intensityFramework && (
              <div style={{ marginBottom: '30px' }}>
                <h3 className="overview-heading">Intensity Framework</h3>
                <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#1a1a1a' }}>
                  {plan.weeklyStructure.intensityFramework.split('\n').map((paragraph: string, idx: number) => (
                    paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="overview-heading">Daily Focus Areas</h3>
              <div style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '15px',
                  lineHeight: '1.8'
                }}>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {plan.weeklyStructure.focusAreas.map((area: any, idx: number) => {
                      // Split on first colon
                      const colonIndex = area.indexOf(':');
                      const day = colonIndex !== -1 ? area.substring(0, colonIndex).trim() : `Day ${idx + 1}`;
                      const description = colonIndex !== -1 ? area.substring(colonIndex + 1).trim() : area;

                      return (
                        <tr key={idx} style={{
                          borderBottom: idx < plan.weeklyStructure.focusAreas.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}>
                          <td style={{
                            padding: '16px 20px',
                            fontWeight: '600',
                            verticalAlign: 'top',
                            width: '20%',
                            color: '#1a1a1a'
                          }}>
                            {day}
                          </td>
                          <td style={{
                            padding: '16px 20px',
                            verticalAlign: 'top',
                            color: '#4a4a4a'
                          }}>
                            {description}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Decorative Image 2 */}
          <div className="plan-image-container">
            <img src={getImagePath(2)} alt="Workout program" className="plan-image" />
          </div>

          {/* Weekly Workout Program */}
          <section className="plan-section">
            <h2 className="section-title">Weekly Workout Program</h2>
            <div className="meal-plan-grid">
              {(() => {
                // Define day order
                const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

                // Get the program (either weeklyProgram or sevenDayProgram)
                const program = plan.weeklyProgram || plan.sevenDayProgram || {};

                // Sort keys by day order
                const sortedDayKeys = Object.keys(program).sort((a, b) => {
                  const indexA = dayOrder.indexOf(a.toLowerCase());
                  const indexB = dayOrder.indexOf(b.toLowerCase());
                  // If day not found in order, put it at the end
                  if (indexA === -1) return 1;
                  if (indexB === -1) return -1;
                  return indexA - indexB;
                });

                return sortedDayKeys.map((dayKey, dayIdx) => {
                  const day = program[dayKey];
                  if (!day) return null;

                  // Get proper day name
                  const dayIndex = dayOrder.indexOf(dayKey.toLowerCase());
                  const displayDayName = day.dayName || (dayIndex !== -1 ? dayNames[dayIndex] : `Day ${dayIdx + 1}`);

                return (
                  <div key={dayKey} className="day-column">
                    <h3 className="day-title">{displayDayName}</h3>
                    <div className="workout-day-header" style={{
                      background: '#f5f5f5',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '15px'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>
                        {day.focus}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        Duration: {day.duration}
                      </div>
                    </div>

                    {/* Warmup */}
                    <div className="workout-section" style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        color: '#666',
                        marginBottom: '10px'
                      }}>
                        Warmup
                      </h4>
                      <p style={{ fontSize: '13px', marginBottom: '10px', color: '#555' }}>
                        {day.warmup.description}
                      </p>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {day.warmup.exercises?.map((exercise: any, idx: number) => (
                        <div key={idx} style={{
                          background: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          padding: '10px',
                          marginBottom: '8px'
                        }}>
                          <div style={{ fontWeight: '500', marginBottom: '4px' }}>{exercise.name}</div>
                          <div style={{ fontSize: '13px', color: '#666' }}>
                            {exercise.sets} × {exercise.reps}
                          </div>
                          {exercise.notes && (
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', fontStyle: 'italic' }}>
                              {exercise.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Main Workout */}
                    <div className="workout-section" style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        color: '#000',
                        marginBottom: '10px'
                      }}>
                        Main Workout
                      </h4>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {day.mainWorkout?.map((exercise: any, idx: number) => (
                        <div key={idx} style={{
                          background: '#fff',
                          border: '2px solid #000',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px' }}>
                            {exercise.exercise}
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            fontSize: '13px',
                            marginBottom: '8px'
                          }}>
                            <div>
                              <span style={{ color: '#666' }}>Sets × Reps:</span> <strong>{exercise.sets} × {exercise.reps}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#666' }}>Rest:</span> <strong>{exercise.rest}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#666' }}>Tempo:</span> <strong>{exercise.tempo}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#666' }}>Intensity:</span> <strong>{exercise.intensity}</strong>
                            </div>
                          </div>
                          {exercise.notes && (
                            <div style={{
                              fontSize: '12px',
                              color: '#555',
                              background: '#f9f9f9',
                              padding: '8px',
                              borderRadius: '4px',
                              marginBottom: '6px'
                            }}>
                              <strong>Form:</strong> {exercise.notes}
                            </div>
                          )}
                          {exercise.progressionNotes && (
                            <div style={{
                              fontSize: '12px',
                              color: '#0066cc',
                              fontStyle: 'italic'
                            }}>
                              <strong>Progression:</strong> {exercise.progressionNotes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Cooldown */}
                    <div className="workout-section">
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        color: '#666',
                        marginBottom: '10px'
                      }}>
                        Cooldown
                      </h4>
                      <p style={{ fontSize: '13px', marginBottom: '10px', color: '#555' }}>
                        {day.cooldown.description}
                      </p>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {day.cooldown.exercises?.map((exercise: any, idx: number) => (
                        <div key={idx} style={{
                          background: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          padding: '10px',
                          marginBottom: '8px'
                        }}>
                          <div style={{ fontWeight: '500', marginBottom: '4px' }}>{exercise.name}</div>
                          <div style={{ fontSize: '13px', color: '#666' }}>{exercise.duration}</div>
                          {exercise.notes && (
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', fontStyle: 'italic' }}>
                              {exercise.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          </section>

          {/* Supplement Recommendations */}
          <section className="plan-section">
            <h2 className="section-title">Supplement Recommendations</h2>

            <div style={{ marginBottom: '30px' }}>
              <h3 className="overview-heading">Essential Supplements</h3>
              <div style={{ display: 'grid', gap: '15px' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(plan.supplementRecommendations?.essentialSupplements || plan.supplementRecommendations?.essential || []).map((supp: any, idx: number) => (
                  <div key={idx} style={{
                    background: '#f5f5f5',
                    border: '2px solid #000',
                    borderRadius: '8px',
                    padding: '15px'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                      {supp.name || supp.supplement}
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                      <strong>Dosage:</strong> {supp.dosage} • <strong>Timing:</strong> {supp.timing}
                    </div>
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '6px' }}>
                      <strong>Why:</strong> {supp.rationale}
                    </div>
                    {supp.benefits && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                        <strong>Benefits:</strong> {supp.benefits}
                      </div>
                    )}
                    {supp.duration && (
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        <strong>Duration:</strong> {supp.duration}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 className="overview-heading">Optional Supplements</h3>
              <div style={{ display: 'grid', gap: '15px' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(plan.supplementRecommendations?.optionalSupplements || plan.supplementRecommendations?.optional || []).map((supp: any, idx: number) => (
                  <div key={idx} style={{
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '15px'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                      {supp.name || supp.supplement}
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                      <strong>Dosage:</strong> {supp.dosage} • <strong>Timing:</strong> {supp.timing}
                    </div>
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '6px' }}>
                      <strong>Why:</strong> {supp.rationale}
                    </div>
                    {supp.benefits && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                        <strong>Benefits:</strong> {supp.benefits}
                      </div>
                    )}
                    {supp.duration && (
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        <strong>Duration:</strong> {supp.duration}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </section>

          {/* Decorative Image 3 */}
          <div className="plan-image-container">
            <img src={getImagePath(3)} alt="Recovery and wellness" className="plan-image" />
          </div>

          {/* Recovery Protocol */}
          <section className="plan-section">
            <h2 className="section-title">Recovery Protocol</h2>
            <div className="recommendations-grid">
              <div className="recommendation-card">
                <h3>Daily Practices</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(plan.recoveryProtocol?.dailyPractices || []).map((practice: any, idx: number) => (
                    <li key={idx}>{practice}</li>
                  ))}
                </ul>
              </div>
              <div className="recommendation-card">
                <h3>Weekly Practices</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(plan.recoveryProtocol?.weeklyPractices || []).map((practice: any, idx: number) => (
                    <li key={idx}>{practice}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="recommendations-grid" style={{ marginTop: '20px' }}>
              <div className="recommendation-card">
                <h3>Sleep Optimization</h3>
                <p>{plan.recoveryProtocol?.sleepOptimization || 'Not available'}</p>
              </div>
              <div className="recommendation-card">
                <h3>Stress Management</h3>
                <p>{plan.recoveryProtocol?.stressManagement || 'Not available'}</p>
              </div>
              <div className="recommendation-card">
                <h3>Mobility Work</h3>
                <p>{plan.recoveryProtocol?.mobilityWork || 'Not available'}</p>
              </div>
            </div>
          </section>

          {/* Nutrition Guidance */}
          <section className="plan-section">
            <h2 className="section-title">Nutrition Guidance</h2>
            <div className="overview-grid">
              <div className="overview-column">
                <h3 className="overview-heading">Protein Target</h3>
                <p>{plan.nutritionGuidance.proteinTarget}</p>
              </div>
              <div className="overview-column">
                <h3 className="overview-heading">Calorie Guidance</h3>
                <p>{plan.nutritionGuidance.calorieGuidance}</p>
              </div>
            </div>
            <div className="overview-grid" style={{ marginTop: '20px' }}>
              <div className="overview-column">
                <h3 className="overview-heading">Meal Timing</h3>
                <p>{plan.nutritionGuidance.mealTiming}</p>
              </div>
              <div className="overview-column">
                <h3 className="overview-heading">Hydration</h3>
                <p>{plan.nutritionGuidance.hydration}</p>
              </div>
            </div>
          </section>

          {/* Decorative Image 6 */}
          <div className="plan-image-container">
            <img src={getImagePath(4)} alt="Progress tracking" className="plan-image" />
          </div>

          {/* Progress Tracking & Injury Prevention */}
          <section className="plan-section">
            <h2 className="section-title">Progress Tracking</h2>
            <div className="recommendations-grid">
              <div className="recommendation-card">
                <h3>Metrics to Track</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(plan.progressTracking.weeklyMetrics || plan.progressTracking.metrics || []).map((metric: any, idx: number) => (
                    <li key={idx}>{metric}</li>
                  ))}
                </ul>
              </div>
              <div className="recommendation-card">
                <h3>Performance Benchmarks</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(plan.progressTracking.performanceBenchmarks || plan.progressTracking.benchmarks || []).map((benchmark: any, idx: number) => (
                    <li key={idx}>{benchmark}</li>
                  ))}
                </ul>
              </div>
            </div>
            {(plan.progressTracking.reassessmentSchedule || plan.progressTracking.whenToReassess) && (
              <div className="recommendation-card" style={{ marginTop: '20px' }}>
                <h3>When to Reassess</h3>
                <p>{plan.progressTracking.reassessmentSchedule || plan.progressTracking.whenToReassess}</p>
              </div>
            )}
          </section>

          {/* Decorative Image 4 */}
          <div className="plan-image-container">
            <img src={getImagePath(5)} alt="Injury prevention" className="plan-image" />
          </div>

          <section className="plan-section">
            <h2 className="section-title">Injury Prevention</h2>
            <div className="recommendations-grid">
              <div className="recommendation-card">
                <h3>Common Risks</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {plan.injuryPrevention.commonRisks.map((risk: any, idx: number) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              </div>
              <div className="recommendation-card">
                <h3>Prevention Strategies</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {plan.injuryPrevention.preventionStrategies.map((strategy: any, idx: number) => (
                    <li key={idx}>{strategy}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Decorative Image 5 */}
          <div className="plan-image-container">
            <img src={getImagePath(6)} alt="Adaptive training" className="plan-image" />
          </div>

          {/* Adaptive Features */}
          <section className="plan-section">
            <h2 className="section-title">Adaptive Features</h2>
            <div className="lifestyle-grid">
              <div className="lifestyle-item">
                <h3>High Energy Day Adjustments</h3>
                <p>{plan.adaptiveFeatures.highEnergyDay}</p>
              </div>
              <div className="lifestyle-item">
                <h3>Low Energy Day Adjustments</h3>
                <p>{plan.adaptiveFeatures.lowEnergyDay}</p>
              </div>
              <div className="lifestyle-item">
                <h3>Travel Modifications</h3>
                <p>{plan.adaptiveFeatures.travelModifications}</p>
              </div>
              <div className="lifestyle-item">
                <h3>Injury Modifications</h3>
                <p>{plan.adaptiveFeatures.injuryModifications}</p>
              </div>
            </div>
          </section>

          {/* Decorative Image 7 - Final */}
          <div className="plan-image-container">
            <img src={getImagePath(7)} alt="Fitness journey" className="plan-image" />
          </div>
        </>
      )}

      {/* Daily Recommendations - Only for nutrition plans */}
      {isNutritionPlan(plan) && plan.dailyRecommendations && (
        <section className="plan-section">
          <h2 className="section-title">Daily Recommendations</h2>
          <div className="recommendations-grid">
            <div className="recommendation-card">
              <h3>Morning Ritual</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.morningRitual?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Empower the Gut</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.empowerGut?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Afternoon Vitality</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.afternoonVitality?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Energy Optimization</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.energyOptimization?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Midday Mastery</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.middayMastery?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Evening Nourishment</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.eveningNourishment?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Micronutrient Focus - Only for nutrition plans */}
      {isNutritionPlan(plan) && (
        <section className="plan-section">
          <h2 className="section-title">Micronutrient Focus</h2>

          {plan.micronutrientFocus && (
            <>
              {/* Personalized intro for fallback micronutrients */}
              <p className="micronutrients-intro">
                {`Based on ${bloodAnalysis ? 'your blood biomarkers' : 'your profile'}${
                  bloodAnalysis && bloodAnalysis.concerns?.length > 0
                    ? ` showing ${bloodAnalysis.concerns.slice(0, 2).join(' and ')}`
                    : ''
                }, your ${plan?.nutritionOverview?.goals?.[0]?.toLowerCase() || 'health goals'}, and your ${
                  plan?.dailyRecommendations ? 'personalized nutrition plan' : 'lifestyle'
                }, these micronutrients are specifically chosen to support your optimal health and performance.`}
              </p>

              <div className="table-container">
                <table className="micronutrient-table">
                  <thead>
                    <tr>
                      <th>Nutrient</th>
                      <th>Daily Goal</th>
                      <th>Food Sources in Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {plan.micronutrientFocus.map((nutrient: any, idx: number) => (
                    <tr key={idx}>
                      <td className="nutrient-name">{nutrient.nutrient}</td>
                      <td className="nutrient-goal">{nutrient.dailyGoal}</td>
                      <td className="nutrient-sources">{nutrient.foodSources}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      )}

      {/* Sample Meal Plan with Side Image Layout - Only for nutrition plans */}
      {isNutritionPlan(plan) && plan.sampleMealPlan && (
      <div className="with-side-image-layout">
        <div className="side-image-container">
          <img
            src="/meal-plan-side-image.png"
            alt="Gourmet Meal"
            className="side-image"
          />
        </div>

        <div className="side-content">
          {/* Sample Meal Plan */}
          <section className="plan-section">
            <h2 className="section-title">Meal Plan</h2>

            {/* Personalized intro for meal plan */}
            <p className="meal-plan-intro">
              {`This 7-day meal plan is optimized for ${bloodAnalysis ? 'your biomarkers' : 'your goals'}${
                bloodAnalysis && bloodAnalysis.concerns?.length > 0
                  ? `, specifically targeting ${bloodAnalysis.concerns[0]?.toLowerCase()}`
                  : ''
              }. Each meal is designed around your ${plan?.nutritionOverview?.nutritionStructure?.protein || 'protein'} targets${
                plan?.nutritionOverview?.goals?.[0]
                  ? ` to ${plan.nutritionOverview.goals[0].toLowerCase().replace(/^(improve|enhance|boost|increase|optimize)\s+/i, 'support ')}`
                  : ''
              }, while respecting your ${plan?.lifestyleIntegration?.exerciseProtocol ? 'training schedule' : 'lifestyle preferences'} and eating window.`}
            </p>

            <div className="meal-plan-grid">
              {Object.keys(plan.sampleMealPlan)
                .filter(key => key !== 'profileSummary') // Skip the profile summary object
                .map((dayKey, dayIdx) => {
                const day = plan.sampleMealPlan[dayKey];
                if (!day || !day.meals) return null; // Safety check
                return (
                  <div key={dayKey} className="day-column">
                    <h3 className="day-title">Day {dayIdx + 1}</h3>
                    <div className="meals-list">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {day.meals.map((meal: any, mealIdx: number) => (
                        <div key={mealIdx} className="meal-card">
                          <div className="meal-time">
                            <span className="time-dot"></span>
                            {meal.time}
                          </div>
                          <div className="meal-name">{meal.name}</div>
                          <div className="meal-description">{meal.description}</div>
                          {meal.cookingTime && (
                            <div className="meal-meta">
                              <span>⏱️ {meal.cookingTime}</span>
                              {meal.difficulty && <span> • {meal.difficulty}</span>}
                            </div>
                          )}
                          <div className="meal-macros">{meal.macros}</div>
                          {meal.biomarkerNotes && (
                            <div className="biomarker-notes">
                              {meal.biomarkerNotes}
                            </div>
                          )}
                          {meal.prepType && (
                            <div className="meal-tags">
                              <span className="meal-tag">{meal.prepType}</span>
                              {meal.complexity && <span className="meal-tag">{meal.complexity}</span>}
                              {meal.prepTime && <span className="meal-tag">⏱️ {meal.prepTime}</span>}
                            </div>
                          )}
                          {meal.ingredients && meal.ingredients.length > 0 && (
                            <details className="meal-details">
                              <summary>View Recipe</summary>
                              <div className="recipe-content">
                                <h4>Ingredients:</h4>
                                <ul className="ingredients-list">
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                  {meal.ingredients.map((ingredient: any, idx: number) => (
                                    <li key={idx}>{ingredient}</li>
                                  ))}
                                </ul>
                                {meal.cookingInstructions && meal.cookingInstructions.length > 0 && (
                                  <>
                                    <h4>Instructions:</h4>
                                    <ol className="instructions-list">
                                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                      {meal.cookingInstructions.map((instruction: any, idx: number) => (
                                        <li key={idx}>{instruction}</li>
                                      ))}
                                    </ol>
                                  </>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Lifestyle Integration */}
          <section className="plan-section">
            <h2 className="section-title">Lifestyle Integration</h2>

            {/* Personalized intro for lifestyle */}
            <p className="lifestyle-intro">
              {`Your lifestyle plan is tailored to ${
                plan?.nutritionOverview?.goals?.[0]
                  ? `${plan.nutritionOverview.goals[0].toLowerCase().replace(/^(improve|enhance|boost|increase|optimize)\s+/i, '')}`
                  : 'your health goals'
              }${
                bloodAnalysis && bloodAnalysis.concerns?.length > 0
                  ? ` and optimized to address ${bloodAnalysis.concerns.slice(0, 2).join(' and ').toLowerCase()}`
                  : ''
              }. These protocols integrate seamlessly with your daily routine, ${
                plan?.dailyRecommendations?.morningRitual
                  ? 'from your morning ritual'
                  : 'from sleep optimization'
              } to stress management, ensuring sustainable habits that compound over time.`}
            </p>

            {plan.lifestyleIntegration ? (
              <div className="lifestyle-clean">
                {/* Sleep Optimization */}
                {plan.lifestyleIntegration.sleepOptimization && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Sleep Optimization</h3>
                    {plan.lifestyleIntegration.sleepOptimization.personalizedIntro && (
                      <p className="lifestyle-subtitle">{plan.lifestyleIntegration.sleepOptimization.personalizedIntro}</p>
                    )}

                    {plan.lifestyleIntegration.sleepOptimization.optimalSleepWindow && (
                      <div className="lifestyle-text">
                        <p><strong>Optimal Sleep Window:</strong> {plan.lifestyleIntegration.sleepOptimization.optimalSleepWindow}</p>
                      </div>
                    )}

                    {plan.lifestyleIntegration.sleepOptimization.preBedroutine && plan.lifestyleIntegration.sleepOptimization.preBedroutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Pre-Bed Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.sleepOptimization.preBedroutine.map((item: any, idx: number) => (
                          <p key={idx}>• {item}</p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.sleepOptimization.morningProtocol && plan.lifestyleIntegration.sleepOptimization.morningProtocol.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Morning Protocol:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.sleepOptimization.morningProtocol.map((item: any, idx: number) => (
                          <p key={idx}>• {item}</p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.sleepOptimization.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {plan.lifestyleIntegration.sleepOptimization.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Exercise Protocol */}
                {plan.lifestyleIntegration.exerciseProtocol && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Exercise Protocol</h3>
                    {plan.lifestyleIntegration.exerciseProtocol.personalizedIntro && (
                      <p className="lifestyle-subtitle">{plan.lifestyleIntegration.exerciseProtocol.personalizedIntro}</p>
                    )}

                    {plan.lifestyleIntegration.exerciseProtocol.weeklyStructure && (
                      <div className="lifestyle-text">
                        <p><strong>Weekly Structure:</strong> {plan.lifestyleIntegration.exerciseProtocol.weeklyStructure}</p>
                      </div>
                    )}

                    {plan.lifestyleIntegration.exerciseProtocol.workoutSplit && plan.lifestyleIntegration.exerciseProtocol.workoutSplit.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Workout Split:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.exerciseProtocol.workoutSplit.map((workout: any, idx: number) => (
                          <p key={idx}>
                            <strong>{workout.day}:</strong> {workout.focus}
                            {workout.duration && <> • {workout.duration}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.exerciseProtocol.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {plan.lifestyleIntegration.exerciseProtocol.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Stress Management */}
                {plan.lifestyleIntegration.stressManagement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Stress Management</h3>
                    {plan.lifestyleIntegration.stressManagement.personalizedIntro && (
                      <p className="lifestyle-subtitle">{plan.lifestyleIntegration.stressManagement.personalizedIntro}</p>
                    )}

                    {plan.lifestyleIntegration.stressManagement.dailyPractices && plan.lifestyleIntegration.stressManagement.dailyPractices.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Daily Practices:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.stressManagement.dailyPractices.map((practice: any, idx: number) => (
                          <p key={idx}>
                            <strong>{practice.practice}</strong>
                            {practice.timing && <> • {practice.timing}</>}
                            {practice.duration && <> • {practice.duration}</>}
                            {practice.benefit && <><br />{practice.benefit}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.stressManagement.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {plan.lifestyleIntegration.stressManagement.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Skin Improvement */}
                {plan.lifestyleIntegration.skinImprovement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Skin Improvement</h3>
                    {plan.lifestyleIntegration.skinImprovement.personalizedIntro && (
                      <p className="lifestyle-subtitle">{plan.lifestyleIntegration.skinImprovement.personalizedIntro}</p>
                    )}

                    {plan.lifestyleIntegration.skinImprovement.morningRoutine && plan.lifestyleIntegration.skinImprovement.morningRoutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Morning Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.skinImprovement.morningRoutine.map((step: any, idx: number) => (
                          <p key={idx}>
                            {idx + 1}. <strong>{step.product}</strong>
                            {step.purpose && <> - {step.purpose}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.skinImprovement.eveningRoutine && plan.lifestyleIntegration.skinImprovement.eveningRoutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Evening Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.skinImprovement.eveningRoutine.map((step: any, idx: number) => (
                          <p key={idx}>
                            {idx + 1}. <strong>{step.product}</strong>
                            {step.purpose && <> - {step.purpose}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.skinImprovement.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {plan.lifestyleIntegration.skinImprovement.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="lifestyle-content">
                <div className="lifestyle-item">
                  <h3>Sleep Optimization Protocol:</h3>
                  <p>{plan.lifestyleIntegration.sleepOptimization}</p>
                </div>
                <div className="lifestyle-item">
                  <h3>Exercise Protocol:</h3>
                  <p>{plan.lifestyleIntegration.exerciseProtocol}</p>
                </div>
                <div className="lifestyle-item">
                  <h3>Stress Management Protocol:</h3>
                  <p>{plan.lifestyleIntegration.stressManagement}</p>
                </div>
                {plan.lifestyleIntegration.skinImprovement && (
                  <div className="lifestyle-item">
                    <h3>Skin Improvement Protocol:</h3>
                    <p>{plan.lifestyleIntegration.skinImprovement}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Preventive & Adaptive Features */}
          {plan.preventiveFeatures && (
            <section className="plan-section">
              <h2 className="section-title">Preventive & Adaptive Features</h2>
              <ul className="features-list">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.preventiveFeatures.map((feature: any, idx: number) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      )}

      {/* Moccet Waitlist CTA */}
      <section className="plan-section waitlist-section">
        <h2 className="waitlist-title">If you enjoyed using forge, join the waitlist for moccet.</h2>
        <p className="waitlist-subtitle">You will be one of the first to try out our full suite.</p>
        <div className="qr-code-placeholder">
          <div className="qr-box">
            <img
              src="/sage-qr-code.png"
              alt="Moccet Waitlist QR Code"
              className="qr-code-image"
            />
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <footer className="plan-footer">
        <p>
          For questions, guidance, or personalized workout updates / additions contact the forge team.<br />
          All numbers, meal plans and recommendations reflect clinical best practices and feature only foods and dosages shown safe and effective
          for the clients clinical profile. Supplementation is subject to personal discretion, contact your physician if any adverse effects occur.
        </p>
        <p className="footer-brand">forge, a product by moccet inc © 2025</p>
      </footer>
    </div>
  );
}
