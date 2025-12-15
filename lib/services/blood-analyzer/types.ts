/**
 * Blood Analyzer Types
 * Multi-agent system for comprehensive blood test analysis
 */

export type BiomarkerStatus = 'optimal' | 'normal' | 'borderline' | 'high' | 'low' | 'critical';

export interface Biomarker {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: BiomarkerStatus;
  category: string;
  significance: string;
  implications: string;
}

export interface CategoryConfig {
  name: string;
  expectedMarkers: string[];
  minExpected: number;
}

export interface BatchConfig {
  name: string;
  categories: string[];
  model: 'gpt-4o-mini' | 'gpt-4o';
}

export interface CategoryExtractionResult {
  category: string;
  biomarkers: Biomarker[];
  rawCount: number;
}

export interface BatchExtractionResult {
  batchName: string;
  categories: string[];
  biomarkers: Biomarker[];
  rawCount: number;
  processingTimeMs: number;
}

export interface ValidationResult {
  biomarkers: Biomarker[];
  duplicatesRemoved: number;
  confidence: number;
}

export interface Recommendations {
  lifestyle: string[];
  dietary: string[];
  supplements: string[];
  followUp: string[];
}

export interface BloodAnalysisResult {
  summary: string;
  biomarkers: Biomarker[];
  totalCount: number;
  concerns: string[];
  positives: string[];
  recommendations: Recommendations;
  confidence: number;
  processingTimeMs: number;
  batchResults?: BatchExtractionResult[];
}

export interface AnalysisJobPayload {
  fileUrl: string;
  email: string;
  fileName?: string;
}

export interface AnalysisJobResult {
  success: boolean;
  biomarkerCount: number;
  message?: string;
  error?: string;
}

