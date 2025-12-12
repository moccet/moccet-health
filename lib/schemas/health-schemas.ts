/**
 * Health-focused Schema.org JSON-LD schemas for SEO and AI discoverability
 * These schemas help search engines and AI assistants understand Moccet's health offerings
 */

// Organization Schema - Enhanced for full health AI platform
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Moccet",
  "alternateName": "Moccet Inc",
  "description": "Autonomous health AI platform that embeds AI agents into daily life, relationships, and clinical workflows. Combines continuous health monitoring, personalized AI recommendations, and deep clinical integration for proactive, personalized care.",
  "url": "https://moccet.ai",
  "logo": "https://moccet.ai/logo.png",
  "foundingDate": "2024",
  "industry": "Health Technology",
  "knowsAbout": [
    "Autonomous Health Agents",
    "Continuous Health Monitoring",
    "AI-Powered Clinical Workflows",
    "Predictive Health Modeling",
    "Personalized Nutrition",
    "Metabolic Health",
    "Blood Biomarker Analysis",
    "Continuous Glucose Monitoring",
    "Microbiome Science",
    "Heart Rate Variability Training",
    "Fitness Optimization",
    "Recovery Science",
    "Family Health Coordination",
    "Peri-Operative Health",
    "Travel Health Management",
    "Early Disease Detection",
    "AI Physician Consultations"
  ],
  "sameAs": [
    "https://twitter.com/moccet",
    "https://linkedin.com/company/moccet",
    "https://moccetai.substack.com"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "url": "https://moccet.ai/contact"
  }
};

// Sage Product Schema - Nutrition AI
export const sageProductSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalWebPage",
      "@id": "https://moccet.ai/sage#webpage",
      "name": "Sage - AI-Powered Personalized Nutrition Plans",
      "description": "Generate personalized nutrition plans based on metabolic data, blood biomarkers, CGM data, and microbiome analysis. AI that adapts to your biology.",
      "url": "https://moccet.ai/sage",
      "specialty": {
        "@type": "MedicalSpecialty",
        "name": "Nutrition Science"
      },
      "audience": {
        "@type": "PeopleAudience",
        "healthCondition": {
          "@type": "MedicalCondition",
          "name": "Metabolic Health Optimization"
        }
      },
      "about": {
        "@type": "Diet",
        "name": "Personalized Metabolic Nutrition Plan",
        "dietFeatures": [
          "Based on individual blood biomarkers",
          "Continuous glucose monitor integration",
          "Microbiome-optimized food selection",
          "Personalized meal timing",
          "Macro and micronutrient optimization"
        ]
      }
    },
    {
      "@type": "SoftwareApplication",
      "name": "Moccet Sage",
      "applicationCategory": "HealthApplication",
      "operatingSystem": "Web",
      "description": "AI-powered personalized nutrition planning based on metabolic data, blood biomarkers, and microbiome analysis",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock"
      },
      "provider": {
        "@type": "Organization",
        "name": "Moccet",
        "url": "https://moccet.ai"
      },
      "featureList": [
        "Personalized nutrition plans from metabolic data",
        "Blood biomarker analysis",
        "CGM data integration",
        "Microbiome-based recommendations",
        "Wearable device sync",
        "Evidence-based recommendations with citations"
      ]
    }
  ]
};

// Forge Product Schema - Fitness AI
export const forgeProductSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalWebPage",
      "@id": "https://moccet.ai/forge#webpage",
      "name": "Forge - AI-Powered Personalized Training Programs",
      "description": "Get fitness and training programs built from your biomarkers, HRV data, and recovery patterns. AI that adapts to your biology.",
      "url": "https://moccet.ai/forge",
      "specialty": {
        "@type": "MedicalSpecialty",
        "name": "Exercise Science"
      }
    },
    {
      "@type": "ExercisePlan",
      "name": "Personalized Biomarker-Based Training Program",
      "description": "Training programs that adapt based on blood biomarkers, HRV patterns, and recovery data",
      "exerciseType": [
        "Strength Training",
        "Cardiovascular Exercise",
        "Flexibility Training",
        "Recovery Protocols"
      ],
      "activityDuration": "PT45M to PT90M",
      "activityFrequency": "3-6 days per week, personalized based on recovery capacity",
      "additionalVariable": [
        "Heart Rate Variability (HRV) adaptation",
        "Blood biomarker-based intensity adjustment",
        "Sleep quality integration",
        "Recovery status monitoring",
        "Stress-aware training modifications"
      ]
    },
    {
      "@type": "SoftwareApplication",
      "name": "Moccet Forge",
      "applicationCategory": "HealthApplication",
      "operatingSystem": "Web",
      "description": "AI-powered personalized fitness programming based on biomarkers, HRV, and recovery data",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock"
      },
      "provider": {
        "@type": "Organization",
        "name": "Moccet",
        "url": "https://moccet.ai"
      },
      "featureList": [
        "Training programs from blood biomarkers",
        "HRV-based training adaptation",
        "Recovery optimization",
        "Progressive overload customization",
        "Wearable integration"
      ]
    }
  ]
};

