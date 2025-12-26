/**
 * Share Dashboard API Route
 * GET /api/share/dashboard - Get caregiver dashboard overview
 * GET /api/share/dashboard?sharerEmail=xxx - Get detailed view for one person
 */

import { NextRequest, NextResponse } from 'next/server';
import { shareRelationshipService } from '@/lib/services/share/share-relationship-service';
import { getServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const email = request.headers.get('x-user-email');
    const sharerEmail = request.nextUrl.searchParams.get('sharerEmail');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (sharerEmail) {
      // Detailed view for one person
      return await getPersonDetail(email, sharerEmail);
    }

    // Overview of all monitored people
    console.log(`[Share] Fetching dashboard overview for ${email}`);

    const monitoredPeople = await shareRelationshipService.instance.getMonitoredPeople(email);

    // Get recent alerts for all monitored people
    const { data: recentAlerts } = await supabase
      .from('share_alerts')
      .select('*')
      .contains('routed_to_caregivers', [email])
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(10);

    // Get stats
    const stats = await shareRelationshipService.instance.getStats(email);

    return NextResponse.json({
      success: true,
      monitored_people: monitoredPeople,
      recent_alerts: recentAlerts || [],
      stats: {
        total_monitoring: stats.people_i_monitor,
        total_caregivers: stats.people_monitoring_me,
        pending_invites: stats.pending_invites_received,
      },
    });
  } catch (error) {
    console.error('[Share] Error fetching dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}

async function getPersonDetail(caregiverEmail: string, sharerEmail: string) {
  const supabase = getServiceClient();

  try {
    // Verify caregiver has access
    const canAccess = await shareRelationshipService.instance.canAccessMetric(
      sharerEmail,
      caregiverEmail,
      'activity' // Base metric to check access
    );

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    console.log(`[Share] Fetching person detail: ${sharerEmail} for ${caregiverEmail}`);

    // Get relationship
    const { data: relationship } = await supabase
      .from('share_relationships')
      .select('*, share_permissions(*)')
      .eq('sharer_email', sharerEmail)
      .eq('caregiver_email', caregiverEmail)
      .eq('status', 'active')
      .single();

    if (!relationship) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }

    // Get baselines
    const { data: baselines } = await supabase
      .from('share_baselines')
      .select('*')
      .eq('user_email', sharerEmail);

    // Get recent alerts
    const { data: alerts } = await supabase
      .from('share_alerts')
      .select('*')
      .eq('sharer_email', sharerEmail)
      .contains('routed_to_caregivers', [caregiverEmail])
      .order('created_at', { ascending: false })
      .limit(20);

    // Get active interventions
    const { data: interventions } = await supabase
      .from('share_interventions')
      .select('*')
      .eq('user_email', sharerEmail)
      .eq('status', 'active');

    // Get latest health snapshot
    const { data: snapshot } = await supabase
      .from('share_health_snapshots')
      .select('*')
      .eq('user_email', sharerEmail)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    // Get clinical providers
    const { data: clinicalProviders } = await supabase
      .from('share_clinical_coordination')
      .select('provider_name, provider_type, is_active')
      .eq('user_email', sharerEmail)
      .eq('is_active', true);

    // Filter data based on permissions
    const permissions = relationship.share_permissions?.[0] || {};
    const filteredBaselines = filterBaselinesForPermissions(baselines || [], permissions);

    return NextResponse.json({
      success: true,
      relationship: {
        id: relationship.id,
        relationship_type: relationship.relationship_type,
        relationship_label: relationship.relationship_label,
        caregiver_role: relationship.caregiver_role,
        connected_since: relationship.invite_accepted_at,
        is_bidirectional: relationship.is_bidirectional,
      },
      permissions,
      baselines: filteredBaselines,
      alerts: alerts || [],
      interventions: interventions || [],
      latest_snapshot: snapshot,
      clinical_providers: clinicalProviders || [],
    });
  } catch (error) {
    console.error('[Share] Error fetching person detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person detail' },
      { status: 500 }
    );
  }
}

function filterBaselinesForPermissions(
  baselines: any[],
  permissions: any
): any[] {
  const metricPermissionMap: Record<string, string> = {
    sleep_score: 'share_sleep_score',
    sleep_duration_hours: 'share_sleep_score',
    deep_sleep_pct: 'share_sleep_details',
    rem_sleep_pct: 'share_sleep_details',
    recovery_score: 'share_recovery',
    hrv_ms: 'share_hrv',
    resting_hr: 'share_resting_hr',
    daily_steps: 'share_steps',
    active_calories: 'share_calories',
    active_minutes: 'share_activity',
    avg_glucose: 'share_glucose',
    time_in_range_pct: 'share_time_in_range',
    medication_compliance_pct: 'share_medication_compliance',
    hydration_oz: 'share_hydration',
    daily_calories: 'share_nutrition',
    weight_lbs: 'share_weight',
  };

  return baselines.filter((baseline) => {
    const permKey = metricPermissionMap[baseline.metric_type];
    if (!permKey) return true; // Allow if no specific permission defined
    return permissions[permKey] === true;
  });
}
