/**
 * Validation Schemas
 *
 * Export all validation schemas and utilities
 */

export {
  // Common schemas
  emailSchema,
  uuidSchema,
  paginationSchema,
  dateRangeSchema,

  // Insight schemas
  insightSeveritySchema,
  insightRequestSchema,
  createInsightRequestSchema,
  updateInsightStatusSchema,

  // Intervention schemas
  interventionStatusSchema,
  createInterventionSchema,
  updateInterventionSchema,

  // Feedback schemas
  feedbackSchema,

  // Goal schemas
  goalStatusSchema,
  createGoalSchema,
  updateGoalSchema,

  // Sync schemas
  syncRequestSchema,

  // Utilities
  validateBody,
  validateQuery,
  formatZodError,
  createValidator,
} from './schemas';
