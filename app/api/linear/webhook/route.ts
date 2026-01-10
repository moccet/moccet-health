import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Linear Webhook Receiver
 *
 * Handles real-time events from Linear:
 * - Issue created/updated/deleted
 * - Comment created
 * - Project updates
 *
 * Webhooks are created via the setup-subscription endpoint
 */

export const maxDuration = 30;

// Verify Linear webhook signature
function verifyLinearSignature(
  signature: string | null,
  body: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expectedSignature = createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  return signature === expectedSignature;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.text();
    const signature = request.headers.get('linear-signature');
    const deliveryId = request.headers.get('linear-delivery');

    console.log('[Linear Webhook] Received event, delivery:', deliveryId);

    // Verify signature
    const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      if (!verifyLinearSignature(signature, body, webhookSecret)) {
        console.error('[Linear Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log('[Linear Webhook] Signature verified');
    }

    // Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      console.error('[Linear Webhook] Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Extract event info
    const action = payload.action as string; // create, update, remove
    const type = payload.type as string; // Issue, Comment, Project, etc.
    const data = payload.data as Record<string, unknown>;
    const organizationId = payload.organizationId as string;

    console.log(`[Linear Webhook] ${action} ${type}`);

    // Handle different event types
    if (type === 'Issue') {
      await handleIssueEvent(action, data, organizationId);
    } else if (type === 'Comment') {
      await handleCommentEvent(action, data, organizationId);
    } else if (type === 'Project') {
      await handleProjectEvent(action, data, organizationId);
    }

    // Store event for debugging
    const supabase = createAdminClient();
    await supabase.from('linear_webhook_events').insert({
      event_type: `${action}.${type.toLowerCase()}`,
      delivery_id: deliveryId,
      organization_id: organizationId,
      entity_id: (data?.id as string) || null,
      payload: payload,
      processed_at: new Date().toISOString(),
    }).catch((err) => {
      console.error('[Linear Webhook] Error storing event:', err);
    });

    const processingTime = Date.now() - startTime;
    console.log(`[Linear Webhook] Processed in ${processingTime}ms`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Linear Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleIssueEvent(
  action: string,
  data: Record<string, unknown>,
  organizationId: string
) {
  const issueId = data.id as string;
  const title = data.title as string;
  const state = data.state as Record<string, unknown> | undefined;
  const assigneeId = data.assigneeId as string | undefined;
  const priority = data.priority as number;

  console.log(`[Linear Webhook] Issue ${action}: ${title} (${issueId})`);

  const supabase = createAdminClient();

  // Find users with this Linear organization
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('user_email')
    .eq('provider', 'linear')
    .contains('metadata', { organization_id: organizationId });

  if (!tokens || tokens.length === 0) {
    console.log('[Linear Webhook] No users found for organization:', organizationId);
    return;
  }

  for (const token of tokens) {
    const userEmail = token.user_email;

    if (action === 'remove') {
      // Delete from linear_issues
      await supabase
        .from('linear_issues')
        .delete()
        .eq('user_email', userEmail)
        .eq('linear_issue_id', issueId);
      console.log(`[Linear Webhook] Deleted issue ${issueId} for ${userEmail}`);
    } else {
      // Upsert issue
      await supabase.from('linear_issues').upsert({
        user_email: userEmail,
        linear_issue_id: issueId,
        title: title,
        state: state?.name as string || null,
        priority: priority,
        due_date: data.dueDate ? new Date(data.dueDate as string).toISOString() : null,
        project_name: (data.project as Record<string, unknown>)?.name as string || null,
        team_name: (data.team as Record<string, unknown>)?.name as string || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_email,linear_issue_id' });
      console.log(`[Linear Webhook] Upserted issue ${issueId} for ${userEmail}`);
    }

    // Trigger behavioral patterns update for significant changes
    if (action === 'create' || (action === 'update' && (priority === 1 || priority === 2))) {
      // Don't await - fire and forget
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/linear/fetch-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      }).catch(err => {
        console.error('[Linear Webhook] Error triggering fetch:', err);
      });
    }
  }
}

async function handleCommentEvent(
  action: string,
  data: Record<string, unknown>,
  organizationId: string
) {
  const issueId = (data.issue as Record<string, unknown>)?.id as string;
  const body = data.body as string;
  const userId = data.userId as string;

  console.log(`[Linear Webhook] Comment ${action} on issue ${issueId}`);

  // Could trigger notification or analysis here
  // For now, just log it
}

async function handleProjectEvent(
  action: string,
  data: Record<string, unknown>,
  organizationId: string
) {
  const projectId = data.id as string;
  const name = data.name as string;

  console.log(`[Linear Webhook] Project ${action}: ${name} (${projectId})`);

  // Could update project tracking here
}

// Handle GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'linear-webhook',
    timestamp: new Date().toISOString(),
  });
}
