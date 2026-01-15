/**
 * Health Logging Tools
 * Tools for logging water intake, food, and weight data
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';
import { randomUUID } from 'crypto';

// =============================================================================
// WATER LOGGING TOOLS
// =============================================================================

// Log water intake
export const logWaterIntakeTool: ToolDefinition = {
  name: 'log_water_intake',
  description: `Log water intake for the user. Records the amount in milliliters.
    Use this when the user says things like "I drank water", "log 500ml water", etc.
    Returns the total water intake for today after logging.`,
  riskLevel: 'low',
  parameters: z.object({
    amount_ml: z.number().min(1).max(5000)
      .describe('Amount of water in milliliters (1-5000)'),
    timestamp: z.string().optional()
      .describe('Optional ISO timestamp. Defaults to now.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { amount_ml, timestamp } = params;
      const loggedAt = timestamp ? new Date(timestamp) : new Date();

      // Insert the water log
      const { data: logEntry, error: insertError } = await context.supabase
        .from('water_logs')
        .insert({
          id: randomUUID(),
          user_email: context.userEmail,
          amount_ml,
          logged_at: loggedAt.toISOString(),
          source: 'assistant',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Get today's total
      const today = new Date().toISOString().split('T')[0];
      const { data: todayTotal } = await context.supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_email', context.userEmail)
        .gte('logged_at', `${today}T00:00:00`)
        .lt('logged_at', `${today}T23:59:59`);

      const totalToday = todayTotal?.reduce((sum: number, log: any) => sum + log.amount_ml, 0) || amount_ml;

      // Get user's goal
      const { data: goal } = await context.supabase
        .from('water_goals')
        .select('daily_goal_ml')
        .eq('user_email', context.userEmail)
        .maybeSingle();

      const dailyGoal = goal?.daily_goal_ml || 2500;
      const progressPercent = Math.round((totalToday / dailyGoal) * 100);

      return {
        success: true,
        data: {
          logged: {
            amount_ml,
            timestamp: loggedAt.toISOString(),
          },
          today: {
            total_ml: totalToday,
            goal_ml: dailyGoal,
            progress_percent: progressPercent,
            remaining_ml: Math.max(0, dailyGoal - totalToday),
          },
        },
        metadata: {
          source: 'water_logging',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to log water: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Quick log water by glasses
export const quickLogWaterTool: ToolDefinition = {
  name: 'quick_log_water',
  description: `Quickly log water by number of glasses. 1 glass = 250ml.
    Use when user says "I drank 2 glasses of water" or "had a glass of water".`,
  riskLevel: 'low',
  parameters: z.object({
    glasses: z.number().min(1).max(20)
      .describe('Number of glasses (1 glass = 250ml)'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    const amount_ml = params.glasses * 250;
    // Delegate to the main water logging tool
    return logWaterIntakeTool.execute({ amount_ml }, context);
  },
};

// Get today's water intake
export const getWaterIntakeTool: ToolDefinition = {
  name: 'get_water_intake',
  description: `Get the user's water intake for today or a specific date.
    Returns total intake, goal, and progress.`,
  riskLevel: 'low',
  parameters: z.object({
    date: z.string().optional()
      .describe('Optional date (YYYY-MM-DD). Defaults to today.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const targetDate = params.date || new Date().toISOString().split('T')[0];

      // Get all logs for the date
      const { data: logs, error } = await context.supabase
        .from('water_logs')
        .select('*')
        .eq('user_email', context.userEmail)
        .gte('logged_at', `${targetDate}T00:00:00`)
        .lt('logged_at', `${targetDate}T23:59:59`)
        .order('logged_at', { ascending: true });

      if (error) throw error;

      // Get user's goal
      const { data: goal } = await context.supabase
        .from('water_goals')
        .select('*')
        .eq('user_email', context.userEmail)
        .maybeSingle();

      const dailyGoal = goal?.daily_goal_ml || 2500;
      const totalMl = logs?.reduce((sum: number, log: any) => sum + log.amount_ml, 0) || 0;
      const progressPercent = Math.round((totalMl / dailyGoal) * 100);

      return {
        success: true,
        data: {
          date: targetDate,
          total_ml: totalMl,
          goal_ml: dailyGoal,
          progress_percent: progressPercent,
          remaining_ml: Math.max(0, dailyGoal - totalMl),
          entries: logs?.length || 0,
          logs: logs?.map((log: any) => ({
            amount_ml: log.amount_ml,
            time: new Date(log.logged_at).toLocaleTimeString(),
          })),
        },
        metadata: {
          source: 'water_tracking',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get water intake: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Set water goal
export const setWaterGoalTool: ToolDefinition = {
  name: 'set_water_goal',
  description: `Set or update the user's daily water intake goal.
    Requires user confirmation as it changes their settings.`,
  riskLevel: 'medium',
  parameters: z.object({
    daily_goal_ml: z.number().min(500).max(10000)
      .describe('Daily water goal in milliliters (500-10000)'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { daily_goal_ml } = params;

      // Upsert the goal
      const { data, error } = await context.supabase
        .from('water_goals')
        .upsert({
          user_email: context.userEmail,
          daily_goal_ml,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_email',
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          daily_goal_ml,
          glasses_equivalent: Math.round(daily_goal_ml / 250),
          message: `Water goal set to ${daily_goal_ml}ml (${Math.round(daily_goal_ml / 250)} glasses) per day`,
        },
        metadata: {
          source: 'water_goals',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to set water goal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// =============================================================================
// FOOD LOGGING TOOLS
// =============================================================================

// Log food
export const logFoodTool: ToolDefinition = {
  name: 'log_food',
  description: `Log a food item the user ate. Records calories, macros, and meal type.
    Use when user says things like "I ate eggs for breakfast", "log my lunch - salad 400 calories".
    Meal types: breakfast, lunch, dinner, snack.`,
  riskLevel: 'low',
  parameters: z.object({
    name: z.string().min(1).max(200)
      .describe('Name of the food item'),
    calories: z.number().min(0).max(10000)
      .describe('Calories in the food'),
    protein: z.number().min(0).optional()
      .describe('Protein in grams'),
    carbs: z.number().min(0).optional()
      .describe('Carbohydrates in grams'),
    fat: z.number().min(0).optional()
      .describe('Fat in grams'),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional()
      .describe('Type of meal. Defaults to snack.'),
    servings: z.number().min(0.1).max(20).optional()
      .describe('Number of servings consumed. Defaults to 1.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const {
        name,
        calories,
        protein = 0,
        carbs = 0,
        fat = 0,
        meal_type = 'snack',
        servings = 1,
      } = params;

      // Insert the food log
      const { data: logEntry, error: insertError } = await context.supabase
        .from('sage_food_logs')
        .insert({
          id: randomUUID(),
          user_email: context.userEmail,
          name,
          calories: calories * servings,
          protein: protein * servings,
          carbs: carbs * servings,
          fat: fat * servings,
          meal_type,
          servings_consumed: servings,
          source: 'assistant',
          logged_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Get today's totals
      const today = new Date().toISOString().split('T')[0];
      const { data: todayLogs } = await context.supabase
        .from('sage_food_logs')
        .select('calories, protein, carbs, fat')
        .eq('user_email', context.userEmail)
        .gte('logged_at', `${today}T00:00:00`)
        .lt('logged_at', `${today}T23:59:59`);

      const totals = todayLogs?.reduce((acc: any, log: any) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fat: acc.fat + (log.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 }) || { calories: 0, protein: 0, carbs: 0, fat: 0 };

      return {
        success: true,
        data: {
          logged: {
            name,
            meal_type,
            calories: Math.round(calories * servings),
            protein: Math.round(protein * servings),
            carbs: Math.round(carbs * servings),
            fat: Math.round(fat * servings),
            servings,
          },
          today_totals: {
            calories: Math.round(totals.calories),
            protein: Math.round(totals.protein),
            carbs: Math.round(totals.carbs),
            fat: Math.round(totals.fat),
          },
        },
        metadata: {
          source: 'food_logging',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to log food: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get food log for a date
export const getFoodLogTool: ToolDefinition = {
  name: 'get_food_log',
  description: `Get the user's food log for today or a specific date range.
    Returns all logged foods with calories and macros.`,
  riskLevel: 'low',
  parameters: z.object({
    date: z.string().optional()
      .describe('Optional date (YYYY-MM-DD). Defaults to today.'),
    days: z.number().min(1).max(30).optional()
      .describe('Number of days to look back. Defaults to 1 (just the date).'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const targetDate = params.date || new Date().toISOString().split('T')[0];
      const days = params.days || 1;

      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - days + 1);

      const { data: logs, error } = await context.supabase
        .from('sage_food_logs')
        .select('*')
        .eq('user_email', context.userEmail)
        .gte('logged_at', startDate.toISOString())
        .lte('logged_at', `${targetDate}T23:59:59`)
        .order('logged_at', { ascending: false });

      if (error) throw error;

      // Group by date
      const byDate: Record<string, any[]> = {};
      logs?.forEach((log: any) => {
        const date = new Date(log.logged_at).toISOString().split('T')[0];
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(log);
      });

      // Calculate totals per date
      const summaryByDate = Object.entries(byDate).map(([date, dateLogs]) => {
        const totals = dateLogs.reduce((acc, log) => ({
          calories: acc.calories + (log.calories || 0),
          protein: acc.protein + (log.protein || 0),
          carbs: acc.carbs + (log.carbs || 0),
          fat: acc.fat + (log.fat || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        return {
          date,
          entry_count: dateLogs.length,
          totals: {
            calories: Math.round(totals.calories),
            protein: Math.round(totals.protein),
            carbs: Math.round(totals.carbs),
            fat: Math.round(totals.fat),
          },
          meals: {
            breakfast: dateLogs.filter(l => l.meal_type === 'breakfast'),
            lunch: dateLogs.filter(l => l.meal_type === 'lunch'),
            dinner: dateLogs.filter(l => l.meal_type === 'dinner'),
            snack: dateLogs.filter(l => l.meal_type === 'snack'),
          },
        };
      });

      return {
        success: true,
        data: {
          date_range: { from: startDate.toISOString().split('T')[0], to: targetDate },
          total_entries: logs?.length || 0,
          summary_by_date: summaryByDate,
        },
        metadata: {
          source: 'food_log',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get food log: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// =============================================================================
// WEIGHT LOGGING TOOLS
// =============================================================================

// Log weight
export const logWeightTool: ToolDefinition = {
  name: 'log_weight',
  description: `Log the user's weight. Can also record body fat percentage and notes.
    Use when user says "I weigh 75kg", "my weight is 165 lbs", etc.`,
  riskLevel: 'low',
  parameters: z.object({
    weight_kg: z.number().min(20).max(300)
      .describe('Weight in kilograms'),
    body_fat_percent: z.number().min(1).max(70).optional()
      .describe('Body fat percentage if known'),
    notes: z.string().max(500).optional()
      .describe('Optional notes about the weigh-in'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { weight_kg, body_fat_percent, notes } = params;

      // Get user's height for BMI calculation
      const { data: goalData } = await context.supabase
        .from('weight_goals')
        .select('height_cm, goal_weight_kg')
        .eq('user_email', context.userEmail)
        .maybeSingle();

      // Calculate BMI if height is available
      let bmi = null;
      if (goalData?.height_cm) {
        const heightM = goalData.height_cm / 100;
        bmi = Math.round((weight_kg / (heightM * heightM)) * 10) / 10;
      }

      // Insert the weight log
      const { data: logEntry, error: insertError } = await context.supabase
        .from('weight_logs')
        .insert({
          id: randomUUID(),
          user_email: context.userEmail,
          weight_kg,
          body_fat_percent,
          notes,
          bmi,
          source: 'assistant',
          logged_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Get weight history for trend
      const { data: history } = await context.supabase
        .from('weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_email', context.userEmail)
        .order('logged_at', { ascending: false })
        .limit(10);

      // Calculate change from last entry
      let change = null;
      if (history && history.length > 1) {
        change = Math.round((weight_kg - history[1].weight_kg) * 100) / 100;
      }

      // Calculate progress to goal
      let goalProgress = null;
      if (goalData?.goal_weight_kg) {
        const startWeight = history?.[history.length - 1]?.weight_kg || weight_kg;
        const totalChange = Math.abs(startWeight - goalData.goal_weight_kg);
        const currentProgress = Math.abs(startWeight - weight_kg);
        goalProgress = {
          goal_kg: goalData.goal_weight_kg,
          remaining_kg: Math.round(Math.abs(weight_kg - goalData.goal_weight_kg) * 10) / 10,
          progress_percent: Math.round((currentProgress / totalChange) * 100),
        };
      }

      return {
        success: true,
        data: {
          logged: {
            weight_kg,
            body_fat_percent,
            bmi,
            notes,
          },
          change_from_last: change,
          goal_progress: goalProgress,
        },
        metadata: {
          source: 'weight_logging',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to log weight: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get weight history
export const getWeightHistoryTool: ToolDefinition = {
  name: 'get_weight_history',
  description: `Get the user's weight history and trend over time.
    Shows progress toward goal if one is set.`,
  riskLevel: 'low',
  parameters: z.object({
    days: z.number().min(7).max(365).optional()
      .describe('Number of days of history. Defaults to 30.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const days = params.days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: logs, error } = await context.supabase
        .from('weight_logs')
        .select('*')
        .eq('user_email', context.userEmail)
        .gte('logged_at', startDate.toISOString())
        .order('logged_at', { ascending: true });

      if (error) throw error;

      // Get goal
      const { data: goal } = await context.supabase
        .from('weight_goals')
        .select('*')
        .eq('user_email', context.userEmail)
        .maybeSingle();

      // Calculate stats
      const weights = logs?.map((l: any) => l.weight_kg) || [];
      const stats = weights.length > 0 ? {
        current: weights[weights.length - 1],
        lowest: Math.min(...weights),
        highest: Math.max(...weights),
        average: Math.round((weights.reduce((a: number, b: number) => a + b, 0) / weights.length) * 10) / 10,
        change: Math.round((weights[weights.length - 1] - weights[0]) * 100) / 100,
      } : null;

      return {
        success: true,
        data: {
          period_days: days,
          entry_count: logs?.length || 0,
          stats,
          goal: goal ? {
            target_kg: goal.goal_weight_kg,
            remaining_kg: stats ? Math.round(Math.abs(stats.current - goal.goal_weight_kg) * 10) / 10 : null,
          } : null,
          entries: logs?.map((l: any) => ({
            date: new Date(l.logged_at).toISOString().split('T')[0],
            weight_kg: l.weight_kg,
            bmi: l.bmi,
            body_fat_percent: l.body_fat_percent,
          })),
        },
        metadata: {
          source: 'weight_history',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get weight history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Set weight goal
export const setWeightGoalTool: ToolDefinition = {
  name: 'set_weight_goal',
  description: `Set or update the user's weight goal. Can also set height for BMI calculation.
    Requires user confirmation as it changes their settings.`,
  riskLevel: 'medium',
  parameters: z.object({
    goal_weight_kg: z.number().min(30).max(250)
      .describe('Target weight in kilograms'),
    height_cm: z.number().min(100).max(250).optional()
      .describe('Height in centimeters (for BMI calculation)'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { goal_weight_kg, height_cm } = params;

      // Get current weight
      const { data: currentWeight } = await context.supabase
        .from('weight_logs')
        .select('weight_kg')
        .eq('user_email', context.userEmail)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Upsert the goal
      const updateData: any = {
        user_email: context.userEmail,
        goal_weight_kg,
        updated_at: new Date().toISOString(),
      };
      if (height_cm) updateData.height_cm = height_cm;

      const { error } = await context.supabase
        .from('weight_goals')
        .upsert(updateData, {
          onConflict: 'user_email',
        });

      if (error) throw error;

      // Calculate target BMI if height is available
      let targetBmi = null;
      if (height_cm) {
        const heightM = height_cm / 100;
        targetBmi = Math.round((goal_weight_kg / (heightM * heightM)) * 10) / 10;
      }

      const weightDiff = currentWeight
        ? Math.round((currentWeight.weight_kg - goal_weight_kg) * 10) / 10
        : null;

      return {
        success: true,
        data: {
          goal_weight_kg,
          height_cm,
          target_bmi: targetBmi,
          current_weight: currentWeight?.weight_kg,
          weight_to_lose: weightDiff && weightDiff > 0 ? weightDiff : null,
          weight_to_gain: weightDiff && weightDiff < 0 ? Math.abs(weightDiff) : null,
        },
        metadata: {
          source: 'weight_goals',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to set weight goal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Export all health logging tools
export const healthLoggingTools = [
  logWaterIntakeTool,
  quickLogWaterTool,
  getWaterIntakeTool,
  setWaterGoalTool,
  logFoodTool,
  getFoodLogTool,
  logWeightTool,
  getWeightHistoryTool,
  setWeightGoalTool,
];
