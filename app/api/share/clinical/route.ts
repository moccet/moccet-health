/**
 * Clinical Coordination API
 * GET /api/share/clinical - Get clinical providers
 * POST /api/share/clinical - Add clinical provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { clinicalCoordinationService } from '@/lib/services/share/clinical-coordination-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetEmail = searchParams.get('user_email') || user.email;

    // If requesting for someone else, verify caregiver access
    if (targetEmail !== user.email) {
      const { data: relationship } = await supabase
        .from('share_relationships')
        .select('share_permissions(can_see_clinical_alerts)')
        .eq('sharer_email', targetEmail)
        .eq('caregiver_email', user.email)
        .eq('status', 'active')
        .single();

      const perms = relationship?.share_permissions as any;
      if (!perms?.can_see_clinical_alerts) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      // For caregivers, only return clinical alerts they can see
      const clinicalAlerts = await clinicalCoordinationService.getClinicalAlertsForCaregiver(
        user.email,
        targetEmail
      );

      return NextResponse.json({
        success: true,
        clinicalAlerts,
        // Don't expose provider details to caregivers
      });
    }

    // User requesting their own providers
    const providers = await clinicalCoordinationService.getProviders(user.email);

    return NextResponse.json({
      success: true,
      providers,
    });
  } catch (error) {
    console.error('Error fetching clinical data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clinical data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      provider_email,
      provider_name,
      provider_type,
      practice_name,
      phone,
      fax,
      portal_url,
      share_alerts,
      share_weekly_summary,
      share_trend_reports,
      preferred_contact_method,
    } = body;

    if (!provider_email || !provider_name || !provider_type) {
      return NextResponse.json(
        { error: 'Missing required fields: provider_email, provider_name, provider_type' },
        { status: 400 }
      );
    }

    const provider = await clinicalCoordinationService.addProvider(user.email, {
      providerEmail: provider_email,
      providerName: provider_name,
      providerType: provider_type,
      practiceName: practice_name,
      phone,
      fax,
      portalUrl: portal_url,
      shareAlerts: share_alerts,
      shareWeeklySummary: share_weekly_summary,
      shareTrendReports: share_trend_reports,
      preferredContactMethod: preferred_contact_method,
    });

    return NextResponse.json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error('Error adding provider:', error);
    return NextResponse.json(
      { error: 'Failed to add provider' },
      { status: 500 }
    );
  }
}
