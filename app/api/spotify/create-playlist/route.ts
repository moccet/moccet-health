import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Mood-to-audio-features mapping for Spotify recommendations
const MOOD_CONFIGS: Record<string, {
  seedGenres: string[];
  targetEnergy?: number;
  targetValence?: number;
  targetInstrumentalness?: number;
  targetAcousticness?: number;
  targetTempo?: number;
  minTempo?: number;
}> = {
  calm: {
    seedGenres: ['ambient', 'chill', 'acoustic'],
    targetEnergy: 0.3,
    targetValence: 0.5,
    targetAcousticness: 0.7,
  },
  focus: {
    seedGenres: ['electronic', 'classical', 'ambient'],
    targetEnergy: 0.5,
    targetInstrumentalness: 0.8,
    targetValence: 0.4,
  },
  energy: {
    seedGenres: ['pop', 'dance', 'electronic'],
    targetEnergy: 0.8,
    targetValence: 0.8,
  },
  sleep: {
    seedGenres: ['ambient', 'sleep', 'classical'],
    targetEnergy: 0.2,
    targetAcousticness: 0.8,
    targetInstrumentalness: 0.7,
  },
  workout: {
    seedGenres: ['hip-hop', 'electronic', 'pop'],
    targetEnergy: 0.9,
    targetValence: 0.7,
    minTempo: 120,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userCode, name, mood, duration = 60 } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!mood || !MOOD_CONFIGS[mood]) {
      return NextResponse.json(
        { error: 'Invalid mood. Must be one of: calm, focus, energy, sleep, workout' },
        { status: 400 }
      );
    }

    // Get Spotify access token
    const tokenResult = await getAccessToken(email, 'spotify', userCode);
    if (!tokenResult.success || !tokenResult.accessToken) {
      return NextResponse.json(
        { error: 'Spotify not connected. Please connect Spotify first.', needsAuth: true },
        { status: 401 }
      );
    }

    const accessToken = tokenResult.accessToken;

    // Step 1: Get user's Spotify ID
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      console.error('[Spotify] Failed to get user profile:', error);
      return NextResponse.json({ error: 'Failed to get Spotify user profile' }, { status: 500 });
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    console.log(`[Spotify] Creating playlist for user ${userId} with mood: ${mood}`);

    // Step 2: Get track recommendations based on mood
    const moodConfig = MOOD_CONFIGS[mood];
    const trackCount = Math.ceil(duration / 3.5); // ~3.5 min per track

    const recommendationsUrl = new URL('https://api.spotify.com/v1/recommendations');
    recommendationsUrl.searchParams.append('seed_genres', moodConfig.seedGenres.slice(0, 5).join(','));
    recommendationsUrl.searchParams.append('limit', String(Math.min(trackCount, 50)));

    if (moodConfig.targetEnergy !== undefined) {
      recommendationsUrl.searchParams.append('target_energy', String(moodConfig.targetEnergy));
    }
    if (moodConfig.targetValence !== undefined) {
      recommendationsUrl.searchParams.append('target_valence', String(moodConfig.targetValence));
    }
    if (moodConfig.targetInstrumentalness !== undefined) {
      recommendationsUrl.searchParams.append('target_instrumentalness', String(moodConfig.targetInstrumentalness));
    }
    if (moodConfig.targetAcousticness !== undefined) {
      recommendationsUrl.searchParams.append('target_acousticness', String(moodConfig.targetAcousticness));
    }
    if (moodConfig.targetTempo !== undefined) {
      recommendationsUrl.searchParams.append('target_tempo', String(moodConfig.targetTempo));
    }
    if (moodConfig.minTempo !== undefined) {
      recommendationsUrl.searchParams.append('min_tempo', String(moodConfig.minTempo));
    }

    const recommendationsResponse = await fetch(recommendationsUrl.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!recommendationsResponse.ok) {
      const error = await recommendationsResponse.text();
      console.error('[Spotify] Failed to get recommendations:', error);
      return NextResponse.json({ error: 'Failed to get track recommendations' }, { status: 500 });
    }

    const recommendationsData = await recommendationsResponse.json();
    const tracks = recommendationsData.tracks || [];

    if (tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks found for this mood' }, { status: 404 });
    }

    console.log(`[Spotify] Found ${tracks.length} recommended tracks`);

    // Step 3: Create the playlist
    const playlistName = name || `Moccet ${mood.charAt(0).toUpperCase() + mood.slice(1)} Mix`;
    const playlistDescription = `Created by Moccet Agent - ${mood} mood playlist. ${tracks.length} tracks.`;

    const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: playlistName,
        description: playlistDescription,
        public: false, // Create as private playlist
      }),
    });

    if (!createPlaylistResponse.ok) {
      const error = await createPlaylistResponse.text();
      console.error('[Spotify] Failed to create playlist:', error);
      return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
    }

    const playlistData = await createPlaylistResponse.json();
    const playlistId = playlistData.id;
    const playlistUrl = playlistData.external_urls?.spotify;

    console.log(`[Spotify] Created playlist: ${playlistId}`);

    // Step 4: Add tracks to the playlist
    const trackUris = tracks.map((track: any) => track.uri);

    const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: trackUris,
      }),
    });

    if (!addTracksResponse.ok) {
      const error = await addTracksResponse.text();
      console.error('[Spotify] Failed to add tracks:', error);
      // Playlist was created but tracks failed - return partial success
      return NextResponse.json({
        success: true,
        partial: true,
        playlistId,
        playlistUrl,
        playlistName,
        trackCount: 0,
        message: 'Playlist created but failed to add tracks',
      });
    }

    console.log(`[Spotify] Added ${trackUris.length} tracks to playlist`);

    // Get track names for response
    const trackNames = tracks.slice(0, 5).map((track: any) => ({
      name: track.name,
      artist: track.artists?.[0]?.name || 'Unknown Artist',
    }));

    return NextResponse.json({
      success: true,
      playlistId,
      playlistUrl,
      playlistName,
      trackCount: trackUris.length,
      mood,
      sampleTracks: trackNames,
      message: `Created "${playlistName}" with ${trackUris.length} tracks`,
    });

  } catch (error) {
    console.error('[Spotify] Error creating playlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
