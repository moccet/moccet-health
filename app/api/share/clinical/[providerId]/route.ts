/**
 * Clinical Provider Actions API
 * GET /api/share/clinical/:providerId - Get provider details
 * PUT /api/share/clinical/:providerId - Update provider
 * DELETE /api/share/clinical/:providerId - Remove provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { clinicalCoordinationService } from '@/lib/services/share/clinical-coordination-service';

async function verifyOwnership(userEmail: string, providerId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('share_clinical_coordination')
    .select('user_email')
    .eq('id', providerId)
    .single();

  return data?.user_email === userEmail;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
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

    const { providerId } = params;

    if (!await verifyOwnership(user.email, providerId)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { data: provider } = await supabase
      .from('share_clinical_coordination')
      .select('*')
      .eq('id', providerId)
      .single();

    // Get recent clinical alerts for this provider
    const { data: alerts } = await supabase
      .from('share_clinical_alerts')
      .select('*')
      .eq('coordination_id', providerId)
      .order('sent_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      provider,
      recentAlerts: alerts || [],
    });
  } catch (error) {
    console.error('Error fetching provider:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
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

    const { providerId } = params;

    if (!await verifyOwnership(user.email, providerId)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
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

    const provider = await clinicalCoordinationService.updateProvider(providerId, {
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
    console.error('Error updating provider:', error);
    return NextResponse.json(
      { error: 'Failed to update provider' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
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

    const { providerId } = params;

    if (!await verifyOwnership(user.email, providerId)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await clinicalCoordinationService.removeProvider(providerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing provider:', error);
    return NextResponse.json(
      { error: 'Failed to remove provider' },
      { status: 500 }
    );
  }
}
