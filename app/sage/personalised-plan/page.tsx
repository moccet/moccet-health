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
    // Get code or email from URL params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const email = params.get('email');

    // Use code parameter if available, otherwise use email parameter
    const identifier = code || email;

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
        setLoadingBloodAnalysis(true);

        // Step 1: Fetch plan and blood analysis in parallel
        const [planResponse, bloodAnalysisResponse] = await Promise.allSettled([
          fetch(`/api/generate-sage-plan?${paramName}=${encodeURIComponent(identifier)}`),
          fetch(`/api/analyze-blood-results?${paramName}=${encodeURIComponent(identifier)}`)
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

        const mealPlanResponse = await fetch(`/api/generate-meal-plan?${paramName}=${encodeURIComponent(identifier)}`);
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

        const micronutrientsResponse = await fetch(`/api/generate-micronutrients?${paramName}=${encodeURIComponent(identifier)}`);
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

        const lifestyleResponse = await fetch(`/api/generate-lifestyle-integration?${paramName}=${encodeURIComponent(identifier)}`);
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
            loading sage plan
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
          className="sidebar-icon-button"
          onClick={() => {
            const subject = encodeURIComponent("My Personalized Nutrition Plan from Sage");
            const body = encodeURIComponent(`Check out my personalized nutrition plan: ${window.location.href}`);
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
          }}
          title="Email my plan"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
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
            const text = "Check out my personalized nutrition plan from Sage!";
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
              <div className="lifestyle-clean">
                {/* Sleep Optimization */}
                {lifestyleIntegration.sleepOptimization && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Sleep Optimization</h3>
                    {lifestyleIntegration.sleepOptimization.personalizedIntro && (
                      <p className="lifestyle-subtitle">{lifestyleIntegration.sleepOptimization.personalizedIntro}</p>
                    )}

                    {lifestyleIntegration.sleepOptimization.optimalSleepWindow && (
                      <div className="lifestyle-text">
                        <p><strong>Optimal Sleep Window:</strong> {lifestyleIntegration.sleepOptimization.optimalSleepWindow}</p>
                      </div>
                    )}

                    {lifestyleIntegration.sleepOptimization.preBedroutine && lifestyleIntegration.sleepOptimization.preBedroutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Pre-Bed Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.sleepOptimization.preBedroutine.map((item: any, idx: number) => (
                          <p key={idx}>• {item}</p>
                        ))}
                      </div>
                    )}

                    {lifestyleIntegration.sleepOptimization.morningProtocol && lifestyleIntegration.sleepOptimization.morningProtocol.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Morning Protocol:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.sleepOptimization.morningProtocol.map((item: any, idx: number) => (
                          <p key={idx}>• {item}</p>
                        ))}
                      </div>
                    )}

                    {lifestyleIntegration.sleepOptimization.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {lifestyleIntegration.sleepOptimization.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Exercise Protocol */}
                {lifestyleIntegration.exerciseProtocol && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Exercise Protocol</h3>
                    {lifestyleIntegration.exerciseProtocol.personalizedIntro && (
                      <p className="lifestyle-subtitle">{lifestyleIntegration.exerciseProtocol.personalizedIntro}</p>
                    )}

                    {lifestyleIntegration.exerciseProtocol.weeklyStructure && (
                      <div className="lifestyle-text">
                        <p><strong>Weekly Structure:</strong> {lifestyleIntegration.exerciseProtocol.weeklyStructure}</p>
                      </div>
                    )}

                    {lifestyleIntegration.exerciseProtocol.workoutSplit && lifestyleIntegration.exerciseProtocol.workoutSplit.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Workout Split:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.exerciseProtocol.workoutSplit.map((workout: any, idx: number) => (
                          <p key={idx}>
                            <strong>{workout.day}:</strong> {workout.focus}
                            {workout.duration && <> • {workout.duration}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {lifestyleIntegration.exerciseProtocol.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {lifestyleIntegration.exerciseProtocol.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Stress Management */}
                {lifestyleIntegration.stressManagement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Stress Management</h3>
                    {lifestyleIntegration.stressManagement.personalizedIntro && (
                      <p className="lifestyle-subtitle">{lifestyleIntegration.stressManagement.personalizedIntro}</p>
                    )}

                    {lifestyleIntegration.stressManagement.dailyPractices && lifestyleIntegration.stressManagement.dailyPractices.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Daily Practices:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.stressManagement.dailyPractices.map((practice: any, idx: number) => (
                          <p key={idx}>
                            <strong>{practice.practice}</strong>
                            {practice.timing && <> • {practice.timing}</>}
                            {practice.duration && <> • {practice.duration}</>}
                            {practice.benefit && <><br />{practice.benefit}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {lifestyleIntegration.stressManagement.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {lifestyleIntegration.stressManagement.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Skin Improvement */}
                {lifestyleIntegration.skinImprovement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Skin Improvement</h3>
                    {lifestyleIntegration.skinImprovement.personalizedIntro && (
                      <p className="lifestyle-subtitle">{lifestyleIntegration.skinImprovement.personalizedIntro}</p>
                    )}

                    {lifestyleIntegration.skinImprovement.morningRoutine && lifestyleIntegration.skinImprovement.morningRoutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Morning Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.skinImprovement.morningRoutine.map((step: any, idx: number) => (
                          <p key={idx}>
                            {idx + 1}. <strong>{step.product}</strong>
                            {step.purpose && <> - {step.purpose}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {lifestyleIntegration.skinImprovement.eveningRoutine && lifestyleIntegration.skinImprovement.eveningRoutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Evening Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyleIntegration.skinImprovement.eveningRoutine.map((step: any, idx: number) => (
                          <p key={idx}>
                            {idx + 1}. <strong>{step.product}</strong>
                            {step.purpose && <> - {step.purpose}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {lifestyleIntegration.skinImprovement.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {lifestyleIntegration.skinImprovement.whyThisMatters}</p>
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
