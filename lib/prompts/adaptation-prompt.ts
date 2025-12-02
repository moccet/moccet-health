/**
 * Adaptive Features Generation Prompt
 * Specialized agent for generating HRV-based training adjustments
 */

export interface AdaptationInput {
  userProfile: {
    name: string;
    age: number;
    gender: string;
    fitnessLevel: string;
    lifestyle: string;
    goals: string[];
  };
  biomarkers: {
    hrv?: number;
    restingHeartRate?: number;
    sleepQuality?: string;
    stressLevel?: string;
  };
  trainingProgram: {
    weeklyProgram: {
      [day: string]: {
        focus: string;
        duration: string;
        mainWorkout: any[];
      };
    };
  };
}

export function generateAdaptationPrompt(input: AdaptationInput): string {
  return `You are a sports scientist specializing in training that adjusts based on how you feel and recovery score-based programming.

TASK: Generate adaptive training protocols that allow the user to adjust their training based on daily readiness, energy levels, and life circumstances.

USER PROFILE:
- Name: ${input.userProfile.name}
- Age: ${input.userProfile.age}
- Gender: ${input.userProfile.gender}
- Fitness Level: ${input.userProfile.fitnessLevel}
- Lifestyle: ${input.userProfile.lifestyle}
- Goals: ${input.userProfile.goals.join(', ')}

BIOMARKERS & READINESS INDICATORS:
${input.biomarkers.hrv ? `- Baseline Recovery Score (a measure of how well-rested you are): ${input.biomarkers.hrv} ms` : ''}
${input.biomarkers.restingHeartRate ? `- Baseline Resting Heart Rate: ${input.biomarkers.restingHeartRate} bpm` : ''}
${input.biomarkers.sleepQuality ? `- Typical Sleep Quality: ${input.biomarkers.sleepQuality}` : ''}
${input.biomarkers.stressLevel ? `- Typical Stress Level: ${input.biomarkers.stressLevel}` : ''}

STANDARD TRAINING PROGRAM:
${Object.entries(input.trainingProgram.weeklyProgram).map(([day, workout]) => `
- ${day}: ${workout.focus} (${workout.duration})
  ${workout.mainWorkout.slice(0, 2).map(ex => `  * ${ex.exercise || ex.exerciseName || 'Exercise'}`).join('\n')}`).join('')}

INSTRUCTIONS:
1. Create decision trees for high-energy vs. low-energy days
2. Provide workout modifications for poor recovery score/sleep
3. Design quick workout alternatives for time-constrained days
4. Create travel-friendly bodyweight modifications
5. Include guidance on adjusting based on how hard it feels (on a scale of 1-10, where 10 is maximum effort)
6. Provide clear decision criteria (when to push vs. when to back off)

ADAPTATION PRINCIPLES:
- Recovery Score-Based: If recovery score is >10% below baseline → reduce volume or intensity
- Sleep-Based: <6 hours sleep → prioritize recovery or low-intensity work
- Stress-Based: High work stress + training stress = overtraining risk
- Time-Based: Provide 15-min, 30-min, and 45-min versions of key sessions
- Location-Based: Gym vs. home vs. travel (hotel room) modifications

OUTPUT FORMAT:
Return a JSON object with this exact structure:

{
  "adaptiveFeatures": {
    "readinessScoring": {
      "description": "Simple daily readiness assessment to guide training decisions",
      "scoringCriteria": [
        {
          "factor": "Recovery Score (a measure of how well-rested you are)",
          "green": ">95% of baseline",
          "yellow": "85-95% of baseline",
          "red": "<85% of baseline"
        },
        {
          "factor": "Sleep Duration",
          "green": "7-9 hours",
          "yellow": "6-7 hours",
          "red": "<6 hours"
        },
        {
          "factor": "Sleep Quality (subjective 1-10)",
          "green": "8-10",
          "yellow": "5-7",
          "red": "1-4"
        },
        {
          "factor": "Muscle Soreness After Workouts",
          "green": "Minimal or none",
          "yellow": "Moderate, manageable",
          "red": "Severe or limiting how far you can move a joint"
        },
        {
          "factor": "Stress Level",
          "green": "Low",
          "yellow": "Moderate",
          "red": "High (work deadlines, personal issues)"
        }
      ],
      "decisionLogic": {
        "allGreen": "Proceed with planned training as written",
        "1-2Yellow": "Reduce volume by 20% OR reduce intensity by 1 point (on a scale of 1-10, where 10 is maximum effort)",
        "3+YellowOr1+Red": "Switch to recovery day or low-intensity active recovery"
      }
    },
    "highEnergyDay": {
      "description": "When recovery score is high, sleep was great, and you feel energized - capitalize on readiness",
      "modifications": [
        {
          "aspect": "Volume",
          "adjustment": "Add 1-2 extra sets to main lifts",
          "example": "Squat: Increase from 4x6 to 5x6 or 4x8"
        },
        {
          "aspect": "Intensity",
          "adjustment": "Push to 9 out of 10 (where 10 is maximum effort) instead of 8 out of 10",
          "example": "Top set of deadlifts: Go for a new rep PR at current weight"
        },
        {
          "aspect": "Accessory Work",
          "adjustment": "Add 1-2 extra accessory exercises",
          "example": "Add extra bicep/tricep work or core exercises"
        }
      ],
      "exampleWorkout": {
        "original": "Squat 4x6 at 8 out of 10 effort (where 10 is maximum), Romanian Deadlift 3x10, Leg Press 3x12",
        "highEnergy": "Squat 5x6 at 9 out of 10 effort (where 10 is maximum), Romanian Deadlift 4x10, Leg Press 3x12, Leg Curls 3x12"
      }
    },
    "lowEnergyDay": {
      "description": "When recovery score is low, sleep was poor, or stress is high - prioritize recovery while maintaining movement",
      "modifications": [
        {
          "aspect": "Volume",
          "adjustment": "Reduce sets by 30-50%",
          "example": "Squat: Reduce from 4x6 to 2x6"
        },
        {
          "aspect": "Intensity",
          "adjustment": "Reduce load to 6-7 out of 10 effort, where 10 is maximum (leave 3-4 reps in reserve)",
          "example": "Use 70-80% of planned weight"
        },
        {
          "aspect": "Exercise Selection",
          "adjustment": "Choose less taxing variations",
          "example": "Replace barbell squats with goblet squats or leg press"
        },
        {
          "aspect": "Session Type",
          "adjustment": "Convert to active recovery",
          "example": "20-30 min easy cardio, light mobility work, yoga"
        }
      ],
      "exampleWorkout": {
        "original": "Squat 4x6 at 8 out of 10 effort (where 10 is maximum), Romanian Deadlift 3x10, Leg Press 3x12",
        "lowEnergy": "Goblet Squat 3x8 at 6 out of 10 effort (where 10 is maximum), Walking Lunges 2x10 each leg, Light bike 15 minutes"
      },
      "recoveryAlternative": {
        "description": "Full recovery session when readiness is very low",
        "activities": [
          "30 minutes easy walking or cycling (conversational pace)",
          "15 minutes foam rolling and stretching",
          "10 minutes breathing exercises or meditation"
        ]
      }
    },
    "busyScheduleAdjustments": {
      "15minQuickSession": {
        "description": "Minimal effective dose when time is extremely limited",
        "structure": "1-2 compound exercises, 3 sets each, minimal rest",
        "examples": [
          {
            "focus": "Lower Body",
            "workout": "Goblet Squats 3x10 (90s rest), Pushups 3x max reps"
          },
          {
            "focus": "Upper Body",
            "workout": "Pullups 3x max reps (90s rest), Dips 3x max reps"
          }
        ]
      },
      "30minCondensedSession": {
        "description": "Abbreviated version of main workout - prioritize most important lifts",
        "structure": "Main compound lift + 1-2 accessories, moderate rest",
        "examples": [
          {
            "focus": "Leg Day",
            "workout": "Squat 3x6 at 8 out of 10 effort (where 10 is maximum) (2min rest), Romanian Deadlift 3x8 (90s rest)"
          },
          {
            "focus": "Upper Body",
            "workout": "Bench Press 3x6 at 8 out of 10 effort (where 10 is maximum) (2min rest), Rows 3x8 (90s rest)"
          }
        ]
      }
    },
    "travelAdjustments": {
      "hotelRoom": {
        "description": "Bodyweight workouts requiring no equipment",
        "workouts": [
          {
            "day": "Push Day",
            "exercises": [
              "Pushup variations (regular, diamond, decline) - 4x10-15",
              "Pike pushups (shoulder focus) - 3x8-12",
              "Tricep dips on chair - 3x10-15"
            ]
          },
          {
            "day": "Pull Day",
            "exercises": [
              "Doorframe rows (use towel) - 4x10-12",
              "Reverse snow angels - 3x15",
              "Plank variations - 3x30-60s"
            ]
          },
          {
            "day": "Leg Day",
            "exercises": [
              "Bulgarian split squats - 4x10 each leg",
              "Single-leg Romanian deadlifts - 3x10 each leg",
              "Jump squats - 3x12"
            ]
          }
        ]
      },
      "minimalEquipment": {
        "description": "Workouts with resistance bands or single dumbbell/kettlebell",
        "equipment": "Resistance band set (can pack in suitcase)",
        "workouts": [
          {
            "day": "Full Body",
            "exercises": [
              "Band squats - 4x15",
              "Band rows - 4x15",
              "Band chest press - 4x15",
              "Band shoulder press - 3x12"
            ]
          }
        ]
      }
    },
    "autoregulationGuidance": {
      "description": "How to adjust training based on in-workout feel",
      "adjustmentsBasedOnHowHardItFeels": [
        {
          "scenario": "Set feels easier than expected (target 8 out of 10 effort where 10 is maximum, but feels like 6 out of 10)",
          "action": "Increase weight by 5-10% for next set or add extra set"
        },
        {
          "scenario": "Set feels much harder than expected (target 8 out of 10 effort where 10 is maximum, but feels like 9.5 out of 10)",
          "action": "Reduce weight by 10% or end session early"
        },
        {
          "scenario": "Multiple exercises feel off/weak",
          "action": "Cut volume by 30%, treat as low-energy day, prioritize recovery"
        }
      ],
      "barVelocityGuidance": {
        "description": "If using velocity tracker (optional)",
        "green": "Bar speed within 10% of baseline - continue as planned",
        "yellow": "Bar speed 10-20% slower - reduce volume or load",
        "red": "Bar speed >20% slower - end session, prioritize recovery"
      }
    }
  }
}

IMPORTANT CONSTRAINTS:
- All modifications should maintain training stimulus while respecting recovery needs
- Provide clear, actionable decision criteria (not vague "listen to your body")
- Travel workouts should be genuinely feasible in small spaces
- Quick sessions should focus on highest-ROI exercises (compound movements)
- Adjusting based on how hard it feels (on a scale of 1-10, where 10 is maximum effort) is the primary tool (accessible to everyone)

RETURN ONLY THE JSON OBJECT. NO ADDITIONAL TEXT.`;
}
