/**
 * Spotify Tools
 * Tools for interacting with Spotify API
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Helper function to make Spotify API requests
async function spotifyRequest(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Spotify API error: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Create a playlist
export const createPlaylistTool: ToolDefinition = {
  name: 'create_playlist',
  description: `Create a new Spotify playlist for the user.
    Use this to create mood-based, activity-based, or health-focused playlists.
    LOW RISK: Creates a playlist but doesn't cost anything.`,
  riskLevel: 'low',
  parameters: z.object({
    name: z.string().describe('Name of the playlist'),
    description: z.string().optional().describe('Description of the playlist'),
    public: z.boolean().optional().describe('Whether the playlist should be public. Default is false.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { name, description = '', public: isPublic = false } = params;

      if (!context.accessTokens.spotify) {
        return {
          success: false,
          error: 'Spotify not connected. User needs to connect their Spotify account.',
        };
      }

      // Get user's Spotify ID
      const me = await spotifyRequest('/me', context.accessTokens.spotify);

      // Create playlist
      const playlist = await spotifyRequest(
        `/users/${me.id}/playlists`,
        context.accessTokens.spotify,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            description,
            public: isPublic,
          }),
        }
      );

      // Log the action
      await context.supabase.from('agent_action_log').insert({
        user_email: context.userEmail,
        action_type: 'spotify_playlist_created',
        details: {
          playlistId: playlist.id,
          name,
        },
      });

      return {
        success: true,
        data: {
          playlistId: playlist.id,
          name: playlist.name,
          externalUrl: playlist.external_urls?.spotify,
          uri: playlist.uri,
        },
        metadata: {
          source: 'spotify',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create playlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Search for tracks
export const searchTracksTool: ToolDefinition = {
  name: 'search_tracks',
  description: `Search for tracks on Spotify based on mood, activity, or specific criteria.
    Use this to find music that matches the user's current state or needs.`,
  riskLevel: 'low',
  parameters: z.object({
    query: z.string().optional().describe('Search query (artist, track, etc.)'),
    mood: z.enum(['calm', 'energetic', 'focus', 'sleep', 'happy', 'sad', 'workout']).optional()
      .describe('Mood-based search'),
    limit: z.number().min(1).max(50).optional().describe('Number of tracks to return. Default is 20.'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { query, mood, limit = 20 } = params;

      if (!context.accessTokens.spotify) {
        return {
          success: false,
          error: 'Spotify not connected.',
        };
      }

      // Build search query based on mood if no query provided
      let searchQuery = query || '';
      const moodGenres: Record<string, string> = {
        calm: 'ambient chill relaxing',
        energetic: 'upbeat electronic dance',
        focus: 'lo-fi study concentration instrumental',
        sleep: 'sleep ambient white noise',
        happy: 'happy feel good pop',
        sad: 'sad melancholy acoustic',
        workout: 'workout gym high energy',
      };

      if (mood && !query) {
        searchQuery = moodGenres[mood];
      }

      const results = await spotifyRequest(
        `/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit}`,
        context.accessTokens.spotify
      );

      const tracks = results.tracks.items.map((track: any) => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        uri: track.uri,
        durationMs: track.duration_ms,
        previewUrl: track.preview_url,
      }));

      return {
        success: true,
        data: {
          tracks,
          query: searchQuery,
          totalFound: results.tracks.total,
        },
        metadata: {
          source: 'spotify',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search tracks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Add tracks to playlist
export const addTracksToPlaylistTool: ToolDefinition = {
  name: 'add_tracks_to_playlist',
  description: `Add tracks to an existing Spotify playlist.
    Use this after creating a playlist to populate it with songs.`,
  riskLevel: 'low',
  parameters: z.object({
    playlistId: z.string().describe('ID of the playlist'),
    trackUris: z.array(z.string()).describe('Array of Spotify track URIs to add'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { playlistId, trackUris } = params;

      if (!context.accessTokens.spotify) {
        return {
          success: false,
          error: 'Spotify not connected.',
        };
      }

      await spotifyRequest(
        `/playlists/${playlistId}/tracks`,
        context.accessTokens.spotify,
        {
          method: 'POST',
          body: JSON.stringify({
            uris: trackUris,
          }),
        }
      );

      return {
        success: true,
        data: {
          playlistId,
          tracksAdded: trackUris.length,
        },
        metadata: {
          source: 'spotify',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add tracks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get recommendations based on seeds
export const getRecommendationsTool: ToolDefinition = {
  name: 'get_spotify_recommendations',
  description: `Get personalized track recommendations from Spotify based on seeds and audio features.
    Can tune for energy, tempo, valence (happiness), etc.`,
  riskLevel: 'low',
  parameters: z.object({
    seedTracks: z.array(z.string()).max(5).optional()
      .describe('Track IDs to use as seeds'),
    seedArtists: z.array(z.string()).max(5).optional()
      .describe('Artist IDs to use as seeds'),
    seedGenres: z.array(z.string()).max(5).optional()
      .describe('Genres to use as seeds'),
    targetEnergy: z.number().min(0).max(1).optional()
      .describe('Target energy level (0.0 to 1.0)'),
    targetTempo: z.number().min(0).max(250).optional()
      .describe('Target tempo in BPM'),
    targetValence: z.number().min(0).max(1).optional()
      .describe('Target happiness/positivity (0.0 to 1.0)'),
    limit: z.number().min(1).max(100).optional(),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const {
        seedTracks,
        seedArtists,
        seedGenres,
        targetEnergy,
        targetTempo,
        targetValence,
        limit = 20,
      } = params;

      if (!context.accessTokens.spotify) {
        return {
          success: false,
          error: 'Spotify not connected.',
        };
      }

      // Build query params
      const queryParams = new URLSearchParams();
      queryParams.set('limit', limit.toString());

      if (seedTracks?.length) queryParams.set('seed_tracks', seedTracks.join(','));
      if (seedArtists?.length) queryParams.set('seed_artists', seedArtists.join(','));
      if (seedGenres?.length) queryParams.set('seed_genres', seedGenres.join(','));
      if (targetEnergy !== undefined) queryParams.set('target_energy', targetEnergy.toString());
      if (targetTempo !== undefined) queryParams.set('target_tempo', targetTempo.toString());
      if (targetValence !== undefined) queryParams.set('target_valence', targetValence.toString());

      // Need at least one seed
      if (!seedTracks?.length && !seedArtists?.length && !seedGenres?.length) {
        queryParams.set('seed_genres', 'pop,rock,indie');
      }

      const results = await spotifyRequest(
        `/recommendations?${queryParams.toString()}`,
        context.accessTokens.spotify
      );

      const tracks = results.tracks.map((track: any) => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        uri: track.uri,
        durationMs: track.duration_ms,
      }));

      return {
        success: true,
        data: {
          recommendations: tracks,
          seeds: {
            tracks: seedTracks,
            artists: seedArtists,
            genres: seedGenres,
          },
        },
        metadata: {
          source: 'spotify',
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

export const spotifyTools = [
  createPlaylistTool,
  searchTracksTool,
  addTracksToPlaylistTool,
  getRecommendationsTool,
];
