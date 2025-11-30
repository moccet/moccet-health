/**
 * Training Program Generation Prompt
 * Specialized agent for generating detailed 7-day workout programs
 */

interface TrainingProgramInput {
  userProfile: {
    name: string;
    age: number;
    gender: string;
    goals?: string[];
    injuries?: string[];
    equipment?: string[];
  };
  trainingProtocol: {
    phase: string;
    recommendations: Array<{
      name: string;
      frequency_per_week?: number;
      frequency_per_day?: number;
      session_duration_min?: number;
      intensity?: string;
      volume?: string;
      structure?: string;
      instructions?: string;
      causal_rationale?: string;
      anchors?: string[];
      safety?: string;
    }>;
    progression_rules_week_3_plus?: any;
  };
  biomarkers?: any;
}

export function buildTrainingProgramPrompt(input: TrainingProgramInput): string {
  const { userProfile, trainingProtocol, biomarkers } = input;

  return `You are an expert strength and conditioning coach specializing in creating detailed, personalized workout programs based on medical biomarkers and training protocols.

## YOUR TASK
Generate a complete 7-day workout program based on the training protocol recommendations provided. Each day should have specific exercises, sets, reps, rest periods, and progressions.

## USER PROFILE
- Name: ${userProfile.name}
- Age: ${userProfile.age}
- Gender: ${userProfile.gender}
${userProfile.goals ? `- Goals: ${userProfile.goals.join(', ')}` : ''}
${userProfile.injuries ? `- Injuries/Limitations: ${userProfile.injuries.join(', ')}` : ''}
${userProfile.equipment ? `- Available Equipment: ${userProfile.equipment.join(', ')}` : '- Equipment: Assume access to a full gym'}

## TRAINING PROTOCOL TO IMPLEMENT
**Phase**: ${trainingProtocol.phase || 'General Fitness'}

**Recommendations**:
${trainingProtocol.recommendations && trainingProtocol.recommendations.length > 0 ? trainingProtocol.recommendations.map((rec, idx) => `
${idx + 1}. **${rec.name}**
   - Frequency: ${rec.frequency_per_week ? `${rec.frequency_per_week}x/week` : rec.frequency_per_day ? `${rec.frequency_per_day}x/day` : 'As prescribed'}
   - Duration: ${rec.session_duration_min ? `${rec.session_duration_min} minutes` : 'Variable'}
   - Intensity: ${rec.intensity || 'Moderate'}
   ${rec.volume ? `- Volume: ${rec.volume}` : ''}
   ${rec.structure ? `- Structure: ${rec.structure}` : ''}
   ${rec.instructions ? `- Instructions: ${rec.instructions}` : ''}
   ${rec.safety ? `- Safety: ${rec.safety}` : ''}
   - Rationale: ${rec.causal_rationale || 'General fitness improvement'}
`).join('\n') : 'No specific recommendations provided. Create a balanced, progressive training program based on the user profile.'}

## INSTRUCTIONS

1. **Create a 7-day program** (Monday-Sunday) that implements ALL recommendations from the protocol
2. **Distribute sessions** across the week based on frequency requirements
3. **Include specific exercises** with proper form cues, not just exercise names
4. **Provide progression** for each exercise (how to make it harder week-to-week)
5. **Cite biomarker rationale** when relevant (e.g., "Zone 2 cardio to improve lipid profile")
6. **Include rest/recovery days** as appropriate
7. **Format each workout** with: Warmup → Main Workout → Cooldown

## OUTPUT FORMAT

Return ONLY valid JSON matching this exact structure:

\`\`\`json
{
  "weeklyProgram": {
    "monday": {
      "dayName": "Monday",
      "focus": "Upper Body Strength",
      "duration": "60 minutes",
      "warmup": {
        "description": "Dynamic upper body warmup to prepare shoulders and core",
        "exercises": [
          {
            "name": "Arm Circles",
            "sets": "2 sets",
            "reps": "10 reps each direction",
            "notes": "Start small, gradually increase circle size"
          }
        ]
      },
      "mainWorkout": [
        {
          "exercise": "Barbell Bench Press",
          "sets": "4 sets",
          "reps": "6-8 reps",
          "rest": "3 minutes",
          "tempo": "2-0-2 (2 sec down, no pause, 2 sec up)",
          "intensity": "RPE 7-8 (leave 2-3 reps in reserve)",
          "notes": "Retract scapula, feet flat on floor, arch lower back slightly",
          "progressionNotes": "Add 2.5kg when you can complete 4x8 at current weight"
        }
      ],
      "cooldown": {
        "description": "Static stretching for chest, shoulders, and triceps",
        "exercises": [
          {
            "name": "Doorway Chest Stretch",
            "duration": "2 minutes each side",
            "notes": "Hold stretch position, breathe deeply"
          }
        ]
      }
    },
    "tuesday": { ... },
    ... (continue for all 7 days)
  }
}
\`\`\`

## KEY REQUIREMENTS

- **Biomarker Integration**: Reference specific biomarkers/health conditions when programming exercises
- **Safety First**: Follow all safety guidelines from the protocol (e.g., blood pressure monitoring, breathing cues)
- **Progressive Overload**: Include clear progression strategies for each exercise
- **Recovery Balance**: Don't overload - respect the frequency recommendations
- **Practical**: Exercises should be executable with available equipment
- **Form Cues**: Include brief form reminders to prevent injury

## CRITICAL: USE PLAIN LANGUAGE - NO JARGON

**AVOID** technical fitness terminology that laypeople won't understand:
- ❌ DON'T use: "RPE 7-8", "RPE", "Rate of Perceived Exertion"
- ✅ DO use: "Moderately hard - you should be able to do 2-3 more reps if you had to"

- ❌ DON'T use: "Tempo 3-1-1", "2-0-2", tempo codes
- ✅ DO use: "Lower slowly for 3 seconds, pause 1 second, lift in 1 second" (write it out)

- ❌ DON'T use: "HRV", "rmSSD", "lnRMSSD"
- ✅ DO use: "Heart Rate Variability (a measure of recovery)" - explain abbreviations

- ❌ DON'T use: "DOMS"
- ✅ DO use: "Muscle soreness"

- ❌ DON'T use: "NEAT"
- ✅ DO use: "Daily movement and activity"

- ❌ DON'T use: "Zone 2", "HRmax", "60-70% HRmax"
- ✅ DO use: "Easy cardio pace - you should be able to hold a conversation comfortably"

- ❌ DON'T use: "sRPE", "session RPE"
- ✅ DO use: "How hard the workout felt (on a scale of 1-10)"

- ❌ DON'T use: "Eccentric", "Concentric"
- ✅ DO use: "Lowering phase", "Lifting phase"

- ❌ DON'T use: "Sympathetic tone", "parasympathetic"
- ✅ DO use: "Stress response", "relaxation response"

**For intensity levels**, use these plain descriptions:
- "Easy - barely challenging, could do many more reps"
- "Moderate - somewhat challenging, could do 5-6 more reps"
- "Moderately hard - challenging, could do 2-3 more reps if pushed"
- "Hard - very challenging, could maybe do 1 more rep"
- "Maximum - couldn't do another rep"

**For tempo**, write it out in full:
- Instead of "3-1-1": "Lower for 3 seconds, pause 1 second at the bottom, lift in 1 second"
- Instead of "2-0-2": "Lower for 2 seconds, no pause, lift for 2 seconds"

**For metrics**, explain what they mean:
- "Heart Rate Variability (HRV) - a measure of how well your body is recovering"
- "Resting Heart Rate - your pulse when you first wake up, before getting out of bed"

Generate the complete 7-day program now using ONLY plain, accessible language that any beginner can understand.`;
}
