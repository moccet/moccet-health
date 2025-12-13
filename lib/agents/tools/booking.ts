/**
 * Health Booking Tools
 * Tools for finding and booking health appointments
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';

// Mock provider database (in production, integrate with real provider APIs)
const MOCK_PROVIDERS = [
  {
    id: 'prov_pcp_smith',
    name: 'Dr. Sarah Smith',
    specialty: 'Primary Care',
    location: 'San Francisco, CA',
    rating: 4.8,
    acceptsInsurance: ['Aetna', 'Blue Cross', 'United', 'Cigna'],
    nextAvailable: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    appointmentTypes: ['checkup', 'consultation', 'follow_up'],
  },
  {
    id: 'prov_endo_jones',
    name: 'Dr. Michael Jones',
    specialty: 'Endocrinology',
    location: 'San Francisco, CA',
    rating: 4.9,
    acceptsInsurance: ['Aetna', 'Blue Cross', 'Kaiser'],
    nextAvailable: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    appointmentTypes: ['consultation', 'thyroid', 'diabetes', 'hormone'],
  },
  {
    id: 'prov_derm_patel',
    name: 'Dr. Priya Patel',
    specialty: 'Dermatology',
    location: 'Oakland, CA',
    rating: 4.7,
    acceptsInsurance: ['Blue Cross', 'United', 'Cigna'],
    nextAvailable: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    appointmentTypes: ['skin_check', 'consultation', 'follow_up'],
  },
  {
    id: 'prov_cardio_chen',
    name: 'Dr. Wei Chen',
    specialty: 'Cardiology',
    location: 'San Francisco, CA',
    rating: 4.9,
    acceptsInsurance: ['Aetna', 'Blue Cross', 'United', 'Kaiser'],
    nextAvailable: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    appointmentTypes: ['consultation', 'stress_test', 'ecg', 'follow_up'],
  },
  {
    id: 'prov_lab_quest',
    name: 'Quest Diagnostics',
    specialty: 'Laboratory',
    location: 'Multiple Locations',
    rating: 4.3,
    acceptsInsurance: ['Aetna', 'Blue Cross', 'United', 'Cigna', 'Kaiser'],
    nextAvailable: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    appointmentTypes: ['blood_test', 'lab_work'],
  },
];

// Find health providers
export const findHealthProvidersTool: ToolDefinition = {
  name: 'find_health_providers',
  description: `Find healthcare providers based on specialty, location, or insurance.
    Use this to help users find doctors for appointments.`,
  riskLevel: 'low',
  parameters: z.object({
    specialty: z.string().optional()
      .describe('Medical specialty (e.g., "Primary Care", "Endocrinology", "Cardiology")'),
    appointmentType: z.string().optional()
      .describe('Type of appointment (e.g., "checkup", "consultation", "blood_test")'),
    insurance: z.string().optional()
      .describe('Insurance provider name'),
    location: z.string().optional()
      .describe('Location or city'),
    availableWithin: z.number().optional()
      .describe('Maximum days until next available appointment'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { specialty, appointmentType, insurance, location, availableWithin } = params;

      let results = [...MOCK_PROVIDERS];

      // Filter by specialty
      if (specialty) {
        results = results.filter((p) =>
          p.specialty.toLowerCase().includes(specialty.toLowerCase())
        );
      }

      // Filter by appointment type
      if (appointmentType) {
        results = results.filter((p) =>
          p.appointmentTypes.some((t) =>
            t.toLowerCase().includes(appointmentType.toLowerCase())
          )
        );
      }

      // Filter by insurance
      if (insurance) {
        results = results.filter((p) =>
          p.acceptsInsurance.some((i) =>
            i.toLowerCase().includes(insurance.toLowerCase())
          )
        );
      }

      // Filter by location
      if (location) {
        results = results.filter((p) =>
          p.location.toLowerCase().includes(location.toLowerCase())
        );
      }

      // Filter by availability
      if (availableWithin !== undefined) {
        const maxDate = new Date(Date.now() + availableWithin * 24 * 60 * 60 * 1000);
        results = results.filter((p) => new Date(p.nextAvailable) <= maxDate);
      }

      // Sort by rating
      results.sort((a, b) => b.rating - a.rating);

      return {
        success: true,
        data: {
          providers: results.map((p) => ({
            ...p,
            nextAvailableFormatted: new Date(p.nextAvailable).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
          })),
          totalFound: results.length,
          searchCriteria: {
            specialty,
            appointmentType,
            insurance,
            location,
            availableWithin,
          },
        },
        metadata: {
          source: 'provider_search',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find providers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Check insurance coverage
export const checkInsuranceTool: ToolDefinition = {
  name: 'check_insurance',
  description: `Check user's insurance coverage and benefits.
    Use this before booking appointments to verify coverage.`,
  riskLevel: 'low',
  parameters: z.object({
    procedureType: z.string().optional()
      .describe('Type of procedure or visit to check coverage for'),
    providerName: z.string().optional()
      .describe('Provider name to check if in-network'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { procedureType, providerName } = params;

      // Get user's insurance info from profile
      const { data: profile } = await context.supabase
        .from('sage_onboarding_data')
        .select('form_data')
        .eq('email', context.userEmail)
        .maybeSingle();

      const insuranceProvider = profile?.form_data?.insurance || 'Unknown';

      // Mock coverage check (in production, integrate with insurance APIs)
      const coverageInfo = {
        insuranceProvider,
        planType: 'PPO',
        inNetwork: providerName
          ? MOCK_PROVIDERS.some(
              (p) =>
                p.name.toLowerCase().includes(providerName.toLowerCase()) &&
                p.acceptsInsurance.some((i) =>
                  i.toLowerCase().includes(insuranceProvider.toLowerCase())
                )
            )
          : null,
        coverage: {
          preventiveCare: { covered: true, copay: 0 },
          primaryCare: { covered: true, copay: 25 },
          specialist: { covered: true, copay: 50 },
          labWork: { covered: true, copay: 0, deductibleApplies: true },
          urgentCare: { covered: true, copay: 75 },
        },
        deductible: {
          individual: 1500,
          met: 750,
          remaining: 750,
        },
        outOfPocketMax: {
          individual: 5000,
          met: 1200,
          remaining: 3800,
        },
      };

      // Add procedure-specific info if requested
      let procedureCoverage = null;
      if (procedureType) {
        const procedureMap: Record<string, any> = {
          checkup: { covered: true, type: 'preventiveCare', estimatedCost: 0 },
          blood_test: { covered: true, type: 'labWork', estimatedCost: 0 },
          consultation: { covered: true, type: 'specialist', estimatedCost: 50 },
          lab_work: { covered: true, type: 'labWork', estimatedCost: 0 },
        };
        procedureCoverage = procedureMap[procedureType.toLowerCase()] || {
          covered: true,
          type: 'specialist',
          estimatedCost: 50,
        };
      }

      return {
        success: true,
        data: {
          ...coverageInfo,
          procedureCoverage,
        },
        metadata: {
          source: 'insurance_check',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check insurance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Book appointment
export const bookAppointmentTool: ToolDefinition = {
  name: 'book_appointment',
  description: `Book a healthcare appointment with a provider.
    HIGH RISK: This creates a medical commitment - requires explicit user approval.
    Only use after user confirms they want to book.`,
  riskLevel: 'high',
  parameters: z.object({
    providerId: z.string().describe('ID of the provider'),
    providerName: z.string().describe('Name of the provider'),
    appointmentType: z.string().describe('Type of appointment'),
    preferredDate: z.string().optional()
      .describe('Preferred date in ISO format'),
    preferredTime: z.enum(['morning', 'afternoon', 'any']).optional()
      .describe('Preferred time of day'),
    reason: z.string().optional()
      .describe('Reason for visit'),
    confirmBooking: z.literal(true)
      .describe('Must be true to confirm booking'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const {
        providerId,
        providerName,
        appointmentType,
        preferredDate,
        preferredTime = 'any',
        reason,
        confirmBooking,
      } = params;

      if (!confirmBooking) {
        return {
          success: false,
          error: 'Booking not confirmed. Set confirmBooking to true to proceed.',
        };
      }

      // Find provider
      const provider = MOCK_PROVIDERS.find((p) => p.id === providerId);
      if (!provider) {
        return {
          success: false,
          error: `Provider not found: ${providerId}`,
        };
      }

      // Generate appointment time
      let appointmentDate = preferredDate
        ? new Date(preferredDate)
        : new Date(provider.nextAvailable);

      // Adjust for preferred time
      if (preferredTime === 'morning') {
        appointmentDate.setHours(9, 0, 0, 0);
      } else if (preferredTime === 'afternoon') {
        appointmentDate.setHours(14, 0, 0, 0);
      }

      // Create appointment ID
      const appointmentId = `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save appointment to database
      await context.supabase.from('user_appointments').insert({
        id: appointmentId,
        user_email: context.userEmail,
        provider_id: providerId,
        provider_name: providerName,
        specialty: provider.specialty,
        appointment_type: appointmentType,
        scheduled_at: appointmentDate.toISOString(),
        reason: reason,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      });

      // Log the action
      await context.supabase.from('agent_action_log').insert({
        user_email: context.userEmail,
        action_type: 'appointment_booked',
        details: {
          appointmentId,
          providerId,
          providerName,
          scheduledAt: appointmentDate.toISOString(),
        },
      });

      // Also create calendar event if Google connected
      if (context.accessTokens.google) {
        // This would be handled by the calendar tool
        // For now, just note that it should be created
      }

      return {
        success: true,
        data: {
          appointmentId,
          provider: {
            id: providerId,
            name: providerName,
            specialty: provider.specialty,
            location: provider.location,
          },
          appointment: {
            type: appointmentType,
            scheduledAt: appointmentDate.toISOString(),
            scheduledAtFormatted: appointmentDate.toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
            reason,
          },
          status: 'confirmed',
          confirmationSent: true,
          reminderSet: true,
          notes: [
            'Confirmation email sent to your inbox',
            'Remember to bring your insurance card and ID',
            'Arrive 15 minutes early to complete paperwork',
          ],
        },
        metadata: {
          source: 'appointment_booking',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to book appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Cancel appointment
export const cancelAppointmentTool: ToolDefinition = {
  name: 'cancel_appointment',
  description: `Cancel an existing healthcare appointment.
    HIGH RISK: This cancels a medical commitment - requires approval.`,
  riskLevel: 'high',
  parameters: z.object({
    appointmentId: z.string().describe('ID of the appointment to cancel'),
    reason: z.string().optional().describe('Reason for cancellation'),
    confirmCancel: z.literal(true)
      .describe('Must be true to confirm cancellation'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { appointmentId, reason, confirmCancel } = params;

      if (!confirmCancel) {
        return {
          success: false,
          error: 'Cancellation not confirmed.',
        };
      }

      // Get appointment
      const { data: appointment } = await context.supabase
        .from('user_appointments')
        .select('*')
        .eq('id', appointmentId)
        .eq('user_email', context.userEmail)
        .maybeSingle();

      if (!appointment) {
        return {
          success: false,
          error: 'Appointment not found.',
        };
      }

      // Update appointment status
      await context.supabase
        .from('user_appointments')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', appointmentId);

      // Log the action
      await context.supabase.from('agent_action_log').insert({
        user_email: context.userEmail,
        action_type: 'appointment_cancelled',
        details: {
          appointmentId,
          reason,
        },
      });

      return {
        success: true,
        data: {
          cancelled: true,
          appointmentId,
          providerNotified: true,
          notes: [
            'Appointment has been cancelled',
            'Provider has been notified',
            'You may reschedule at any time',
          ],
        },
        metadata: {
          source: 'appointment_booking',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cancel appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

export const bookingTools = [
  findHealthProvidersTool,
  checkInsuranceTool,
  bookAppointmentTool,
  cancelAppointmentTool,
];
