/**
 * Supplement Tools
 * Tools for supplement recommendations and analysis
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';

// Supplement database (in production, this would be a real database or API)
const SUPPLEMENT_DATABASE = [
  {
    id: 'supp_vitd3_thorne',
    name: 'Thorne Vitamin D3',
    brand: 'Thorne',
    category: 'vitamin_d',
    dosage: '1000 IU',
    form: 'liquid',
    price: 24.99,
    rating: 4.8,
    forDeficiencies: ['vitamin_d', '25-hydroxyvitamin_d'],
    description: 'High-quality vitamin D3 in liquid form for optimal absorption',
    url: 'https://www.thorne.com/products/dp/vitamin-d-liquid',
  },
  {
    id: 'supp_vitd3_nordic',
    name: 'Nordic Naturals Vitamin D3',
    brand: 'Nordic Naturals',
    category: 'vitamin_d',
    dosage: '1000 IU',
    form: 'softgel',
    price: 19.95,
    rating: 4.7,
    forDeficiencies: ['vitamin_d', '25-hydroxyvitamin_d'],
    description: 'Vitamin D3 in olive oil for better absorption',
    url: 'https://www.nordicnaturals.com/consumers/vitamin-d3',
  },
  {
    id: 'supp_b12_jarrow',
    name: 'Jarrow Formulas Methyl B-12',
    brand: 'Jarrow Formulas',
    category: 'vitamin_b12',
    dosage: '1000 mcg',
    form: 'lozenge',
    price: 12.99,
    rating: 4.6,
    forDeficiencies: ['vitamin_b12', 'b12'],
    description: 'Methylcobalamin form for optimal bioavailability',
    url: 'https://jarrow.com/products/methyl-b-12',
  },
  {
    id: 'supp_iron_thorne',
    name: 'Thorne Iron Bisglycinate',
    brand: 'Thorne',
    category: 'iron',
    dosage: '25 mg',
    form: 'capsule',
    price: 21.00,
    rating: 4.5,
    forDeficiencies: ['iron', 'ferritin', 'hemoglobin'],
    description: 'Gentle iron supplement that is easy on the stomach',
    url: 'https://www.thorne.com/products/dp/iron-bisglycinate',
  },
  {
    id: 'supp_mag_glycinate',
    name: 'Pure Encapsulations Magnesium Glycinate',
    brand: 'Pure Encapsulations',
    category: 'magnesium',
    dosage: '120 mg',
    form: 'capsule',
    price: 32.50,
    rating: 4.8,
    forDeficiencies: ['magnesium'],
    description: 'Highly absorbable magnesium for sleep and muscle relaxation',
    url: 'https://www.pureencapsulations.com/magnesium-glycinate',
  },
  {
    id: 'supp_zinc_thorne',
    name: 'Thorne Zinc Picolinate',
    brand: 'Thorne',
    category: 'zinc',
    dosage: '30 mg',
    form: 'capsule',
    price: 18.00,
    rating: 4.7,
    forDeficiencies: ['zinc'],
    description: 'Well-absorbed zinc for immune support',
    url: 'https://www.thorne.com/products/dp/zinc-picolinate',
  },
  {
    id: 'supp_omega3_nordic',
    name: 'Nordic Naturals Ultimate Omega',
    brand: 'Nordic Naturals',
    category: 'omega3',
    dosage: '1280 mg',
    form: 'softgel',
    price: 54.95,
    rating: 4.9,
    forDeficiencies: ['omega3', 'fatty_acids'],
    description: 'High-concentration omega-3 fish oil',
    url: 'https://www.nordicnaturals.com/consumers/ultimate-omega',
  },
];

// Search supplements database
export const searchSupplementsTool: ToolDefinition = {
  name: 'search_supplements',
  description: `Search for supplements based on deficiencies, categories, or specific criteria.
    Use this after analyzing biomarkers to find appropriate supplements.`,
  riskLevel: 'low',
  parameters: z.object({
    deficiency: z.string().optional()
      .describe('Deficiency to address (e.g., "vitamin_d", "iron", "magnesium")'),
    category: z.string().optional()
      .describe('Supplement category'),
    maxPrice: z.number().optional()
      .describe('Maximum price filter'),
    minRating: z.number().min(0).max(5).optional()
      .describe('Minimum rating filter'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { deficiency, category, maxPrice, minRating } = params;

      let results = [...SUPPLEMENT_DATABASE];

      // Filter by deficiency
      if (deficiency) {
        const normalizedDeficiency = deficiency.toLowerCase().replace(/[^a-z0-9]/g, '_');
        results = results.filter(
          (s) =>
            s.forDeficiencies.some((d) =>
              d.toLowerCase().includes(normalizedDeficiency) ||
              normalizedDeficiency.includes(d.toLowerCase())
            ) ||
            s.category.includes(normalizedDeficiency)
        );
      }

      // Filter by category
      if (category) {
        results = results.filter((s) =>
          s.category.toLowerCase().includes(category.toLowerCase())
        );
      }

      // Filter by price
      if (maxPrice !== undefined) {
        results = results.filter((s) => s.price <= maxPrice);
      }

      // Filter by rating
      if (minRating !== undefined) {
        results = results.filter((s) => s.rating >= minRating);
      }

      // Sort by rating
      results.sort((a, b) => b.rating - a.rating);

      return {
        success: true,
        data: {
          supplements: results,
          totalFound: results.length,
          searchCriteria: {
            deficiency,
            category,
            maxPrice,
            minRating,
          },
        },
        metadata: {
          source: 'supplement_database',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search supplements: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get personalized supplement recommendations
export const getSupplementRecommendationsTool: ToolDefinition = {
  name: 'get_supplement_recommendations',
  description: `Get personalized supplement recommendations based on user's biomarkers and deficiencies.
    This analyzes the user's health data and recommends appropriate supplements.`,
  riskLevel: 'low',
  parameters: z.object({
    deficiencies: z.array(z.object({
      name: z.string(),
      severity: z.enum(['mild', 'moderate', 'severe']),
    })).optional().describe('Known deficiencies from biomarker analysis'),
    healthGoals: z.array(z.string()).optional()
      .describe('User health goals (e.g., "better_sleep", "more_energy", "immune_support")'),
    budget: z.enum(['low', 'medium', 'high']).optional()
      .describe('Budget preference'),
    existingSupplements: z.array(z.string()).optional()
      .describe('Supplements user is already taking'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { deficiencies, healthGoals, budget, existingSupplements = [] } = params;

      const recommendations: any[] = [];
      const maxPrice = budget === 'low' ? 25 : budget === 'medium' ? 50 : 100;

      // If no deficiencies provided, fetch from stored analysis
      let deficiencyList = deficiencies || [];
      if (deficiencyList.length === 0) {
        const { data: bloodData } = await context.supabase
          .from('blood_analysis_results')
          .select('analysis')
          .eq('user_email', context.userEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (bloodData?.analysis?.biomarkers) {
          deficiencyList = bloodData.analysis.biomarkers
            .filter((b: any) => b.status === 'low' || b.status === 'deficient')
            .map((b: any) => ({
              name: b.name,
              severity: b.status === 'deficient' ? 'severe' : 'moderate',
            }));
        }
      }

      // Find supplements for each deficiency
      for (const deficiency of deficiencyList) {
        const normalizedName = deficiency.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

        const matching = SUPPLEMENT_DATABASE.filter(
          (s) =>
            s.price <= maxPrice &&
            !existingSupplements.some(
              (es) => s.name.toLowerCase().includes(es.toLowerCase())
            ) &&
            (s.forDeficiencies.some((d) =>
              d.toLowerCase().includes(normalizedName) ||
              normalizedName.includes(d.toLowerCase())
            ) ||
              s.category.includes(normalizedName))
        ).sort((a, b) => b.rating - a.rating);

        if (matching.length > 0) {
          recommendations.push({
            forDeficiency: deficiency.name,
            severity: deficiency.severity,
            recommended: matching[0],
            alternatives: matching.slice(1, 3),
            priority: deficiency.severity === 'severe' ? 'high' : 'medium',
          });
        }
      }

      // Sort by priority
      recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] -
               priorityOrder[b.priority as keyof typeof priorityOrder];
      });

      return {
        success: true,
        data: {
          recommendations,
          totalRecommended: recommendations.length,
          estimatedMonthlyCost: recommendations.reduce(
            (sum, r) => sum + r.recommended.price,
            0
          ),
          notes: [
            'Consult with a healthcare provider before starting new supplements',
            'Start with one supplement at a time to monitor effects',
          ],
        },
        metadata: {
          source: 'supplement_recommendation_engine',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

export const supplementTools = [
  searchSupplementsTool,
  getSupplementRecommendationsTool,
];