// FAQ Schema for Sage (invisible in UI, visible to search engines)
export const sageFAQSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How does Sage create personalized nutrition plans?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sage analyzes multiple data streams including blood biomarkers (glucose, lipids, hormones, inflammation markers), continuous glucose monitor (CGM) data, microbiome test results, and wearable device data. It uses this information to understand your individual metabolic response and creates nutrition plans tailored to how your body actually processes different foods, rather than using generic formulas based on weight and activity level."
      }
    },
    {
      "@type": "Question",
      "name": "What data does Sage need to create a nutrition plan?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sage can work with varying levels of data. At minimum, it needs basic metabolic panel results from blood work. For more precise recommendations, you can add CGM data for glucose patterns, microbiome test results for gut health insights, and wearable device data from Apple Health, Fitbit, Oura, or Garmin. More data leads to more personalized recommendations, but Sage works with whatever you have available."
      }
    },
    {
      "@type": "Question",
      "name": "How is Sage different from other nutrition apps like MyFitnessPal?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Traditional nutrition apps use standard formulas based on weight, height, age, and activity level to calculate macros. Sage uses your actual biological data - blood tests, CGM readings, microbiome composition - to understand how YOUR body responds to different foods. Two people can eat the same meal with completely different metabolic responses. Sage accounts for individual insulin sensitivity, gut microbiome composition, hormone levels, and activity patterns."
      }
    },
    {
      "@type": "Question",
      "name": "Is Sage based on scientific research?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, every recommendation in Sage traces to peer-reviewed research. When Sage recommends specific meal timing or food choices based on your metabolic data, it provides citations to the relevant studies. The system synthesizes findings from nutrition science, metabolic research, and microbiome studies to create evidence-based personalized recommendations."
      }
    },
    {
      "@type": "Question",
      "name": "Can Sage help with metabolic health and blood sugar control?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, Sage is particularly effective for metabolic health optimization. By analyzing your glucose patterns (especially if you use a CGM), blood biomarkers, and eating habits, Sage can recommend meal compositions and timing that minimize glucose spikes, improve insulin sensitivity, and support overall metabolic health. The recommendations are specific to your individual response patterns."
      }
    },
    {
      "@type": "Question",
      "name": "What wearable devices does Sage integrate with?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sage integrates with Apple Health, Fitbit, Oura Ring, Garmin, Whoop, and Strava. It can also connect to Dexcom for continuous glucose monitoring data. These integrations provide activity patterns, sleep data, heart rate information, and other metrics that help Sage understand your lifestyle and optimize meal timing and composition accordingly."
      }
    }
  ]
};

// FAQ Schema for Forge (invisible in UI, visible to search engines)
export const forgeFAQSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How does Forge personalize training programs?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Forge analyzes your blood biomarkers (hormones, inflammation markers, metabolic health), heart rate variability (HRV) patterns, sleep data, and recovery metrics to determine your current capacity for training stress. It then generates programs that match your body's actual state, adjusting intensity, volume, and frequency based on real data rather than generic templates."
      }
    },
    {
      "@type": "Question",
      "name": "What makes HRV-based training different from regular workout programs?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Traditional training programs follow fixed progressions regardless of your internal state. HRV-based training through Forge adapts based on real data - if your HRV is trending down (indicating accumulated stress or incomplete recovery), training intensity and volume adjust automatically. This prevents overtraining, optimizes recovery, and leads to better long-term results by working with your body's current capacity."
      }
    },
    {
      "@type": "Question",
      "name": "What data does Forge need to create a training program?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Forge works best with HRV data from wearables like Oura, Whoop, or Garmin, combined with sleep tracking data. For enhanced personalization, you can add blood test results showing hormone levels (testosterone, cortisol), inflammation markers, and metabolic health indicators. The more data you provide, the more precisely Forge can optimize your training."
      }
    },
    {
      "@type": "Question",
      "name": "How does Forge prevent overtraining?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Forge monitors recovery indicators including HRV trends, sleep quality, resting heart rate patterns, and if available, blood biomarkers like cortisol and testosterone. When these indicators suggest accumulated fatigue or incomplete recovery, Forge automatically adjusts your program - reducing volume, modifying intensity, or recommending additional recovery time before you experience symptoms of overtraining."
      }
    },
    {
      "@type": "Question",
      "name": "Can Forge adjust my training based on life stress and travel?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, Forge can integrate with your calendar to anticipate stressful periods and travel. When it detects upcoming high-stress events or travel, it proactively adjusts your training load. Additionally, your HRV and sleep data reflect life stress, so even without calendar integration, Forge adapts based on how stress is affecting your recovery capacity."
      }
    },
    {
      "@type": "Question",
      "name": "How is Forge different from apps like Strong or JEFIT?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Apps like Strong and JEFIT help you log workouts and follow pre-made programs. Forge creates the program itself based on your biomarkers and recovery data, then continuously adapts it based on how your body is actually responding. It's the difference between following a template and having a program that evolves with your biological state."
      }
    }
  ]
};

