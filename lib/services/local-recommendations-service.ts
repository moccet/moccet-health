/**
 * Local Recommendations Service
 *
 * Integrates with Google Places API to provide location-specific recommendations
 * for activities, venues, and businesses.
 *
 * Features:
 * - Search for gyms, running clubs, yoga studios, etc.
 * - 24-hour caching to reduce API costs
 * - Distance-based filtering
 * - Activity-specific search terms
 *
 * @module lib/services/local-recommendations-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { getActivitySearchTerms } from './activity-inference-service';

const logger = createLogger('LocalRecommendationsService');

// ============================================================================
// TYPES
// ============================================================================

export interface LocalRecommendation {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types: string[];
  location: {
    lat: number;
    lng: number;
  };
  distanceKm?: number;
  openNow?: boolean;
  photoUrl?: string;
  website?: string;
  phoneNumber?: string;
}

export interface SearchParams {
  activity: string;
  city: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
}

export interface SearchResult {
  recommendations: LocalRecommendation[];
  query: string;
  source: 'cache' | 'api';
  totalResults: number;
}

// Google Places type mappings for activities
const ACTIVITY_PLACE_TYPES: Record<string, string[]> = {
  running: ['gym', 'park', 'sports_club'],
  cycling: ['gym', 'bicycle_store', 'sports_club'],
  swimming: ['gym', 'sports_club', 'swimming_pool'],
  weightlifting: ['gym'],
  strength_training: ['gym'],
  crossfit: ['gym'],
  yoga: ['gym', 'spa', 'health'],
  pilates: ['gym', 'spa', 'health'],
  hiit: ['gym'],
  boxing: ['gym'],
  mma: ['gym'],
  rock_climbing: ['gym', 'sports_club'],
  tennis: ['sports_club'],
  basketball: ['sports_club'],
  soccer: ['sports_club'],
  golf: ['golf_course'],
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Search for local recommendations based on activity and location
 */
export async function searchLocalRecommendations(params: SearchParams): Promise<SearchResult> {
  const { activity, city, neighborhood, latitude, longitude, radiusKm = 10, limit = 5 } = params;

  logger.info('Searching for local recommendations', { activity, city, neighborhood });

  // Generate cache key
  const cacheKey = generateCacheKey(activity, city, neighborhood);

  // Try cache first
  const cachedResult = await getCachedRecommendations(cacheKey);
  if (cachedResult) {
    logger.info('Using cached recommendations', { cacheKey, count: cachedResult.length });
    return {
      recommendations: cachedResult.slice(0, limit),
      query: `${activity} in ${neighborhood ? `${neighborhood}, ` : ''}${city}`,
      source: 'cache',
      totalResults: cachedResult.length,
    };
  }

  // Get search terms for the activity
  const searchTerms = getActivitySearchTerms(activity);
  const placeTypes = ACTIVITY_PLACE_TYPES[activity] || ['gym', 'sports_club'];

  // Build the search query
  const searchQuery = `${searchTerms[0]} ${neighborhood ? neighborhood : ''} ${city}`;

  // Call Google Places API
  const recommendations = await searchGooglePlaces({
    query: searchQuery,
    location: latitude && longitude ? { lat: latitude, lng: longitude } : undefined,
    radius: radiusKm * 1000, // Convert to meters
    types: placeTypes,
  });

  // Calculate distances if we have user coordinates
  if (latitude && longitude) {
    for (const rec of recommendations) {
      rec.distanceKm = calculateDistance(
        latitude,
        longitude,
        rec.location.lat,
        rec.location.lng
      );
    }

    // Sort by distance
    recommendations.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  }

  // Cache the results
  await cacheRecommendations(cacheKey, recommendations, activity, city, neighborhood, latitude, longitude, radiusKm);

  return {
    recommendations: recommendations.slice(0, limit),
    query: searchQuery,
    source: 'api',
    totalResults: recommendations.length,
  };
}

