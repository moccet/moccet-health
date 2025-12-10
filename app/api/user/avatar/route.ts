import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const BUCKET_NAME = 'avatars';

/**
 * Ensure the avatars bucket exists
 */
async function ensureBucketExists(supabase: ReturnType<typeof createAdminClient>) {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
      });

      if (error && !error.message.includes('already exists')) {
        console.error('[Avatar] Error creating bucket:', error);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('[Avatar] Error checking bucket:', error);
    return false;
  }
}

/**
 * Helper to infer MIME type from file extension
 */
function inferMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
  };
  return ext ? mimeMap[ext] || null : null;
}

/**
 * POST - Upload avatar image
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Avatar] ========== NEW UPLOAD REQUEST ==========');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('user_id') as string | null;

    console.log('[Avatar] FormData keys:', Array.from(formData.keys()));
    console.log('[Avatar] user_id:', userId);

    if (!file) {
      console.log('[Avatar] ERROR: No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('[Avatar] File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    });

    if (!userId) {
      console.log('[Avatar] ERROR: No user_id provided');
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Determine file type - use provided type, or infer from extension
    let fileType = file.type;
    if (!fileType || fileType === 'application/octet-stream') {
      const inferredType = inferMimeType(file.name);
      console.log(`[Avatar] MIME type missing/octet-stream, inferred from extension: ${inferredType}`);
      if (inferredType) {
        fileType = inferredType;
      }
    }

    // Validate file type (including HEIC/HEIF for iPhone photos)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!validTypes.includes(fileType)) {
      console.log(`[Avatar] ERROR: Invalid file type '${fileType}' (original: '${file.type}')`);
      return NextResponse.json({
        error: `Invalid file type '${fileType}'. Allowed: jpeg, png, webp, gif, heic, heif`
      }, { status: 400 });
    }

    console.log(`[Avatar] File type validated: ${fileType}`);

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB' }, { status: 400 });
    }

    console.log(`[Avatar] Uploading avatar for user ${userId}, file: ${file.name}, size: ${file.size}`);

    const supabase = createAdminClient();

    // Ensure bucket exists
    const bucketReady = await ensureBucketExists(supabase);
    if (!bucketReady) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Delete old avatars for this user
    try {
      const { data: existingFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { search: `avatar_${userId}` });

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => f.name);
        await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
        console.log(`[Avatar] Deleted ${filesToDelete.length} old avatars`);
      }
    } catch (e) {
      console.log('[Avatar] No old avatars to delete');
    }

    // Generate filename with timestamp
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `avatar_${userId}_${Date.now()}.${extension}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage (use validated fileType, not original file.type)
    console.log(`[Avatar] Uploading to storage: ${fileName} with contentType: ${fileType}`);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: fileType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Avatar] Upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;
    console.log(`[Avatar] Upload successful: ${avatarUrl}`);

    // Update user metadata in auth.users table
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { user_metadata: { avatar_url: avatarUrl } }
    );

    if (updateError) {
      console.error('[Avatar] Error updating user metadata:', updateError);
      // Still return success since the image was uploaded
    }

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
    });
  } catch (error) {
    console.error('[Avatar] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove avatar image
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    console.log(`[Avatar] Removing avatar for user ${userId}`);

    const supabase = createAdminClient();

    // Find and delete user's avatars
    try {
      const { data: existingFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { search: `avatar_${userId}` });

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => f.name);
        await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
        console.log(`[Avatar] Deleted ${filesToDelete.length} avatars`);
      }
    } catch (e) {
      console.log('[Avatar] No avatars to delete');
    }

    // Clear avatar_url from user metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { user_metadata: { avatar_url: null } }
    );

    if (updateError) {
      console.error('[Avatar] Error clearing user metadata:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Avatar removed',
    });
  } catch (error) {
    console.error('[Avatar] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
