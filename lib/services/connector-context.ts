/**
 * Connector Context Service
 * Provides connector awareness for the Health Agent
 * Knows what data sources are connected and their read/write capabilities
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface ConnectorPermissions {
  read: string[];
  write: string[];
}

export interface ConnectorDefinition {
  name: string;
  displayName: string;
  description: string;
  permissions: ConnectorPermissions;
  dataFreshness: 'real-time' | 'hourly' | 'daily' | 'manual';
  dataTypes: string[];
}

export interface UserConnectorStatus {
  name: string;
  displayName: string;
  connected: boolean;
  lastSynced?: string;
  permissions: ConnectorPermissions;
  dataFreshness: string;
  dataTypes: string[];
}

// =============================================================================
// CONNECTOR DEFINITIONS
// =============================================================================

export const CONNECTOR_DEFINITIONS: Record<string, ConnectorDefinition> = {
  // Health & Fitness Wearables
  oura: {
    name: 'oura',
    displayName: 'Oura Ring',
    description: 'Sleep, activity, readiness, and HRV tracking from Oura smart ring',
    permissions: {
      read: ['sleep', 'activity', 'readiness', 'hrv', 'heart_rate', 'temperature'],
      write: [],
    },
    dataFreshness: 'real-time',
    dataTypes: ['sleep_score', 'sleep_duration', 'deep_sleep', 'rem_sleep', 'hrv', 'readiness_score', 'steps', 'calories'],
  },

  whoop: {
    name: 'whoop',
    displayName: 'WHOOP',
    description: 'Recovery, strain, and sleep tracking from WHOOP strap',
    permissions: {
      read: ['sleep', 'recovery', 'strain', 'hrv', 'heart_rate'],
      write: [],
    },
    dataFreshness: 'real-time',
    dataTypes: ['recovery_score', 'strain', 'sleep_performance', 'hrv', 'resting_heart_rate'],
  },

  fitbit: {
    name: 'fitbit',
    displayName: 'Fitbit',
    description: 'Activity, sleep, and heart rate from Fitbit devices',
    permissions: {
      read: ['activity', 'sleep', 'heart_rate', 'weight', 'nutrition'],
      write: [],
    },
    dataFreshness: 'hourly',
    dataTypes: ['steps', 'calories', 'distance', 'sleep', 'heart_rate', 'weight'],
  },

  garmin: {
    name: 'garmin',
    displayName: 'Garmin',
    description: 'Activity, sleep, and training data from Garmin devices',
    permissions: {
      read: ['activity', 'sleep', 'heart_rate', 'stress', 'body_battery'],
      write: [],
    },
    dataFreshness: 'hourly',
    dataTypes: ['steps', 'calories', 'sleep', 'stress_level', 'body_battery', 'training_load'],
  },

  apple_health: {
    name: 'apple_health',
    displayName: 'Apple Health',
    description: 'Health data synced from Apple Health via Vital',
    permissions: {
      read: ['activity', 'sleep', 'heart_rate', 'nutrition', 'workouts', 'mindfulness'],
      write: [],
    },
    dataFreshness: 'daily',
    dataTypes: ['steps', 'calories', 'sleep', 'heart_rate', 'workouts', 'stand_hours'],
  },

  strava: {
    name: 'strava',
    displayName: 'Strava',
    description: 'Running, cycling, and workout activities',
    permissions: {
      read: ['activities', 'routes', 'segments'],
      write: [],
    },
    dataFreshness: 'real-time',
    dataTypes: ['runs', 'rides', 'swims', 'workouts', 'distance', 'elevation', 'pace'],
  },

  // Medical Devices
  dexcom: {
    name: 'dexcom',
    displayName: 'Dexcom CGM',
    description: 'Continuous glucose monitoring data',
    permissions: {
      read: ['glucose', 'events', 'calibrations'],
      write: [],
    },
    dataFreshness: 'real-time',
    dataTypes: ['glucose_value', 'glucose_trend', 'high_alert', 'low_alert', 'urgent_low'],
  },

  freestyle_libre: {
    name: 'freestyle_libre',
    displayName: 'Freestyle Libre',
    description: 'Glucose monitoring via Freestyle Libre sensor',
    permissions: {
      read: ['glucose'],
      write: [],
    },
    dataFreshness: 'real-time',
    dataTypes: ['glucose_value', 'glucose_trend'],
  },

  // Productivity & Calendar
  google: {
    name: 'google',
    displayName: 'Google',
    description: 'Gmail, Google Calendar, and Google services',
    permissions: {
      read: ['emails', 'calendar_events', 'contacts'],
      write: ['calendar_events', 'email_drafts'],
    },
    dataFreshness: 'real-time',
    dataTypes: ['emails', 'calendar_events', 'meetings', 'tasks'],
  },

  outlook: {
    name: 'outlook',
    displayName: 'Microsoft Outlook',
    description: 'Outlook email and calendar',
    permissions: {
      read: ['emails', 'calendar_events'],
      write: ['calendar_events', 'email_drafts'],
    },
    dataFreshness: 'real-time',
    dataTypes: ['emails', 'calendar_events', 'meetings'],
  },

  slack: {
    name: 'slack',
    displayName: 'Slack',
    description: 'Team communication and notifications',
    permissions: {
      read: ['messages', 'channels', 'user_status'],
      write: ['messages', 'status'],
    },
    dataFreshness: 'real-time',
    dataTypes: ['messages', 'mentions', 'direct_messages'],
  },

  teams: {
    name: 'teams',
    displayName: 'Microsoft Teams',
    description: 'Team collaboration and meetings',
    permissions: {
      read: ['messages', 'meetings', 'presence'],
      write: ['messages', 'status'],
    },
    dataFreshness: 'real-time',
    dataTypes: ['chats', 'meetings', 'calls'],
  },

  notion: {
    name: 'notion',
    displayName: 'Notion',
    description: 'Notes, databases, and workspace',
    permissions: {
      read: ['pages', 'databases'],
      write: ['pages', 'database_entries'],
    },
    dataFreshness: 'real-time',
    dataTypes: ['pages', 'databases', 'notes', 'tasks'],
  },

  linear: {
    name: 'linear',
    displayName: 'Linear',
    description: 'Project and issue tracking',
    permissions: {
      read: ['issues', 'projects', 'cycles'],
      write: ['issues', 'comments'],
    },
    dataFreshness: 'real-time',
    dataTypes: ['issues', 'projects', 'milestones'],
  },

  // Entertainment & Lifestyle
  spotify: {
    name: 'spotify',
    displayName: 'Spotify',
    description: 'Music streaming and playlist management',
    permissions: {
      read: ['listening_history', 'playlists', 'saved_tracks'],
      write: ['playlists', 'playback_control', 'queue'],
    },
    dataFreshness: 'real-time',
    dataTypes: ['recently_played', 'top_artists', 'top_tracks', 'playlists'],
  },
};

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Get connector status for a user
 */
