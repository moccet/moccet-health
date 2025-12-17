/**
 * Email Fine-Tuning Service
 *
 * Manages OpenAI fine-tuning for personalized email generation.
 * - Collects training data from user corrections
 * - Creates and manages fine-tuning jobs
 * - Tracks per-user fine-tuned models
 *
 * @module lib/services/email-fine-tuning
 */

import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/server';

// =========================================================================
// TYPES
// =========================================================================

export interface TrainingExample {
  id: string;
  originalEmailFrom: string;
  originalEmailSubject: string;
  originalEmailBody: string;
  emailType: string | null;
  urgencyLevel: string | null;
  aiDraftBody: string;
  userFinalBody: string;
  wasModified: boolean;
  similarityScore: number;
}

export interface FineTuningStatus {
  hasFineTunedModel: boolean;
  currentModelId: string | null;
  trainingExamplesCount: number;
  pendingExamplesCount: number;
  canStartFineTuning: boolean;
  minExamplesRequired: number;
  latestJobStatus: string | null;
  latestJobId: string | null;
}

export interface FineTuningJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

// =========================================================================
// CONSTANTS
// =========================================================================

const BASE_MODEL = 'gpt-4o-mini-2024-07-18';
const MIN_TRAINING_EXAMPLES = 10; // OpenAI minimum is 10
const RECOMMENDED_EXAMPLES = 15;

// =========================================================================
// OPENAI CLIENT
// =========================================================================

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

