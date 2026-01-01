/**
 * Test fixtures for insights
 */

export const mockInsight = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  insight_type: 'sleep_quality',
  severity: 'medium',
  title: 'Sleep Quality Alert',
  summary: 'Your sleep quality has decreased over the past week.',
  recommendation: 'Try going to bed 30 minutes earlier.',
  data_sources: ['oura'],
  created_at: '2024-01-15T08:00:00Z',
  updated_at: '2024-01-15T08:00:00Z',
  viewed_at: null,
  dismissed_at: null,
  acted_on: false,
  action_taken: null,
  notification_sent: false,
};

export const mockInsights = [
  mockInsight,
  {
    ...mockInsight,
    id: '223e4567-e89b-12d3-a456-426614174001',
    insight_type: 'activity_low',
    severity: 'low',
    title: 'Activity Level',
    summary: 'Your activity level is slightly below your weekly average.',
    created_at: '2024-01-14T08:00:00Z',
  },
  {
    ...mockInsight,
    id: '323e4567-e89b-12d3-a456-426614174002',
    insight_type: 'stress_high',
    severity: 'high',
    title: 'Elevated Stress Levels',
    summary: 'Your HRV indicates elevated stress levels.',
    created_at: '2024-01-13T08:00:00Z',
  },
];

export const mockPaginatedResponse = {
  success: true,
  insights: mockInsights,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 3,
    totalPages: 1,
    hasMore: false,
  },
  syncTimestamp: '2024-01-15T10:00:00Z',
};
