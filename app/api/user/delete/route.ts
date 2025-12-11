/**
 * User Delete API
 * Permanently delete a user account and all associated data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * DELETE - Delete user account and all associated data
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Delete User API] Starting deletion for user: ${userId}`);

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Get user email first for tables that use email as identifier
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;

    console.log(`[Delete User API] User email: ${userEmail}`);

    // Delete data from all related tables
    const deletionResults: { table: string; success: boolean; error?: string }[] = [];

    // Tables that use user_id
    const userIdTables = [
      'blood_test_files',
      'user_addresses',
      'orders',
      'cart_items',
      'ecosystem_context_cache',
      'user_connectors',
      'oauth_tokens',
      'apple_health_data',
      'oura_data',
      'dexcom_data',
      'vital_data',
      'gmail_data',
      'slack_data',
      'fitness_plans',
      'nutrition_plans',
      'personalized_plans',
      'user_insights',
    ];

    // Delete from user_id tables
    for (const table of userIdTables) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId);

        if (error && !error.message.includes('does not exist')) {
          console.log(`[Delete User API] Error deleting from ${table}:`, error.message);
          deletionResults.push({ table, success: false, error: error.message });
        } else {
          console.log(`[Delete User API] Deleted from ${table}`);
          deletionResults.push({ table, success: true });
        }
      } catch (e) {
        console.log(`[Delete User API] Table ${table} may not exist, skipping`);
        deletionResults.push({ table, success: true, error: 'Table may not exist' });
      }
    }

    // Tables that use email as identifier
    if (userEmail) {
      const emailTables = [
        'sage_onboarding_data',
        'forge_onboarding_data',
        'waitlist',
      ];

      for (const table of emailTables) {
        try {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('email', userEmail);

          if (error && !error.message.includes('does not exist')) {
            console.log(`[Delete User API] Error deleting from ${table}:`, error.message);
            deletionResults.push({ table, success: false, error: error.message });
          } else {
            console.log(`[Delete User API] Deleted from ${table}`);
            deletionResults.push({ table, success: true });
          }
        } catch (e) {
          console.log(`[Delete User API] Table ${table} may not exist, skipping`);
          deletionResults.push({ table, success: true, error: 'Table may not exist' });
        }
      }
    }

    // Delete user's files from storage
    try {
      const { data: bloodFiles } = await supabase.storage
        .from('blood-results')
        .list(userId);

      if (bloodFiles && bloodFiles.length > 0) {
        const filePaths = bloodFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('blood-results').remove(filePaths);
        console.log(`[Delete User API] Deleted ${filePaths.length} blood result files`);
      }
    } catch (e) {
      console.log('[Delete User API] Error deleting storage files:', e);
    }

    // Delete avatar from storage
    try {
      const { data: avatarFiles } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (avatarFiles && avatarFiles.length > 0) {
        const filePaths = avatarFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('avatars').remove(filePaths);
        console.log(`[Delete User API] Deleted ${filePaths.length} avatar files`);
      }
    } catch (e) {
      console.log('[Delete User API] Error deleting avatar files:', e);
    }

    // Finally, delete the auth user
    try {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        console.error('[Delete User API] Error deleting auth user:', deleteAuthError);
        deletionResults.push({ table: 'auth.users', success: false, error: deleteAuthError.message });
      } else {
        console.log('[Delete User API] Auth user deleted successfully');
        deletionResults.push({ table: 'auth.users', success: true });
      }
    } catch (e) {
      console.error('[Delete User API] Error deleting auth user:', e);
      deletionResults.push({ table: 'auth.users', success: false, error: String(e) });
    }

    console.log('[Delete User API] Deletion complete. Results:', deletionResults);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
      details: deletionResults,
    });

  } catch (error) {
    console.error('[Delete User API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete account',
        details: String(error),
      },
      { status: 500 }
    );
  }
}

// Also support OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
