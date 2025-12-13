/**
 * Calendar Tools
 * Tools for interacting with Google Calendar
 */

import { z } from 'zod';
import { google } from 'googleapis';
import { ToolDefinition, ToolContext, ToolResult } from './types';

// Find available calendar slots
export const findCalendarSlotsTool: ToolDefinition = {
  name: 'find_calendar_slots',
  description: `Find available time slots in the user's calendar for scheduling events.
    Use this before creating calendar events to find optimal times.
    Can filter by preferred time ranges (morning, afternoon, evening).`,
  riskLevel: 'low',
  parameters: z.object({
    durationMinutes: z.number().min(15).max(480)
      .describe('Duration of the event in minutes'),
    preferredTimeOfDay: z.enum(['morning', 'afternoon', 'evening', 'any']).optional()
      .describe('Preferred time of day for the event'),
    daysAhead: z.number().min(1).max(90).optional()
      .describe('How many days ahead to search. Default is 14.'),
    avoidWeekends: z.boolean().optional()
      .describe('Whether to avoid weekends'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { durationMinutes, preferredTimeOfDay = 'any', daysAhead = 14, avoidWeekends = false } = params;

      if (!context.accessTokens.google) {
        return {
          success: false,
          error: 'Google Calendar not connected. User needs to connect their Google account.',
        };
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: context.accessTokens.google });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const now = new Date();
      const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      // Get busy times
      const freeBusy = await calendar.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: endDate.toISOString(),
          items: [{ id: 'primary' }],
        },
      });

      const busyTimes = freeBusy.data.calendars?.primary?.busy || [];

      // Find free slots
      const slots: { start: Date; end: Date; formatted: string }[] = [];
      const timeRanges: Record<string, { start: number; end: number }> = {
        morning: { start: 8, end: 12 },
        afternoon: { start: 12, end: 17 },
        evening: { start: 17, end: 21 },
        any: { start: 8, end: 21 },
      };
      const range = timeRanges[preferredTimeOfDay];

      let currentDay = new Date(now);
      currentDay.setHours(0, 0, 0, 0);

      while (currentDay < endDate && slots.length < 10) {
        // Skip weekends if requested
        if (avoidWeekends && (currentDay.getDay() === 0 || currentDay.getDay() === 6)) {
          currentDay.setDate(currentDay.getDate() + 1);
          continue;
        }

        // Check slots in the preferred time range
        for (let hour = range.start; hour < range.end; hour++) {
          const slotStart = new Date(currentDay);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

          // Skip if slot is in the past
          if (slotStart < now) continue;

          // Check if slot overlaps with any busy time
          const isBusy = busyTimes.some((busy: any) => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            return (slotStart < busyEnd && slotEnd > busyStart);
          });

          if (!isBusy) {
            slots.push({
              start: slotStart,
              end: slotEnd,
              formatted: `${slotStart.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })} at ${slotStart.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}`,
            });

            if (slots.length >= 10) break;
          }
        }

        currentDay.setDate(currentDay.getDate() + 1);
      }

      return {
        success: true,
        data: {
          availableSlots: slots,
          searchCriteria: {
            durationMinutes,
            preferredTimeOfDay,
            daysAhead,
            avoidWeekends,
          },
        },
        metadata: {
          source: 'google_calendar',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find calendar slots: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Create calendar event
export const createCalendarEventTool: ToolDefinition = {
  name: 'create_calendar_event',
  description: `Create a new event in the user's Google Calendar.
    Use this to schedule appointments, reminders, or block time for health activities.
    MEDIUM RISK: This modifies the user's calendar - requires approval.`,
  riskLevel: 'medium',
  parameters: z.object({
    title: z.string().describe('Title of the event'),
    description: z.string().optional().describe('Description or notes for the event'),
    startTime: z.string().describe('Start time in ISO 8601 format'),
    endTime: z.string().describe('End time in ISO 8601 format'),
    location: z.string().optional().describe('Location of the event'),
    reminders: z.array(z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number(),
    })).optional().describe('Reminders for the event'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { title, description, startTime, endTime, location, reminders } = params;

      if (!context.accessTokens.google) {
        return {
          success: false,
          error: 'Google Calendar not connected. User needs to connect their Google account.',
        };
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: context.accessTokens.google });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: title,
          description: description,
          start: {
            dateTime: startTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          location: location,
          reminders: reminders ? {
            useDefault: false,
            overrides: reminders,
          } : { useDefault: true },
        },
      });

      // Log the action
      await context.supabase.from('agent_action_log').insert({
        user_email: context.userEmail,
        action_type: 'calendar_event_created',
        details: {
          eventId: event.data.id,
          title,
          startTime,
          endTime,
        },
      });

      return {
        success: true,
        data: {
          eventId: event.data.id,
          htmlLink: event.data.htmlLink,
          summary: event.data.summary,
          start: event.data.start,
          end: event.data.end,
        },
        metadata: {
          source: 'google_calendar',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Update calendar event
export const updateCalendarEventTool: ToolDefinition = {
  name: 'update_calendar_event',
  description: `Update an existing event in the user's Google Calendar.
    MEDIUM RISK: This modifies the user's calendar - requires approval.`,
  riskLevel: 'medium',
  parameters: z.object({
    eventId: z.string().describe('ID of the event to update'),
    updates: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      location: z.string().optional(),
    }).describe('Fields to update'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { eventId, updates } = params;

      if (!context.accessTokens.google) {
        return {
          success: false,
          error: 'Google Calendar not connected.',
        };
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: context.accessTokens.google });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Get existing event
      const existingEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      const requestBody: any = {
        summary: updates.title || existingEvent.data.summary,
        description: updates.description || existingEvent.data.description,
        location: updates.location || existingEvent.data.location,
      };

      if (updates.startTime) {
        requestBody.start = {
          dateTime: updates.startTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      if (updates.endTime) {
        requestBody.end = {
          dateTime: updates.endTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      const event = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody,
      });

      return {
        success: true,
        data: {
          eventId: event.data.id,
          htmlLink: event.data.htmlLink,
          updatedFields: Object.keys(updates),
        },
        metadata: {
          source: 'google_calendar',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Delete calendar event
export const deleteCalendarEventTool: ToolDefinition = {
  name: 'delete_calendar_event',
  description: `Delete an event from the user's Google Calendar.
    MEDIUM RISK: This removes an event - requires approval.`,
  riskLevel: 'medium',
  parameters: z.object({
    eventId: z.string().describe('ID of the event to delete'),
    reason: z.string().optional().describe('Reason for deletion (for logging)'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { eventId, reason } = params;

      if (!context.accessTokens.google) {
        return {
          success: false,
          error: 'Google Calendar not connected.',
        };
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: context.accessTokens.google });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      // Log the action
      await context.supabase.from('agent_action_log').insert({
        user_email: context.userEmail,
        action_type: 'calendar_event_deleted',
        details: { eventId, reason },
      });

      return {
        success: true,
        data: {
          deleted: true,
          eventId,
        },
        metadata: {
          source: 'google_calendar',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

export const calendarTools = [
  findCalendarSlotsTool,
  createCalendarEventTool,
  updateCalendarEventTool,
  deleteCalendarEventTool,
];
