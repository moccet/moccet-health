'use client';

import { useState, useEffect } from 'react';
import './personalised-plan.css';
import ShoppingCart from '@/components/ShoppingCart';

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
  supplementRecommendations?: {
    essentialSupplements?: Array<{
      name: string;
      dosage: string;
      timing: string;
      rationale: string;
      benefits?: string;
      duration?: string;
    }>;
    optionalSupplements?: Array<{
      name: string;
      dosage: string;
      timing: string;
      rationale: string;
      benefits?: string;
      duration?: string;
    }>;
    // Alternative naming convention
    essential?: Array<{
      name: string;
      dosage: string;
      timing: string;
      rationale: string;
      benefits?: string;
      duration?: string;
    }>;
    optional?: Array<{
      name: string;
      dosage: string;
      timing: string;
      rationale: string;
      benefits?: string;
      duration?: string;
    }>;
    considerations?: string;
    personalizedNotes?: string;
  };
}

export default function PersonalisedPlanPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planStatus, setPlanStatus] = useState<'queued' | 'processing' | 'completed' | 'failed' | 'unknown'>('unknown');
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
  const [cartOpen, setCartOpen] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [enrichedEssentialSupplements, setEnrichedEssentialSupplements] = useState<any[]>([]);
  const [enrichedOptionalSupplements, setEnrichedOptionalSupplements] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    // Get code or email from URL params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const emailParam = params.get('email');

    // Store for cart
    setPlanCode(code);
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

        // Debug: Log the plan structure
        console.log('[Plan Structure] Full plan:', planData.plan);
        console.log('[Plan Structure] Plan keys:', Object.keys(planData.plan || {}));

        // Transform old plan structure to new structure if needed
        let transformedPlan = planData.plan;

        // Check if this is an old plan format (has nutrition_plan instead of nutritionOverview)
        if (planData.plan && planData.plan.nutrition_plan && !planData.plan.nutritionOverview) {
          console.log('[Plan Transform] Detected old plan format, transforming...');

          // Helper to ensure array
          const ensureArray = (val: any) => {
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') return [val];
            if (!val) return [];
            return [];
          };

          // Extract goals from string format "Main priority — physical — Driving goal — athletic"
          const extractGoals = (goalsString: string) => {
            if (!goalsString) return [];
            // Split by — and clean up
            return goalsString.split('—').map(g => g.trim()).filter(g => g && !g.startsWith('Main') && !g.startsWith('Driving'));
          };

          // Map old structure to new structure
          const firstName = planData.plan.overview?.user?.split(' ')[0] || 'there';
          const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

          transformedPlan = {
            personalizedGreeting: `Welcome, ${capitalizedFirstName}`,
            executiveSummary: planData.plan.overview?.interpretation || planData.plan.overview?.summary || '',
            biomarkers: null,
            nutritionOverview: {
              goals: planData.plan.priority_areas?.map((p: any) => {
                // Handle different priority area formats
                if (typeof p === 'string') return p;
                if (typeof p === 'object') return p.area || p.name || String(p);
                return String(p);
              }) || extractGoals(planData.plan.overview?.goals || ''),
              nutritionStructure: {
                calories: planData.plan.nutrition_plan?.macro_framework || 'Not specified',
                protein: planData.plan.nutrition_plan?.protein_target || 'Not specified',
                carbs: planData.plan.nutrition_plan?.carb_strategy || 'Not specified',
                fiber: planData.plan.nutrition_plan?.fiber_target || 'Not specified',
                fat: planData.plan.nutrition_plan?.fat_quality_shift || 'Not specified'
              }
            },
            dailyRecommendations: {
              morningRitual: planData.plan.nutrition_plan?.feeding_windows?.[0]
                ? [
                    planData.plan.nutrition_plan.feeding_windows[0].window,
                    planData.plan.nutrition_plan.feeding_windows[0].rationale,
                    planData.plan.nutrition_plan.feeding_windows[0].preworkout_within_window
                  ].filter(Boolean)
                : ensureArray(planData.plan.nutrition_plan?.morning_ritual),
              empowerGut: planData.plan.nutrition_plan?.cholesterol_lowering_foods
                ? [planData.plan.nutrition_plan.cholesterol_lowering_foods]
                : ensureArray(planData.plan.nutrition_plan?.gut_health),
              afternoonVitality: planData.plan.nutrition_plan?.feeding_windows?.[1]
                ? [
                    planData.plan.nutrition_plan.feeding_windows[1].rationale,
                    planData.plan.nutrition_plan.feeding_windows[1].preworkout_within_window
                  ].filter(Boolean)
                : ensureArray(planData.plan.nutrition_plan?.afternoon_vitality),
              energyOptimization: planData.plan.nutrition_plan?.feeding_windows?.[0]?.postworkout_within_window
                ? [planData.plan.nutrition_plan.feeding_windows[0].postworkout_within_window]
                : ensureArray(planData.plan.nutrition_plan?.pre_post_workout),
              middayMastery: planData.plan.nutrition_plan?.macro_framework
                ? [planData.plan.nutrition_plan.macro_framework]
                : ensureArray(planData.plan.nutrition_plan?.meal_timing),
              eveningNourishment: planData.plan.nutrition_plan?.iron_management_in_foods
                ? [planData.plan.nutrition_plan.iron_management_in_foods]
                : ensureArray(planData.plan.nutrition_plan?.evening_protocol)
            },
            micronutrientFocus: ensureArray(planData.plan.nutrition_plan?.micronutrients || planData.plan.targeted_interventions).map((item: any) => {
              // Handle different micronutrient formats
              if (item.nutrient && item.dailyGoal && item.foodSources) {
                return item; // Already in correct format
              }
              // Transform old format from targeted_interventions: {title, actions, biomarker_links}
              if (item.title && item.biomarker_links) {
                return {
                  nutrient: item.title,
                  dailyGoal: Array.isArray(item.actions) ? item.actions.join('; ') : (item.actions || 'See plan details'),
                  foodSources: item.biomarker_links
                };
              }
              // Fallback for other formats
              return {
                nutrient: item.name || item.nutrient || 'Unknown',
                dailyGoal: item.targets || item.target || item.dailyGoal || 'Not specified',
                foodSources: item.evidence || item.sources || item.foodSources || 'Various sources'
              };
            }),
            sampleMealPlan: planData.plan.nutrition_plan?.daily_meal_examples ?
              // Convert array of meal examples to day-based structure
              planData.plan.nutrition_plan.daily_meal_examples.reduce((acc: any, mealExample: any, idx: number) => {
                const dayKey = `day${idx + 1}`;
                // Parse meal string: "Meal Name — ingredient 1 — ingredient 2 — ..."
                const mealParts = mealExample.meal?.split('—').map((p: string) => p.trim()) || [];
                const mealName = mealParts[0] || `Meal ${idx + 1}`;
                const ingredients = mealParts.slice(1).filter((i: string) => i.length > 0);

                // Transform {meal, time, biomarker_targets} to proper meal structure
                acc[dayKey] = {
                  meals: [{
                    time: mealExample.time || `Meal ${idx + 1}`,
                    name: mealName,
                    description: `${mealName} - ${mealExample.biomarker_targets || 'Optimized for your biomarkers'}`,
                    macros: '', // Macros are embedded in biomarker_targets
                    ingredients: ingredients.length > 0 ? ingredients : [mealExample.meal],
                    cookingInstructions: mealExample.biomarker_targets ? [mealExample.biomarker_targets] : []
                  }]
                };
                return acc;
              }, {}) : {},
            lifestyleIntegration: {
              sleepOptimization: planData.plan.training_nutrition?.sleep || planData.plan.training_nutrition?.rest_days || 'Not specified',
              exerciseProtocol: planData.plan.training_nutrition?.pre_training || planData.plan.training_nutrition?.training || 'Not specified',
              stressManagement: planData.plan.training_nutrition?.post_training || planData.plan.training_nutrition?.recovery || 'Not specified'
            },
            preventiveFeatures: [
              ...ensureArray(planData.plan.monitoring_plan?.self_tracking),
              ...ensureArray(planData.plan.monitoring_plan?.biomarker_retests),
              ...(planData.plan.monitoring_plan?.convergence_checks ? [planData.plan.monitoring_plan.convergence_checks] : [])
            ],
            supplementRecommendations: planData.plan.supplement_plan ? {
              essentialSupplements: ensureArray(planData.plan.supplement_plan)
                .filter((s: any) => {
                  // Skip supplements that are "not indicated" or "already optimal"
                  if (s.supplement?.toLowerCase().includes('not indicated')) return false;
                  if (s.purpose?.toLowerCase().includes('already optimal')) return false;
                  // Skip adjunct/optional supplements
                  const purpose = (s.purpose || '').toLowerCase();
                  if (purpose.includes('adjunct')) return false;
                  // Categorize as essential if purpose contains strong action words
                  return purpose.includes('reduce') || purpose.includes('lower') ||
                         purpose.includes('raise') || purpose.includes('competitive inhibition');
                })
                .map((s: any) => {
                  // Parse supplement string: "Name — dosage timing"
                  const parts = s.supplement?.split('—').map((p: string) => p.trim()) || [];
                  const name = parts[0] || s.supplement || 'Supplement';
                  const dosageAndTiming = parts.slice(1).join(' ') || 'As directed';

                  return {
                    name: name,
                    dosage: dosageAndTiming,
                    timing: dosageAndTiming.includes('daily') ? dosageAndTiming : 'Daily with food',
                    rationale: s.purpose || 'As recommended',
                    benefits: s.biomarker_links || '',
                    duration: 'Daily ongoing'
                  };
                }),
              optionalSupplements: ensureArray(planData.plan.supplement_plan)
                .filter((s: any) => {
                  // Optional if it's adjunct support or curcumin-type supplements
                  const purpose = (s.purpose || '').toLowerCase();
                  return purpose.includes('adjunct') || purpose.includes('support');
                })
                .map((s: any) => {
                  const parts = s.supplement?.split('—').map((p: string) => p.trim()) || [];
                  const name = parts[0] || s.supplement || 'Supplement';
                  const dosageAndTiming = parts.slice(1).join(' ') || 'As directed';

                  return {
                    name: name,
                    dosage: dosageAndTiming,
                    timing: dosageAndTiming.includes('daily') ? dosageAndTiming : 'Daily with food',
                    rationale: s.purpose || 'As recommended',
                    benefits: s.biomarker_links || '',
                    duration: 'Daily ongoing'
                  };
                })
            } : undefined
          };

          console.log('[Plan Transform] Transformed plan:', transformedPlan);
          console.log('[Plan Transform] Transformed goals:', transformedPlan.nutritionOverview?.goals);
          console.log('[Plan Transform] Transformed micronutrients:', transformedPlan.micronutrientFocus);
          console.log('[Plan Transform] Transformed supplements:', transformedPlan.supplementRecommendations);
          console.log('[Plan Transform] Essential supplements count:', transformedPlan.supplementRecommendations?.essentialSupplements?.length);
          console.log('[Plan Transform] Optional supplements count:', transformedPlan.supplementRecommendations?.optionalSupplements?.length);
          console.log('[Plan Transform] Original overview:', planData.plan.overview);
          console.log('[Plan Transform] Original nutrition_plan:', planData.plan.nutrition_plan);
          console.log('[Plan Transform] Original priority_areas:', planData.plan.priority_areas);
          console.log('[Plan Transform] Original targeted_interventions:', planData.plan.targeted_interventions);
          console.log('[Plan Transform] Original supplement_plan:', planData.plan.supplement_plan);
        }

        // Set plan data
        setPlan(transformedPlan);
        setPlanStatus(planData.status || 'completed');

        // Extract and set email from API response if not already set
        if (!email && planData.email) {
          setEmail(planData.email);
          console.log('[Email] Extracted from plan data:', planData.email);
        }

        // Set blood analysis if available
        if (planData.bloodAnalysis) {
          setBloodAnalysis(planData.bloodAnalysis);
          console.log('[Blood Analysis] Loaded from database:', planData.bloodAnalysis);
        }

        setLoadingBloodAnalysis(false);

        // All additional data (meal plan, micronutrients, lifestyle) loaded from single API call
        if (planData.mealPlan) {
          setDetailedMealPlan(planData.mealPlan);
          console.log('[Meal Plan] Loaded from database');
        }
        setLoadingMealPlan(false);

        if (planData.micronutrients) {
          setMicronutrients(planData.micronutrients);
          console.log('[Micronutrients] Loaded from database');
        }
        setLoadingMicronutrients(false);

        if (planData.lifestyleIntegration) {
          setLifestyleIntegration(planData.lifestyleIntegration);
          console.log('[Lifestyle] Loaded from database');
        }
        setLoadingLifestyle(false);

        // Enrich supplements with product data if they exist (use transformedPlan for old format)
        const planToCheck = transformedPlan.supplementRecommendations || planData.plan?.supplementRecommendations;
        if (planToCheck) {
          // Handle both naming conventions: essentialSupplements/optionalSupplements AND essential/optional
          const essential = planToCheck.essentialSupplements || planToCheck.essential || [];
          const optional = planToCheck.optionalSupplements || planToCheck.optional || [];

          console.log('[Supplement Enrichment] Essential count:', essential.length);
          console.log('[Supplement Enrichment] Optional count:', optional.length);

          if (essential.length > 0) {
            enrichSupplements(essential, 'essential');
          }
          if (optional.length > 0) {
            enrichSupplements(optional, 'optional');
          }
        }

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

  // Fetch cart count on mount and when cart updates
  useEffect(() => {
    if (email || planCode) {
      fetchCartCount();
    }

    // Listen for cart updates
    const handleCartUpdate = () => {
      fetchCartCount();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, [email, planCode]);

  // Enrich supplements with product data
  const enrichSupplements = async (supplements: any[], type: 'essential' | 'optional') => {
    if (!supplements || supplements.length === 0) return;

    setLoadingProducts(true);
    try {
      const response = await fetch('/api/supplements/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations: supplements }),
      });

      const data = await response.json();
      if (data.success) {
        if (type === 'essential') {
          setEnrichedEssentialSupplements(data.recommendations);
        } else {
          setEnrichedOptionalSupplements(data.recommendations);
        }
      }
    } catch (error) {
      console.error('Error enriching supplements:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCartCount = async () => {
    const userIdentifier = email || `guest-${planCode}`;
    if (!userIdentifier) return;

    try {
      const response = await fetch(`/api/cart?email=${encodeURIComponent(userIdentifier)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[Cart Badge] API Response:', data);
        setCartItemCount(data.cart?.itemCount || 0);
      }
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  };

  const handleAddToCart = async (productId: string, supplementName: string, recommendation: any) => {
    // Use email if logged in, otherwise use planCode as identifier for guest checkout
    const userIdentifier = email || `guest-${planCode}`;

    setAddingToCart(productId);
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userIdentifier,
          productId,
          quantity: 1,
          planCode,
          recommendationContext: {
            supplementName,
            dosage: recommendation.dosage,
            timing: recommendation.timing,
            rationale: recommendation.rationale,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Trigger cart refresh
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        console.error('Error adding to cart:', data.error);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setAddingToCart(null);
    }
  };

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

  // Show waiting message if plan is still being generated
  if (planStatus === 'queued' || planStatus === 'processing') {
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
          onClick={() => window.location.href = '/sage'}
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
          Return to Sage
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
        <button
          className="sidebar-icon-button"
          onClick={() => {
            window.open('https://www.instagram.com/', '_blank', 'width=600,height=600');
          }}
          title="Share on Instagram"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </button>
        <button
          className="sidebar-icon-button"
          onClick={() => setCartOpen(true)}
          title="View Cart"
          style={{ position: 'relative' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          {cartItemCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#4CAF50',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              border: '2px solid white'
            }}>
              {cartItemCount}
            </span>
          )}
        </button>
      </div>

      {/* Shopping Cart */}
      <ShoppingCart
        userEmail={email || `guest-${planCode}`}
        planCode={planCode || undefined}
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
      />

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

        {/* Personal Summary */}
        <div className="executive-summary-container">
          <h2 className="section-title">Personal Summary</h2>
          <div className="executive-summary">
            {typeof plan.executiveSummary === 'string' ? (
              plan.executiveSummary.split('\n').map((paragraph, idx) => (
                paragraph.trim() && <p key={idx}>{paragraph}</p>
              ))
            ) : plan.executiveSummary && typeof plan.executiveSummary === 'object' ? (
              <div>
                {plan.executiveSummary.mainMotivator && (
                  <p><strong>Main Goal:</strong> {plan.executiveSummary.mainMotivator}</p>
                )}
                {plan.executiveSummary.currentDiet && (
                  <p><strong>Current Diet:</strong> {plan.executiveSummary.currentDiet}</p>
                )}
                {plan.executiveSummary.sleepQuality && (
                  <p><strong>Sleep Quality:</strong> {plan.executiveSummary.sleepQuality}</p>
                )}
                {plan.executiveSummary.stressLevel && (
                  <p><strong>Stress Management:</strong> {plan.executiveSummary.stressLevel}</p>
                )}
                {plan.executiveSummary.activityLevel && (
                  <p><strong>Activity Level:</strong> {plan.executiveSummary.activityLevel}</p>
                )}
                {plan.executiveSummary.concerns && plan.executiveSummary.concerns.length > 0 && (
                  <div>
                    <p><strong>Key Focus Areas:</strong></p>
                    <ul>
                      {plan.executiveSummary.concerns.map((concern: string, idx: number) => (
                        <li key={idx}>{concern}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
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
                  {(() => {
                    // Priority biomarkers to always show if present (even if normal)
                    const priorityBiomarkers = [
                      'vitamin d', 'hba1c', 'glucose', 'ferritin', 'crp', 'c-reactive protein',
                      'ldl cholesterol', 'hdl cholesterol', 'total cholesterol', 'triglycerides',
                      'tsh', 'free thyroxine', 'ft4', 'iron', 'b12', 'vitamin b12', 'folate'
                    ];

                    // Sort biomarkers: abnormal first, then priority, then others
                    const sortedBiomarkers = [...bloodAnalysis.biomarkers].sort((a, b) => {
                      const statusPriority = (status: string) => {
                        const s = status.toLowerCase();
                        if (s === 'critical' || s === 'very high' || s === 'very low') return 0;
                        if (s === 'high' || s === 'low') return 1;
                        if (s === 'needs optimization' || s === 'borderline') return 2;
                        if (s === 'pending') return 5;
                        return 3; // Normal
                      };

                      const isPriority = (name: string) =>
                        priorityBiomarkers.some(p => name.toLowerCase().includes(p));

                      const priorityA = statusPriority(a.status);
                      const priorityB = statusPriority(b.status);

                      if (priorityA !== priorityB) return priorityA - priorityB;

                      // If same status priority, prioritize important biomarkers
                      const aIsPriority = isPriority(a.name);
                      const bIsPriority = isPriority(b.name);
                      if (aIsPriority && !bIsPriority) return -1;
                      if (!aIsPriority && bIsPriority) return 1;

                      return 0;
                    });

                    // Take top 8-10: all abnormal + important normals up to limit
                    const MAX_BIOMARKERS = 10;
                    const abnormalCount = sortedBiomarkers.filter(m =>
                      !['normal', 'pending'].includes(m.status.toLowerCase())
                    ).length;

                    // Show all abnormal, plus fill up to 10 with important normal ones
                    const limitedBiomarkers = sortedBiomarkers.slice(0, Math.max(abnormalCount, MAX_BIOMARKERS));

                    return limitedBiomarkers
                      .filter(m => m.status.toLowerCase() !== 'pending') // Hide pending
                      .map((marker, idx) => (
                      <tr key={idx}>
                        <td className="biomarker-name">{marker.name}</td>
                        <td className="biomarker-value">{marker.value}</td>
                        <td className="biomarker-range">{marker.referenceRange || 'N/A'}</td>
                        <td className={`biomarker-status status-${marker.status.toLowerCase().replace(/\s+/g, '-')}`}>{marker.status}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
        </section>
      )}

      {/* Nutrition Plan Overview */}
      {plan.nutritionOverview && (
        <section className="plan-section">
          <h2 className="section-title">Nutrition Plan Overview</h2>
          <div className="overview-grid">
            <div className="overview-column">
              <h3 className="overview-heading">Goals</h3>
              <ul className="goals-list">
                {plan.nutritionOverview.goals?.map((goal, idx) => (
                  <li key={idx}>{goal}</li>
                ))}
              </ul>
            </div>
            <div className="overview-column">
              <h3 className="overview-heading">Nutrition Structure</h3>
              <div className="nutrition-structure">
                <p><strong>Total Daily Calories:</strong> {plan.nutritionOverview.nutritionStructure?.calories}</p>
                <p><strong>Protein:</strong> {plan.nutritionOverview.nutritionStructure?.protein}</p>
                <p><strong>Carbs:</strong> {plan.nutritionOverview.nutritionStructure?.carbs}</p>
                <p><strong>Total Fiber:</strong> {plan.nutritionOverview.nutritionStructure?.fiber}</p>
                <p><strong>Fat:</strong> {plan.nutritionOverview.nutritionStructure?.fat}</p>
              </div>
            </div>
          </div>
        </section>
      )}

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
      {plan.dailyRecommendations && (
        <section className="plan-section">
          <h2 className="section-title">Daily Recommendations</h2>
          <div className="recommendations-grid">
            {plan.dailyRecommendations.morningRitual && (
            <div className="recommendation-card">
              <h3>{plan.dailyRecommendations.morningRitual.title || 'Morning Ritual'}</h3>
              <ul>
                {(Array.isArray(plan.dailyRecommendations.morningRitual)
                  ? plan.dailyRecommendations.morningRitual
                  : plan.dailyRecommendations.morningRitual.items || []
                ).map((item: any, idx: number) => (
                  <li key={idx}>
                    {typeof item === 'string' ? item : (
                      <div>
                        {item.time && <strong>{item.time}</strong>}{item.time ? ' - ' : ''}{item.action}
                        {item.description && <div style={{ fontSize: '0.9em', marginTop: '5px', color: '#b3b3b3' }}>{item.description}</div>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.dailyRecommendations.empowerGut && (
            <div className="recommendation-card">
              <h3>{plan.dailyRecommendations.empowerGut.title || 'Empower the Gut'}</h3>
              <ul>
                {(Array.isArray(plan.dailyRecommendations.empowerGut)
                  ? plan.dailyRecommendations.empowerGut
                  : plan.dailyRecommendations.empowerGut.items || []
                ).map((item: any, idx: number) => (
                  <li key={idx}>{typeof item === 'string' ? item : `${item.time ? item.time + ' - ' : ''}${item.action}`}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.dailyRecommendations.afternoonVitality && (
            <div className="recommendation-card">
              <h3>{plan.dailyRecommendations.afternoonVitality.title || 'Afternoon Vitality'}</h3>
              <ul>
                {(Array.isArray(plan.dailyRecommendations.afternoonVitality)
                  ? plan.dailyRecommendations.afternoonVitality
                  : plan.dailyRecommendations.afternoonVitality.items || []
                ).map((item: any, idx: number) => (
                  <li key={idx}>
                    {typeof item === 'string' ? item : (
                      <div>
                        {item.time && <strong>{item.time}</strong>}{item.time ? ' - ' : ''}{item.action}
                        {item.description && <div style={{ fontSize: '0.9em', marginTop: '5px', color: '#b3b3b3' }}>{item.description}</div>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.dailyRecommendations.energyOptimization && (
            <div className="recommendation-card">
              <h3>{plan.dailyRecommendations.energyOptimization.title || 'Energy Optimization'}</h3>
              <ul>
                {(Array.isArray(plan.dailyRecommendations.energyOptimization)
                  ? plan.dailyRecommendations.energyOptimization
                  : plan.dailyRecommendations.energyOptimization.items || []
                ).map((item: any, idx: number) => (
                  <li key={idx}>{typeof item === 'string' ? item : `${item.time ? item.time + ' - ' : ''}${item.action}`}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.dailyRecommendations.middayMastery && (
            <div className="recommendation-card">
              <h3>{plan.dailyRecommendations.middayMastery.title || 'Midday Mastery'}</h3>
              <ul>
                {(Array.isArray(plan.dailyRecommendations.middayMastery)
                  ? plan.dailyRecommendations.middayMastery
                  : plan.dailyRecommendations.middayMastery.items || []
                ).map((item: any, idx: number) => (
                  <li key={idx}>{typeof item === 'string' ? item : `${item.time ? item.time + ' - ' : ''}${item.action}`}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.dailyRecommendations.eveningNourishment && (
            <div className="recommendation-card">
              <h3>{plan.dailyRecommendations.eveningNourishment.title || 'Evening Nourishment'}</h3>
              <ul>
                {(Array.isArray(plan.dailyRecommendations.eveningNourishment)
                  ? plan.dailyRecommendations.eveningNourishment
                  : plan.dailyRecommendations.eveningNourishment.items || []
                ).map((item: any, idx: number) => (
                  <li key={idx}>{typeof item === 'string' ? item : `${item.time ? item.time + ' - ' : ''}${item.action}`}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.dailyRecommendations.eveningWellness && (
            <div className="recommendation-card">
              <h3>{plan.dailyRecommendations.eveningWellness.title || 'Evening Wellness'}</h3>
              <ul>
                {(Array.isArray(plan.dailyRecommendations.eveningWellness)
                  ? plan.dailyRecommendations.eveningWellness
                  : plan.dailyRecommendations.eveningWellness.items || []
                ).map((item: any, idx: number) => (
                  <li key={idx}>
                    {typeof item === 'string' ? item : (
                      <div>
                        {item.time && <strong>{item.time}</strong>}{item.time ? ' - ' : ''}{item.action}
                        {item.description && <div style={{ fontSize: '0.9em', marginTop: '5px', color: '#b3b3b3' }}>{item.description}</div>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.dailyRecommendations.nutritionGuidelines && (
            <div className="recommendation-card">
              <h3>{plan.dailyRecommendations.nutritionGuidelines.title || 'Nutrition Guidelines'}</h3>
              <ul>
                {(Array.isArray(plan.dailyRecommendations.nutritionGuidelines)
                  ? plan.dailyRecommendations.nutritionGuidelines
                  : plan.dailyRecommendations.nutritionGuidelines.items || []
                ).map((item: any, idx: number) => (
                  <li key={idx}>
                    {typeof item === 'string' ? item : (
                      <div>
                        <strong>{item.category || item.action}</strong>{(item.category || item.action) ? ': ' : ''}{item.guideline || item.description}
                        {item.reason && <div style={{ fontSize: '0.9em', marginTop: '5px', color: '#b3b3b3' }}><em>Why:</em> {item.reason}</div>}
                        {item.examples && <div style={{ fontSize: '0.9em', marginTop: '3px', color: '#a0a0a0' }}><em>Examples:</em> {item.examples}</div>}
                        {item.tip && <div style={{ fontSize: '0.9em', marginTop: '3px', color: '#000000' }}><em>Tip:</em> {item.tip}</div>}
                        {item.portion && <div style={{ fontSize: '0.9em', marginTop: '3px', color: '#a0a0a0' }}><em>Portion:</em> {item.portion}</div>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      )}

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
            {/* Personalized intro - use AI-generated or create fallback */}
            {(micronutrients.personalizedIntro || bloodAnalysis || plan) && (
              <p className="micronutrients-intro">
                {micronutrients.personalizedIntro ||
                  `Based on ${bloodAnalysis ? 'your blood biomarkers' : 'your profile'}${
                    bloodAnalysis && bloodAnalysis.concerns?.length > 0
                      ? ` showing ${bloodAnalysis.concerns.slice(0, 2).join(' and ')}`
                      : ''
                  }, your health goals, and your personalized nutrition plan, these micronutrients are specifically chosen to support your optimal health and performance.`
                }
              </p>
            )}

            {/* Display cholesterolFocus section if available */}
            {micronutrients.cholesterolFocus && (
              <div style={{ marginBottom: '30px' }}>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid #e5e5e5',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ color: '#000000', marginBottom: '10px', fontWeight: 'bold' }}>
                    Cholesterol Management
                  </h3>
                  {micronutrients.cholesterolFocus.keyNutrients?.map((nutrient: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: idx < micronutrients.cholesterolFocus.keyNutrients.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                      <h4 style={{ color: '#000000', marginBottom: '10px', fontWeight: '600' }}>
                        {nutrient.nutrient} - {nutrient.importance}
                      </h4>
                      {nutrient.dailyGoal && <p><strong>Daily Goal:</strong> {nutrient.dailyGoal}</p>}
                      {nutrient.sources && (
                        <p><strong>Sources:</strong> {Array.isArray(nutrient.sources) ? nutrient.sources.join(', ') : nutrient.sources}</p>
                      )}
                      {nutrient.preparationTip && (
                        <p style={{ color: '#000000' }}><strong>Tip:</strong> {nutrient.preparationTip}</p>
                      )}
                      {nutrient.storageNote && (
                        <p style={{ color: '#000000' }}><strong>Storage:</strong> {nutrient.storageNote}</p>
                      )}
                      {nutrient.tip && (
                        <p style={{ color: '#000000' }}><strong>Tip:</strong> {nutrient.tip}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Display supplementation info if available */}
            {micronutrients.supplementation && (
              <div style={{ marginBottom: '30px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px' }}>Supplementation Guidance</h3>
                <p style={{ marginBottom: '10px' }}><em>{micronutrients.supplementation.philosophy}</em></p>
                {micronutrients.supplementation.optionalSupport && (
                  <div style={{ marginTop: '15px', paddingLeft: '20px', borderLeft: '3px solid #e5e5e5' }}>
                    <h4 style={{ color: '#000000', marginBottom: '10px', fontWeight: '600' }}>
                      Optional: {micronutrients.supplementation.optionalSupport.name}
                    </h4>
                    <p><strong>Purpose:</strong> {micronutrients.supplementation.optionalSupport.purpose}</p>
                    <p><strong>Benefit:</strong> {micronutrients.supplementation.optionalSupport.benefit}</p>
                    {micronutrients.supplementation.optionalSupport.timing && (
                      <p><strong>Timing:</strong> {micronutrients.supplementation.optionalSupport.timing}</p>
                    )}
                    {micronutrients.supplementation.optionalSupport.when && (
                      <p><strong>When to use:</strong> {micronutrients.supplementation.optionalSupport.when}</p>
                    )}
                    {micronutrients.supplementation.optionalSupport.consultation && (
                      <p style={{ color: '#000000' }}><strong>Note:</strong> {micronutrients.supplementation.optionalSupport.consultation}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Standard micronutrients table */}
            {micronutrients.micronutrients && micronutrients.micronutrients.length > 0 && (
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
                    {micronutrients.micronutrients.map((nutrient: any, idx: number) => (
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
            )}
          </>
        )}

        {/* Fallback micronutrient table - handles both array and object formats */}
        {(() => {
          // Extract nutrients array from either format: array directly OR object with .nutrients
          const fallbackNutrients = plan.micronutrientFocus
            ? (Array.isArray(plan.micronutrientFocus)
                ? plan.micronutrientFocus
                : plan.micronutrientFocus.nutrients || [])
            : [];
          const fallbackIntro = !Array.isArray(plan.micronutrientFocus) && plan.micronutrientFocus?.personalizedIntro;

          if (loadingMicronutrients || (micronutrients && micronutrients.micronutrients && micronutrients.micronutrients.length > 0)) {
            return null;
          }
          if (fallbackNutrients.length === 0) {
            return null;
          }

          return (
            <>
              {/* Personalized intro for fallback micronutrients */}
              <p className="micronutrients-intro">
                {fallbackIntro || `Based on ${bloodAnalysis ? 'your blood biomarkers' : 'your profile'}${
                  bloodAnalysis && bloodAnalysis.concerns?.length > 0
                    ? ` showing ${bloodAnalysis.concerns.slice(0, 2).join(' and ')}`
                    : ''
                }, your ${typeof plan?.nutritionOverview?.goals?.[0] === 'string' ? plan.nutritionOverview.goals[0].toLowerCase() : 'health goals'}, and your ${
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
                      <th>Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                  {fallbackNutrients.map((nutrient: any, idx: number) => (
                    <tr key={idx}>
                      <td className="nutrient-name">{typeof nutrient.nutrient === 'string' ? nutrient.nutrient : JSON.stringify(nutrient.nutrient)}</td>
                      <td className="nutrient-goal">{typeof nutrient.dailyGoal === 'string' ? nutrient.dailyGoal : JSON.stringify(nutrient.dailyGoal)}</td>
                      <td className="nutrient-sources">{typeof nutrient.foodSources === 'string' ? nutrient.foodSources : JSON.stringify(nutrient.foodSources)}</td>
                      <td className="nutrient-purpose">{typeof nutrient.purpose === 'string' ? nutrient.purpose : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          );
        })()}

        {/* Fallback when no micronutrient data from either source */}
        {!loadingMicronutrients && (!micronutrients || !micronutrients.micronutrients || micronutrients.micronutrients.length === 0) && (
          !plan.micronutrientFocus ||
          (Array.isArray(plan.micronutrientFocus) && plan.micronutrientFocus.length === 0) ||
          (!Array.isArray(plan.micronutrientFocus) && (!plan.micronutrientFocus.nutrients || plan.micronutrientFocus.nutrients.length === 0))
        ) && (
          <p className="micronutrients-intro" style={{ color: '#666' }}>
            Micronutrient recommendations are being personalized for you. Please check back soon.
          </p>
        )}
      </section>

      {/* Supplement Recommendations */}
      {plan.supplementRecommendations && ((plan.supplementRecommendations.essentialSupplements?.length > 0 || plan.supplementRecommendations.essential?.length > 0) || (plan.supplementRecommendations.optionalSupplements?.length > 0 || plan.supplementRecommendations.optional?.length > 0)) && (
        <section className="plan-section">
          <h2 className="section-title">Supplement Recommendations</h2>

          {((plan.supplementRecommendations.essentialSupplements && plan.supplementRecommendations.essentialSupplements.length > 0) || (plan.supplementRecommendations.essential && plan.supplementRecommendations.essential.length > 0)) && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h3 className="overview-heading" style={{ marginBottom: 0 }}>Essential Supplements</h3>

                {/* Purchase as Bundle button */}
                {enrichedEssentialSupplements.length > 0 && enrichedEssentialSupplements.every((s: any) => s.product?.inStock) && (
                  <button
                    onClick={async () => {
                      // Add all supplements to cart
                      for (const supp of enrichedEssentialSupplements) {
                        if (supp.product?.productId) {
                          await handleAddToCart(supp.product.productId, supp.name, supp);
                        }
                      }
                      // Redirect to checkout after a short delay
                      const userIdentifier = email || `guest-${planCode}`;
                      setTimeout(() => {
                        window.location.href = `/checkout?email=${encodeURIComponent(userIdentifier)}${planCode ? `&planCode=${planCode}` : ''}`;
                      }, 800);
                    }}
                    style={{
                      padding: '14px 24px',
                      background: '#1a1a1a',
                      color: '#ffffff',
                      border: '1px solid #1a1a1a',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      fontFamily: '"Inter", Helvetica, sans-serif',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#000000';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#1a1a1a';
                    }}
                  >
                    Purchase as Bundle
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '30px' }}>
                {loadingProducts ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#000000' }}>
                    Loading products...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {enrichedEssentialSupplements.map((supp: any, idx: number) => (
                      <div key={idx} style={{
                        background: 'transparent',
                        borderBottom: idx < enrichedEssentialSupplements.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        paddingBottom: '32px'
                      }}>
                        <div style={{
                          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                          fontWeight: '600',
                          fontSize: '28px',
                          marginBottom: '16px',
                          color: '#000000',
                          letterSpacing: '-0.01em'
                        }}>
                          {supp.name || supp.supplement}
                        </div>

                        {/* Product Info */}
                        {supp.product && (
                          <div style={{
                            background: '#fafafa',
                            padding: '20px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            border: '1px solid #e5e5e5',
                            display: 'flex',
                            gap: '20px',
                            alignItems: 'flex-start'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontFamily: '"Inter", Helvetica, sans-serif',
                                fontSize: '18px',
                                fontWeight: '600',
                                marginBottom: '6px',
                                color: '#000000'
                              }}>
                                {supp.product.brand} {supp.product.name}
                              </div>
                              <div style={{
                                fontFamily: '"Inter", Helvetica, sans-serif',
                                fontSize: '13px',
                                color: '#000000',
                                marginBottom: '16px'
                              }}>
                                {supp.product.quantity} {supp.product.unit} • {supp.product.strength}
                              </div>
                              <div>
                                <div style={{
                                  fontFamily: '"SF Pro", sans-serif',
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  color: '#000000',
                                  letterSpacing: '-0.02em'
                                }}>
                                  ${supp.product.retailPrice.toFixed(2)}
                                </div>
                                <div style={{
                                  fontFamily: '"Inter", Helvetica, sans-serif',
                                  fontSize: '12px',
                                  color: '#000000',
                                  marginTop: '4px'
                                }}>
                                  ${supp.product.perDayPrice.toFixed(2)}/day
                                </div>
                              </div>
                            </div>

                            {/* Add to Cart and Buy Now Buttons - Stacked on right */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '140px' }}>
                              {supp.product.inStock && (
                                <>
                                <button
                                  onClick={() => {
                                    handleAddToCart(supp.product.productId, supp.name, supp);
                                    const userIdentifier = email || `guest-${planCode}`;
                                    setTimeout(() => {
                                      window.location.href = `/checkout?email=${encodeURIComponent(userIdentifier)}${planCode ? `&planCode=${planCode}` : ''}`;
                                    }, 500);
                                  }}
                                  disabled={addingToCart === supp.product.productId}
                                  style={{
                                    padding: '12px 16px',
                                    background: '#1a1a1a',
                                    color: '#ffffff',
                                    border: '1px solid #1a1a1a',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    fontFamily: '"Inter", Helvetica, sans-serif',
                                    cursor: addingToCart === supp.product.productId ? 'not-allowed' : 'pointer',
                                    opacity: addingToCart === supp.product.productId ? 0.6 : 1,
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (addingToCart !== supp.product.productId) {
                                      e.currentTarget.style.background = '#000000';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (addingToCart !== supp.product.productId) {
                                      e.currentTarget.style.background = '#1a1a1a';
                                    }
                                  }}
                                >
                                  Buy Now
                                </button>
                                <button
                                  onClick={() => handleAddToCart(supp.product.productId, supp.name, supp)}
                                  disabled={addingToCart === supp.product.productId}
                                  style={{
                                    padding: '12px 16px',
                                    background: '#f5f5f5',
                                    color: '#000000',
                                    border: '1px solid #e5e5e5',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '400',
                                    fontFamily: '"Inter", Helvetica, sans-serif',
                                    cursor: addingToCart === supp.product.productId ? 'not-allowed' : 'pointer',
                                    opacity: addingToCart === supp.product.productId ? 0.6 : 1,
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (addingToCart !== supp.product.productId) {
                                      e.currentTarget.style.background = '#eeeeee';
                                      e.currentTarget.style.borderColor = '#d0d0d0';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (addingToCart !== supp.product.productId) {
                                      e.currentTarget.style.background = '#f5f5f5';
                                      e.currentTarget.style.borderColor = '#e5e5e5';
                                    }
                                  }}
                                >
                                  {addingToCart === supp.product.productId ? 'Adding...' : 'Add to Cart'}
                                </button>
                                </>
                              )}

                              {/* Stock status below buttons */}
                              <div style={{ textAlign: 'center', marginTop: '4px' }}>
                                {supp.product.inStock ? (
                                  <div style={{
                                    fontFamily: '"Inter", Helvetica, sans-serif',
                                    fontSize: '11px',
                                    color: '#10b981',
                                    fontWeight: '400'
                                  }}>
                                    In Stock
                                  </div>
                                ) : (
                                  <div style={{
                                    fontFamily: '"Inter", Helvetica, sans-serif',
                                    fontSize: '11px',
                                    color: '#ef4444',
                                    fontWeight: '400'
                                  }}>
                                    Out of Stock
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Recommendation Details */}
                        <div style={{
                          fontFamily: '"Inter", Helvetica, sans-serif',
                          fontSize: '14px',
                          lineHeight: '1.7',
                          color: '#000000',
                          marginBottom: '8px',
                          letterSpacing: '0'
                        }}>
                          Dosage: {supp.dosage} • Timing: {supp.timing}
                        </div>
                        <div style={{
                          fontFamily: '"SF Pro", sans-serif',
                          fontSize: '15px',
                          lineHeight: '1.7',
                          color: '#000000',
                          marginBottom: '8px',
                          letterSpacing: '-0.01em'
                        }}>
                          {supp.rationale}
                        </div>
                        {supp.benefits && (
                          <div style={{
                            fontFamily: '"Inter", Helvetica, sans-serif',
                            fontSize: '13px',
                            color: '#000000',
                            marginTop: '12px',
                            lineHeight: '1.6'
                          }}>
                            {supp.benefits}
                          </div>
                        )}
                        {supp.duration && (
                          <div style={{
                            fontFamily: '"Inter", Helvetica, sans-serif',
                            fontSize: '12px',
                            color: '#000000',
                            marginTop: '8px'
                          }}>
                            Duration: {supp.duration}
                          </div>
                        )}

                        {/* No Match Warning */}
                        {supp.matchStatus === 'no_match' && (
                          <div style={{
                            marginTop: '16px',
                            padding: '12px 16px',
                            background: 'rgba(254, 243, 199, 0.08)',
                            borderRadius: '6px',
                            border: '1px solid rgba(254, 243, 199, 0.15)',
                            fontFamily: '"Inter", Helvetica, sans-serif',
                            fontSize: '13px',
                            color: '#fbbf24'
                          }}>
                            Product not available in our store yet
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {enrichedOptionalSupplements.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 className="overview-heading">Optional Supplements</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {enrichedOptionalSupplements.map((supp: any, idx: number) => (
                  <div key={idx} style={{
                    background: 'transparent',
                    borderBottom: idx < enrichedOptionalSupplements.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    paddingBottom: '32px'
                  }}>
                    <div style={{
                      fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                      fontWeight: '600',
                      fontSize: '28px',
                      marginBottom: '16px',
                      color: '#000000',
                      letterSpacing: '-0.01em'
                    }}>
                      {supp.name || supp.supplement}
                    </div>

                    {/* Product Info */}
                    {supp.product && (
                      <div style={{
                        background: '#fafafa',
                        padding: '20px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        border: '1px solid #e5e5e5',
                        display: 'flex',
                        gap: '20px',
                        alignItems: 'flex-start'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontFamily: '"Inter", Helvetica, sans-serif',
                            fontSize: '18px',
                            fontWeight: '600',
                            marginBottom: '6px',
                            color: '#000000'
                          }}>
                            {supp.product.brand} {supp.product.name}
                          </div>
                          <div style={{
                            fontFamily: '"Inter", Helvetica, sans-serif',
                            fontSize: '13px',
                            color: '#000000',
                            marginBottom: '16px'
                          }}>
                            {supp.product.quantity} {supp.product.unit} • {supp.product.strength}
                          </div>
                          <div>
                            <div style={{
                              fontFamily: '"SF Pro", sans-serif',
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#000000',
                              letterSpacing: '-0.02em'
                            }}>
                              ${supp.product.retailPrice.toFixed(2)}
                            </div>
                            <div style={{
                              fontFamily: '"Inter", Helvetica, sans-serif',
                              fontSize: '12px',
                              color: '#000000',
                              marginTop: '4px'
                            }}>
                              ${supp.product.perDayPrice.toFixed(2)}/day
                            </div>
                          </div>
                        </div>

                        {/* Add to Cart and Buy Now Buttons - Stacked on right */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '140px' }}>
                          {supp.product.inStock && (
                            <>
                            <button
                              onClick={() => {
                                handleAddToCart(supp.product.productId, supp.name, supp);
                                const userIdentifier = email || `guest-${planCode}`;
                                setTimeout(() => {
                                  window.location.href = `/checkout?email=${encodeURIComponent(userIdentifier)}${planCode ? `&planCode=${planCode}` : ''}`;
                                }, 500);
                              }}
                              disabled={addingToCart === supp.product.productId}
                              style={{
                                padding: '12px 16px',
                                background: '#1a1a1a',
                                color: '#ffffff',
                                border: '1px solid #1a1a1a',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                fontFamily: '"Inter", Helvetica, sans-serif',
                                cursor: addingToCart === supp.product.productId ? 'not-allowed' : 'pointer',
                                opacity: addingToCart === supp.product.productId ? 0.6 : 1,
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (addingToCart !== supp.product.productId) {
                                  e.currentTarget.style.background = '#000000';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (addingToCart !== supp.product.productId) {
                                  e.currentTarget.style.background = '#1a1a1a';
                                }
                              }}
                            >
                              Buy Now
                            </button>
                            <button
                              onClick={() => handleAddToCart(supp.product.productId, supp.name, supp)}
                              disabled={addingToCart === supp.product.productId}
                              style={{
                                padding: '12px 16px',
                                background: '#f5f5f5',
                                color: '#000000',
                                border: '1px solid #e5e5e5',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '400',
                                fontFamily: '"Inter", Helvetica, sans-serif',
                                cursor: addingToCart === supp.product.productId ? 'not-allowed' : 'pointer',
                                opacity: addingToCart === supp.product.productId ? 0.6 : 1,
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (addingToCart !== supp.product.productId) {
                                  e.currentTarget.style.background = '#eeeeee';
                                  e.currentTarget.style.borderColor = '#d0d0d0';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (addingToCart !== supp.product.productId) {
                                  e.currentTarget.style.background = '#f5f5f5';
                                  e.currentTarget.style.borderColor = '#e5e5e5';
                                }
                              }}
                            >
                              {addingToCart === supp.product.productId ? 'Adding...' : 'Add to Cart'}
                            </button>
                            </>
                          )}

                          {/* Stock status below buttons */}
                          <div style={{ textAlign: 'center', marginTop: '4px' }}>
                            {supp.product.inStock ? (
                              <div style={{
                                fontFamily: '"Inter", Helvetica, sans-serif',
                                fontSize: '11px',
                                color: '#10b981',
                                fontWeight: '400'
                              }}>
                                In Stock
                              </div>
                            ) : (
                              <div style={{
                                fontFamily: '"Inter", Helvetica, sans-serif',
                                fontSize: '11px',
                                color: '#ef4444',
                                fontWeight: '400'
                              }}>
                                Out of Stock
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recommendation Details */}
                    <div style={{
                      fontFamily: '"Inter", Helvetica, sans-serif',
                      fontSize: '14px',
                      lineHeight: '1.7',
                      color: '#000000',
                      marginBottom: '8px',
                      letterSpacing: '0'
                    }}>
                      Dosage: {supp.dosage} • Timing: {supp.timing}
                    </div>
                    <div style={{
                      fontFamily: '"SF Pro", sans-serif',
                      fontSize: '15px',
                      lineHeight: '1.7',
                      color: '#000000',
                      marginBottom: '8px',
                      letterSpacing: '-0.01em'
                    }}>
                      {supp.rationale}
                    </div>
                    {supp.benefits && (
                      <div style={{
                        fontFamily: '"Inter", Helvetica, sans-serif',
                        fontSize: '13px',
                        color: '#000000',
                        marginTop: '12px',
                        lineHeight: '1.6'
                      }}>
                        {supp.benefits}
                      </div>
                    )}
                    {supp.duration && (
                      <div style={{
                        fontFamily: '"Inter", Helvetica, sans-serif',
                        fontSize: '12px',
                        color: '#000000',
                        marginTop: '8px'
                      }}>
                        Duration: {supp.duration}
                      </div>
                    )}

                    {/* No Match Warning */}
                    {supp.matchStatus === 'no_match' && (
                      <div style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        background: 'rgba(254, 243, 199, 0.08)',
                        borderRadius: '6px',
                        border: '1px solid rgba(254, 243, 199, 0.15)',
                        fontFamily: '"Inter", Helvetica, sans-serif',
                        fontSize: '13px',
                        color: '#fbbf24'
                      }}>
                        Product not available in our store yet
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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

            {/* Personalized intro for meal plan */}
            {(detailedMealPlan || plan) && (
              <p className="meal-plan-intro">
                {detailedMealPlan?.personalizedIntro ||
                  `This 7-day meal plan is optimized for ${bloodAnalysis ? 'your biomarkers' : 'your goals'}${
                    bloodAnalysis && bloodAnalysis.concerns?.length > 0
                      ? `, specifically targeting ${bloodAnalysis.concerns[0]?.toLowerCase()}`
                      : ''
                  }. Each meal is designed to meet your daily nutrition targets${
                    plan?.nutritionOverview?.goals?.[0] && typeof plan.nutritionOverview.goals[0] === 'string'
                      ? ` and ${plan.nutritionOverview.goals[0].toLowerCase().replace(/^(improve|enhance|boost|increase|optimize)\s+/i, 'support ')}`
                      : ''
                  }, while respecting your ${plan?.lifestyleIntegration?.exerciseProtocol ? 'training schedule' : 'lifestyle preferences'} and eating window.`
                }
              </p>
            )}

            {loadingMealPlan && (
              <div className="meal-plan-loading">
                <div className="loading-spinner-small"></div>
                <p>Generating biomarker-optimized meal plan...</p>
              </div>
            )}
            {(() => {
              // Use detailedMealPlan only if it has day data, otherwise fall back to plan.sampleMealPlan
              const mealPlanData = (detailedMealPlan && Object.keys(detailedMealPlan).some(key => key.startsWith('day')))
                ? detailedMealPlan
                : plan?.sampleMealPlan;

              if (!mealPlanData) return null;

              return (
                <div className="meal-plan-grid">
                  {Object.keys(mealPlanData)
                    .filter(key => key !== 'profileSummary' && key !== 'importantNotes') // Skip metadata
                    .map((dayKey, dayIdx) => {
                    const day = mealPlanData[dayKey];
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
              );
            })()}
          </section>

          {/* Lifestyle Integration */}
          <section className="plan-section">
            <h2 className="section-title">Lifestyle Integration</h2>

            {/* Personalized intro for lifestyle */}
            {(lifestyleIntegration || plan) && (
              <p className="lifestyle-intro">
                {lifestyleIntegration?.personalizedIntro ||
                  `Your lifestyle plan is tailored to ${
                    plan?.nutritionOverview?.goals?.[0] && typeof plan.nutritionOverview.goals[0] === 'string'
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
                  } to stress management, ensuring sustainable habits that compound over time.`
                }
              </p>
            )}

            {loadingLifestyle && (
              <div className="lifestyle-loading">
                <div className="loading-spinner-small"></div>
                <p>Generating personalized lifestyle integration plan...</p>
              </div>
            )}

            {/* Use lifestyleIntegration state (from separate column) OR fall back to plan.lifestyleIntegration */}
            {(() => {
              // Check if lifestyleIntegration state has the expected structure (old format)
              // If not, fall back to plan.lifestyleIntegration which may have the correct structure
              const hasExpectedStructure = (data: any) => {
                return data && (data.sleepOptimization || data.exerciseProtocol || data.stressManagement || data.sleep || data.exercise);
              };

              // Prefer lifestyleIntegration state if it has expected structure, otherwise use plan.lifestyleIntegration
              const lifestyle = hasExpectedStructure(lifestyleIntegration)
                ? lifestyleIntegration
                : ((plan as any)?.lifestyleIntegration || lifestyleIntegration);

              if (!lifestyle) return null;

              return (
              <div className="lifestyle-clean">
                {/* Sleep Optimization / Sleep */}
                {(lifestyle.sleepOptimization || lifestyle.sleep) && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Sleep{lifestyle.sleepOptimization ? ' Optimization' : ''}</h3>

                    {/* New format - simple sleep info */}
                    {lifestyle.sleep && (
                      <>
                        {lifestyle.sleep.currentQuality && (
                          <div style={{
                            background: 'rgba(0, 0, 0, 0.02)',
                            border: '1px solid #e5e5e5',
                            padding: '15px',
                            borderRadius: '8px',
                            marginBottom: '20px'
                          }}>
                            <p><strong>Current Sleep Quality:</strong> {lifestyle.sleep.currentQuality}</p>
                            {lifestyle.sleep.recommendation && (
                              <p style={{ marginTop: '10px' }}><strong>Recommendation:</strong> {lifestyle.sleep.recommendation}</p>
                            )}
                          </div>
                        )}
                        {lifestyle.sleep.mealTimingForSleep && (
                          <div className="lifestyle-text">
                            <p><strong>Meal Timing:</strong> {lifestyle.sleep.mealTimingForSleep}</p>
                          </div>
                        )}
                        {lifestyle.sleep.tip && (
                          <div className="lifestyle-text">
                            <p style={{ color: '#000000' }}>{lifestyle.sleep.tip}</p>
                          </div>
                        )}
                        {lifestyle.sleep.protectYourSleep && (
                          <div className="lifestyle-text">
                            <p>{lifestyle.sleep.protectYourSleep}</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Old format - detailed sleep optimization */}
                    {lifestyle.sleepOptimization && (
                      <>
                        {lifestyle.sleepOptimization.personalizedIntro && (
                          <p className="lifestyle-subtitle">{lifestyle.sleepOptimization.personalizedIntro}</p>
                        )}

                        {lifestyle.sleepOptimization.optimalSleepWindow && (
                          <div className="lifestyle-text">
                            <p><strong>Optimal Sleep Window:</strong> {lifestyle.sleepOptimization.optimalSleepWindow}</p>
                          </div>
                        )}

                        {lifestyle.sleepOptimization.preBedRoutine && lifestyle.sleepOptimization.preBedRoutine.length > 0 && (
                          <div className="lifestyle-text">
                            <p><strong>Pre-Bed Routine:</strong></p>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyle.sleepOptimization.preBedRoutine.map((item: any, idx: number) => (
                              <p key={idx}>• {item}</p>
                            ))}
                          </div>
                        )}

                        {lifestyle.sleepOptimization.morningProtocol && lifestyle.sleepOptimization.morningProtocol.length > 0 && (
                          <div className="lifestyle-text">
                            <p><strong>Morning Protocol:</strong></p>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyle.sleepOptimization.morningProtocol.map((item: any, idx: number) => (
                              <p key={idx}>• {item}</p>
                            ))}
                          </div>
                        )}

                        {lifestyle.sleepOptimization.whyThisMatters && (
                          <div className="lifestyle-text">
                            <p><strong>Why This Matters:</strong> {lifestyle.sleepOptimization.whyThisMatters}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Exercise Protocol / Exercise */}
                {(lifestyle.exerciseProtocol || lifestyle.exercise) && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Exercise{lifestyle.exerciseProtocol ? ' Protocol' : ''}</h3>

                    {/* New format - exercise concerns and monitoring */}
                    {lifestyle.exercise && (
                      <>
                        {lifestyle.exercise.currentSituation && (
                          <div style={{
                            background: 'rgba(0, 0, 0, 0.02)',
                            border: '1px solid #e5e5e5',
                            padding: '15px',
                            borderRadius: '8px',
                            marginBottom: '20px'
                          }}>
                            {lifestyle.exercise.currentSituation.recentChange && (
                              <p><strong>Recent Change:</strong> {lifestyle.exercise.currentSituation.recentChange}</p>
                            )}
                            {lifestyle.exercise.currentSituation.concern && (
                              <p style={{ marginTop: '10px' }}><strong>Your Concern:</strong> {lifestyle.exercise.currentSituation.concern}</p>
                            )}
                          </div>
                        )}

                        {lifestyle.exercise.approach && (
                          <div className="lifestyle-text">
                            <p><strong>Our Approach:</strong> {lifestyle.exercise.approach}</p>
                          </div>
                        )}

                        {lifestyle.exercise.monitoring && (
                          <div className="lifestyle-text">
                            <p><strong>What We'll Monitor:</strong></p>
                            {lifestyle.exercise.monitoring.watchFor && lifestyle.exercise.monitoring.watchFor.length > 0 && (
                              <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
                                {lifestyle.exercise.monitoring.watchFor.map((item: string, idx: number) => (
                                  <li key={idx} style={{ marginBottom: '5px' }}>{item}</li>
                                ))}
                              </ul>
                            )}
                            {lifestyle.exercise.monitoring.action && (
                              <p style={{ marginTop: '10px', color: '#000000' }}><strong>Action:</strong> {lifestyle.exercise.monitoring.action}</p>
                            )}
                          </div>
                        )}

                        {lifestyle.exercise.reassurance && (
                          <div style={{
                            background: 'rgba(144, 217, 160, 0.1)',
                            padding: '15px',
                            borderRadius: '8px',
                            marginTop: '20px'
                          }}>
                            <p>{lifestyle.exercise.reassurance}</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Old format - detailed exercise protocol */}
                    {lifestyle.exerciseProtocol && (
                      <>
                        {lifestyle.exerciseProtocol.personalizedIntro && (
                          <p className="lifestyle-subtitle">{lifestyle.exerciseProtocol.personalizedIntro}</p>
                        )}

                        {lifestyle.exerciseProtocol.weeklyStructure && (
                          <div className="lifestyle-text">
                            <p><strong>Weekly Structure:</strong> {lifestyle.exerciseProtocol.weeklyStructure}</p>
                          </div>
                        )}

                        {lifestyle.exerciseProtocol.workoutSplit && lifestyle.exerciseProtocol.workoutSplit.length > 0 && (
                          <div className="lifestyle-text">
                            <p><strong>Workout Split:</strong></p>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {lifestyle.exerciseProtocol.workoutSplit.map((workout: any, idx: number) => (
                              <p key={idx}>
                                <strong>{workout.day}:</strong> {workout.focus}
                                {workout.duration && <> • {workout.duration}</>}
                              </p>
                            ))}
                          </div>
                        )}

                        {lifestyle.exerciseProtocol.whyThisMatters && (
                          <div className="lifestyle-text">
                            <p><strong>Why This Matters:</strong> {lifestyle.exerciseProtocol.whyThisMatters}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Stress Management */}
                {lifestyle.stressManagement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Stress Management</h3>

                    {/* Current Level */}
                    {lifestyle.stressManagement.currentLevel && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid #e5e5e5',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        <p><strong>Current Status:</strong> {lifestyle.stressManagement.currentLevel}</p>
                        {lifestyle.stressManagement.acknowledgment && (
                          <p style={{ marginTop: '10px' }}>{lifestyle.stressManagement.acknowledgment}</p>
                        )}
                      </div>
                    )}

                    {lifestyle.stressManagement.personalizedIntro && (
                      <p className="lifestyle-subtitle">{lifestyle.stressManagement.personalizedIntro}</p>
                    )}

                    {/* Primary Interventions */}
                    {lifestyle.stressManagement.primaryInterventions && lifestyle.stressManagement.primaryInterventions.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Key Strategies:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyle.stressManagement.primaryInterventions.map((intervention: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '15px', paddingLeft: '15px', borderLeft: '3px solid #e5e5e5' }}>
                            <p><strong>{intervention.intervention}</strong></p>
                            <p style={{ fontSize: '0.95em', color: '#666666' }}>{intervention.description}</p>
                            {intervention.frequency && (
                              <p style={{ fontSize: '0.9em', color: '#000000' }}>Frequency: {intervention.frequency}</p>
                            )}
                            {intervention.benefit && (
                              <p style={{ fontSize: '0.9em', color: '#666666' }}>Benefit: {intervention.benefit}</p>
                            )}
                            {intervention.deskBoundAlternatives && intervention.deskBoundAlternatives.length > 0 && (
                              <div style={{ marginTop: '10px' }}>
                                <p style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Desk-Bound Alternatives:</p>
                                <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                                  {intervention.deskBoundAlternatives.map((alt: string, altIdx: number) => (
                                    <li key={altIdx} style={{ fontSize: '0.85em', color: '#666666' }}>{alt}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {intervention.importantNote && (
                              <p style={{ fontSize: '0.9em', color: '#000000', marginTop: '10px' }}>
                                {intervention.importantNote}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Daily Practices (legacy format) */}
                    {lifestyle.stressManagement.dailyPractices && lifestyle.stressManagement.dailyPractices.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Daily Practices:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyle.stressManagement.dailyPractices.map((practice: any, idx: number) => (
                          <p key={idx}>
                            <strong>{practice.practice}</strong>
                            {practice.timing && <> • {practice.timing}</>}
                            {practice.duration && <> • {practice.duration}</>}
                            {practice.benefit && <><br />{practice.benefit}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Expected Outcome */}
                    {lifestyle.stressManagement.expectedOutcome && (
                      <div style={{
                        background: 'rgba(144, 217, 160, 0.1)',
                        padding: '15px',
                        borderRadius: '8px',
                        marginTop: '20px'
                      }}>
                        <p><strong>Expected Progress:</strong> {lifestyle.stressManagement.expectedOutcome}</p>
                      </div>
                    )}

                    {lifestyle.stressManagement.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {lifestyle.stressManagement.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Cholesterol Management - New Section */}
                {lifestyle.cholesterolManagement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Cholesterol Management</h3>

                    {lifestyle.cholesterolManagement.primaryGoal && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid #e5e5e5',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        <p><strong>Primary Goal:</strong> {lifestyle.cholesterolManagement.primaryGoal}</p>
                      </div>
                    )}

                    {lifestyle.cholesterolManagement.keyStrategies && lifestyle.cholesterolManagement.keyStrategies.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Key Strategies:</strong></p>
                        <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
                          {lifestyle.cholesterolManagement.keyStrategies.map((strategy: string, idx: number) => (
                            <li key={idx} style={{ marginBottom: '8px' }}>{strategy}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lifestyle.cholesterolManagement.timeline && (
                      <div style={{
                        background: 'rgba(144, 217, 160, 0.1)',
                        padding: '15px',
                        borderRadius: '8px',
                        marginTop: '20px'
                      }}>
                        <p><strong>Expected Timeline:</strong> {lifestyle.cholesterolManagement.timeline}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Skin Improvement */}
                {lifestyle.skinImprovement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Skin Improvement</h3>
                    {lifestyle.skinImprovement.personalizedIntro && (
                      <p className="lifestyle-subtitle">{lifestyle.skinImprovement.personalizedIntro}</p>
                    )}

                    {lifestyle.skinImprovement.morningRoutine && lifestyle.skinImprovement.morningRoutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Morning Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyle.skinImprovement.morningRoutine.map((step: any, idx: number) => (
                          <p key={idx}>
                            {idx + 1}. <strong>{step.product}</strong>
                            {step.purpose && <> - {step.purpose}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {lifestyle.skinImprovement.eveningRoutine && lifestyle.skinImprovement.eveningRoutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Evening Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {lifestyle.skinImprovement.eveningRoutine.map((step: any, idx: number) => (
                          <p key={idx}>
                            {idx + 1}. <strong>{step.product}</strong>
                            {step.purpose && <> - {step.purpose}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {lifestyle.skinImprovement.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {lifestyle.skinImprovement.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })()}
          </section>

          {/* Preventive & Adaptive Features */}
          {plan.preventiveFeatures && (
            <section className="plan-section">
              <h2 className="section-title">Preventive & Adaptive Features</h2>
              <ul className="features-list">
                {plan.preventiveFeatures.map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
            </section>
          )}
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