// HowTo Schema for Getting Started with Sage
export const sageHowToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Get Your Personalized Nutrition Plan from Moccet Sage",
  "description": "Step-by-step guide to creating your personalized nutrition plan based on metabolic data using Moccet Sage",
  "totalTime": "PT15M",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Upload Blood Work",
      "text": "Upload your recent blood test results (metabolic panel, lipid panel, hormones, etc.) by taking a photo or uploading a PDF. Sage can read results from most major labs.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Connect Wearables",
      "text": "Connect your wearable devices through Apple Health, Fitbit, Oura, Garmin, or Whoop to provide activity patterns, sleep data, and heart rate information.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Add Optional Health Data",
      "text": "For more precise recommendations, add CGM data from Dexcom, microbiome test results, or genetic data if available. Each additional data source improves personalization.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Complete Lifestyle Assessment",
      "text": "Answer questions about dietary preferences, cooking ability, time constraints, and food access so Sage can create practical, actionable recommendations.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Receive Your Plan",
      "text": "Get your personalized nutrition plan immediately, including meal plans with specific foods, timing protocols optimized for your glucose patterns, and supplement recommendations based on your actual deficiencies.",
      "position": 5
    }
  ]
};

// HowTo Schema for Getting Started with Forge
export const forgeHowToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Get Your Personalized Training Program from Moccet Forge",
  "description": "Step-by-step guide to creating your personalized fitness program based on biomarkers and recovery data using Moccet Forge",
  "totalTime": "PT15M",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Connect Wearables",
      "text": "Connect your wearable device through Apple Health, Oura, Whoop, Garmin, or Fitbit. HRV and sleep data are particularly valuable for training optimization.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Upload Blood Work (Optional)",
      "text": "For enhanced personalization, upload recent blood test results showing hormone levels (testosterone, cortisol), inflammation markers, and metabolic health indicators.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Share Training History",
      "text": "Answer questions about your training background, current fitness level, available equipment, and schedule constraints.",
      "position": 3
    },
    {
      "@type": "HowToStep",
      "name": "Define Your Goals",
      "text": "Specify your fitness objectives - strength, endurance, body composition, athletic performance - so Forge can optimize your program accordingly.",
      "position": 4
    },
    {
      "@type": "HowToStep",
      "name": "Receive Your Program",
      "text": "Get your personalized training program that adapts based on your recovery data. As Forge collects more data about your response to training, recommendations become increasingly precise.",
      "position": 5
    }
  ]
};

// Website Schema for homepage
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Moccet",
  "alternateName": "Moccet - Autonomous Health AI Platform",
  "url": "https://moccet.ai",
  "description": "Autonomous health AI platform with personalized nutrition, fitness, clinical workflows, family health coordination, and specialized health programs.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://moccet.ai/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

// Moccet Agent Schema - Core Platform AI
export const moccetAgentSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "The Moccet Agent",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "Web",
  "description": "Core AI agent that continuously monitors health data, surfaces actionable insights, and coordinates with specialized agents and human clinicians.",
  "provider": {
    "@type": "Organization",
    "name": "Moccet",
    "url": "https://moccet.ai"
  },
  "featureList": [
    "Continuous health monitoring across all connected sources",
    "Pattern recognition for early warning signs",
    "Natural language health Q&A using personal data",
    "Action orchestration (bookings, reminders, coordination)",
    "Seamless escalation to human clinicians"
  ]
};

// Moccet-Medic Schema - AI Health Agent
export const moccetMedicSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalWebPage",
      "name": "Moccet-Medic - AI Health Agent",
      "description": "AI health agent that conducts AI-to-AI physician consultations, enables early detection, and seamlessly escalates to human clinicians.",
      "specialty": {
        "@type": "MedicalSpecialty",
        "name": "Telemedicine"
      }
    },
    {
      "@type": "SoftwareApplication",
      "name": "Moccet-Medic",
      "applicationCategory": "HealthApplication",
      "operatingSystem": "Web",
      "description": "AI health agent with AI-to-AI physician consultations, early detection through pattern analysis, and human clinician escalation",
      "provider": {
        "@type": "Organization",
        "name": "Moccet",
        "url": "https://moccet.ai"
      },
      "featureList": [
        "Continuous health data aggregation",
        "AI-to-AI physician consultations",
        "Early detection through pattern analysis",
        "Structured health histories for provider visits",
        "Plain language translation of clinical concepts",
        "Seamless human clinician escalation"
      ]
    }
  ]
};

