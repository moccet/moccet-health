/**
 * Share Interventions API
 * GET /api/share/interventions - Get interventions
 * POST /api/share/interventions - Create intervention
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { interventionEngine } from '@/lib/services/share/intervention-engine';

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
    const status = searchParams.get('status') as any;
    const type = searchParams.get('type') as any;

    // If requesting for someone else, verify caregiver access
    if (targetEmail !== user.email) {
      const { data: relationship } = await supabase
        .from('share_relationships')
        .select('id, share_permissions(can_create_reminders)')
        .eq('sharer_email', targetEmail)
        .eq('caregiver_email', user.email)
        .eq('status', 'active')
        .single();

      if (!relationship) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const interventions = await interventionEngine.getInterventions(
      targetEmail,
      { status, type }
    );

    return NextResponse.json({
      success: true,
      interventions,
    });
  } catch (error) {
    console.error('Error fetching interventions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interventions' },
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
      user_email,
      intervention_type,
      trigger_type,
      config,
    } = body;

    const targetEmail = user_email || user.email;

    // If creating for someone else, verify caregiver access and permissions
    if (targetEmail !== user.email) {
      const { data: relationship } = await supabase
        .from('share_relationships')
        .select(`
          id,
          share_permissions(can_create_reminders, can_initiate_deliveries)
        `)
        .eq('sharer_email', targetEmail)
        .eq('caregiver_email', user.email)
        .eq('status', 'active')
        .single();

      if (!relationship) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      const perms = relationship.share_permissions as any;

      // Check specific permission based on intervention type
      if (intervention_type === 'reminder' && !perms?.can_create_reminders) {
        return NextResponse.json(
          { error: 'Not authorized to create reminders for this person' },
          { status: 403 }
        );
      }

      if (intervention_type === 'automated_delivery' && !perms?.can_initiate_deliveries) {
        return NextResponse.json(
          { error: 'Not authorized to initiate deliveries for this person' },
          { status: 403 }
        );
      }
    }

    const intervention = await interventionEngine.createIntervention(
      targetEmail,
      intervention_type,
      trigger_type || 'caregiver_initiated',
      config,
      user.email
    );

    return NextResponse.json({
      success: true,
      intervention,
    });
  } catch (error) {
    console.error('Error creating intervention:', error);
    return NextResponse.json(
      { error: 'Failed to create intervention' },
      { status: 500 }
    );
  }
}