/**
 * Get recommendations for multiple activities
 */
export async function getMultiActivityRecommendations(
  activities: string[],
  city: string,
  neighborhood?: string,
  coordinates?: { lat: number; lng: number }
): Promise<Record<string, LocalRecommendation[]>> {
  const results: Record<string, LocalRecommendation[]> = {};

  // Fetch recommendations for each activity in parallel
  const promises = activities.map(async (activity) => {
    const result = await searchLocalRecommendations({
      activity,
      city,
      neighborhood,
      latitude: coordinates?.lat,
      longitude: coordinates?.lng,
      limit: 3,
    });
    return { activity, recommendations: result.recommendations };
  });

  const allResults = await Promise.all(promises);

  for (const { activity, recommendations } of allResults) {
    results[activity] = recommendations;
  }

  return results;
}

/**
 * Format recommendations for insight display
 */
export function formatRecommendationsForInsight(
  recommendations: LocalRecommendation[],
  activity: string
): string[] {
  if (recommendations.length === 0) {
    return [`Search for ${activity.replace(/_/g, ' ')} options in your area`];
  }

  return recommendations.slice(0, 3).map((rec) => {
    const parts: string[] = [rec.name];

    if (rec.distanceKm !== undefined) {
      parts.push(`${rec.distanceKm.toFixed(1)}km away`);
    }

    if (rec.rating && rec.userRatingsTotal) {
      parts.push(`${rec.rating} stars (${rec.userRatingsTotal} reviews)`);
    }

    if (rec.openNow !== undefined) {
      parts.push(rec.openNow ? 'Open now' : 'Currently closed');
    }

    return parts.join(' - ');
  });
}

/**
 * Get activity-specific venue types
 */
export function getVenueTypesForActivity(activity: string): string[] {
  const venueTypes: Record<string, string[]> = {
    running: ['Running Club', 'Parkrun', 'Track Club', 'Running Store'],
    cycling: ['Cycling Club', 'Bike Shop', 'Spin Studio', 'Velodrome'],
    swimming: ['Swimming Pool', 'Aquatic Center', 'Masters Swim Club'],
    yoga: ['Yoga Studio', 'Hot Yoga', 'Wellness Center'],
    crossfit: ['CrossFit Box', 'Functional Fitness Gym'],
    boxing: ['Boxing Gym', 'Kickboxing Studio'],
    rock_climbing: ['Climbing Gym', 'Bouldering Center'],
    tennis: ['Tennis Club', 'Tennis Court', 'Racquet Club'],
  };

  return venueTypes[activity] || ['Gym', 'Fitness Center', 'Sports Club'];
}

// ============================================================================
// GOOGLE PLACES API
// ============================================================================

interface GooglePlacesSearchParams {
  query: string;
  location?: { lat: number; lng: number };
  radius?: number;
  types?: string[];
}

/**
 * Search Google Places API
 */
async function searchGooglePlaces(params: GooglePlacesSearchParams): Promise<LocalRecommendation[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    logger.warn('Google Places API key not configured');
    return getMockRecommendations(params.query);
  }

  try {
    // Use Text Search API for better results with natural language queries
    const baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

    const searchParams = new URLSearchParams({
      query: params.query,
      key: apiKey,
    });

    if (params.location) {
      searchParams.set('location', `${params.location.lat},${params.location.lng}`);
    }

    if (params.radius) {
      searchParams.set('radius', params.radius.toString());
    }

    const response = await fetch(`${baseUrl}?${searchParams.toString()}`);

    if (!response.ok) {
      logger.error('Google Places API error', { status: response.status });
      return getMockRecommendations(params.query);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error('Google Places API returned error status', { status: data.status });
      return getMockRecommendations(params.query);
    }

    const recommendations: LocalRecommendation[] = (data.results || []).map((place: Record<string, unknown>) => ({
      placeId: place.place_id as string,
      name: place.name as string,
      address: place.formatted_address as string,
      rating: place.rating as number | undefined,
      userRatingsTotal: place.user_ratings_total as number | undefined,
      priceLevel: place.price_level as number | undefined,
      types: (place.types || []) as string[],
      location: {
        lat: (place.geometry as Record<string, unknown>)?.location?.lat as number || 0,
        lng: (place.geometry as Record<string, unknown>)?.location?.lng as number || 0,
      },
      openNow: (place.opening_hours as Record<string, unknown>)?.open_now as boolean | undefined,
      photoUrl: place.photos ? getPhotoUrl((place.photos as Array<Record<string, unknown>>)[0], apiKey) : undefined,
    }));

    return recommendations;
  } catch (error) {
    logger.error('Error calling Google Places API', error);
    return getMockRecommendations(params.query);
  }
}

