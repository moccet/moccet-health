/**
 * MCP Tools
 *
 * Tools allow the AI to take actions on behalf of the user.
 * Risk levels determine if user approval is required.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

export interface ServerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  userEmail: string;
  baseUrl: string;
}

type ToolHandler = (args: Record<string, any>, config: ServerConfig) => Promise<any>;

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const toolDefinitions: Tool[] = [
  // Calendar Tools
  {
    name: 'calendar_find_slots',
    description: 'Find available time slots in the user\'s Google Calendar. Use this to find good times for scheduling health activities, appointments, or reminders.',
    inputSchema: {
      type: 'object',
      properties: {
        durationMinutes: {
          type: 'number',
          description: 'Duration of the event in minutes (15-480)',
        },
        preferredTime: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening', 'any'],
          description: 'Preferred time of day',
        },
        daysAhead: {
          type: 'number',
          description: 'How many days ahead to search (1-30)',
        },
      },
      required: ['durationMinutes'],
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new event in the user\'s Google Calendar. MEDIUM RISK: Requires user approval before execution.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Event description/notes' },
        startTime: { type: 'string', description: 'Start time in ISO 8601 format' },
        endTime: { type: 'string', description: 'End time in ISO 8601 format' },
        location: { type: 'string', description: 'Event location' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
  },

  // Spotify Tools
  {
    name: 'spotify_create_playlist',
    description: 'Create a new Spotify playlist for mood, focus, sleep, workout, etc. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Playlist name' },
        description: { type: 'string', description: 'Playlist description' },
        mood: {
          type: 'string',
          enum: ['calm', 'energetic', 'focus', 'sleep', 'happy', 'workout'],
          description: 'Mood to base the playlist on',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'spotify_add_tracks',
    description: 'Add tracks to an existing playlist. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        playlistId: { type: 'string', description: 'Spotify playlist ID' },
        trackCount: { type: 'number', description: 'Number of tracks to add (default 20)' },
        mood: { type: 'string', description: 'Mood for track selection' },
      },
      required: ['playlistId'],
    },
  },

  // Supplement Tools
  {
    name: 'supplements_search',
    description: 'Search for supplements based on deficiencies or health goals. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        deficiency: { type: 'string', description: 'Nutrient deficiency to address' },
        category: { type: 'string', description: 'Supplement category' },
        maxPrice: { type: 'number', description: 'Maximum price filter' },
      },
    },
  },
  {
    name: 'supplements_recommend',
    description: 'Get personalized supplement recommendations based on blood work. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        budget: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Budget preference',
        },
      },
    },
  },

  // Shopping Tools
  {
    name: 'shopping_search',
    description: 'Search for health products. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: {
          type: 'string',
          enum: ['supplements', 'devices', 'fitness', 'wellness'],
          description: 'Product category',
        },
        maxPrice: { type: 'number', description: 'Maximum price' },
      },
      required: ['query'],
    },
  },
  {
    name: 'shopping_add_to_cart',
    description: 'Add a product to the user\'s cart. MEDIUM RISK: Requires user approval.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product ID' },
        productName: { type: 'string', description: 'Product name' },
        price: { type: 'number', description: 'Price' },
        quantity: { type: 'number', description: 'Quantity (default 1)' },
      },
      required: ['productId', 'productName', 'price'],
    },
  },
  {
    name: 'shopping_purchase',
    description: 'Complete purchase of cart items. HIGH RISK: Requires explicit user approval.',
    inputSchema: {
      type: 'object',
      properties: {
        confirmPurchase: {
          type: 'boolean',
          description: 'Must be true to confirm purchase',
        },
      },
      required: ['confirmPurchase'],
    },
  },

  // WhatsApp Tools (via Wassenger)
  {
    name: 'whatsapp_send_message',
    description: 'Send a WhatsApp message to a patient/contact. HIGH RISK: Requires explicit user approval before sending.',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone number with country code (e.g., +1234567890)' },
        message: { type: 'string', description: 'Message text to send' },
      },
      required: ['phone', 'message'],
    },
  },
  {
    name: 'whatsapp_list_chats',
    description: 'List recent WhatsApp conversations. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of chats to return (default 50)' },
      },
    },
  },
  {
    name: 'whatsapp_get_conversation',
    description: 'Get messages from a specific WhatsApp conversation. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: { type: 'string', description: 'Chat/conversation ID' },
        limit: { type: 'number', description: 'Number of messages to return (default 100)' },
      },
      required: ['chatId'],
    },
  },

  // Health Booking Tools
  {
    name: 'booking_find_providers',
    description: 'Find healthcare providers by specialty, location, or insurance. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        specialty: { type: 'string', description: 'Medical specialty' },
        location: { type: 'string', description: 'City or area' },
        insurance: { type: 'string', description: 'Insurance provider' },
      },
    },
  },
  {
    name: 'booking_check_insurance',
    description: 'Check insurance coverage for a procedure or visit. LOW RISK: Auto-approved.',
    inputSchema: {
      type: 'object',
      properties: {
        procedureType: { type: 'string', description: 'Type of procedure/visit' },
        providerName: { type: 'string', description: 'Provider name to check' },
      },
    },
  },
  {
    name: 'booking_schedule',
    description: 'Book a healthcare appointment. HIGH RISK: Requires explicit user approval.',
    inputSchema: {
      type: 'object',
      properties: {
        providerId: { type: 'string', description: 'Provider ID' },
        providerName: { type: 'string', description: 'Provider name' },
        appointmentType: { type: 'string', description: 'Type of appointment' },
        preferredDate: { type: 'string', description: 'Preferred date' },
        reason: { type: 'string', description: 'Reason for visit' },
        confirmBooking: {
          type: 'boolean',
          description: 'Must be true to confirm booking',
        },
      },
      required: ['providerId', 'providerName', 'appointmentType', 'confirmBooking'],
    },
  },
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================

const getSupabase = (config: ServerConfig) => {
  return createClient(config.supabaseUrl, config.supabaseKey);
};

// Helper to get OAuth tokens
async function getOAuthToken(config: ServerConfig, provider: string): Promise<string | null> {
  const supabase = getSupabase(config);

  const { data } = await supabase
    .from('user_oauth_connections')
    .select('access_token')
    .eq('user_email', config.userEmail)
    .eq('provider', provider)
    .maybeSingle();

  return data?.access_token || null;
}

// Calendar: Find Slots
async function calendarFindSlots(args: Record<string, any>, config: ServerConfig) {
  const { durationMinutes, preferredTime = 'any', daysAhead = 14 } = args;

  const token = await getOAuthToken(config, 'google');
  if (!token) {
    return { success: false, error: 'Google Calendar not connected' };
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busyTimes = freeBusy.data.calendars?.primary?.busy || [];
    const slots: any[] = [];

    const timeRanges: Record<string, { start: number; end: number }> = {
      morning: { start: 8, end: 12 },
      afternoon: { start: 12, end: 17 },
      evening: { start: 17, end: 21 },
      any: { start: 8, end: 21 },
    };
    const range = timeRanges[preferredTime];

    let currentDay = new Date(now);
    currentDay.setHours(0, 0, 0, 0);

    while (currentDay < endDate && slots.length < 10) {
      for (let hour = range.start; hour < range.end && slots.length < 10; hour++) {
        const slotStart = new Date(currentDay);
        slotStart.setHours(hour, 0, 0, 0);

        if (slotStart < now) continue;

        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        const isBusy = busyTimes.some((busy: any) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (slotStart < busyEnd && slotEnd > busyStart);
        });

        if (!isBusy) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            formatted: `${slotStart.toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric'
            })} at ${slotStart.toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit'
            })}`,
          });
        }
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return { success: true, slots, count: slots.length };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Calendar: Create Event
async function calendarCreateEvent(args: Record<string, any>, config: ServerConfig) {
  const { title, description, startTime, endTime, location } = args;

  const token = await getOAuthToken(config, 'google');
  if (!token) {
    return { success: false, error: 'Google Calendar not connected' };
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        description,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        location,
      },
    });

    // Log action
    const supabase = getSupabase(config);
    await supabase.from('agent_action_log').insert({
      user_email: config.userEmail,
      action_type: 'mcp_calendar_event_created',
      details: { eventId: event.data.id, title, startTime },
    });

    return {
      success: true,
      eventId: event.data.id,
      htmlLink: event.data.htmlLink,
      summary: event.data.summary,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Spotify: Create Playlist
async function spotifyCreatePlaylist(args: Record<string, any>, config: ServerConfig) {
  const { name, description = '', mood } = args;

  const token = await getOAuthToken(config, 'spotify');
  if (!token) {
    return { success: false, error: 'Spotify not connected' };
  }

  try {
    // Get user ID
    const meResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meResponse.json();

    // Create playlist
    const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${me.id}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: description || `${mood ? mood.charAt(0).toUpperCase() + mood.slice(1) + ' ' : ''}playlist created by Moccet`,
        public: false,
      }),
    });
    const playlist = await playlistResponse.json();

    return {
      success: true,
      playlistId: playlist.id,
      name: playlist.name,
      url: playlist.external_urls?.spotify,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Spotify: Add Tracks
async function spotifyAddTracks(args: Record<string, any>, config: ServerConfig) {
  const { playlistId, trackCount = 20, mood = 'focus' } = args;

  const token = await getOAuthToken(config, 'spotify');
  if (!token) {
    return { success: false, error: 'Spotify not connected' };
  }

  try {
    const moodGenres: Record<string, string> = {
      calm: 'ambient chill',
      energetic: 'electronic dance',
      focus: 'lo-fi study',
      sleep: 'sleep ambient',
      happy: 'happy pop',
      workout: 'workout',
    };

    // Search for tracks
    const searchQuery = moodGenres[mood] || mood;
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${trackCount}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchResults = await searchResponse.json();

    const trackUris = searchResults.tracks.items.map((t: any) => t.uri);

    // Add tracks to playlist
    await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: trackUris }),
    });

    return { success: true, tracksAdded: trackUris.length, playlistId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Supplements: Search
async function supplementsSearch(args: Record<string, any>, config: ServerConfig) {
  const { deficiency, category, maxPrice } = args;

  // Use the existing tools from the LangGraph agent
  const response = await fetch(`${config.baseUrl}/api/agent/tools/supplements/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deficiency, category, maxPrice }),
  }).catch(() => null);

  if (response?.ok) {
    return await response.json();
  }

  // Fallback to local data
  const supplements = [
    { id: 'vitd3', name: 'Thorne Vitamin D3', category: 'vitamin_d', price: 24.99, rating: 4.8 },
    { id: 'b12', name: 'Jarrow B12', category: 'vitamin_b12', price: 12.99, rating: 4.6 },
    { id: 'iron', name: 'Thorne Iron', category: 'iron', price: 21.00, rating: 4.5 },
    { id: 'mag', name: 'Pure Encapsulations Mag', category: 'magnesium', price: 32.50, rating: 4.8 },
  ];

  let results = supplements;
  if (deficiency) {
    results = results.filter(s => s.category.includes(deficiency.toLowerCase()));
  }
  if (maxPrice) {
    results = results.filter(s => s.price <= maxPrice);
  }

  return { success: true, supplements: results };
}

// Supplements: Recommend
async function supplementsRecommend(args: Record<string, any>, config: ServerConfig) {
  const { budget = 'medium' } = args;

  // Get deficiencies from blood work
  const supabase = getSupabase(config);
  const { data: bloodData } = await supabase
    .from('blood_analysis_results')
    .select('analysis')
    .eq('user_email', config.userEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const deficiencies = (bloodData?.analysis?.biomarkers || [])
    .filter((b: any) => b.status === 'low' || b.status === 'deficient')
    .map((b: any) => b.name);

  const recommendations = [];
  for (const def of deficiencies.slice(0, 5)) {
    const searchResult = await supplementsSearch({ deficiency: def, maxPrice: budget === 'low' ? 25 : budget === 'high' ? 100 : 50 }, config);
    if (searchResult.supplements?.length > 0) {
      recommendations.push({
        forDeficiency: def,
        recommended: searchResult.supplements[0],
      });
    }
  }

  return { success: true, recommendations, deficiencyCount: deficiencies.length };
}

// Shopping: Search
async function shoppingSearch(args: Record<string, any>, config: ServerConfig) {
  const { query, category, maxPrice } = args;

  // Mock search results
  const products = [
    { id: 'prod1', name: 'Thorne Vitamin D3', category: 'supplements', price: 24.99, rating: 4.8 },
    { id: 'prod2', name: 'Oura Ring Gen 3', category: 'devices', price: 299.00, rating: 4.7 },
    { id: 'prod3', name: 'Manduka Yoga Mat', category: 'fitness', price: 120.00, rating: 4.9 },
  ];

  let results = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.category === category
  );

  if (maxPrice) {
    results = results.filter(p => p.price <= maxPrice);
  }

  return { success: true, products: results };
}

// Shopping: Add to Cart
async function shoppingAddToCart(args: Record<string, any>, config: ServerConfig) {
  const { productId, productName, price, quantity = 1 } = args;

  const supabase = getSupabase(config);

  // Get or create cart
  const { data: cartData } = await supabase
    .from('user_shopping_cart')
    .select('cart_items')
    .eq('user_email', config.userEmail)
    .maybeSingle();

  const cart = cartData?.cart_items || [];
  cart.push({ productId, productName, price, quantity, addedAt: new Date().toISOString() });

  await supabase.from('user_shopping_cart').upsert({
    user_email: config.userEmail,
    cart_items: cart,
    updated_at: new Date().toISOString(),
  });

  return {
    success: true,
    added: { productName, price, quantity },
    cartTotal: cart.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0),
  };
}

// Shopping: Purchase
async function shoppingPurchase(args: Record<string, any>, config: ServerConfig) {
  const { confirmPurchase } = args;

  if (!confirmPurchase) {
    return { success: false, error: 'Purchase not confirmed' };
  }

  const supabase = getSupabase(config);

  const { data: cartData } = await supabase
    .from('user_shopping_cart')
    .select('cart_items')
    .eq('user_email', config.userEmail)
    .maybeSingle();

  const cart = cartData?.cart_items || [];
  if (cart.length === 0) {
    return { success: false, error: 'Cart is empty' };
  }

  const total = cart.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

  // Create order
  const orderId = `order_${Date.now()}`;
  await supabase.from('user_orders').insert({
    id: orderId,
    user_email: config.userEmail,
    items: cart,
    total,
    status: 'pending',
  });

  // Clear cart
  await supabase.from('user_shopping_cart').delete().eq('user_email', config.userEmail);

  return { success: true, orderId, total, itemCount: cart.length };
}

// Booking: Find Providers
async function bookingFindProviders(args: Record<string, any>, config: ServerConfig) {
  const { specialty, location, insurance } = args;

  // Mock providers
  const providers = [
    { id: 'prov1', name: 'Dr. Sarah Smith', specialty: 'Primary Care', location: 'San Francisco', insurance: ['Aetna', 'Blue Cross'], rating: 4.8 },
    { id: 'prov2', name: 'Dr. Michael Jones', specialty: 'Endocrinology', location: 'San Francisco', insurance: ['Blue Cross', 'Kaiser'], rating: 4.9 },
    { id: 'prov3', name: 'Quest Diagnostics', specialty: 'Laboratory', location: 'Multiple', insurance: ['All Major'], rating: 4.3 },
  ];

  let results = providers;
  if (specialty) {
    results = results.filter(p => p.specialty.toLowerCase().includes(specialty.toLowerCase()));
  }
  if (location) {
    results = results.filter(p => p.location.toLowerCase().includes(location.toLowerCase()));
  }

  return { success: true, providers: results };
}

// Booking: Check Insurance
async function bookingCheckInsurance(args: Record<string, any>, config: ServerConfig) {
  return {
    success: true,
    coverage: {
      preventiveCare: { covered: true, copay: 0 },
      specialist: { covered: true, copay: 50 },
      labWork: { covered: true, copay: 0 },
    },
    deductible: { individual: 1500, met: 750 },
  };
}

// Booking: Schedule
async function bookingSchedule(args: Record<string, any>, config: ServerConfig) {
  const { providerId, providerName, appointmentType, preferredDate, reason, confirmBooking } = args;

  if (!confirmBooking) {
    return { success: false, error: 'Booking not confirmed' };
  }

  const supabase = getSupabase(config);
  const appointmentId = `appt_${Date.now()}`;

  await supabase.from('user_appointments').insert({
    id: appointmentId,
    user_email: config.userEmail,
    provider_id: providerId,
    provider_name: providerName,
    appointment_type: appointmentType,
    scheduled_at: preferredDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    reason,
    status: 'confirmed',
  });

  return {
    success: true,
    appointmentId,
    provider: providerName,
    type: appointmentType,
    status: 'confirmed',
  };
}

// =============================================================================
// WHATSAPP HANDLERS (via Wassenger)
// =============================================================================

function getWassengerApiKey(): string {
  return process.env.WASSENGER_API_KEY || '';
}

// WhatsApp: Send Message
async function whatsappSendMessage(args: Record<string, any>, config: ServerConfig) {
  const { phone, message } = args;
  const apiKey = getWassengerApiKey();

  if (!apiKey) {
    return { success: false, error: 'Wassenger API key not configured' };
  }

  try {
    const response = await fetch('https://api.wassenger.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': apiKey,
      },
      body: JSON.stringify({ phone, message }),
    });

    const result = await response.json();

    // Log action
    const supabase = getSupabase(config);
    await supabase.from('agent_action_log').insert({
      user_email: config.userEmail,
      action_type: 'whatsapp_message_sent',
      details: { phone, messagePreview: message.substring(0, 50) },
    });

    return { success: true, messageId: result.id, status: result.status };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// WhatsApp: List Chats
async function whatsappListChats(args: Record<string, any>, config: ServerConfig) {
  const { limit = 50 } = args;
  const apiKey = getWassengerApiKey();

  if (!apiKey) {
    return { success: false, error: 'Wassenger API key not configured' };
  }

  try {
    const response = await fetch(`https://api.wassenger.com/v1/chats?limit=${limit}`, {
      headers: { 'Token': apiKey },
    });
    const chats = await response.json();
    return { success: true, chats, count: chats.length };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// WhatsApp: Get Conversation
async function whatsappGetConversation(args: Record<string, any>, config: ServerConfig) {
  const { chatId, limit = 100 } = args;
  const apiKey = getWassengerApiKey();

  if (!apiKey) {
    return { success: false, error: 'Wassenger API key not configured' };
  }

  try {
    const response = await fetch(`https://api.wassenger.com/v1/chats/${chatId}/messages?limit=${limit}`, {
      headers: { 'Token': apiKey },
    });
    const messages = await response.json();
    return { success: true, messages, count: messages.length };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// EXPORT HANDLERS
// =============================================================================

export const toolHandlers: Record<string, ToolHandler> = {
  calendar_find_slots: calendarFindSlots,
  calendar_create_event: calendarCreateEvent,
  spotify_create_playlist: spotifyCreatePlaylist,
  spotify_add_tracks: spotifyAddTracks,
  supplements_search: supplementsSearch,
  supplements_recommend: supplementsRecommend,
  shopping_search: shoppingSearch,
  shopping_add_to_cart: shoppingAddToCart,
  shopping_purchase: shoppingPurchase,
  booking_find_providers: bookingFindProviders,
  booking_check_insurance: bookingCheckInsurance,
  booking_schedule: bookingSchedule,
  whatsapp_send_message: whatsappSendMessage,
  whatsapp_list_chats: whatsappListChats,
  whatsapp_get_conversation: whatsappGetConversation,
};
