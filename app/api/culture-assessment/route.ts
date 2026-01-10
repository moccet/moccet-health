import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyCultureAssessmentComplete } from '@/lib/slack';

interface CategoryScore {
  score: number;
  max: number;
  label: string;
}

interface CultureAssessmentPayload {
  email: string;
  name?: string;
  role?: string;
  overallScore: number;
  categoryScores: Record<string, CategoryScore>;
  answers: Record<number, number>;
  textAnswers: Record<string, string | number>;
}

export async function POST(request: NextRequest) {
  try {
    const data: CultureAssessmentPayload = await request.json();

    if (!data.email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Extract individual category scores
    const locusOfControlScore = data.categoryScores.locus_of_control
      ? Math.round((data.categoryScores.locus_of_control.score / data.categoryScores.locus_of_control.max) * 100)
      : null;
    const giverScore = data.categoryScores.giver_score
      ? Math.round((data.categoryScores.giver_score.score / data.categoryScores.giver_score.max) * 100)
      : null;
    const conscientiousnessScore = data.categoryScores.conscientiousness
      ? Math.round((data.categoryScores.conscientiousness.score / data.categoryScores.conscientiousness.max) * 100)
      : null;
    const gritScore = data.categoryScores.grit
      ? Math.round((data.categoryScores.grit.score / data.categoryScores.grit.max) * 100)
      : null;
    const intrinsicMotivationScore = data.categoryScores.intrinsic_motivation
      ? Math.round((data.categoryScores.intrinsic_motivation.score / data.categoryScores.intrinsic_motivation.max) * 100)
      : null;
    const psychSafetyScore = data.categoryScores.psych_safety
      ? Math.round((data.categoryScores.psych_safety.score / data.categoryScores.psych_safety.max) * 100)
      : null;
    const emotionalIntelligenceScore = data.categoryScores.emotional_intelligence
      ? Math.round((data.categoryScores.emotional_intelligence.score / data.categoryScores.emotional_intelligence.max) * 100)
      : null;
    const deliberatePracticeScore = data.categoryScores.deliberate_practice
      ? Math.round((data.categoryScores.deliberate_practice.score / data.categoryScores.deliberate_practice.max) * 100)
      : null;
    const crisisResponseScore = data.categoryScores.crisis_response
      ? Math.round((data.categoryScores.crisis_response.score / data.categoryScores.crisis_response.max) * 100)
      : null;

    // Extract self-assessment data
    const selfRating = typeof data.textAnswers.self_rating === 'number'
      ? data.textAnswers.self_rating
      : null;
    const managerRating = typeof data.textAnswers.manager_rating === 'number'
      ? data.textAnswers.manager_rating
      : null;
    const ratingGap = selfRating !== null && managerRating !== null
      ? selfRating - managerRating
      : null;

    // Get user agent and IP
    const userAgent = request.headers.get('user-agent') || null;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : null;

    // Prepare database record
    const dbRecord = {
      email: data.email,
      name: data.name || null,
      role: data.role || null,
      overall_score: data.overallScore,
      locus_of_control_score: locusOfControlScore,
      giver_score: giverScore,
      conscientiousness_score: conscientiousnessScore,
      grit_score: gritScore,
      intrinsic_motivation_score: intrinsicMotivationScore,
      psych_safety_score: psychSafetyScore,
      emotional_intelligence_score: emotionalIntelligenceScore,
      deliberate_practice_score: deliberatePracticeScore,
      crisis_response_score: crisisResponseScore,
      self_rating: selfRating,
      manager_rating: managerRating,
      rating_gap: ratingGap,
      weakness_response: typeof data.textAnswers.weakness === 'string'
        ? data.textAnswers.weakness
        : null,
      hard_feedback_response: typeof data.textAnswers.hard_feedback === 'string'
        ? data.textAnswers.hard_feedback
        : null,
      raw_answers: data.answers,
      raw_text_answers: data.textAnswers,
      user_agent: userAgent,
      ip_address: ipAddress,
      updated_at: new Date().toISOString(),
    };

    // Save to Supabase
    let insertedData = null;
    try {
      const supabase = await createClient();

      const { data: result, error } = await supabase
        .from('culture_assessment_submissions')
        .insert(dbRecord)
        .select()
        .single();

      if (error) {
        console.error('[Culture Assessment] Supabase insert error:', error);
        // Continue anyway - we still want to send Slack notification
      } else {
        insertedData = result;
        console.log('[Culture Assessment] ✅ Saved to Supabase:', result.id);
      }
    } catch (supabaseError) {
      console.error('[Culture Assessment] Supabase error:', supabaseError);
      // Continue anyway
    }

    // Send Slack notification
    try {
      await notifyCultureAssessmentComplete({
        email: data.email,
        name: data.name,
        role: data.role,
        overallScore: data.overallScore,
        categoryScores: data.categoryScores,
        selfRating: selfRating ?? undefined,
        managerRating: managerRating ?? undefined,
      });
      console.log('[Culture Assessment] ✅ Slack notification sent');
    } catch (slackError) {
      console.error('[Culture Assessment] Slack notification failed:', slackError);
      // Don't fail the request if Slack fails
    }

    return NextResponse.json({
      success: true,
      data: {
        id: insertedData?.id || null,
        email: data.email,
        overallScore: data.overallScore,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Culture Assessment] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit assessment' },
      { status: 500 }
    );
  }
}
