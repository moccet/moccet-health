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
  biomarkers: Record<string, unknown>;
  nutritionOverview: {
    goals: string[];
    nutritionStructure: {
      calories: string;
      protein: string;
      carbs: string;
      fiber: string;
      fat: string;
    };
  };
  dailyRecommendations: {
    morningRitual: string[];
    empowerGut: string[];
    afternoonVitality: string[];
    energyOptimization: string[];
    middayMastery: string[];
    eveningNourishment: string[];
  };
  micronutrientFocus: Array<{
    nutrient: string;
    dailyGoal: string;
    foodSources: string;
  }>;
  sampleMealPlan: {
    [key: string]: {
      meals: Array<{
        time: string;
        name: string;
        description: string;
        macros: string;
        ingredients?: string[];
        cookingInstructions?: string[];
        cookingTime?: string;
        difficulty?: string;
      }>;
    };
  };
  lifestyleIntegration: {
    sleepOptimization: string;
    exerciseProtocol: string;
    stressManagement: string;
    skinImprovement?: string;
  };
  preventiveFeatures: string[];
}

export default function PersonalisedPlanPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loadingMealPlan, setLoadingMealPlan] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailedMealPlan, setDetailedMealPlan] = useState<any>(null);
  const [loadingBloodAnalysis, setLoadingBloodAnalysis] = useState(false);
  const [bloodAnalysis, setBloodAnalysis] = useState<BloodAnalysis | null>(null);
  const [loadingMicronutrients, setLoadingMicronutrients] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [micronutrients, setMicronutrients] = useState<any>(null);
  const [loadingLifestyle, setLoadingLifestyle] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lifestyleIntegration, setLifestyleIntegration] = useState<any>(null);

  useEffect(() => {
    // Get email from URL params
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');

    if (!email) {
      setError('No email provided');
      setLoading(false);
      return;
    }

    // Fetch all data - blood analysis first, then meal plan (to optimize for biomarkers)
    const fetchAllData = async () => {
      try {
        setLoadingBloodAnalysis(true);

        // Step 1: Fetch plan and blood analysis in parallel
        const [planResponse, bloodAnalysisResponse] = await Promise.allSettled([
          fetch(`/api/generate-sage-plan?email=${encodeURIComponent(email)}`),
          fetch(`/api/analyze-blood-results?email=${encodeURIComponent(email)}`)
        ]);

        // Handle plan response (required)
        if (planResponse.status === 'fulfilled') {
          const planData = await planResponse.value.json();
          if (planResponse.value.ok) {
            setPlan(planData.plan);
          } else {
            throw new Error(planData.error || 'Failed to generate plan');
          }
        } else {
          throw new Error('Failed to fetch plan');
        }

        // Handle blood analysis response (optional)
        if (bloodAnalysisResponse.status === 'fulfilled' && bloodAnalysisResponse.value.ok) {
          const bloodData = await bloodAnalysisResponse.value.json();
          console.log('[Blood Analysis] Response:', bloodData);
          if (bloodData.success) {
            setBloodAnalysis(bloodData.analysis);
            console.log('[Blood Analysis] Set:', bloodData.analysis);
          }
        } else {
          console.log('[Blood Analysis] Not found or failed');
        }
        setLoadingBloodAnalysis(false);

        // Step 2: Now fetch meal plan (required) - waits for blood analysis to optimize for biomarkers
        setLoadingMealPlan(true);
        console.log('[Meal Plan] Fetching biomarker-optimized meal plan...');

        const mealPlanResponse = await fetch(`/api/generate-meal-plan?email=${encodeURIComponent(email)}`);
        if (mealPlanResponse.ok) {
          const mealPlanData = await mealPlanResponse.json();
          if (mealPlanData.success) {
            setDetailedMealPlan(mealPlanData.mealPlan);
            console.log('[Meal Plan] Generated successfully');
          } else {
            throw new Error(mealPlanData.error || 'Failed to generate meal plan');
          }
        } else {
          const errorData = await mealPlanResponse.json();
          throw new Error(errorData.error || 'Failed to generate meal plan');
        }
        setLoadingMealPlan(false);

        // Step 3: Fetch micronutrient recommendations
        setLoadingMicronutrients(true);
        console.log('[Micronutrients] Fetching personalized micronutrient recommendations...');

        const micronutrientsResponse = await fetch(`/api/generate-micronutrients?email=${encodeURIComponent(email)}`);
        if (micronutrientsResponse.ok) {
          const micronutrientsData = await micronutrientsResponse.json();
          if (micronutrientsData.success) {
            setMicronutrients(micronutrientsData.micronutrients);
            console.log('[Micronutrients] Generated successfully');
          }
        }
        setLoadingMicronutrients(false);

        // Step 4: Fetch lifestyle integration
        setLoadingLifestyle(true);
        console.log('[Lifestyle] Fetching personalized lifestyle integration plan...');

        const lifestyleResponse = await fetch(`/api/generate-lifestyle-integration?email=${encodeURIComponent(email)}`);
        if (lifestyleResponse.ok) {
          const lifestyleData = await lifestyleResponse.json();
          if (lifestyleData.success) {
            setLifestyleIntegration(lifestyleData.lifestyle);
            console.log('[Lifestyle] Generated successfully');
          }
        }
        setLoadingLifestyle(false);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load your personalized plan');
        setLoadingMealPlan(false);
        setLoadingBloodAnalysis(false);
        setLoadingMicronutrients(false);
        setLoadingLifestyle(false);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) {
    return (
      <div className="plan-loading">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="plan-loading-video"
        >
          <source src="/videos/sage.mp4" type="video/mp4" />
        </video>
        <div className="plan-loading-overlay">
          <div className="plan-loading-content">
            <div className="plan-loading-text">loading sage plan</div>
            <div className="plan-loading-bar-container">
              <div className="plan-loading-bar-fill"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plan-error">
        <h1>Unable to Load Plan</h1>
        <p>{error}</p>
        <button onClick={() => window.location.href = '/sage'}>Return to Sage</button>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="plan-container">
      {/* Sidebar */}
      <div className="plan-sidebar">
        <button
          className="sidebar-button download-button"
          onClick={() => window.print()}
          title="Download as PDF"
        >
          Download PDF
        </button>
        <button
          className="sidebar-button linkedin-button"
          onClick={() => {
            const url = window.location.href;
            const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            window.open(shareUrl, '_blank', 'width=600,height=600');
          }}
          title="Share on LinkedIn"
        >
          Share on LinkedIn
        </button>
        <button
          className="sidebar-button twitter-button"
          onClick={() => {
            const text = "Check out my personalized nutrition plan from Sage!";
            const url = window.location.href;
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
            window.open(shareUrl, '_blank', 'width=600,height=600');
          }}
          title="Share on X"
        >
          Share on X
        </button>
      </div>

      {/* Hero Image */}
      <div className="hero-image-container">
        <img
          src="/sage-hero.png"
          alt="Sage Nutrition Plan"
          className="hero-image"
        />
      </div>

      {/* Header */}
      <header className="plan-header">
        <h1 className="plan-main-title">Sage Nutrition Plan</h1>
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

      {/* Nutrition Plan Overview */}
      <section className="plan-section">
        <h2 className="section-title">Nutrition Plan Overview</h2>
        <div className="overview-grid">
          <div className="overview-column">
            <h3 className="overview-heading">Goals</h3>
            <ul className="goals-list">
              {plan.nutritionOverview.goals.map((goal, idx) => (
                <li key={idx}>{goal}</li>
              ))}
            </ul>
          </div>
          <div className="overview-column">
            <h3 className="overview-heading">Nutrition Structure</h3>
            <div className="nutrition-structure">
              <p><strong>Total Daily Calories:</strong> {plan.nutritionOverview.nutritionStructure.calories}</p>
              <p><strong>Protein:</strong> {plan.nutritionOverview.nutritionStructure.protein}</p>
              <p><strong>Carbs:</strong> {plan.nutritionOverview.nutritionStructure.carbs}</p>
              <p><strong>Total Fiber:</strong> {plan.nutritionOverview.nutritionStructure.fiber}</p>
              <p><strong>Fat:</strong> {plan.nutritionOverview.nutritionStructure.fat}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Nutrition Divider Image */}
      <div className="nutrition-divider">
        <img
          src="/nutrition-divider.png"
          alt="Nutrition Plan"
          className="divider-image"
        />
      </div>

      {/* Daily Recommendations Divider Image */}
      <div className="daily-recs-divider">
        <img
          src="/daily-recs-divider.png"
          alt="Daily Recommendations"
          className="divider-image-auto"
        />
      </div>

      {/* Daily Recommendations */}
      <section className="plan-section">
        <h2 className="section-title">Daily Recommendations</h2>
        <div className="recommendations-grid">
          <div className="recommendation-card">
            <h3>Morning Ritual</h3>
            <ul>
              {plan.dailyRecommendations.morningRitual.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="recommendation-card">
            <h3>Empower the Gut</h3>
            <ul>
              {plan.dailyRecommendations.empowerGut.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="recommendation-card">
            <h3>Afternoon Vitality</h3>
            <ul>
              {plan.dailyRecommendations.afternoonVitality.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="recommendation-card">
            <h3>Energy Optimization</h3>
            <ul>
              {plan.dailyRecommendations.energyOptimization.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="recommendation-card">
            <h3>Midday Mastery</h3>
            <ul>
              {plan.dailyRecommendations.middayMastery.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="recommendation-card">
            <h3>Evening Nourishment</h3>
            <ul>
              {plan.dailyRecommendations.eveningNourishment.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Micronutrient Focus */}
      <section className="plan-section">
        <h2 className="section-title">Micronutrient Focus</h2>

        {loadingMicronutrients && (
          <div className="micronutrients-loading">
            <div className="loading-spinner-small"></div>
            <p>Generating personalized micronutrient recommendations...</p>
          </div>
        )}

        {micronutrients && (
          <>
            {micronutrients.personalizedIntro && (
              <p className="micronutrients-intro">{micronutrients.personalizedIntro}</p>
            )}

            <div className="table-container">
              <table className="micronutrient-table">
                <thead>
                  <tr>
                    <th>Nutrient</th>
                    <th>Daily Goal</th>
                    <th>Food Sources in Plan</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {micronutrients.micronutrients?.map((nutrient: any, idx: number) => (
                    <tr key={idx}>
                      <td className="nutrient-name">{nutrient.nutrient}</td>
                      <td className="nutrient-goal">{nutrient.dailyGoal}</td>
                      <td className="nutrient-sources">{nutrient.foodSources}</td>
                      <td className="nutrient-purpose">{nutrient.purpose}</td>
                    </tr>
              ))}
            </tbody>
          </table>
        </div>
          </>
        )}

        {!loadingMicronutrients && !micronutrients && plan.micronutrientFocus && (
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
                {plan.micronutrientFocus.map((nutrient, idx) => (
                  <tr key={idx}>
                    <td className="nutrient-name">{nutrient.nutrient}</td>
                    <td className="nutrient-goal">{nutrient.dailyGoal}</td>
                    <td className="nutrient-sources">{nutrient.foodSources}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lifestyle Integration */}
      <section className="plan-section lifestyle-section">
        <h2 className="section-title">Lifestyle Integration</h2>

        {loadingLifestyle && (
          <div className="lifestyle-loading">
            <div className="loading-spinner-small"></div>
            <p>Generating personalized lifestyle integration plan...</p>
          </div>
        )}

        {lifestyleIntegration && (
          <div className="lifestyle-grid">
            {/* Sleep Optimization */}
            {lifestyleIntegration.sleepOptimization && (
              <div className="lifestyle-card">
                <h3 className="lifestyle-card-title">💤 Sleep Optimization</h3>
                {lifestyleIntegration.sleepOptimization.personalizedIntro && (
                  <p className="lifestyle-intro">{lifestyleIntegration.sleepOptimization.personalizedIntro}</p>
                )}

                <div className="lifestyle-content">
                  {lifestyleIntegration.sleepOptimization.optimalSleepWindow && (
                    <div className="lifestyle-item">
                      <strong>Optimal Sleep Window:</strong>
                      <p>{lifestyleIntegration.sleepOptimization.optimalSleepWindow}</p>
                    </div>
                  )}

                  {lifestyleIntegration.sleepOptimization.preBedroutine && lifestyleIntegration.sleepOptimization.preBedroutine.length > 0 && (
                    <div className="lifestyle-item">
                      <strong>Pre-Bed Routine:</strong>
                      <ul>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.sleepOptimization.preBedroutine.map((item: any, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {lifestyleIntegration.sleepOptimization.morningProtocol && lifestyleIntegration.sleepOptimization.morningProtocol.length > 0 && (
                    <div className="lifestyle-item">
                      <strong>Morning Protocol:</strong>
                      <ul>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.sleepOptimization.morningProtocol.map((item: any, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {lifestyleIntegration.sleepOptimization.whyThisMatters && (
                    <div className="lifestyle-why">
                      <strong>Why This Matters:</strong>
                      <p>{lifestyleIntegration.sleepOptimization.whyThisMatters}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Exercise Protocol */}
            {lifestyleIntegration.exerciseProtocol && (
              <div className="lifestyle-card">
                <h3 className="lifestyle-card-title">💪 Exercise Protocol</h3>
                {lifestyleIntegration.exerciseProtocol.personalizedIntro && (
                  <p className="lifestyle-intro">{lifestyleIntegration.exerciseProtocol.personalizedIntro}</p>
                )}

                <div className="lifestyle-content">
                  {lifestyleIntegration.exerciseProtocol.weeklyStructure && (
                    <div className="lifestyle-item">
                      <strong>Weekly Structure:</strong>
                      <p>{lifestyleIntegration.exerciseProtocol.weeklyStructure}</p>
                    </div>
                  )}

                  {lifestyleIntegration.exerciseProtocol.workoutSplit && lifestyleIntegration.exerciseProtocol.workoutSplit.length > 0 && (
                    <div className="lifestyle-item">
                      <strong>Workout Split:</strong>
                      <div className="workout-split">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.exerciseProtocol.workoutSplit.map((workout: any, idx: number) => (
                          <div key={idx} className="workout-day">
                            <strong>{workout.day}:</strong> {workout.focus}
                            {workout.duration && <span className="workout-duration"> • {workout.duration}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lifestyleIntegration.exerciseProtocol.whyThisMatters && (
                    <div className="lifestyle-why">
                      <strong>Why This Matters:</strong>
                      <p>{lifestyleIntegration.exerciseProtocol.whyThisMatters}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stress Management */}
            {lifestyleIntegration.stressManagement && (
              <div className="lifestyle-card">
                <h3 className="lifestyle-card-title">🧘 Stress Management</h3>
                {lifestyleIntegration.stressManagement.personalizedIntro && (
                  <p className="lifestyle-intro">{lifestyleIntegration.stressManagement.personalizedIntro}</p>
                )}

                <div className="lifestyle-content">
                  {lifestyleIntegration.stressManagement.dailyPractices && lifestyleIntegration.stressManagement.dailyPractices.length > 0 && (
                    <div className="lifestyle-item">
                      <strong>Daily Practices:</strong>
                      <div className="stress-practices">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.stressManagement.dailyPractices.map((practice: any, idx: number) => (
                          <div key={idx} className="practice-item">
                            <strong>{practice.practice}</strong>
                            {practice.timing && <span> • {practice.timing}</span>}
                            {practice.duration && <span> • {practice.duration}</span>}
                            {practice.benefit && <p className="practice-benefit">{practice.benefit}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lifestyleIntegration.stressManagement.whyThisMatters && (
                    <div className="lifestyle-why">
                      <strong>Why This Matters:</strong>
                      <p>{lifestyleIntegration.stressManagement.whyThisMatters}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Skin Improvement */}
            {lifestyleIntegration.skinImprovement && (
              <div className="lifestyle-card">
                <h3 className="lifestyle-card-title">✨ Skin Improvement</h3>
                {lifestyleIntegration.skinImprovement.personalizedIntro && (
                  <p className="lifestyle-intro">{lifestyleIntegration.skinImprovement.personalizedIntro}</p>
                )}

                <div className="lifestyle-content">
                  {lifestyleIntegration.skinImprovement.morningRoutine && lifestyleIntegration.skinImprovement.morningRoutine.length > 0 && (
                    <div className="lifestyle-item">
                      <strong>Morning Routine:</strong>
                      <ol className="skincare-routine">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.skinImprovement.morningRoutine.map((step: any, idx: number) => (
                          <li key={idx}>
                            <strong>{step.product}</strong>
                            {step.purpose && <span className="step-purpose"> - {step.purpose}</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {lifestyleIntegration.skinImprovement.eveningRoutine && lifestyleIntegration.skinImprovement.eveningRoutine.length > 0 && (
                    <div className="lifestyle-item">
                      <strong>Evening Routine:</strong>
                      <ol className="skincare-routine">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.skinImprovement.eveningRoutine.map((step: any, idx: number) => (
                          <li key={idx}>
                            <strong>{step.product}</strong>
                            {step.purpose && <span className="step-purpose"> - {step.purpose}</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {lifestyleIntegration.skinImprovement.whyThisMatters && (
                    <div className="lifestyle-why">
                      <strong>Why This Matters:</strong>
                      <p>{lifestyleIntegration.skinImprovement.whyThisMatters}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sample Meal Plan with Side Image Layout */}
      <div className="with-side-image-layout">
        <div className="side-image-container">
          <img
            src="/meal-plan-side-image.png"
            alt="Gourmet Meal"
            className="side-image"
          />
        </div>

        <div className="side-content">
          {/* Profile Summary */}
          {detailedMealPlan && detailedMealPlan.profileSummary && (
            <div className="profile-summary-card">
              <h3 className="profile-summary-title">Your Personalized Plan</h3>
              <div className="profile-summary-grid">
                <div className="profile-summary-item">
                  <span className="profile-summary-label">Goals:</span>
                  <span className="profile-summary-value">{detailedMealPlan.profileSummary.goals}</span>
                </div>
                <div className="profile-summary-item">
                  <span className="profile-summary-label">Dietary Preferences:</span>
                  <span className="profile-summary-value">{detailedMealPlan.profileSummary.dietaryPreferences}</span>
                </div>
                {detailedMealPlan.profileSummary.keyBiomarkers && detailedMealPlan.profileSummary.keyBiomarkers.length > 0 && (
                  <div className="profile-summary-item">
                    <span className="profile-summary-label">Key Biomarkers Being Targeted:</span>
                    <div className="biomarker-tags">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {detailedMealPlan.profileSummary.keyBiomarkers.map((biomarker: any, idx: number) => (
                        <span key={idx} className="biomarker-tag">{biomarker}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sample Meal Plan */}
          <section className="plan-section">
            <h2 className="section-title">Meal Plan</h2>
            {loadingMealPlan && (
              <div className="meal-plan-loading">
                <div className="loading-spinner-small"></div>
                <p>Generating biomarker-optimized meal plan...</p>
              </div>
            )}
            <div className="meal-plan-grid">
              {Object.keys(detailedMealPlan || plan.sampleMealPlan)
                .filter(key => key !== 'profileSummary') // Skip the profile summary object
                .map((dayKey, dayIdx) => {
                const day = detailedMealPlan ? detailedMealPlan[dayKey] : plan.sampleMealPlan[dayKey];
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

            {loadingLifestyle && (
              <div className="lifestyle-loading">
                <div className="loading-spinner-small"></div>
                <p>Generating personalized lifestyle integration plan...</p>
              </div>
            )}

            {lifestyleIntegration ? (
              <div className="lifestyle-grid">
                {/* Sleep Optimization */}
                {lifestyleIntegration.sleepOptimization && (
                  <div className="lifestyle-card">
                    <h3 className="lifestyle-card-title">Sleep Optimization</h3>
                    {lifestyleIntegration.sleepOptimization.personalizedIntro && (
                      <p className="lifestyle-intro">{lifestyleIntegration.sleepOptimization.personalizedIntro}</p>
                    )}

                    <div className="lifestyle-content">
                      {lifestyleIntegration.sleepOptimization.optimalSleepWindow && (
                        <div className="lifestyle-item">
                          <strong>Optimal Sleep Window:</strong>
                          <p>{lifestyleIntegration.sleepOptimization.optimalSleepWindow}</p>
                        </div>
                      )}

                      {lifestyleIntegration.sleepOptimization.preBedroutine && lifestyleIntegration.sleepOptimization.preBedroutine.length > 0 && (
                        <div className="lifestyle-item">
                          <strong>Pre-Bed Routine:</strong>
                          <ul>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyleIntegration.sleepOptimization.preBedroutine.map((item: any, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {lifestyleIntegration.sleepOptimization.morningProtocol && lifestyleIntegration.sleepOptimization.morningProtocol.length > 0 && (
                        <div className="lifestyle-item">
                          <strong>Morning Protocol:</strong>
                          <ul>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyleIntegration.sleepOptimization.morningProtocol.map((item: any, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {lifestyleIntegration.sleepOptimization.whyThisMatters && (
                        <div className="lifestyle-why">
                          <strong>Why This Matters:</strong>
                          <p>{lifestyleIntegration.sleepOptimization.whyThisMatters}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Exercise Protocol */}
                {lifestyleIntegration.exerciseProtocol && (
                  <div className="lifestyle-card">
                    <h3 className="lifestyle-card-title">Exercise Protocol</h3>
                    {lifestyleIntegration.exerciseProtocol.personalizedIntro && (
                      <p className="lifestyle-intro">{lifestyleIntegration.exerciseProtocol.personalizedIntro}</p>
                    )}

                    <div className="lifestyle-content">
                      {lifestyleIntegration.exerciseProtocol.weeklyStructure && (
                        <div className="lifestyle-item">
                          <strong>Weekly Structure:</strong>
                          <p>{lifestyleIntegration.exerciseProtocol.weeklyStructure}</p>
                        </div>
                      )}

                      {lifestyleIntegration.exerciseProtocol.workoutSplit && lifestyleIntegration.exerciseProtocol.workoutSplit.length > 0 && (
                        <div className="lifestyle-item">
                          <strong>Workout Split:</strong>
                          <div className="workout-split">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyleIntegration.exerciseProtocol.workoutSplit.map((workout: any, idx: number) => (
                              <div key={idx} className="workout-day">
                                <strong>{workout.day}:</strong> {workout.focus}
                                {workout.duration && <span className="workout-duration"> • {workout.duration}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {lifestyleIntegration.exerciseProtocol.whyThisMatters && (
                        <div className="lifestyle-why">
                          <strong>Why This Matters:</strong>
                          <p>{lifestyleIntegration.exerciseProtocol.whyThisMatters}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stress Management */}
                {lifestyleIntegration.stressManagement && (
                  <div className="lifestyle-card">
                    <h3 className="lifestyle-card-title">Stress Management</h3>
                    {lifestyleIntegration.stressManagement.personalizedIntro && (
                      <p className="lifestyle-intro">{lifestyleIntegration.stressManagement.personalizedIntro}</p>
                    )}

                    <div className="lifestyle-content">
                      {lifestyleIntegration.stressManagement.dailyPractices && lifestyleIntegration.stressManagement.dailyPractices.length > 0 && (
                        <div className="lifestyle-item">
                          <strong>Daily Practices:</strong>
                          <div className="stress-practices">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyleIntegration.stressManagement.dailyPractices.map((practice: any, idx: number) => (
                              <div key={idx} className="practice-item">
                                <strong>{practice.practice}</strong>
                                {practice.timing && <span> • {practice.timing}</span>}
                                {practice.duration && <span> • {practice.duration}</span>}
                                {practice.benefit && <p className="practice-benefit">{practice.benefit}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {lifestyleIntegration.stressManagement.whyThisMatters && (
                        <div className="lifestyle-why">
                          <strong>Why This Matters:</strong>
                          <p>{lifestyleIntegration.stressManagement.whyThisMatters}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Skin Improvement */}
                {lifestyleIntegration.skinImprovement && (
                  <div className="lifestyle-card">
                    <h3 className="lifestyle-card-title">Skin Improvement</h3>
                    {lifestyleIntegration.skinImprovement.personalizedIntro && (
                      <p className="lifestyle-intro">{lifestyleIntegration.skinImprovement.personalizedIntro}</p>
                    )}

                    <div className="lifestyle-content">
                      {lifestyleIntegration.skinImprovement.morningRoutine && lifestyleIntegration.skinImprovement.morningRoutine.length > 0 && (
                        <div className="lifestyle-item">
                          <strong>Morning Routine:</strong>
                          <ol className="skincare-routine">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyleIntegration.skinImprovement.morningRoutine.map((step: any, idx: number) => (
                              <li key={idx}>
                                <strong>{step.product}</strong>
                                {step.purpose && <span className="step-purpose"> - {step.purpose}</span>}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {lifestyleIntegration.skinImprovement.eveningRoutine && lifestyleIntegration.skinImprovement.eveningRoutine.length > 0 && (
                        <div className="lifestyle-item">
                          <strong>Evening Routine:</strong>
                          <ol className="skincare-routine">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyleIntegration.skinImprovement.eveningRoutine.map((step: any, idx: number) => (
                              <li key={idx}>
                                <strong>{step.product}</strong>
                                {step.purpose && <span className="step-purpose"> - {step.purpose}</span>}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {lifestyleIntegration.skinImprovement.whyThisMatters && (
                        <div className="lifestyle-why">
                          <strong>Why This Matters:</strong>
                          <p>{lifestyleIntegration.skinImprovement.whyThisMatters}</p>
                        </div>
                      )}
                    </div>
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
          <section className="plan-section">
            <h2 className="section-title">Preventive & Adaptive Features</h2>
            <ul className="features-list">
              {plan.preventiveFeatures.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Moccet Waitlist CTA */}
      <section className="plan-section waitlist-section">
        <h2 className="waitlist-title">If you enjoyed using sage, join the waitlist for moccet.</h2>
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
          For questions, guidance, or personalized recipe updates / additions contact the sage team.<br />
          All numbers, meal plans and recommendations reflect clinical best practices and feature only foods and dosages shown safe and effective
          for the clients clinical profile. Supplementation is subject to personal discretion, contact your physician if any adverse effects occur.
        </p>
        <p className="footer-brand">sage, a product by moccet inc © 2025</p>
      </footer>
    </div>
  );
}
