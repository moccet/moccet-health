import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  encryptSiteCredentials,
  decryptSiteCredentials,
  maskEmail,
} from '@/lib/services/shopping-agent/encryption-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Supported shopping sites
const SUPPORTED_SITES = ['amazon', 'healf', 'iherb', 'vitacost', 'thrive_market'] as const;
type SupportedSite = typeof SUPPORTED_SITES[number];

function isValidSite(site: string): site is SupportedSite {
  return SUPPORTED_SITES.includes(site as SupportedSite);
}

/**
 * GET - List stored credentials for a user (masked)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const site = searchParams.get('site');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let query = supabase
      .from('external_site_credentials')
      .select('id, site_name, is_active, last_used_at, login_failures, created_at, encrypted_email')
      .eq('user_email', email)
      .eq('is_active', true);

    if (site) {
      query = query.eq('site_name', site);
    }

    const { data: credentials, error } = await query;

    if (error) {
      console.error('[Shopping Agent] Error fetching credentials:', error);
      return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
    }

    // Mask email addresses for display
    const maskedCredentials = credentials?.map(cred => {
      let maskedSiteEmail = '***';
      try {
        // Decrypt and mask the site login email
        const decrypted = decryptSiteCredentials({
          encryptedEmail: cred.encrypted_email,
          encryptedPassword: '', // Not needed for masking
          keyId: 'default',
          version: 1,
        });
        maskedSiteEmail = maskEmail(decrypted.email);
      } catch {
        maskedSiteEmail = 'Unable to decrypt';
      }

      return {
        id: cred.id,
        siteName: cred.site_name,
        siteEmail: maskedSiteEmail,
        isActive: cred.is_active,
        lastUsedAt: cred.last_used_at,
        loginFailures: cred.login_failures,
        createdAt: cred.created_at,
      };
    }) || [];

    return NextResponse.json({
      success: true,
      credentials: maskedCredentials,
      supportedSites: SUPPORTED_SITES,
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in GET /credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Store new site credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, site, siteEmail, sitePassword, totpSecret, backupCodes } = body;

    // Validation
    if (!email || !site || !siteEmail || !sitePassword) {
      return NextResponse.json(
        { error: 'Email, site, siteEmail, and sitePassword are required' },
        { status: 400 }
      );
    }

    if (!isValidSite(site)) {
      return NextResponse.json(
        { error: `Invalid site. Supported sites: ${SUPPORTED_SITES.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[Shopping Agent] Storing credentials for ${email} on ${site}`);

    // Encrypt credentials
    const encrypted = encryptSiteCredentials({
      email: siteEmail,
      password: sitePassword,
      totpSecret,
      backupCodes,
    });

    // Upsert (update if exists, insert if not)
    const { data, error } = await supabase
      .from('external_site_credentials')
      .upsert({
        user_email: email,
        site_name: site,
        encrypted_email: encrypted.encryptedEmail,
        encrypted_password: encrypted.encryptedPassword,
        totp_secret_encrypted: encrypted.totpSecretEncrypted,
        backup_codes_encrypted: encrypted.backupCodesEncrypted,
        encryption_key_id: encrypted.keyId,
        encryption_version: encrypted.version,
        is_active: true,
        login_failures: 0, // Reset on new credentials
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email,site_name',
      })
      .select('id, site_name, created_at')
      .single();

    if (error) {
      console.error('[Shopping Agent] Error storing credentials:', error);
      return NextResponse.json({ error: 'Failed to store credentials' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      credentialId: data.id,
      siteName: data.site_name,
      message: `Credentials stored securely for ${site}`,
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in POST /credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Remove site credentials
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const site = searchParams.get('site');
    const credentialId = searchParams.get('id');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!site && !credentialId) {
      return NextResponse.json({ error: 'Either site or id is required' }, { status: 400 });
    }

    let query = supabase
      .from('external_site_credentials')
      .delete()
      .eq('user_email', email);

    if (credentialId) {
      query = query.eq('id', credentialId);
    } else if (site) {
      query = query.eq('site_name', site);
    }

    const { error } = await query;

    if (error) {
      console.error('[Shopping Agent] Error deleting credentials:', error);
      return NextResponse.json({ error: 'Failed to delete credentials' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Credentials deleted successfully',
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in DELETE /credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH - Update credential status (e.g., mark as inactive after failures)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, site, action, newPassword, newTotpSecret } = body;

    if (!email || !site) {
      return NextResponse.json({ error: 'Email and site are required' }, { status: 400 });
    }

    switch (action) {
      case 'deactivate':
        await supabase
          .from('external_site_credentials')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('user_email', email)
          .eq('site_name', site);
        break;

      case 'activate':
        await supabase
          .from('external_site_credentials')
          .update({ is_active: true, login_failures: 0, updated_at: new Date().toISOString() })
          .eq('user_email', email)
          .eq('site_name', site);
        break;

      case 'record_failure':
        await supabase
          .from('external_site_credentials')
          .update({
            login_failures: supabase.rpc('increment_login_failures'),
            last_login_failure_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_email', email)
          .eq('site_name', site);
        break;

      case 'update_password':
        if (!newPassword) {
          return NextResponse.json({ error: 'newPassword is required for update_password action' }, { status: 400 });
        }
        // Fetch existing to get email
        const { data: existing } = await supabase
          .from('external_site_credentials')
          .select('encrypted_email')
          .eq('user_email', email)
          .eq('site_name', site)
          .single();

        if (!existing) {
          return NextResponse.json({ error: 'Credentials not found' }, { status: 404 });
        }

        const decrypted = decryptSiteCredentials({
          encryptedEmail: existing.encrypted_email,
          encryptedPassword: '',
          keyId: 'default',
          version: 1,
        });

        const reEncrypted = encryptSiteCredentials({
          email: decrypted.email,
          password: newPassword,
          totpSecret: newTotpSecret,
        });

        await supabase
          .from('external_site_credentials')
          .update({
            encrypted_password: reEncrypted.encryptedPassword,
            totp_secret_encrypted: reEncrypted.totpSecretEncrypted,
            login_failures: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_email', email)
          .eq('site_name', site);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('[Shopping Agent] Error in PATCH /credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