// Moccet Share Schema - Family Health Coordination
export const moccetShareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Moccet Share",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "Web",
  "description": "Family health coordination platform with shared health views, baseline-aware alerts, and fine-grained privacy controls for caregivers and families.",
  "provider": {
    "@type": "Organization",
    "name": "Moccet",
    "url": "https://moccet.ai"
  },
  "featureList": [
    "Shared health dashboards for family members",
    "Activity, sleep, nutrition, and vital pattern monitoring",
    "Baseline-aware alerts when patterns change",
    "Fine-grained privacy controls",
    "Coordinated multi-specialist views",
    "Proactive caregiver alerts"
  ]
};

// Moccet Connect Schema - Social Health Coordination
export const moccetConnectSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Moccet Connect",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "Web",
  "description": "Social health coordination that matches users for workouts and activities based on schedules, fitness levels, and health goals.",
  "provider": {
    "@type": "Organization",
    "name": "Moccet",
    "url": "https://moccet.ai"
  },
  "featureList": [
    "Workout buddy matching based on schedules and fitness levels",
    "Social activity coordination",
    "Integration with clinicians for mental health support",
    "Strict opt-in privacy controls",
    "Logistics coordination for activities"
  ]
};

// Surgical Key Schema - Peri-Operative Health
export const surgicalKeySchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalWebPage",
      "name": "Surgical Key - Peri-Operative Health",
      "description": "Peri-operative health optimization with surgery preparation, recovery monitoring, and care team coordination.",
      "specialty": {
        "@type": "MedicalSpecialty",
        "name": "Surgery"
      }
    },
    {
      "@type": "SoftwareApplication",
      "name": "Moccet Surgical Key",
      "applicationCategory": "HealthApplication",
      "operatingSystem": "Web",
      "description": "Peri-operative health platform for surgery preparation, recovery optimization, and care team coordination",
      "provider": {
        "@type": "Organization",
        "name": "Moccet",
        "url": "https://moccet.ai"
      },
      "featureList": [
        "Pre-surgery health optimization protocols",
        "Surgical readiness assessment based on biomarkers",
        "Recovery metric tracking",
        "Care team coordination",
        "Post-operative monitoring",
        "Early warning for recovery complications"
      ]
    }
  ]
};

// Flight Pass Schema - Travel Health Management
export const flightPassSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Moccet Flight Pass",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "Web",
  "description": "Travel health management with readiness assessment, jet lag protocols, and health optimization for flights and travel.",
  "provider": {
    "@type": "Organization",
    "name": "Moccet",
    "url": "https://moccet.ai"
  },
  "featureList": [
    "Travel readiness assessment",
    "Pre-flight health optimization",
    "Jet lag mitigation protocols",
    "Travel-adjusted routine recommendations",
    "Contextual health summaries for providers"
  ]
};

// Platform-wide FAQ Schema
export const platformFAQSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Moccet?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Moccet is an autonomous health AI platform that embeds AI agents into daily life, relationships, and clinical workflows. It combines continuous health monitoring, personalized AI recommendations, and deep clinical integration to deliver proactive, personalized care. Products include Sage (nutrition AI), Forge (fitness AI), Moccet-Medic (clinical AI), Share (family health), Connect (social health), Surgical Key (surgery preparation), and Flight Pass (travel health)."
      }
    },
    {
      "@type": "Question",
      "name": "How is Moccet different from other health apps?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Moccet uses actual biological data (blood tests, CGM, microbiome, HRV, wearables) with autonomous AI agents, rather than questionnaires or generic formulas. The platform models health as a dynamic system with continuous trajectory monitoring, enabling prevention and early intervention. It also integrates deeply with clinical workflows and human clinicians."
      }
    },
    {
      "@type": "Question",
      "name": "What data does Moccet integrate with?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Moccet integrates with Apple Health, Fitbit, Oura Ring, Garmin, Whoop, Strava, Dexcom CGM, blood test results, microbiome tests, calendar apps (Apple, Google, Outlook), and medical records where available. Each additional data source improves the precision of recommendations."
      }
    },
    {
      "@type": "Question",
      "name": "Is Moccet a medical device?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Moccet provides health insights and recommendations based on your data but is not a medical device. It does not diagnose, treat, or prevent disease. The platform is designed to work alongside healthcare providers, with seamless escalation to human clinicians when appropriate."
      }
    }
  ]
};

// Helper function to render schema as JSON-LD script tag content
export function getSchemaScript(schema: object): string {
  return JSON.stringify(schema);
}
