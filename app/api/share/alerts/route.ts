/**
 * Share Alerts API
 * GET /api/share/alerts - Get alerts for caregiver
 * POST /api/share/alerts - Create a new alert (internal use)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { alertRoutingService } from '@/lib/services/share/alert-routing-service';
import { contextBuilderService } from '@/lib/services/share/context-builder-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    // Get auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.split(',');
    const severity = searchParams.get('severity')?.split(',');
    const sharerEmail = searchParams.get('sharer_email');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let alerts;

    if (sharerEmail) {
      // Get alerts for specific sharer
      alerts = await alertRoutingService.getAlertsForSharer(
        sharerEmail,
        user.email,
        { status: status as any, limit }
      );
    } else {
      // Get all alerts for this caregiver
      alerts = await alertRoutingService.getAlertsForCaregiver(
        user.email,
        { status: status as any, severity: severity as any, limit, offset }
      );
    }

    // Get counts by status
    const activeCount = alerts.filter(a =>
      a.status === 'pending' || a.status === 'sent'
    ).length;
    const acknowledgedCount = alerts.filter(a => a.status === 'acknowledged').length;
    const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

    return NextResponse.json({
      success: true,
      alerts,
      counts: {
        total: alerts.length,
        active: activeCount,
        acknowledged: acknowledgedCount,
        resolved: resolvedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    // Get auth header
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
      sharer_email,
      alert_type,
      severity,
      title,
      message,
      recommendation,
    } = body;

    if (!sharer_email || !alert_type || !severity || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user has caregiver access to this sharer
    const { data: relationship } = await supabase
      .from('share_relationships')
      .select('id, caregiver_role')
      .eq('sharer_email', sharer_email)
      .eq('caregiver_email', user.email)
      .eq('status', 'active')
      .single();

    if (!relationship) {
      return NextResponse.json(
        { error: 'Not authorized to create alerts for this person' },
        { status: 403 }
      );
    }

    // Build context
    const context = await contextBuilderService.buildAlertContext(
      sharer_email,
      alert_type
    );

    // Create alert
    const alert = await alertRoutingService.createAlert(
      sharer_email,
      alert_type,
      severity,
      title,
      message,
      context,
      recommendation
    );

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
