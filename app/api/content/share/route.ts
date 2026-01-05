/**
 * Content Share API
 *
 * Records share events and generates platform-specific share links.
 * Shares are the strongest engagement signal (10x weight).
 *
 * POST /api/content/share
 * Body: { contentId, contentType, contentCategory, platform }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { PreferenceLearner } from '@/lib/services/preference-learner';
import { WisdomLibraryService } from '@/lib/services/wisdom-library-service';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ContentShareAPI');

type SharePlatform = 'whatsapp' | 'imessage' | 'twitter' | 'copy' | 'other';

interface ShareRequestBody {
  contentId: string;
  contentType: 'wisdom' | 'health_insight';
  contentCategory: string;
  platform: SharePlatform;
}

interface ShareResponse {
  success: boolean;
  shareUrl?: string;
  shareText?: string;
  deepLink?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ShareResponse | { error: string }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - must be logged in' },
        { status: 401 }
      );
    }

    const body: ShareRequestBody = await request.json();

    // Validate required fields
    if (!body.contentId || !body.contentType || !body.platform) {
      return NextResponse.json(
        { error: 'Missing required fields: contentId, contentType, platform' },
        { status: 400 }
      );
    }

    const validPlatforms: SharePlatform[] = ['whatsapp', 'imessage', 'twitter', 'copy', 'other'];
    if (!validPlatforms.includes(body.platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    logger.info('Recording share', {
      email: user.email,
      contentId: body.contentId,
      platform: body.platform,
    });

    // Get content details for share text
    let shareText = '';
    let shareTitle = '';

    if (body.contentType === 'wisdom') {
      const wisdom = await WisdomLibraryService.getById(body.contentId);
      if (wisdom) {
        shareTitle = wisdom.title;
        shareText = `${wisdom.title}\n\n${wisdom.content}`;
        if (wisdom.source) {
          shareText += `\n\n- ${wisdom.source}`;
        }
      }
    }

    // Record the share engagement (10x weight - strongest signal)
    await PreferenceLearner.recordEngagement(user.email, {
      contentId: body.contentId,
      contentType: body.contentType,
      contentCategory: body.contentCategory || 'general',
      signalType: 'share',
      platform: body.platform,
    });

    // Generate share URL (base URL from env or default)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.com';
    const shareUrl = `${baseUrl}/wisdom/${body.contentId}`;

    // Generate platform-specific deep links
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);

    let deepLink: string | undefined;

    switch (body.platform) {
      case 'whatsapp':
        deepLink = `https://api.whatsapp.com/send?text=${encodedText}%0A%0A${encodedUrl}`;
        break;
      case 'twitter':
        deepLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodedUrl}`;
        break;
      case 'imessage':
        // iOS will use native share sheet
        deepLink = undefined;
        break;
      case 'copy':
        // Client handles clipboard
        deepLink = undefined;
        break;
    }

    return NextResponse.json({
      success: true,
      shareUrl,
      shareText: `${shareText}\n\n${shareUrl}`,
      deepLink,
    });
  } catch (error) {
    logger.error('Error recording share', { error });
    return NextResponse.json(
      {
        error: 'Failed to record share',
      },
      { status: 500 }
    );
  }
}