// =========================================================================
// TEXT SIMILARITY
// =========================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two texts
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const distance = levenshteinDistance(text1, text2);
  const maxLength = Math.max(text1.length, text2.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

/**
 * Determine modification type based on similarity
 */
export function getModificationType(
  similarityScore: number
): 'sent_as_is' | 'minor_edits' | 'moderate_edits' | 'major_rewrite' {
  if (similarityScore >= 0.95) return 'sent_as_is';
  if (similarityScore >= 0.8) return 'minor_edits';
  if (similarityScore >= 0.5) return 'moderate_edits';
  return 'major_rewrite';
}

// =========================================================================
// TRAINING DATA COLLECTION
// =========================================================================

/**
 * Create a training example from a user's edit to a draft
 */
export async function createTrainingExample(
  userEmail: string,
  draftId: string,
  userFinalSubject: string,
  userFinalBody: string,
  userCode?: string
): Promise<{ success: boolean; trainingDataId?: string; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Get the original draft
    const { data: draft, error: draftError } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_email', userEmail)
      .single();

    if (draftError || !draft) {
      return { success: false, error: 'Draft not found' };
    }

    // Calculate similarity
    const similarityScore = calculateSimilarity(draft.draft_body, userFinalBody);
    const editDistance = levenshteinDistance(draft.draft_body, userFinalBody);
    const modificationType = getModificationType(similarityScore);
    const wasModified = similarityScore < 0.95;

    // Build training prompt (OpenAI fine-tuning format)
    const trainingPrompt = buildTrainingPrompt(
      draft.original_from,
      draft.original_subject,
      draft.original_snippet || '',
      draft.email_type,
      draft.urgency_level
    );

    // Insert training example
    const { data: trainingData, error: insertError } = await supabase
      .from('email_training_data')
      .insert({
        user_email: userEmail,
        user_code: userCode,
        draft_id: draftId,
        original_email_from: draft.original_from,
        original_email_subject: draft.original_subject,
        original_email_body: draft.original_snippet || '',
        email_type: draft.email_type,
        urgency_level: draft.urgency_level,
        ai_draft_subject: draft.draft_subject,
        ai_draft_body: draft.draft_body,
        user_final_subject: userFinalSubject,
        user_final_body: userFinalBody,
        was_modified: wasModified,
        modification_type: modificationType,
        edit_distance: editDistance,
        similarity_score: similarityScore,
        training_prompt: trainingPrompt,
        training_completion: userFinalBody,
        is_valid_for_training: true,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[FineTuning] Failed to create training example:', insertError);
      return { success: false, error: insertError.message };
    }

    // Update draft with reference
    await supabase
      .from('email_drafts')
      .update({
        user_final_subject: userFinalSubject,
        user_final_body: userFinalBody,
        sent_at: new Date().toISOString(),
        training_data_id: trainingData.id,
        status: wasModified ? 'modified' : 'sent',
      })
      .eq('id', draftId);

    console.log(
      `[FineTuning] Created training example for ${userEmail}, similarity: ${(similarityScore * 100).toFixed(1)}%`
    );

    return { success: true, trainingDataId: trainingData.id };
  } catch (error) {
    console.error('[FineTuning] Error creating training example:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build the training prompt for OpenAI fine-tuning
 */
function buildTrainingPrompt(
  from: string,
  subject: string,
  bodyPreview: string,
  emailType: string | null,
  urgencyLevel: string | null
): string {
  return `Write a reply to this email.

FROM: ${from}
SUBJECT: ${subject}
BODY: ${bodyPreview.slice(0, 500)}

Email Type: ${emailType || 'general'}
Urgency: ${urgencyLevel || 'normal'}

Write a natural, personalized response:`;
}

// =========================================================================
// FINE-TUNING STATUS
// =========================================================================

/**
 * Get fine-tuning status for a user
 */
export async function getFineTuningStatus(
  userEmail: string
): Promise<FineTuningStatus> {
  const supabase = createAdminClient();

  // Get current fine-tuned model
  const { data: currentModel } = await supabase
    .from('user_fine_tuned_models')
    .select('openai_model_id, training_examples_count')
    .eq('user_email', userEmail)
    .eq('is_current', true)
    .eq('status', 'active')
    .single();

  // Count training examples
  const { count: totalExamples } = await supabase
    .from('email_training_data')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .eq('is_valid_for_training', true);

  // Count unused examples (not yet used in fine-tuning)
  const { count: pendingExamples } = await supabase
    .from('email_training_data')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .eq('is_valid_for_training', true)
    .is('used_in_fine_tuning_job', null);

  // Get latest job status
  const { data: latestJob } = await supabase
    .from('fine_tuning_jobs')
    .select('id, openai_job_id, status')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const trainingCount = totalExamples || 0;
  const pendingCount = pendingExamples || 0;

  return {
    hasFineTunedModel: !!currentModel,
    currentModelId: currentModel?.openai_model_id || null,
    trainingExamplesCount: trainingCount,
    pendingExamplesCount: pendingCount,
    canStartFineTuning: pendingCount >= MIN_TRAINING_EXAMPLES,
    minExamplesRequired: MIN_TRAINING_EXAMPLES,
    latestJobStatus: latestJob?.status || null,
    latestJobId: latestJob?.id || null,
  };
}

// =========================================================================
// FINE-TUNING JOB MANAGEMENT
// =========================================================================

/**
 * Start a fine-tuning job for a user
 */
export async function startFineTuningJob(
  userEmail: string,
  userCode?: string
): Promise<FineTuningJobResult> {
  const supabase = createAdminClient();
  const openai = getOpenAIClient();

  try {
    // Check if there's already a running job
    const { data: runningJob } = await supabase
      .from('fine_tuning_jobs')
      .select('id')
      .eq('user_email', userEmail)
      .in('status', ['pending', 'uploading', 'validating', 'queued', 'running'])
      .limit(1)
      .single();

    if (runningJob) {
      return { success: false, error: 'A fine-tuning job is already in progress' };
    }

    // Get unused training examples
    const { data: examples, error: examplesError } = await supabase
      .from('email_training_data')
      .select('*')
      .eq('user_email', userEmail)
      .eq('is_valid_for_training', true)
      .is('used_in_fine_tuning_job', null)
      .order('created_at', { ascending: true });

    if (examplesError || !examples) {
      return { success: false, error: 'Failed to fetch training examples' };
    }

    if (examples.length < MIN_TRAINING_EXAMPLES) {
      return {
        success: false,
        error: `Need at least ${MIN_TRAINING_EXAMPLES} examples, have ${examples.length}`,
      };
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('fine_tuning_jobs')
      .insert({
        user_email: userEmail,
        user_code: userCode,
        base_model: BASE_MODEL,
        training_examples_count: examples.length,
        training_data_ids: examples.map((e) => e.id),
        status: 'uploading',
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return { success: false, error: 'Failed to create job record' };
    }

    // Build JSONL training file
    const trainingData = examples.map((ex) => ({
      messages: [
        {
          role: 'system',
          content:
            'You are an email assistant that writes replies in the user\'s personal style. Match their tone, vocabulary, and writing patterns exactly.',
        },
        {
          role: 'user',
          content: ex.training_prompt,
        },
        {
          role: 'assistant',
          content: ex.user_final_body,
        },
      ],
    }));

    const jsonlContent = trainingData.map((d) => JSON.stringify(d)).join('\n');

    // Upload training file to OpenAI
    const file = await openai.files.create({
      file: new File([jsonlContent], 'training.jsonl', { type: 'application/jsonl' }),
      purpose: 'fine-tune',
    });

    console.log(`[FineTuning] Uploaded training file: ${file.id}`);

    // Update job with file ID
    await supabase
      .from('fine_tuning_jobs')
      .update({
        training_file_id: file.id,
        status: 'validating',
      })
      .eq('id', job.id);

    // Start fine-tuning job
    const fineTuneJob = await openai.fineTuning.jobs.create({
      training_file: file.id,
      model: BASE_MODEL,
      suffix: `moccet-${userEmail.split('@')[0].slice(0, 10)}`,
    });

    console.log(`[FineTuning] Started fine-tuning job: ${fineTuneJob.id}`);

    // Update job with OpenAI job ID
    await supabase
      .from('fine_tuning_jobs')
      .update({
        openai_job_id: fineTuneJob.id,
        status: 'queued',
        started_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Mark training examples as used
    await supabase
      .from('email_training_data')
      .update({
        used_in_fine_tuning_job: job.id,
        used_at: new Date().toISOString(),
      })
      .in(
        'id',
        examples.map((e) => e.id)
      );

    return { success: true, jobId: job.id };
  } catch (error) {
    console.error('[FineTuning] Error starting fine-tuning job:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check and update status of a fine-tuning job
 */
export async function checkJobStatus(
  jobId: string
): Promise<{ status: string; modelId?: string; error?: string }> {
  const supabase = createAdminClient();
  const openai = getOpenAIClient();

  try {
    // Get job from database
    const { data: job, error: jobError } = await supabase
      .from('fine_tuning_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job || !job.openai_job_id) {
      return { status: 'unknown', error: 'Job not found' };
    }

    // Check status with OpenAI
    const openaiJob = await openai.fineTuning.jobs.retrieve(job.openai_job_id);

    let dbStatus: string;
    switch (openaiJob.status) {
      case 'validating_files':
        dbStatus = 'validating';
        break;
      case 'queued':
        dbStatus = 'queued';
        break;
      case 'running':
        dbStatus = 'running';
        break;
      case 'succeeded':
        dbStatus = 'succeeded';
        break;
      case 'failed':
        dbStatus = 'failed';
        break;
      case 'cancelled':
        dbStatus = 'cancelled';
        break;
      default:
        dbStatus = openaiJob.status;
    }

    // Update job in database
    const updateData: Record<string, unknown> = {
      status: dbStatus,
      trained_tokens: openaiJob.trained_tokens,
    };

    if (openaiJob.status === 'succeeded' && openaiJob.fine_tuned_model) {
      updateData.result_model_id = openaiJob.fine_tuned_model;
      updateData.completed_at = new Date().toISOString();

      // Create fine-tuned model record
      await createFineTunedModelRecord(
        job.user_email,
        openaiJob.fine_tuned_model,
        job.openai_job_id,
        job.training_examples_count,
        job.user_code
      );
    }

    if (openaiJob.status === 'failed') {
      updateData.error_message = openaiJob.error?.message || 'Unknown error';
      updateData.completed_at = new Date().toISOString();
    }

    await supabase.from('fine_tuning_jobs').update(updateData).eq('id', jobId);

    return {
      status: dbStatus,
      modelId: openaiJob.fine_tuned_model || undefined,
      error: openaiJob.error?.message,
    };
  } catch (error) {
    console.error('[FineTuning] Error checking job status:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a record for a successfully fine-tuned model
 */
async function createFineTunedModelRecord(
  userEmail: string,
  modelId: string,
  jobId: string,
  examplesCount: number,
  userCode?: string
): Promise<void> {
  const supabase = createAdminClient();

  // Deprecate any existing current models
  await supabase
    .from('user_fine_tuned_models')
    .update({
      is_current: false,
      deprecated_at: new Date().toISOString(),
    })
    .eq('user_email', userEmail)
    .eq('is_current', true);

  // Get next version number
  const { count } = await supabase
    .from('user_fine_tuned_models')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail);

  const version = (count || 0) + 1;

  // Create new model record
  await supabase.from('user_fine_tuned_models').insert({
    user_email: userEmail,
    user_code: userCode,
    openai_model_id: modelId,
    base_model: BASE_MODEL,
    fine_tuning_job_id: jobId,
    training_examples_count: examplesCount,
    status: 'active',
    is_current: true,
    version,
  });

  console.log(`[FineTuning] Created model record for ${userEmail}: ${modelId} (v${version})`);
}

// =========================================================================
// MODEL RETRIEVAL
// =========================================================================

/**
 * Get the current fine-tuned model for a user (if available)
 */
export async function getUserFineTunedModel(
  userEmail: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('user_fine_tuned_models')
    .select('openai_model_id')
    .eq('user_email', userEmail)
    .eq('is_current', true)
    .eq('status', 'active')
    .single();

  return data?.openai_model_id || null;
}

/**
 * Increment usage count for a fine-tuned model
 */
export async function recordModelUsage(modelId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase.rpc('increment_model_usage', { model_id: modelId }).catch(() => {
    // Fallback if RPC doesn't exist
    supabase
      .from('user_fine_tuned_models')
      .update({
        drafts_generated: supabase.rpc('increment', { x: 1 }),
        last_used_at: new Date().toISOString(),
      })
      .eq('openai_model_id', modelId);
  });
}

// =========================================================================
// AUTO-TRIGGER LOGIC
// =========================================================================

/**
 * Check if user should trigger a new fine-tuning job
 * Called after creating a training example
 */
export async function shouldTriggerFineTuning(
  userEmail: string
): Promise<boolean> {
  const status = await getFineTuningStatus(userEmail);

  // Don't trigger if a job is already running
  if (
    status.latestJobStatus &&
    ['pending', 'uploading', 'validating', 'queued', 'running'].includes(status.latestJobStatus)
  ) {
    return false;
  }

  // Trigger if we have enough new examples
  if (status.pendingExamplesCount >= RECOMMENDED_EXAMPLES) {
    return true;
  }

  // Trigger first fine-tuning when we reach minimum
  if (!status.hasFineTunedModel && status.pendingExamplesCount >= MIN_TRAINING_EXAMPLES) {
    return true;
  }

  return false;
}
