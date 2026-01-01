/**
 * Zod Validation Schemas
 *
 * Centralized validation schemas for API requests.
 * Provides type-safe validation with detailed error messages.
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email format');

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Pagination parameters schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'startDate must be before or equal to endDate' }
);

// ============================================================================
// INSIGHT SCHEMAS
// ============================================================================

/**
 * Insight severity levels
 */
export const insightSeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);

/**
 * Insight request schema (GET /api/user/insights)
 */
export const insightRequestSchema = z.object({
  email: emailSchema,
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  // Severity can be comma-separated (e.g., "critical,high")
  severity: z.string().max(100).optional(),
  type: z.string().max(100).optional(),
  unread_only: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional()
    .default(false),
  // Pagination
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

/**
 * Create insight request schema (POST /api/user/insights)
 */
export const createInsightRequestSchema = z.object({
  email: emailSchema,
  forceRefresh: z.boolean().optional().default(false),
});

/**
 * Update insight status schema (for API with ID in body)
 */
export const updateInsightStatusSchema = z.object({
  insight_id: uuidSchema,
  viewed: z.boolean().optional(),
  dismissed: z.boolean().optional(),
  acted_on: z.boolean().optional(),
});

/**
 * Patch insight schema (for PATCH /api/user/insights/:id)
 */
export const patchInsightSchema = z.object({
  viewed: z.boolean().optional(),
  dismissed: z.boolean().optional(),
  acted_on: z.boolean().optional(),
  action_taken: z.string().max(500).optional(),
}).refine(
  (data) => data.viewed !== undefined || data.dismissed !== undefined || data.acted_on !== undefined,
  { message: 'At least one of viewed, dismissed, or acted_on must be provided' }
);

// ============================================================================
// INTERVENTION SCHEMAS
// ============================================================================

/**
 * Intervention status
 */
export const interventionStatusSchema = z.enum([
  'SUGGESTED',
  'ONGOING',
  'COMPLETED',
  'ABANDONED',
]);

/**
 * Create intervention schema
 */
export const createInterventionSchema = z.object({
  email: emailSchema,
  insight_id: uuidSchema,
  intervention_type: z.string().min(1).max(100),
  tracked_metric: z.string().min(1).max(50),
  expected_outcome: z.string().max(500).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
});

/**
 * Update intervention schema
 */
export const updateInterventionSchema = z.object({
  experiment_id: uuidSchema,
  status: interventionStatusSchema.optional(),
  result_value: z.number().optional(),
  user_feedback: z.string().max(1000).optional(),
});

// ============================================================================
// FEEDBACK SCHEMAS
// ============================================================================

/**
 * Insight feedback schema
 */
export const feedbackSchema = z.object({
  insight_id: uuidSchema,
  feedback_text: z.string().min(1).max(2000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  helpful: z.boolean().optional(),
});

// ============================================================================
// GOAL SCHEMAS
// ============================================================================

/**
 * Goal status
 */
export const goalStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']);

/**
 * Create goal schema
 */
export const createGoalSchema = z.object({
  email: emailSchema,
  goal_type: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  target_date: z.coerce.date().optional(),
});

/**
 * Update goal schema
 */
export const updateGoalSchema = z.object({
  goal_id: uuidSchema,
  description: z.string().min(1).max(500).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  target_date: z.coerce.date().optional(),
  status: goalStatusSchema.optional(),
});

// ============================================================================
// SYNC SCHEMAS
// ============================================================================

/**
 * Sync request schema (POST /api/mcp/sync)
 */
export const syncRequestSchema = z.object({
  email: emailSchema,
  forceSync: z.boolean().optional().default(false),
  providers: z.array(z.string().min(1).max(50)).optional(),
});

/**
 * Sync status query schema (GET /api/mcp/sync)
 */
export const syncStatusQuerySchema = z.object({
  email: emailSchema,
  action: z.enum(['status', 'recommendations']).optional().default('status'),
});

// ============================================================================
// DEVICE TOKEN SCHEMAS
// ============================================================================

/**
 * Platform types for device tokens
 */
export const platformSchema = z.enum(['ios', 'android']);

/**
 * Push notification provider types
 */
export const pushProviderSchema = z.enum(['fcm', 'onesignal']);

/**
 * Register device token schema (POST /api/user/device-token)
 */
export const registerDeviceTokenSchema = z.object({
  email: emailSchema,
  device_token: z.string().min(10).max(500),
  platform: platformSchema,
  provider: pushProviderSchema.optional().default('fcm'),
});

/**
 * Unregister device token schema (DELETE /api/user/device-token)
 */
export const unregisterDeviceTokenSchema = z.object({
  email: emailSchema,
  device_token: z.string().min(10).max(500),
});

/**
 * Device token query schema (GET /api/user/device-token)
 */
export const deviceTokenQuerySchema = z.object({
  email: emailSchema,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate request body against a schema
 *
 * @example
 * ```ts
 * const result = validateBody(body, insightRequestSchema);
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * const { email, limit } = result.data;
 * ```
 */
export function validateBody<T extends z.ZodTypeAny>(
  body: unknown,
  schema: T
): z.SafeParseReturnType<z.input<T>, z.output<T>> {
  return schema.safeParse(body);
}

/**
 * Validate query parameters against a schema
 */
export function validateQuery<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): z.SafeParseReturnType<z.input<T>, z.output<T>> {
  const query = Object.fromEntries(searchParams);
  return schema.safeParse(query);
}

/**
 * Format Zod errors for API response
 */
export function formatZodError(error: z.ZodError): {
  error: string;
  details: Record<string, string[]>;
} {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return {
    error: 'Validation failed',
    details,
  };
}

/**
 * Create a validation middleware for API routes
 *
 * @example
 * ```ts
 * const validate = createValidator(insightRequestSchema);
 *
 * export async function POST(request: NextRequest) {
 *   const { data, error, response } = await validate(request);
 *   if (error) return response;
 *
 *   // data is typed and validated
 *   const { email, limit } = data;
 *   // ...
 * }
 * ```
 */
export function createValidator<T extends z.ZodTypeAny>(schema: T) {
  return async (
    request: Request
  ): Promise<
    | { data: z.output<T>; error: null; response: null }
    | { data: null; error: z.ZodError; response: Response }
  > => {
    try {
      const body = await request.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        const { NextResponse } = await import('next/server');
        return {
          data: null,
          error: result.error,
          response: NextResponse.json(formatZodError(result.error), { status: 400 }),
        };
      }

      return { data: result.data, error: null, response: null };
    } catch {
      const { NextResponse } = await import('next/server');
      return {
        data: null,
        error: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: 'Invalid JSON body',
          },
        ]),
        response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
      };
    }
  };
}
