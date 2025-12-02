/**
 * Recovery Protocol Generation Prompt
 * Specialized agent for generating progress tracking and injury prevention strategies
 */

export interface RecoveryProtocolInput {
  userProfile: {
    name: string;
    age: number;
    gender: string;
    fitnessLevel: string;
    injuries: string[];
    goals: string[];
  };
  biomarkers: {
    hrv?: number;
    restingHeartRate?: number;
    sleepQuality?: string;
    stressLevel?: string;
    cortisol?: number;
    crp?: number;
    [key: string]: any;
  };
  recommendations: {
    recovery_protocol?: {
      objectives: string[];
      sleepRecommendations?: string;
      stressManagement?: string[];
      activeRecovery?: string[];
      specificRecommendations: string[];
    };
  };
  trainingProgram?: {
    sessionsPerWeek: number;
    highIntensityDays: string[];
    trainingVolume: string;
  };
}

export function generateRecoveryProtocolPrompt(input: RecoveryProtocolInput): string {
  return `You are a sports medicine physician and recovery specialist focusing on injury prevention and performance optimization.

TASK: Generate comprehensive progress tracking metrics and injury prevention protocols based on user profile, biomarkers, and training demands.

USER PROFILE:
- Name: ${input.userProfile.name}
- Age: ${input.userProfile.age}
- Gender: ${input.userProfile.gender}
- Fitness Level: ${input.userProfile.fitnessLevel}
- Current Injuries/Limitations: ${input.userProfile.injuries.length > 0 ? input.userProfile.injuries.join(', ') : 'None'}
- Goals: ${input.userProfile.goals.join(', ')}

BIOMARKERS & RECOVERY METRICS:
${input.biomarkers.hrv ? `- Recovery score (HRV - a measure of how well-rested you are): ${input.biomarkers.hrv} ms` : ''}
${input.biomarkers.restingHeartRate ? `- Resting Heart Rate: ${input.biomarkers.restingHeartRate} bpm` : ''}
${input.biomarkers.sleepQuality ? `- Sleep Quality: ${input.biomarkers.sleepQuality}` : ''}
${input.biomarkers.stressLevel ? `- Stress Level: ${input.biomarkers.stressLevel}` : ''}
${input.biomarkers.cortisol ? `- Stress hormone (Cortisol): ${input.biomarkers.cortisol} μg/dL` : ''}
${input.biomarkers.crp ? `- Inflammation marker (CRP): ${input.biomarkers.crp} mg/L` : ''}

RECOVERY PROTOCOL RECOMMENDATIONS:
${input.recommendations.recovery_protocol ? `
- Objectives: ${input.recommendations.recovery_protocol.objectives?.join('; ') || 'Optimize recovery and prevent injury'}
${input.recommendations.recovery_protocol.sleepRecommendations ? `- Sleep: ${input.recommendations.recovery_protocol.sleepRecommendations}` : ''}
${input.recommendations.recovery_protocol.stressManagement ? `- Stress Management: ${input.recommendations.recovery_protocol.stressManagement.join(', ')}` : ''}
${input.recommendations.recovery_protocol.activeRecovery ? `- Active Recovery: ${input.recommendations.recovery_protocol.activeRecovery.join(', ')}` : ''}
- Specific Recommendations: ${input.recommendations.recovery_protocol.specificRecommendations?.join('; ') || 'Create recovery protocols based on user profile'}
` : 'No specific recovery protocol provided'}

${input.trainingProgram ? `
TRAINING DEMANDS:
- Weekly Sessions: ${input.trainingProgram.sessionsPerWeek}
- High-Intensity Days: ${input.trainingProgram.highIntensityDays.join(', ')}
- Training Volume: ${input.trainingProgram.trainingVolume}
` : ''}

INSTRUCTIONS:
1. Create weekly progress tracking metrics aligned with user goals
2. Design biomarker retesting schedule for monitoring
3. Identify injury risk factors based on training load, age, and history
4. Provide specific injury prevention strategies (warmup protocols, mobility work, load management)
5. Include recovery modalities (sleep, stress management, active recovery)
6. Establish red flags that indicate overtraining or injury risk
7. Provide guidance on when to modify training or take an easier recovery week

PROGRESS TRACKING PRINCIPLES:
- Metrics should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Include both objective (weight lifted, reps) and subjective (how hard it feels on a scale of 1-10, soreness) measures
- Track leading indicators (sleep, recovery score) and lagging indicators (strength gains, body composition)
- Align metrics with user's primary goals

INJURY PREVENTION GUIDELINES:
- Age considerations: 40+ requires more recovery, mobility work, gradual progression
- Common injury patterns: Overuse injuries from excessive volume/frequency, poor form, inadequate warmup
- Load management: 10% rule for volume increases, easier recovery weeks every 4-6 weeks
- Mobility requirements: Address common tight areas (hip flexors, thoracic spine, ankles)
- Movement screening: Identify asymmetries or limitations

OUTPUT FORMAT:
Return a JSON object with this exact structure:

{
  "progressTracking": {
    "weeklyMetrics": [
      {
        "metric": "Training Volume",
        "measurement": "Total sets per muscle group per week",
        "target": "10-20 sets per muscle group",
        "trackingMethod": "Log sets/reps in training journal",
        "frequency": "Weekly review",
        "rationale": "Monitor volume to ensure gradually making workouts harder over time without overtraining"
      },
      {
        "metric": "Body Weight",
        "measurement": "Morning weight after bathroom, before eating",
        "target": "+0.25-0.5 kg per week (muscle gain goal)",
        "trackingMethod": "Daily weigh-ins, calculate weekly average",
        "frequency": "Weekly average",
        "rationale": "Track whether caloric intake supports muscle gain goal"
      },
      {
        "metric": "Recovery score (a measure of how well-rested you are)",
        "measurement": "Morning recovery score reading via chest strap or app",
        "target": "Maintain >70ms; drop >10% indicates inadequate recovery",
        "trackingMethod": "HRV4Training or Whoop app",
        "frequency": "Daily (review weekly trend)",
        "rationale": "Primary indicator of recovery status and training readiness"
      },
      {
        "metric": "Sleep Duration & Quality",
        "measurement": "Hours of sleep + subjective quality rating (1-10)",
        "target": "7-9 hours per night, quality >7/10",
        "trackingMethod": "Sleep tracker or manual log",
        "frequency": "Daily",
        "rationale": "Sleep is critical for recovery, hormone regulation, and performance"
      }
    ],
    "biomarkerRetesting": [
      {
        "biomarker": "Cholesterol test (Total Cholesterol, Bad Cholesterol/LDL, Good Cholesterol/HDL, Triglycerides)",
        "frequency": "Every 3 months",
        "rationale": "Monitor impact of nutrition and training on cardiovascular health",
        "actionThreshold": "If bad cholesterol (LDL) >130 mg/dL or triglycerides >150 mg/dL, adjust nutrition protocol"
      },
      {
        "biomarker": "Average blood sugar over 3 months (HbA1c)",
        "frequency": "Every 6 months",
        "rationale": "Track long-term blood sugar regulation",
        "actionThreshold": "If >5.7%, tighten carbohydrate timing and quality"
      }
    ],
    "performanceBenchmarks": [
      {
        "test": "1-Rep Max Squat",
        "frequency": "Every 6 weeks",
        "rationale": "Track lower body strength progress",
        "targetIncrease": "+2.5-5kg per testing cycle"
      }
    ]
  },
  "injuryPrevention": {
    "riskFactors": [
      {
        "factor": "Age 45 - Reduced tissue elasticity and recovery capacity",
        "mitigation": "Extended warmups, longer rest periods, prioritize sleep and nutrition"
      },
      {
        "factor": "Previous shoulder injury history",
        "mitigation": "Rotator cuff strengthening (band external rotations 2x/week), avoid overhead pressing with poor form"
      },
      {
        "factor": "Sedentary job - Hip flexor tightness, thoracic immobility",
        "mitigation": "Daily hip flexor stretching, thoracic mobility drills before training"
      }
    ],
    "preventionStrategies": [
      {
        "strategy": "Dynamic Warmup Protocol",
        "implementation": "10-15 minutes before every session: joint circles, dynamic stretches, movement-specific prep",
        "exercises": [
          "Hip circles - 10 each direction",
          "Cat-cow thoracic mobility - 10 reps",
          "Band pull-aparts - 2x15",
          "Goblet squat (bodyweight) - 2x10"
        ],
        "rationale": "Increase tissue temperature, improve range of motion, activate stabilizers"
      },
      {
        "strategy": "Load Management",
        "implementation": "Track weekly training volume; increase by max 10% per week; easier recovery week (50% volume) every 5th week",
        "rationale": "Prevent overuse injuries from excessive volume accumulation"
      },
      {
        "strategy": "Rotator Cuff Strengthening",
        "implementation": "2x per week: Band external rotations 3x15, Face pulls 3x15",
        "rationale": "Protect shoulder joint given previous injury history"
      }
    ],
    "mobilityRequirements": [
      {
        "area": "Hip Flexors",
        "issue": "Tightness from sedentary work limits squat depth (how far you can move the joint) and causes lower back compensation",
        "protocol": "Couch stretch - 2 minutes each side, daily",
        "assessmentTest": "Kneeling hip flexor stretch - should achieve 90° hip extension without lumbar arch"
      },
      {
        "area": "Thoracic Spine",
        "issue": "Desk posture causes kyphosis and limits overhead shoulder mobility (how far you can move the joint)",
        "protocol": "Foam roller thoracic extensions - 10 reps, pre-workout",
        "assessmentTest": "Wall angel test - should maintain lower back and head contact while raising arms overhead"
      }
    ],
    "warningSignsOvertraining": [
      {
        "sign": "Recovery score drops >15% from baseline for 3+ consecutive days",
        "action": "Take extra rest day, reduce training volume by 30%, prioritize sleep"
      },
      {
        "sign": "Persistent muscle soreness after workouts >72 hours or joint pain during exercise",
        "action": "Take easier recovery week at 50% volume, address mobility limitations, consider form check"
      },
      {
        "sign": "Resting heart rate elevated >10 bpm from baseline",
        "action": "Sign of inadequate recovery or illness; rest until normalized"
      },
      {
        "sign": "Sleep disruptions, elevated stress, loss of motivation",
        "action": "Reduce training intensity, add stress management practices (meditation, walks)"
      }
    ],
    "recoveryModalities": [
      {
        "modality": "Sleep Optimization",
        "protocol": "7-9 hours nightly; consistent bed/wake times; cool, dark room; no screens 1 hour before bed",
        "frequency": "Daily",
        "rationale": "Primary recovery tool; improves recovery score, hormone regulation, cognitive function"
      },
      {
        "modality": "Active Recovery",
        "protocol": "20-30 min low-intensity cardio (walking, cycling <60% max HR) or yoga",
        "frequency": "1-2x per week on rest days",
        "rationale": "Promote blood flow and reduce muscle soreness without adding training stress"
      },
      {
        "modality": "Foam Rolling / Self-Myofascial Release",
        "protocol": "5-10 minutes post-workout focusing on quads, hamstrings, glutes, IT band",
        "frequency": "After intense training sessions",
        "rationale": "May reduce muscle soreness after workouts and improve short-term flexibility"
      }
    ]
  },
  "recoveryProtocol": {
    "personalizedIntro": "Brief 1-2 sentence overview connecting recovery needs to their specific biomarkers and lifestyle",
    "dailyPractices": [
      "Morning sunlight exposure for 10-15 minutes within 1 hour of waking to regulate circadian rhythm",
      "Evening wind-down routine starting 60 minutes before bed (dim lights, no screens, light stretching)",
      "Stay well-hydrated throughout the day - aim for 3 liters of water, more on training days",
      "Quick 5-minute mobility flow upon waking to reduce morning stiffness",
      "Track your morning resting heart rate before getting out of bed"
    ],
    "weeklyPractices": [
      "One 30-minute self-massage or foam rolling session on a rest day to work through tight spots",
      "Weekly progress review - compare this week's performance, weight, and recovery metrics to last week",
      "Measure waist circumference weekly at same time/conditions to track body composition",
      "Schedule 1-2 active recovery sessions (easy walk, bike, or yoga) on rest days",
      "Review your training log to spot patterns between sleep, stress, and performance"
    ],
    "sleepOptimization": "Write 2-3 paragraphs for sleep optimization. IMPORTANT: Separate each paragraph with \\n\\n (double newline). Each paragraph should be 50-70 words. Paragraph 1: Sleep targets (7-9 hours) and bedtime routine (screen cutoff, room temperature 65-68°F, blackout curtains, consistent schedule). Paragraph 2: WHY sleep matters (muscle repair, growth hormone, nervous system recovery, cortisol effects, testosterone, immune function, injury risk). Paragraph 3: 2-3 specific sleep hacks tailored to their situation (e.g., magnesium before bed, breathing exercises, anchor wake time).",
    "stressManagement": "Write 2-3 paragraphs for stress management. IMPORTANT: Separate each paragraph with \\n\\n (double newline). Each paragraph should be 50-70 words. Paragraph 1: Daily stress reduction practice (box breathing 4-4-4-4, body scan meditation, journaling) and weekly stress audit. Paragraph 2: Explain stress hormone-recovery connection (chronic stress → elevated cortisol → impaired recovery, disrupted sleep, increased inflammation). Paragraph 3: Specific techniques (tactical breathing timing, morning journaling, nature walks) and emphasize that training adds stress so recovery is non-negotiable when stress is high.",
    "mobilityWork": "Write 2-3 paragraphs for daily mobility work. IMPORTANT: Separate each paragraph with \\n\\n (double newline). Each paragraph should be 60-80 words. Paragraph 1: Overview of 10-15 minute daily routine targeting their specific tight areas (hip flexors, thoracic spine, ankles, shoulders). For each area: state the issue, the exercise, and the benefit. Paragraph 2: WHEN to do it (morning or pre-workout), HOW to progress (hold longer, increase range), WHY it prevents injury (mobile joints = better movement = less compensation). Paragraph 3: Specific daily flow with exercises and reps (cat-cow 10, world's greatest stretch 5/side, 90-90 switches 10, thoracic rotations 8/side, ankle rocks 10/side)."
  }
}

IMPORTANT CONSTRAINTS:
- All recommendations must be evidence-based and practical to implement
- Risk factors should be specific to the individual (age, injury history, lifestyle)
- Warning signs should have clear action steps, not vague advice
- Mobility protocols should target identified limitations from user's profile
- Biomarker retesting frequency should balance cost and actionability
- Progress metrics should align with user's stated goals

RETURN ONLY THE JSON OBJECT. NO ADDITIONAL TEXT.`;
}
