/**
 * Script to update Mayra's meal plan based on consultation feedback
 * Code: 5U2JQA6N
 *
 * Key Updates:
 * 1. Meal timing flexibility (2-3 hours before bed is main priority)
 * 2. Increased lunch portions for satiety
 * 3. Sweet cravings management (85% dark chocolate dipped almonds)
 * 4. Warm water recommendation for first drink
 * 5. Flax seed storage instructions
 * 6. Post-meal walk alternatives for desk-bound schedule
 * 7. Amino acid supplement recommendation (Perfect Aminos)
 * 8. High cholesterol management focus
 * 9. Stress management through accountability and exercise
 * 10. Oily fish incorporation strategies
 */

interface MealPlanUpdate {
  code: string;
  updates: {
    mealPlan?: Record<string, unknown>;
    micronutrients?: Record<string, unknown>;
    lifestyleIntegration?: Record<string, unknown>;
    sagePlan?: Record<string, unknown>;
  };
}

async function updateMayraPlan() {
  const PLAN_CODE = '5U2JQA6N';
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Fetch current plan data
  console.log('Fetching current plan data...');
  const getPlanResponse = await fetch(`${BASE_URL}/api/get-plan?code=${PLAN_CODE}`);

  if (!getPlanResponse.ok) {
    throw new Error(`Failed to fetch plan: ${getPlanResponse.statusText}`);
  }

  const currentPlanData = await getPlanResponse.json();
  console.log('Current plan fetched successfully');

  // Prepare updates based on consultation feedback
  const updates: MealPlanUpdate = {
    code: PLAN_CODE,
    updates: {
      sagePlan: {
        ...currentPlanData.plan,
        // Add executive summary update highlighting cholesterol management
        executiveSummary: {
          ...currentPlanData.plan?.executiveSummary,
          mainMotivator: 'High Cholesterol Management',
          stressLevel: 'High - will be addressed through accountability, exercise routine, and post-meal walks',
          activityLevel: 'Recently decreased - major contributor to weight gain',
          sleepQuality: 'Excellent',
          currentDiet: 'Healthy at home, avoids sugar'
        },
        // Update daily recommendations
        dailyRecommendations: {
          morningRitual: {
            title: 'Morning Ritual',
            items: [
              {
                time: '6:00 AM - 7:00 AM',
                action: 'Warm Water (not cold)',
                description: 'Start with warm water to gently wake up the body and digestive system rather than shocking it with cold water. This helps activate your metabolism and prepares your gut for the day.',
                icon: '💧'
              },
              {
                time: '7:00 AM - 8:00 AM',
                action: 'Balanced Breakfast',
                description: 'High protein, healthy fats, and fiber to stabilize blood sugar and reduce cravings throughout the day. This supports cholesterol management and provides sustained energy.',
                icon: '🍳'
              }
            ]
          },
          afternoonVitality: {
            title: 'Afternoon Vitality',
            items: [
              {
                time: '12:00 PM - 1:00 PM',
                action: 'Satisfying Lunch',
                description: 'Properly portioned meal with adequate protein and fiber for satiety. Note: This is a calculated meal, not a snack - designed to keep you full and energized.',
                icon: '🥗'
              },
              {
                time: '1:00 PM - 1:15 PM',
                action: 'Post-Meal Movement',
                description: 'IMPORTANT for stress management: Even a lap around the office or stepping outside for a few breaths helps. If you cannot take a full walk, any movement counts - stand up, stretch, walk to the water cooler. This brief activity aids digestion and reduces stress hormones.',
                icon: '🚶‍♀️'
              }
            ]
          },
          eveningWellness: {
            title: 'Evening Wellness',
            items: [
              {
                time: 'Flexible timing',
                action: 'Dinner',
                description: 'Main priority: Finish eating 2-3 hours before bedtime. The exact timing can be adjusted to your schedule - focus on this buffer rather than a specific clock time.',
                icon: '🍽️'
              },
              {
                time: 'Post-dinner',
                action: 'Gentle Walk',
                description: 'Helps with digestion, cholesterol management, and stress reduction. This is your accountability moment.',
                icon: '🌙'
              }
            ]
          },
          nutritionGuidelines: {
            title: 'Key Nutrition Guidelines',
            items: [
              {
                category: 'Flax Seeds',
                guideline: 'Store in a sealed container in the fridge',
                reason: 'Prevents oxidation and maintains omega-3 fatty acid integrity, crucial for cholesterol management'
              },
              {
                category: 'Oily Fish',
                guideline: 'Incorporate 2-3 times per week',
                reason: 'Essential for cholesterol management. Try smashing with avocado to make a palatable spread - this makes it easier to include in your diet regularly.',
                examples: 'Salmon, mackerel, sardines, or herring'
              },
              {
                category: 'Quinoa',
                guideline: 'Batch cook and prep',
                reason: 'High in protein and very satiating. Great grain alternative that supports your goals.',
                tip: 'Cook a large batch on Sunday for easy meal prep throughout the week'
              },
              {
                category: 'Sweet Cravings',
                guideline: '85% dark chocolate dipped almonds',
                reason: 'The increased protein and fiber in this plan should reduce cravings significantly. When they do occur, this option is magnesium-rich and satisfying. Keep in fridge for a quick crunch snack.',
                portion: 'Small handful (about 10-12 almonds)'
              }
            ]
          }
        },
        // Add meal timing flexibility note
        mealTimingNote: 'Meal times are flexible and can be adjusted to your schedule. The key principle is to avoid eating within 2-3 hours of bedtime. Listen to your body and adjust timing as needed while maintaining proper spacing between meals.'
      },
      mealPlan: {
        ...currentPlanData.mealPlan,
        // Add note about lunch portions
        lunchNote: 'Your lunch has been carefully calculated to provide adequate calories, protein, and fiber for satiety. While it may appear lighter than a traditional lunch, it is designed to be a complete meal that keeps you full and energized throughout the afternoon. If you find yourself hungry, we can adjust portions together.',
        // Add timing flexibility note
        timingNote: 'All meal times are suggestions. The most important rule is to finish eating 2-3 hours before bedtime. Adjust the schedule to fit your lifestyle while maintaining the 2-3 hour pre-sleep buffer.',
        // Add sweet cravings management
        cravingsManagement: {
          strategy: 'The increased protein and fiber in this plan should significantly reduce sweet cravings',
          emergencyOption: '85% dark chocolate dipped almonds (keep in fridge)',
          benefits: 'Magnesium-rich, satisfying crunch, portion-controlled',
          portionSize: 'Small handful (10-12 almonds)'
        }
      },
      micronutrients: {
        ...currentPlanData.micronutrients,
        // Add amino acid supplement recommendation
        supplementation: {
          note: 'This plan is designed to be nutrient-rich, providing what you need from whole foods',
          optionalSupport: {
            name: 'Perfect Aminos or similar amino acid supplement',
            purpose: 'Increases protein intake without increasing calories',
            benefit: 'Supports muscle maintenance during increased training load while managing caloric intake',
            timing: 'Can be taken pre or post-workout',
            consultation: 'Discuss with your coach if you feel the need for additional protein support'
          }
        },
        // Enhance omega-3 focus for cholesterol
        keyFocus: [
          ...(currentPlanData.micronutrients?.keyFocus || []),
          {
            nutrient: 'Omega-3 Fatty Acids',
            importance: 'CRITICAL for cholesterol management',
            sources: 'Oily fish (salmon, mackerel, sardines), flax seeds (refrigerated), walnuts',
            dailyGoal: '2-3 servings of omega-3 rich foods',
            tip: 'Smash oily fish with avocado to make a spread - easier to incorporate and more palatable'
          }
        ]
      },
      lifestyleIntegration: {
        ...currentPlanData.lifestyleIntegration,
        // Enhance stress management section
        stressManagement: {
          currentLevel: 'High (reported as terrible)',
          primaryInterventions: [
            {
              intervention: 'Accountability System',
              description: 'Regular check-ins and progress tracking to provide structure and support',
              frequency: 'Weekly'
            },
            {
              intervention: 'Exercise Routine',
              description: 'Structured training program that will help manage stress through endorphin release and achievement',
              frequency: 'As per training plan'
            },
            {
              intervention: 'Post-Meal Walks',
              description: 'Even brief movement helps reduce stress hormones. For desk-bound days: lap around office, step outside for fresh air, or 2-minute stretch at your desk.',
              frequency: 'After lunch and dinner (even 2-5 minutes counts)',
              deskBoundAlternatives: [
                'Lap around the office after eating',
                'Step outside for a few deep breaths',
                'Stand and stretch at your desk',
                'Walk to get water or visit a colleague',
                'Any movement is better than none'
              ]
            }
          ],
          expectedOutcome: 'Combination of accountability, exercise, and mindful movement should significantly improve stress levels over the coming weeks'
        },
        // Update sleep section
        sleep: {
          currentQuality: 'Excellent - no changes needed',
          mealTimingForSleep: 'Finish eating 2-3 hours before bedtime to optimize sleep quality and digestion',
          tip: 'Your excellent sleep is a major asset - protect it by maintaining this eating window'
        },
        // Update exercise section
        exercise: {
          currentConcern: 'Worried about calorie intake being too low for increased training load',
          approach: 'We will monitor closely and adjust as needed to support your body',
          communication: 'Report any signs of low energy, excessive hunger, or difficulty recovering from workouts',
          adjustment: 'Plan is designed to support your training while managing cholesterol and weight. We can modify if needed.',
          recentChange: 'Major decrease in activity levels attributed to weight gain - this program will help rebuild consistent movement habits'
        }
      }
    }
  };

  // Send update request
  console.log('Sending update request...');
  const updateResponse = await fetch(`${BASE_URL}/api/update-meal-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!updateResponse.ok) {
    const errorData = await updateResponse.json();
    throw new Error(`Failed to update plan: ${errorData.error || updateResponse.statusText}`);
  }

  const result = await updateResponse.json();
  console.log('Plan updated successfully:', result);

  return result;
}

// Run the update
if (require.main === module) {
  updateMayraPlan()
    .then(() => {
      console.log('✅ Mayra\'s plan has been updated successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error updating plan:', error);
      process.exit(1);
    });
}

export { updateMayraPlan };