// Category configurations for extraction
export const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  blood_count: {
    name: 'Full Blood Count',
    expectedMarkers: [
      'Haemoglobin', 'Haematocrit', 'MCH', 'MCHC', 'MCV',
      'RBC Count', 'Red Cell Count', 'WBC Count', 'White Cell Count',
      'Neutrophils', 'Lymphocytes', 'Monocytes', 'Eosinophils', 'Basophils',
      'Platelets', 'MPV', 'RDW', 'Red Cell Distribution Width'
    ],
    minExpected: 10
  },
  iron_status: {
    name: 'Iron Status',
    expectedMarkers: [
      'Iron', 'Serum Iron', 'Ferritin', 'TIBC', 'Total Iron Binding Capacity',
      'Transferrin', 'Transferrin Saturation', 'UIBC'
    ],
    minExpected: 4
  },
  lipid_heart: {
    name: 'Heart Health / Lipids',
    expectedMarkers: [
      'Total Cholesterol', 'LDL Cholesterol', 'LDL', 'HDL Cholesterol', 'HDL',
      'Triglycerides', 'Apolipoprotein A-I', 'Apolipoprotein B', 'Apo A', 'Apo B',
      'Lipoprotein(a)', 'Lp(a)', 'hsCRP', 'hs-CRP', 'High Sensitivity CRP',
      'Small Dense LDL', 'Non-HDL Cholesterol', 'Cholesterol Ratio',
      'TC:HDL Ratio', 'LDL:HDL Ratio', 'VLDL', 'Remnant Cholesterol'
    ],
    minExpected: 6
  },
  metabolic: {
    name: 'Metabolic / Diabetes',
    expectedMarkers: [
      'Glucose', 'Fasting Glucose', 'Random Glucose', 'HbA1c', 'Glycated Haemoglobin',
      'Insulin', 'Fasting Insulin', 'C-peptide', 'HOMA-IR', 'HOMA-B',
      'Fructosamine', 'Average Blood Glucose'
    ],
    minExpected: 3
  },
  kidney: {
    name: 'Kidney Health',
    expectedMarkers: [
      'Creatinine', 'eGFR', 'Estimated GFR', 'Urea', 'Blood Urea Nitrogen', 'BUN',
      'Uric Acid', 'Sodium', 'Potassium', 'Chloride', 'Phosphate', 'Phosphorus',
      'Magnesium', 'Calcium', 'Bicarbonate', 'CO2', 'Anion Gap',
      'Cystatin C', 'Microalbumin', 'Albumin:Creatinine Ratio', 'ACR'
    ],
    minExpected: 5
  },
  liver: {
    name: 'Liver Health',
    expectedMarkers: [
      'ALT', 'Alanine Aminotransferase', 'SGPT',
      'AST', 'Aspartate Aminotransferase', 'SGOT',
      'ALP', 'Alkaline Phosphatase',
      'GGT', 'Gamma GT', 'Gamma-Glutamyl Transferase',
      'Bilirubin', 'Total Bilirubin', 'Direct Bilirubin', 'Indirect Bilirubin',
      'Albumin', 'Globulin', 'Total Protein', 'A:G Ratio'
    ],
    minExpected: 5
  },
  thyroid: {
    name: 'Thyroid Health',
    expectedMarkers: [
      'TSH', 'Thyroid Stimulating Hormone',
      'Free T4', 'FT4', 'Thyroxine',
      'Free T3', 'FT3', 'Triiodothyronine',
      'Total T4', 'Total T3',
      'Anti-TPO', 'Thyroid Peroxidase Antibodies', 'TPO Antibodies',
      'Anti-Tg', 'Thyroglobulin Antibodies', 'TgAb',
      'Reverse T3', 'rT3'
    ],
    minExpected: 2
  },
  hormones: {
    name: 'Hormonal Health',
    expectedMarkers: [
      'Testosterone', 'Total Testosterone', 'Free Testosterone',
      'SHBG', 'Sex Hormone Binding Globulin',
      'Free Androgen Index', 'FAI',
      'Cortisol', 'Morning Cortisol',
      'DHEA', 'DHEA-S', 'DHEA Sulphate',
      'Oestradiol', 'Estradiol', 'E2',
      'Progesterone', 'LH', 'FSH', 'Prolactin',
      'IGF-1', 'Growth Hormone'
    ],
    minExpected: 2
  },
  nutrients: {
    name: 'Nutritional Health',
    expectedMarkers: [
      'Vitamin D', '25-OH Vitamin D', 'Vitamin D3',
      'Vitamin B12', 'Cobalamin', 'Active B12', 'Holotranscobalamin',
      'Folate', 'Folic Acid', 'Red Cell Folate', 'Serum Folate',
      'Calcium', 'Magnesium', 'Zinc', 'Selenium', 'Copper',
      'Vitamin B6', 'Vitamin B1', 'Thiamine',
      'Vitamin A', 'Vitamin E', 'Vitamin K',
      'Omega-3 Index', 'EPA', 'DHA'
    ],
    minExpected: 3
  },
  inflammation: {
    name: 'Infection & Inflammation',
    expectedMarkers: [
      'CRP', 'C-Reactive Protein', 'hs-CRP',
      'ESR', 'Erythrocyte Sedimentation Rate',
      'IgA', 'Immunoglobulin A',
      'IgG', 'Immunoglobulin G',
      'IgM', 'Immunoglobulin M',
      'IgE', 'Immunoglobulin E',
      'C3', 'Complement C3',
      'C4', 'Complement C4',
      'RF', 'Rheumatoid Factor',
      'ANA', 'Antinuclear Antibodies',
      'Homocysteine', 'Fibrinogen'
    ],
    minExpected: 2
  },
  urinalysis: {
    name: 'Urinalysis',
    expectedMarkers: [
      'pH', 'Urine pH',
      'Specific Gravity',
      'Protein', 'Urine Protein',
      'Glucose', 'Urine Glucose',
      'Ketones', 'Urine Ketones',
      'Blood', 'Urine Blood', 'Haematuria',
      'Bilirubin', 'Urine Bilirubin',
      'Urobilinogen',
      'Nitrite', 'Leukocyte Esterase',
      'WBC', 'RBC', 'Epithelial Cells', 'Casts', 'Crystals', 'Bacteria'
    ],
    minExpected: 4
  },
  other: {
    name: 'Other Tests',
    expectedMarkers: [
      'PSA', 'Prostate Specific Antigen', 'Free PSA',
      'H.pylori', 'Helicobacter pylori',
      'Coeliac', 'tTG-IgA', 'Tissue Transglutaminase',
      'Pancreatic Amylase', 'Amylase', 'Lipase',
      'LDH', 'Lactate Dehydrogenase',
      'CK', 'Creatine Kinase', 'CPK',
      'Troponin', 'BNP', 'NT-proBNP',
      'D-Dimer', 'PT', 'INR', 'aPTT',
      'Blood Type', 'Rh Factor'
    ],
    minExpected: 0
  }
};

// Batch configurations for cost-efficient extraction
export const BATCH_CONFIGS: BatchConfig[] = [
  {
    name: 'Blood & Kidney',
    categories: ['blood_count', 'iron_status', 'kidney'],
    model: 'gpt-4o-mini'
  },
  {
    name: 'Cardiovascular & Metabolic',
    categories: ['lipid_heart', 'metabolic', 'liver'],
    model: 'gpt-4o-mini'
  },
  {
    name: 'Endocrine & Nutrition',
    categories: ['thyroid', 'hormones', 'nutrients'],
    model: 'gpt-4o-mini'
  },
  {
    name: 'Immune & Other',
    categories: ['inflammation', 'urinalysis', 'other'],
    model: 'gpt-4o-mini'
  }
];

// Final analysis uses GPT-4o for quality
export const ANALYSIS_MODEL = 'gpt-4o' as const;
