/**
 * Share Intervention Actions API
 * GET /api/share/interventions/:interventionId - Get single intervention
 * PUT /api/share/interventions/:interventionId - Update intervention
 * DELETE /api/share/interventions/:interventionId - Cancel intervention
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { interventionEngine } from '@/lib/services/share/intervention-engine';

async function verifyAccess(userEmail: string, interventionId: string) {
  const supabase = getServiceClient();
  // Get intervention
  const { data: intervention } = await supabase
    .from('share_interventions')
    .select('user_email, created_by_email')
    .eq('id', interventionId)
    .single();

  if (!intervention) return { authorized: false, intervention: null };

  // User is the target or creator
  if (intervention.user_email === userEmail || intervention.created_by_email === userEmail) {
    return { authorized: true, intervention };
  }

  // Check caregiver relationship
  const { data: relationship } = await supabase
    .from('share_relationships')
    .select('id')
    .eq('sharer_email', intervention.user_email)
    .eq('caregiver_email', userEmail)
    .eq('status', 'active')
    .single();

  return { authorized: !!relationship, intervention };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { interventionId: string } }
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

    const { interventionId } = params;
    const { authorized } = await verifyAccess(user.email, interventionId);

    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { data: intervention } = await supabase
      .from('share_interventions')
      .select('*')
      .eq('id', interventionId)
      .single();

    // Get recent logs
    const { data: logs } = await supabase
      .from('share_intervention_logs')
      .select('*')
      .eq('intervention_id', interventionId)
      .order('executed_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      intervention,
      logs: logs || [],
    });
  } catch (error) {
    console.error('Error fetching intervention:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intervention' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { interventionId: string } }
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

    const { interventionId } = params;
    const { authorized } = await verifyAccess(user.email, interventionId);

    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { action, config, status } = body;

    // Handle execute action
    if (action === 'execute') {
      const log = await interventionEngine.executeIntervention(interventionId);
      return NextResponse.json({ success: true, log });
    }

    // Handle update
    const updates: any = {};
    if (config) updates.config = config;
    if (status) updates.status = status;

    const intervention = await interventionEngine.updateIntervention(
      interventionId,
      updates
    );

    return NextResponse.json({
      success: true,
      intervention,
    });
  } catch (error) {
    console.error('Error updating intervention:', error);
    return NextResponse.json(
      { error: 'Failed to update intervention' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { interventionId: string } }
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

    const { interventionId } = params;
    const { authorized } = await verifyAccess(user.email, interventionId);

    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await interventionEngine.cancelIntervention(interventionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling intervention:', error);
    return NextResponse.json(
      { error: 'Failed to cancel intervention' },
      { status: 500 }
    );
  }
}
