// Shared in-memory storage for development mode
// This allows data to be shared between API routes
// Using global to persist across hot reloads in development

declare global {
  var devOnboardingStorage: Map<string, unknown> | undefined;
  var devPlanStorage: Map<string, unknown> | undefined;
}

export const devOnboardingStorage = global.devOnboardingStorage || new Map<string, unknown>();
export const devPlanStorage = global.devPlanStorage || new Map<string, unknown>();

if (process.env.NODE_ENV !== 'production') {
  global.devOnboardingStorage = devOnboardingStorage;
  global.devPlanStorage = devPlanStorage;
}
