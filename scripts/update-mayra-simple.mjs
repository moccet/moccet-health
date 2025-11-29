/**
 * Direct Supabase update script for Mayra's plan
 * Run with: node scripts/update-mayra-simple.mjs
 */

import { createClient } from '@supabase/supabase-js';

const PLAN_CODE = '5U2JQA6N';

// Supabase credentials
const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

async function updateMayraPlanDirect() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Fetching current plan data for code:', PLAN_CODE);

  // Fetch current data
  const { data: currentData, error: fetchError } = await supabase
    .from('sage_onboarding_data')
    .select('*')
    .eq('form_data->>uniqueCode', PLAN_CODE)
    .single();

  if (fetchError || !currentData) {
    throw new Error(`Failed to fetch plan: ${fetchError?.message || 'Not found'}`);
  }

  console.log('✅ Current plan fetched');
  console.log('📧 Email:', currentData.email);

  // Prepare updated sage_plan
  const updatedSagePlan = {
    ...(currentData.sage_plan || {}),
    executiveSummary: {
      ...(currentData.sage_plan?.executiveSummary || {}),
      mainMotivator: 'High Cholesterol Management',
      stressLevel: 'High - will be addressed through accountability, exercise routine, and post-meal walks',
      activityLevel: 'Recently decreased - major contributor to weight gain',
      sleepQuality: 'Excellent',
      currentDiet: 'Healthy at home, avoids sugar',
      concerns: [
        'High cholesterol (primary motivator)',
        'Increased training load vs calorie intake',
        'Sweet cravings management',
        'Desk-bound schedule limiting post-meal movement',
        'High stress levels'
      ]
    },
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
    mealTimingNote: 'Meal times are flexible and can be adjusted to your schedule. The key principle is to avoid eating within 2-3 hours of bedtime. Listen to your body and adjust timing as needed while maintaining proper spacing between meals.'
  };

  // Prepare updated meal_plan
  const updatedMealPlan = {
    ...(currentData.meal_plan || {}),
    importantNotes: {
      lunchClarification: 'Your lunch has been carefully calculated to provide adequate calories, protein, and fiber for satiety. While it may appear lighter than a traditional lunch, it is designed to be a complete meal that keeps you full and energized throughout the afternoon. If you find yourself hungry, we will work together to adjust portions.',
      timingFlexibility: 'All meal times are suggestions. The most important rule is to finish eating 2-3 hours before bedtime. Adjust the schedule to fit your lifestyle while maintaining the 2-3 hour pre-sleep buffer.',
      cravingsManagement: {
        strategy: 'The increased protein and fiber in this plan should significantly reduce sweet cravings',
        emergencyOption: '85% dark chocolate dipped almonds (keep in fridge)',
        benefits: 'Magnesium-rich, satisfying crunch, portion-controlled',
        portionSize: 'Small handful (10-12 almonds)',
        whenToUse: 'If cravings persist after following the plan for a week'
      }
    }
  };

  // Prepare updated micronutrients
  const updatedMicronutrients = {
    ...(currentData.micronutrients || {}),
    supplementation: {
      philosophy: 'This plan is designed to be nutrient-rich, providing what you need from whole foods',
      optionalSupport: {
        name: 'Perfect Aminos or similar amino acid supplement',
        purpose: 'Increases protein intake without increasing calories',
        benefit: 'Supports muscle maintenance during increased training load while managing caloric intake',
        timing: 'Can be taken pre or post-workout',
        when: 'If you feel the need for additional protein support during higher training intensity',
        consultation: 'Discuss with your coach before starting'
      }
    },
    cholesterolFocus: {
      priority: 'HIGH',
      keyNutrients: [
        {
          nutrient: 'Omega-3 Fatty Acids',
          importance: 'CRITICAL for cholesterol management',
          sources: [
            'Oily fish (salmon, mackerel, sardines, herring)',
            'Flax seeds (keep refrigerated in sealed container)',
            'Walnuts',
            'Chia seeds'
          ],
          dailyGoal: '2-3 servings of omega-3 rich foods',
          preparationTip: 'Smash oily fish with avocado to make a spread - easier to incorporate and more palatable. This makes it much easier to consume regularly.',
          storageNote: 'Keep flax seeds sealed and refrigerated to prevent oxidation'
        },
        {
          nutrient: 'Soluble Fiber',
          importance: 'HIGH for cholesterol reduction',
          sources: ['Oats', 'Beans', 'Lentils', 'Apples', 'Quinoa'],
          dailyGoal: '25-30g total fiber',
          tip: 'Batch cook quinoa on weekends - high in protein and very satiating'
        }
      ]
    }
  };

  // Prepare updated lifestyle_integration
  const updatedLifestyleIntegration = {
    ...(currentData.lifestyle_integration || {}),
    stressManagement: {
      currentLevel: 'High (reported as terrible)',
      acknowledgment: 'Stress is a significant factor affecting both cholesterol and weight. This program addresses it through multiple pathways.',
      primaryInterventions: [
        {
          intervention: 'Accountability System',
          description: 'Regular check-ins and progress tracking to provide structure and support',
          frequency: 'Weekly',
          benefit: 'Reduces decision fatigue and provides external support structure'
        },
        {
          intervention: 'Exercise Routine',
          description: 'Structured training program that will help manage stress through endorphin release and sense of achievement',
          frequency: 'As per training plan',
          benefit: 'Natural stress hormone regulation and mood enhancement'
        },
        {
          intervention: 'Post-Meal Walks',
          description: 'Even brief movement helps reduce stress hormones and aids digestion. The key is consistency, not duration.',
          frequency: 'After lunch and dinner (even 2-5 minutes counts)',
          deskBoundAlternatives: [
            'Lap around the office after eating',
            'Step outside for a few deep breaths (even 2 minutes)',
            'Stand and stretch at your desk',
            'Walk to get water or visit a colleague on another floor',
            'Quick stair climb',
            'ANY movement is better than none - do not let perfect be the enemy of good'
          ],
          importantNote: 'You mentioned being chained to your desk all day. Even the smallest movement counts. A single lap around the office or stepping outside for a few breaths will be beneficial. Start with what you can do, and build from there.'
        }
      ],
      expectedOutcome: 'Combination of accountability, exercise, and mindful movement should significantly improve stress levels over 4-6 weeks. Stress reduction will also support cholesterol management and weight goals.'
    },
    sleep: {
      currentQuality: 'Excellent - this is a major asset',
      recommendation: 'No changes needed',
      mealTimingForSleep: 'Finish eating 2-3 hours before bedtime to optimize sleep quality and digestion. This is more important than specific meal times.',
      protectYourSleep: 'Your excellent sleep is supporting your health goals. Protect it by maintaining consistent bedtime routines and the pre-sleep eating window.'
    },
    exercise: {
      currentSituation: {
        recentChange: 'Major decrease in activity levels - attributed to weight gain',
        concern: 'Worried about calorie intake being too low for increased training load'
      },
      approach: 'We will monitor closely and make adjustments as needed to support your body. This program is designed to rebuild consistent movement habits.',
      monitoring: {
        watchFor: [
          'Signs of low energy throughout the day',
          'Excessive hunger that persists',
          'Difficulty recovering from workouts',
          'Decreased performance in training',
          'Persistent fatigue'
        ],
        action: 'Report any of these signs immediately. We can adjust your plan to support your training.'
      },
      reassurance: 'The plan is designed to support your training while managing cholesterol and weight. We will work together to ensure everything is done to support your body. Your concerns are valid and we will adjust as needed.'
    },
    cholesterolManagement: {
      primaryGoal: 'Reduce cholesterol through diet and lifestyle',
      keyStrategies: [
        'Increase omega-3 fatty acids (oily fish, flax seeds)',
        'Boost soluble fiber intake',
        'Regular post-meal movement',
        'Stress reduction through exercise and accountability',
        'Avoid sugar (already doing well)',
        'Maintain healthy eating patterns at home'
      ],
      timeline: 'Expect to see improvements in cholesterol markers within 8-12 weeks with consistent adherence'
    }
  };

  // Perform the update
  console.log('📝 Updating plan data in Supabase...');

  const { error: updateError } = await supabase
    .from('sage_onboarding_data')
    .update({
      sage_plan: updatedSagePlan,
      meal_plan: updatedMealPlan,
      micronutrients: updatedMicronutrients,
      lifestyle_integration: updatedLifestyleIntegration,
      updated_at: new Date().toISOString()
    })
    .eq('form_data->>uniqueCode', PLAN_CODE);

  if (updateError) {
    throw new Error(`Failed to update plan: ${updateError.message}`);
  }

  console.log('✅ Plan updated successfully!');
  console.log('\n📋 Summary of updates:');
  console.log('  ✓ Executive summary updated with main motivator (high cholesterol)');
  console.log('  ✓ Warm water recommendation added to morning ritual');
  console.log('  ✓ Meal timing flexibility notes added (2-3 hours before bed priority)');
  console.log('  ✓ Lunch clarification added (calculated meal, not a snack)');
  console.log('  ✓ Post-meal walk alternatives for desk-bound schedule');
  console.log('  ✓ Flax seed storage instructions (sealed, refrigerated)');
  console.log('  ✓ Oily fish incorporation tips (smash with avocado)');
  console.log('  ✓ Quinoa batch cooking suggestion');
  console.log('  ✓ Sweet cravings management (85% dark chocolate almonds)');
  console.log('  ✓ Amino acid supplement option (Perfect Aminos)');
  console.log('  ✓ Enhanced stress management strategies');
  console.log('  ✓ Training load concerns addressed');
  console.log('  ✓ Cholesterol management focus throughout');
  console.log('\n🔗 View updated plan at:');
  console.log(`  https://www.moccet.ai/sage/personalised-plan?code=${PLAN_CODE}`);
}

// Run the update
updateMayraPlanDirect()
  .then(() => {
    console.log('\n✨ Update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
