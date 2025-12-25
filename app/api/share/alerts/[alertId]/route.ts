/**
 * Share Alert Actions API
 * GET /api/share/alerts/:alertId - Get single alert
 * PUT /api/share/alerts/:alertId - Update alert (acknowledge/resolve)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { alertRoutingService } from '@/lib/services/share/alert-routing-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { alertId: string } }
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

    const { alertId } = params;

    // Get the alert
    const { data: alert, error } = await supabase
      .from('share_alerts')
      .select('*')
      .eq('id', alertId)
      .single();

    if (error || !alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Verify user has access to this alert
    const { data: relationship } = await supabase
      .from('share_relationships')
      .select('id')
      .eq('sharer_email', alert.sharer_email)
      .eq('caregiver_email', user.email)
      .eq('status', 'active')
      .single();

    if (!relationship) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Error fetching alert:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { alertId: string } }
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

    const { alertId } = params;
    const body = await request.json();
    const { action, resolution } = body;

    // Get the alert to verify access
    const { data: alert } = await supabase
      .from('share_alerts')
      .select('sharer_email')
      .eq('id', alertId)
      .single();

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Verify user has access
    const { data: relationship } = await supabase
      .from('share_relationships')
      .select('id')
      .eq('sharer_email', alert.sharer_email)
      .eq('caregiver_email', user.email)
      .eq('status', 'active')
      .single();

    if (!relationship) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    let updatedAlert;

    if (action === 'acknowledge') {
      updatedAlert = await alertRoutingService.acknowledgeAlert(alertId, user.email);
    } else if (action === 'resolve') {
      updatedAlert = await alertRoutingService.resolveAlert(alertId, user.email, resolution);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