export async function getConnectorContext(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<UserConnectorStatus[]> {
  // Get user's connected services
  const { data: connections, error } = await supabase
    .from('user_oauth_connections')
    .select('provider, connected_at, last_sync')
    .eq('user_email', userEmail);

  if (error) {
    console.error('Error fetching connector status:', error);
    return [];
  }

  // Build status for all connectors
  const connectorStatus: UserConnectorStatus[] = [];
  const connectionsList = connections as Array<{ provider: string; connected_at: string; last_sync?: string }> | null;

  for (const [key, definition] of Object.entries(CONNECTOR_DEFINITIONS)) {
    const connection = connectionsList?.find((c) => c.provider === key);

    connectorStatus.push({
      name: definition.name,
      displayName: definition.displayName,
      connected: !!connection,
      lastSynced: connection?.last_sync || connection?.connected_at,
      permissions: definition.permissions,
      dataFreshness: definition.dataFreshness,
      dataTypes: definition.dataTypes,
    });
  }

  return connectorStatus;
}

/**
 * Get only connected services for a user
 */
export async function getConnectedServices(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<UserConnectorStatus[]> {
  const allConnectors = await getConnectorContext(userEmail, supabase);
  return allConnectors.filter(c => c.connected);
}

/**
 * Check if a specific connector is connected
 */
export async function isConnectorConnected(
  userEmail: string,
  connectorName: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  const { data } = await supabase
    .from('user_oauth_connections')
    .select('provider')
    .eq('user_email', userEmail)
    .eq('provider', connectorName)
    .maybeSingle();

  return !!data;
}

/**
 * Format connector context for the agent system prompt
 */
export function formatConnectorContextForPrompt(connectors: UserConnectorStatus[]): string {
  const lines: string[] = ['## Your Connected Data Sources\n'];
  lines.push('You have access to these services for this user:\n');

  // Group by connected status
  const connected = connectors.filter(c => c.connected);
  const disconnected = connectors.filter(c => !c.connected);

  if (connected.length > 0) {
    lines.push('### Connected Services');
    for (const c of connected) {
      const readPerms = c.permissions.read.length > 0 ? `read: ${c.permissions.read.join(', ')}` : '';
      const writePerms = c.permissions.write.length > 0 ? `write: ${c.permissions.write.join(', ')}` : 'write: none';
      const lastSync = c.lastSynced
        ? ` (last synced: ${new Date(c.lastSynced).toLocaleDateString()})`
        : '';

      lines.push(`- **${c.displayName}** ✓ Connected${lastSync}`);
      lines.push(`  - Permissions: ${readPerms} | ${writePerms}`);
      lines.push(`  - Data freshness: ${c.dataFreshness}`);
    }
    lines.push('');
  }

  if (disconnected.length > 0) {
    lines.push('### Not Connected');
    for (const c of disconnected) {
      lines.push(`- **${c.displayName}** ✗ Not connected`);
    }
    lines.push('');
  }

  lines.push('**Important:** When asked about data from disconnected sources, inform the user they need to connect it first in the Connectors section of the app.');

  return lines.join('\n');
}

/**
 * Get a summary of what the agent can read and write
 */
export function getCapabilitiesSummary(connectors: UserConnectorStatus[]): {
  canRead: string[];
  canWrite: string[];
  notConnected: string[];
} {
  const canRead: string[] = [];
  const canWrite: string[] = [];
  const notConnected: string[] = [];

  for (const c of connectors) {
    if (c.connected) {
      canRead.push(...c.permissions.read.map(p => `${p} (${c.displayName})`));
      canWrite.push(...c.permissions.write.map(p => `${p} (${c.displayName})`));
    } else {
      notConnected.push(c.displayName);
    }
  }

  return { canRead, canWrite, notConnected };
}