/**
 * Get photo URL from Google Places photo reference
 */
function getPhotoUrl(photo: Record<string, unknown>, apiKey: string): string {
  if (!photo?.photo_reference) return '';

  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${apiKey}`;
}

/**
 * Get mock recommendations when API is not available
 */
function getMockRecommendations(query: string): LocalRecommendation[] {
  // Return empty array - insights will use generic fallback
  logger.info('Using mock recommendations', { query });
  return [];
}

// ============================================================================
// CACHING
// ============================================================================

function generateCacheKey(activity: string, city: string, neighborhood?: string): string {
  const parts = [activity, city.toLowerCase().replace(/\s+/g, '_')];
  if (neighborhood) {
    parts.push(neighborhood.toLowerCase().replace(/\s+/g, '_'));
  }
  return parts.join('_');
}

async function getCachedRecommendations(cacheKey: string): Promise<LocalRecommendation[] | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('local_recommendations_cache')
      .select('results, expires_at')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) return null;

    // Check if cache is expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired cache entry
      await supabase
        .from('local_recommendations_cache')
        .delete()
        .eq('cache_key', cacheKey);
      return null;
    }

    return data.results as LocalRecommendation[];
  } catch (error) {
    logger.error('Error fetching cached recommendations', error);
    return null;
  }
}

async function cacheRecommendations(
  cacheKey: string,
  recommendations: LocalRecommendation[],
  queryType: string,
  city: string,
  neighborhood?: string,
  latitude?: number,
  longitude?: number,
  radiusKm?: number
): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('local_recommendations_cache')
      .upsert({
        cache_key: cacheKey,
        query_type: queryType,
        city,
        neighborhood,
        latitude,
        longitude,
        radius_km: radiusKm,
        results: recommendations,
        result_count: recommendations.length,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'cache_key',
      });
  } catch (error) {
    logger.error('Error caching recommendations', error);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get place details from Google Places API
 */
export async function getPlaceDetails(placeId: string): Promise<LocalRecommendation | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    logger.warn('Google Places API key not configured');
    return null;
  }

  try {
    const baseUrl = 'https://maps.googleapis.com/maps/api/place/details/json';

    const searchParams = new URLSearchParams({
      place_id: placeId,
      fields: 'place_id,name,formatted_address,geometry,rating,user_ratings_total,price_level,types,opening_hours,website,formatted_phone_number,photos',
      key: apiKey,
    });

    const response = await fetch(`${baseUrl}?${searchParams.toString()}`);

    if (!response.ok) {
      logger.error('Google Places Details API error', { status: response.status });
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      logger.error('Google Places Details API returned error', { status: data.status });
      return null;
    }

    const place = data.result;

    return {
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      priceLevel: place.price_level,
      types: place.types || [],
      location: {
        lat: place.geometry?.location?.lat || 0,
        lng: place.geometry?.location?.lng || 0,
      },
      openNow: place.opening_hours?.open_now,
      website: place.website,
      phoneNumber: place.formatted_phone_number,
      photoUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0], apiKey) : undefined,
    };
  } catch (error) {
    logger.error('Error fetching place details', error);
    return null;
  }
}
