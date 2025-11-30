/**
 * Fix the light lunch meals in the Sage plan to be proper meals
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const planCode = '5U2JQA6N';

const properLunches = {
  day1: {
    time: "1:30 pm",
    name: "Mediterranean Grilled Chicken Bowl",
    description: "Grilled chicken breast with quinoa, roasted vegetables, and tahini dressing",
    macros: "580 kcal | 42g protein | 56g carbs | 10g fiber",
    ingredients: [
      "150g grilled chicken breast",
      "80g cooked quinoa",
      "1 cup roasted vegetables (bell peppers, zucchini, eggplant)",
      "2 tbsp tahini dressing",
      "Fresh parsley and lemon",
      "Pinch of za'atar"
    ],
    cookingInstructions: [
      "Season chicken breast with olive oil, lemon, salt and pepper. Grill or pan-fry for 6-7 minutes per side until cooked through.",
      "Cook quinoa according to package instructions.",
      "Roast vegetables at 200°C (400°F) for 20-25 minutes until tender.",
      "Make tahini dressing by mixing 2 tbsp tahini, lemon juice, water, and a pinch of salt.",
      "Assemble bowl with quinoa, vegetables, sliced chicken, and drizzle with tahini. Garnish with parsley and za'atar."
    ]
  },
  day2: {
    time: "1:45 pm",
    name: "Tuna Nicoise Salad with White Beans",
    description: "Protein-rich salad with tuna, beans, eggs, and vegetables",
    macros: "560 kcal | 44g protein | 48g carbs | 12g fiber",
    ingredients: [
      "150g canned tuna in water, drained",
      "100g white beans (cannellini), drained and rinsed",
      "2 hard-boiled eggs",
      "Mixed greens (2 cups)",
      "Cherry tomatoes (100g)",
      "Green beans (100g, blanched)",
      "1 tbsp olive oil",
      "1 tbsp lemon juice",
      "Dijon mustard (1 tsp)"
    ],
    cookingInstructions: [
      "Boil eggs for 8-9 minutes, then cool in ice water and peel.",
      "Blanch green beans in boiling water for 3-4 minutes, then shock in ice water.",
      "Arrange mixed greens on a plate, top with tuna, white beans, halved eggs, tomatoes, and green beans.",
      "Whisk together olive oil, lemon juice, Dijon mustard, salt and pepper.",
      "Drizzle dressing over salad and serve."
    ]
  },
  day4: {
    time: "1:30 pm",
    name: "Turkey and Avocado Whole Grain Wrap",
    description: "Whole grain wrap filled with lean turkey, avocado, and crisp vegetables",
    macros: "540 kcal | 38g protein | 52g carbs | 12g fiber",
    ingredients: [
      "1 large whole grain tortilla",
      "120g sliced turkey breast",
      "1/2 avocado, sliced",
      "Lettuce, tomato, cucumber",
      "1 tbsp hummus",
      "1 tbsp Greek yogurt",
      "Dijon mustard"
    ],
    cookingInstructions: [
      "Lay out the whole grain tortilla and spread hummus and Greek yogurt across the center.",
      "Layer turkey slices, avocado, lettuce, tomato, and cucumber.",
      "Add a small amount of Dijon mustard for flavor.",
      "Fold in the sides and roll tightly.",
      "Cut in half and serve with a side of carrot sticks or cucumber if desired."
    ]
  },
  day5: {
    time: "1:45 pm",
    name: "Salmon and Sweet Potato Buddha Bowl",
    description: "Pan-seared salmon with roasted sweet potato and leafy greens",
    macros: "620 kcal | 40g protein | 58g carbs | 11g fiber",
    ingredients: [
      "140g salmon fillet",
      "150g sweet potato, cubed",
      "2 cups mixed greens (spinach, kale)",
      "1/4 cup cooked quinoa",
      "1 tbsp olive oil",
      "Lemon tahini dressing (2 tbsp)",
      "Salt, pepper, paprika"
    ],
    cookingInstructions: [
      "Preheat oven to 200°C (400°F). Toss sweet potato cubes with 1/2 tbsp olive oil, salt, and paprika. Roast for 25-30 minutes.",
      "Season salmon with salt and pepper. Heat remaining oil in a pan and cook salmon skin-side down for 4-5 minutes, then flip and cook for another 3-4 minutes.",
      "Massage greens with a pinch of salt to tenderize.",
      "Assemble bowl with greens, quinoa, roasted sweet potato, and salmon.",
      "Drizzle with lemon tahini dressing (mix tahini, lemon juice, water, salt)."
    ]
  },
  day6: {
    time: "2:00 pm",
    name: "Lentil and Vegetable Soup with Whole Grain Bread",
    description: "Hearty lentil soup packed with vegetables and fiber",
    macros: "580 kcal | 32g protein | 78g carbs | 18g fiber",
    ingredients: [
      "100g dry red lentils",
      "1 carrot, diced",
      "1 celery stalk, diced",
      "1 zucchini, diced",
      "400ml vegetable broth",
      "1 can diced tomatoes",
      "2 slices whole grain bread",
      "1 tsp cumin, paprika",
      "Fresh parsley"
    ],
    cookingInstructions: [
      "Sauté diced carrot, celery, and zucchini in a pot with a little olive oil for 5 minutes.",
      "Add lentils, vegetable broth, diced tomatoes, cumin, and paprika.",
      "Bring to a boil, then simmer for 20-25 minutes until lentils are tender.",
      "Season with salt and pepper, garnish with fresh parsley.",
      "Serve with 2 slices of toasted whole grain bread."
    ]
  }
};

async function fixLunches() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Fetching plan...');
  const { data: plans } = await supabase
    .from('sage_onboarding_data')
    .select('*')
    .not('sage_plan', 'is', null);

  const planData = plans.find(p => p.form_data?.uniqueCode === planCode);

  if (!planData) {
    throw new Error('Plan not found');
  }

  console.log('Updating lunches (Meal 2) for days 1, 2, 4, 5, 6...\n');

  const updatedPlan = { ...planData.sage_plan };

  // Update the light lunch days
  ['day1', 'day2', 'day4', 'day5', 'day6'].forEach(day => {
    if (updatedPlan.sampleMealPlan[day]) {
      updatedPlan.sampleMealPlan[day].meals[1] = properLunches[day];
      console.log(`✅ Updated ${day} lunch to: ${properLunches[day].name}`);
    }
  });

  console.log('\nSaving to database...');
  const { error } = await supabase
    .from('sage_onboarding_data')
    .update({
      sage_plan: updatedPlan,
      updated_at: new Date().toISOString()
    })
    .eq('id', planData.id);

  if (error) {
    throw error;
  }

  console.log('✅ Lunches updated successfully!');
  console.log('\nAll lunches now range from 540-620 kcal and are proper meals.');
}

fixLunches()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
