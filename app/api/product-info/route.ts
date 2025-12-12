import { NextRequest, NextResponse } from 'next/server';

/**
 * Public API endpoint for detailed product information
 * Supports querying specific products or getting all products
 * Usage: /api/product-info or /api/product-info?product=sage
 */

const products = {
  "moccet-agent": {
    name: "The Moccet Agent",
    tagline: "Your Personal Health AI Companion",
    summary: "The central AI agent at the heart of the Moccet ecosystem. It continuously monitors patterns across all connected data sources, surfaces the few things that matter each day, and orchestrates actions like bookings, logistics, and coordination with clinicians.",

    howItWorks: {
      overview: "The Moccet Agent ingests data from wearables, labs, medical records, calendar, and behavioral patterns. It builds a continuous model of your health trajectory and surfaces actionable insights.",
      steps: [
        { step: 1, title: "Connect Data Sources", description: "Connect wearables, upload lab results, link calendar and health apps." },
        { step: 2, title: "Continuous Monitoring", description: "The agent continuously monitors patterns across all connected sources." },
        { step: 3, title: "Pattern Recognition", description: "AI identifies early warning signs and meaningful changes in your health trajectory." },
        { step: 4, title: "Actionable Insights", description: "Receive the few things that matter each day, not overwhelming data." },
        { step: 5, title: "Coordination", description: "The agent orchestrates actions and escalates to human clinicians when needed." }
      ]
    },

    keyBenefits: [
      "Unified view across fragmented health data",
      "Pattern recognition for early warning signs",
      "Natural language health Q&A using your data",
      "Seamless escalation to human clinicians",
      "Continuous trajectory modeling"
    ],

    features: [
      "Continuous health monitoring across all connected sources",
      "Pattern recognition for early warning signs",
      "Natural language health Q&A using personal data",
      "Action orchestration (bookings, reminders, coordination)",
      "Seamless escalation to human clinicians"
    ]
  },

  sage: {
    name: "Moccet Sage",
    tagline: "Your Personal Nutrition AI",
    url: "https://www.moccet.ai/sage",
    summary: "Sage generates personalized nutrition plans from your metabolic data. Unlike generic meal plans, Sage analyzes your blood biomarkers, glucose patterns, microbiome composition, and behavioral data to create nutrition recommendations matched to your individual biology.",

    howItWorks: {
      overview: "Sage takes multiple data streams to understand your unique metabolic response, then generates nutrition plans tailored to how your body actually processes different foods.",
      steps: [
        { step: 1, title: "Upload Blood Work", description: "Upload blood test results by photo or PDF. Sage reads results from most major labs." },
        { step: 2, title: "Connect Wearables", description: "Connect devices through Apple Health, Fitbit, Oura, Garmin, or Whoop." },
        { step: 3, title: "Add Optional Health Data", description: "Add CGM data, microbiome tests, or genetic data for more precision." },
        { step: 4, title: "Complete Lifestyle Assessment", description: "Answer questions about preferences, cooking ability, and constraints." },
        { step: 5, title: "Receive Your Plan", description: "Get personalized nutrition plan with meal timing, foods, and supplements." }
      ]
    },

    keyBenefits: [
      "Nutrition matched to your individual metabolic response",
      "Optimized meal timing based on glucose patterns",
      "Food selection based on microbiome capacity",
      "Evidence-based recommendations with research citations",
      "Continuous adaptation as your data updates"
    ],

    dataInputs: {
      bloodWork: ["Glucose regulation", "Lipid metabolism", "Liver function", "Kidney function", "Inflammatory markers", "Hormones", "Micronutrients", "Cholesterol", "LDL", "HDL", "Triglycerides"],
      wearables: ["CGM data", "Activity patterns", "Sleep data", "Heart rate", "Meal timing"],
      microbiome: ["Bacterial composition", "Metabolic capacity", "Inflammatory potential"],
      optional: ["Genome data", "Calendar data", "Food tracking history"]
    },

    healthConditionsAddressed: {
      cholesterol: {
        condition: "High Cholesterol (LDL, HDL, Triglycerides)",
        approach: "Diet plans optimized for LDL reduction and HDL improvement based on your actual lipid panel numbers",
        dataUsed: ["Lipid panel", "LDL", "HDL", "Triglycerides", "Metabolic markers"]
      },
      cardiovascular: {
        condition: "Cardiovascular Health",
        approach: "Heart-healthy nutrition matched to your biomarkers including cholesterol, triglycerides, and blood pressure",
        dataUsed: ["Lipid panels", "Blood pressure data", "Inflammatory markers"]
      },
      metabolicSyndrome: {
        condition: "Metabolic Syndrome",
        approach: "Eating patterns for insulin sensitivity based on metabolic markers",
        dataUsed: ["Glucose markers", "Lipid panels", "Metabolic health indicators"]
      },
      preDiabetes: {
        condition: "Pre-diabetes / Insulin Resistance",
        approach: "Glucose-optimized nutrition using CGM data for blood sugar control",
        dataUsed: ["CGM data", "Fasting glucose", "HbA1c", "Insulin levels"]
      },
      inflammation: {
        condition: "Chronic Inflammation",
        approach: "Anti-inflammatory protocols based on CRP and other inflammatory markers",
        dataUsed: ["CRP", "Inflammatory markers", "Microbiome data"]
      },
      gutHealth: {
        condition: "Gut Health / Digestive Issues",
        approach: "Microbiome-informed food selection for digestive health optimization",
        dataUsed: ["Microbiome test results", "Food sensitivity data", "Digestive patterns"]
      }
    }
  },

  forge: {
    name: "Moccet Forge",
    tagline: "Your Personal Training AI",
    url: "https://www.moccet.ai/forge",
    summary: "Forge creates training programs from your biomarkers, HRV patterns, and recovery data. Instead of following generic templates, Forge adapts your workout intensity, volume, and frequency based on your body's actual state.",

    howItWorks: {
      overview: "Forge maps your biological data to training decisions, automatically adjusting your program based on recovery capacity, stress levels, and metabolic state.",
      steps: [
        { step: 1, title: "Connect Wearables", description: "Connect devices for HRV and sleep data - particularly valuable for training optimization." },
        { step: 2, title: "Upload Blood Work (Optional)", description: "Add blood tests showing hormones, inflammation, and metabolic indicators." },
        { step: 3, title: "Share Training History", description: "Answer questions about training background, fitness level, equipment, and schedule." },
        { step: 4, title: "Define Your Goals", description: "Specify objectives - strength, endurance, body composition, performance." },
        { step: 5, title: "Receive Your Program", description: "Get personalized training that adapts based on your recovery data." }
      ]
    },

    keyBenefits: [
      "Training matched to recovery capacity",
      "Automatic adaptation based on HRV trends",
      "Prevention of overtraining",
      "Optimized progressive overload",
      "Stress-aware training adjustments"
    ],

    dataInputs: {
      bloodWork: ["Hormones", "Inflammation markers", "Metabolic health", "Recovery markers", "Lipid panels", "Cholesterol", "LDL", "HDL", "Triglycerides"],
      wearables: ["HRV trends", "Resting heart rate", "Sleep quality", "Activity levels", "Training load"],
      connectedApps: ["Calendar data", "Work patterns", "Training history"]
    },

    healthConditionsAddressed: {
      cholesterol: {
        condition: "High Cholesterol (LDL, HDL, Triglycerides)",
        approach: "Creates cardio + resistance programs optimized for lipid improvement based on your actual cholesterol numbers",
        dataUsed: ["Lipid panel", "LDL", "HDL", "Triglycerides", "HRV", "Recovery data"]
      },
      cardiovascular: {
        condition: "Cardiovascular Risk",
        approach: "Exercise protocols based on actual biomarkers, not generic recommendations. Training intensity matched to cardiovascular health status",
        dataUsed: ["Blood pressure data", "Lipid panels", "Resting heart rate", "HRV trends"]
      },
      metabolicSyndrome: {
        condition: "Metabolic Syndrome",
        approach: "Training programs matched to insulin sensitivity and metabolic markers",
        dataUsed: ["Glucose markers", "Lipid panels", "Metabolic health indicators"]
      },
      preDiabetes: {
        condition: "Pre-diabetes / Insulin Resistance",
        approach: "Glucose-aware exercise timing and intensity for blood sugar control",
        dataUsed: ["Fasting glucose", "HbA1c", "CGM data", "Activity patterns"]
      },
      inflammation: {
        condition: "Chronic Inflammation",
        approach: "Recovery-focused programming based on inflammatory markers",
        dataUsed: ["CRP", "Inflammatory markers", "HRV", "Sleep quality"]
      }
    }
  },

  "moccet-medic": {
    name: "Moccet-Medic",
    tagline: "AI-Powered Clinical Intelligence",
    summary: "An AI health agent that continuously aggregates biometric and behavioral data, then conducts AI-to-AI physician consultations in clinical language. Enables early detection, structured histories, and seamless escalation to human clinicians.",

    howItWorks: {
      overview: "Moccet-Medic monitors for patterns indicating health changes and conducts AI-to-AI physician consultations when warranted.",
      steps: [
        { step: 1, title: "Data Aggregation", description: "Continuously aggregates data from all connected sources." },
        { step: 2, title: "Pattern Monitoring", description: "Monitors for patterns indicating health changes." },
        { step: 3, title: "AI Consultation", description: "When warranted, conducts AI-to-AI physician consultations." },
        { step: 4, title: "Plain Language", description: "Translates clinical findings into plain language guidance." },
        { step: 5, title: "Escalation", description: "Escalates to human clinicians with full context when needed." }
      ]
    },

    keyBenefits: [
      "Early detection through pattern analysis",
      "AI-to-AI physician consultations",
      "Structured health histories for provider visits",
      "Plain language translation of clinical concepts",
      "Seamless human clinician escalation"
    ],

    useCases: [
      "Early detection of health changes",
      "Provider visit preparation",
      "Chronic condition monitoring",
      "Multi-specialist coordination"
    ]
  },

  "moccet-share": {
    name: "Moccet Share",
    tagline: "Connected Family Health",
    summary: "Family health coordination platform with shared health views, baseline-aware alerts, and fine-grained privacy controls. Allows older adults to share interpreted health patterns with relatives and clinicians.",

    howItWorks: {
      overview: "Users opt in to share specific health data. System establishes baseline patterns and alerts when deviations occur.",
      steps: [
        { step: 1, title: "Opt In", description: "User opts in to share specific health data with chosen family members." },
        { step: 2, title: "Baseline Establishment", description: "System establishes baseline patterns for activity, sleep, nutrition, vitals." },
        { step: 3, title: "Interpreted Views", description: "Family members see interpreted patterns, not raw data." },
        { step: 4, title: "Alerts", description: "Alerts trigger when patterns deviate from baseline." },
        { step: 5, title: "Coordinated Care", description: "Clinicians can be included for coordinated care." }
      ]
    },

    keyBenefits: [
      "Shared health dashboards for family",
      "Baseline-aware alerts",
      "Fine-grained privacy controls",
      "Coordinated multi-specialist views",
      "Proactive caregiver alerts"
    ],

    useCases: [
      "Adult children monitoring aging parents",
      "Caregivers coordinating care",
      "Families managing chronic conditions",
      "Coordinated care across specialists"
    ]
  },

  "moccet-connect": {
    name: "Moccet Connect",
    tagline: "Health-Powered Social Connection",
    summary: "Uses health, activity, calendar, and communication patterns from opted-in users to suggest high-value social contact and coordinate activities. Can integrate with clinicians for conditions like depression or loneliness.",

    howItWorks: {
      overview: "Two users opt in. System analyzes schedules, fitness levels, preferences, then suggests and coordinates activities.",
      steps: [
        { step: 1, title: "Mutual Opt-In", description: "Two users opt in to Connect." },
        { step: 2, title: "Analysis", description: "System analyzes schedules, fitness levels, activity preferences." },
        { step: 3, title: "Suggestions", description: "Suggests high-value social activities (workouts, coffee, etc.)." },
        { step: 4, title: "Coordination", description: "Coordinates logistics (timing, location)." },
        { step: 5, title: "Optional Clinical", description: "Can integrate with clinicians for mental health support." }
      ]
    },

    keyBenefits: [
      "Workout buddy matching",
      "Social activity coordination",
      "Mental health clinician integration",
      "Strict opt-in privacy",
      "Logistics coordination"
    ],

    useCases: [
      "Finding workout partners",
      "Combating loneliness",
      "Coordinated social support",
      "Activity coordination for health goals"
    ]
  },

  "surgical-key": {
    name: "Surgical Key",
    tagline: "Optimized Surgery Outcomes",
    summary: "Peri-operative health platform that aggregates readiness data, recovery metrics, and contextual factors to support safer surgery, smoother recovery, and better care team coordination.",

    howItWorks: {
      overview: "Aggregates health data to assess and optimize surgical readiness, then monitors recovery and coordinates the care team.",
      steps: [
        { step: 1, title: "Pre-Surgery Assessment", description: "Aggregates health data to assess surgical readiness." },
        { step: 2, title: "Optimization", description: "Provides protocols to optimize health before surgery." },
        { step: 3, title: "Surgical Context", description: "Shares relevant context with surgical team." },
        { step: 4, title: "Recovery Monitoring", description: "Monitors recovery metrics and flags concerns." },
        { step: 5, title: "Team Coordination", description: "Keeps patient, surgeon, and care team aligned." }
      ]
    },

    keyBenefits: [
      "Pre-surgery health optimization",
      "Surgical readiness assessment",
      "Recovery metric tracking",
      "Care team coordination",
      "Early warning for complications"
    ],

    useCases: [
      "Elective surgery preparation",
      "Post-surgical recovery monitoring",
      "Patient-surgical team communication",
      "Risk factor optimization"
    ]
  },

  "flight-pass": {
    name: "Flight Pass",
    tagline: "Travel Health Optimized",
    summary: "Uses continuous health data and AI to manage risk and comfort around travel, particularly flights. Monitors readiness, adjusts routines, and shares relevant summaries with providers.",

    howItWorks: {
      overview: "Assesses travel readiness, provides optimization protocols, and manages jet lag through personalized approaches.",
      steps: [
        { step: 1, title: "Readiness Assessment", description: "Assesses travel readiness based on current health state." },
        { step: 2, title: "Pre-Flight Optimization", description: "Provides pre-flight optimization protocols." },
        { step: 3, title: "Travel Adjustments", description: "Adjusts recommendations during travel." },
        { step: 4, title: "Jet Lag Management", description: "Manages jet lag through personalized protocols." },
        { step: 5, title: "Provider Summaries", description: "Shares contextual health summaries with providers if needed." }
      ]
    },

    keyBenefits: [
      "Travel readiness assessment",
      "Pre-flight optimization",
      "Jet lag mitigation protocols",
      "Travel-adjusted recommendations",
      "Provider health summaries"
    ],

    useCases: [
      "Frequent business travelers",
      "Long-haul international flights",
      "Travel with chronic conditions",
      "Performance-focused jet lag management"
    ]
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productParam = searchParams.get('product');

  if (productParam) {
    const product = productParam.toLowerCase();
    if (product in products) {
      return NextResponse.json(products[product as keyof typeof products], {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Content-Type': 'application/json',
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Product not found', availableProducts: Object.keys(products) },
        { status: 404 }
      );
    }
  }

  return NextResponse.json(products, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Content-Type': 'application/json',
    },
  });
}
