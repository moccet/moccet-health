/**
 * Blood Analyzer Orchestrator
 * Coordinates multi-agent extraction and analysis pipeline
 */

import { BloodAnalysisResult, Biomarker } from './types';
import {
  uploadFileToOpenAI,
  deleteFileFromOpenAI,
  runAllBatchExtractions
} from './extractors';
import { validateAndDedupe } from './validator';
import { generateAnalysis, saveAnalysisToDatabase } from './analyzer';

/**
 * Run the complete multi-agent blood analysis pipeline
 *
 * Pipeline:
 * 1. Upload file to OpenAI
 * 2. Run 4 batch extractions (GPT-4o-mini) sequentially
 * 3. Validate and deduplicate all biomarkers
 * 4. Generate comprehensive analysis (GPT-4o)
 * 5. Save to database
 * 6. Clean up file from OpenAI
 */
export async function runMultiAgentBloodAnalysis(
  fileBuffer: Buffer,
  fileName: string,
  userEmail: string
): Promise<BloodAnalysisResult> {
  const startTime = Date.now();
  let openaiFileId: string | null = null;

  console.log(`[Blood Analyzer] Starting multi-agent analysis for ${userEmail}`);
  console.log(`[Blood Analyzer] File: ${fileName}, Size: ${fileBuffer.length} bytes`);

  try {
    // Step 1: Upload file to OpenAI
    console.log(`[Blood Analyzer] Step 1: Uploading file to OpenAI...`);
    openaiFileId = await uploadFileToOpenAI(fileBuffer, fileName);

    // Step 2: Run all batch extractions
    console.log(`[Blood Analyzer] Step 2: Running batch extractions...`);
    const batchResults = await runAllBatchExtractions(openaiFileId);

    // Collect all biomarkers from all batches
    const allBiomarkers: Biomarker[] = [];
    for (const result of batchResults) {
      console.log(`[Blood Analyzer] Batch "${result.batchName}": ${result.biomarkers.length} biomarkers in ${result.processingTimeMs}ms`);
      allBiomarkers.push(...result.biomarkers);
    }

    console.log(`[Blood Analyzer] Total raw biomarkers extracted: ${allBiomarkers.length}`);

    // Step 3: Validate and deduplicate
    console.log(`[Blood Analyzer] Step 3: Validating and deduplicating...`);
    const validation = validateAndDedupe(allBiomarkers);

    // Step 4: Generate comprehensive analysis
    console.log(`[Blood Analyzer] Step 4: Generating analysis with GPT-4o...`);
    const analysis = await generateAnalysis(
      validation.biomarkers,
      userEmail,
      validation.confidence
    );

    // Step 5: Clean up file from OpenAI
    console.log(`[Blood Analyzer] Step 5: Cleaning up OpenAI file...`);
    if (openaiFileId) {
      await deleteFileFromOpenAI(openaiFileId);
    }

    const processingTimeMs = Date.now() - startTime;

    // Build final result
    const result: BloodAnalysisResult = {
      ...analysis,
      processingTimeMs,
      batchResults
    };

    console.log(`[Blood Analyzer] Analysis complete!`);
    console.log(`  - Total biomarkers: ${result.totalCount}`);
    console.log(`  - Confidence: ${result.confidence}%`);
    console.log(`  - Processing time: ${processingTimeMs}ms (${(processingTimeMs / 1000).toFixed(1)}s)`);

    return result;
  } catch (error) {
    console.error(`[Blood Analyzer] Error in multi-agent analysis:`, error);

    // Clean up file on error
    if (openaiFileId) {
      try {
        await deleteFileFromOpenAI(openaiFileId);
      } catch (cleanupError) {
        console.error(`[Blood Analyzer] Error cleaning up file:`, cleanupError);
      }
    }

    throw error;
  }
}

/**
 * Run analysis and save to database
 * This is the main entry point for the QStash webhook
 */
export async function runAndSaveAnalysis(
  fileBuffer: Buffer,
  fileName: string,
  userEmail: string
): Promise<BloodAnalysisResult> {
  // Run the analysis
  const result = await runMultiAgentBloodAnalysis(fileBuffer, fileName, userEmail);

  // Save to database
  await saveAnalysisToDatabase(userEmail, result);

  return result;
}

/**
 * Fetch file from URL and return as buffer
 */
export async function fetchFileFromUrl(fileUrl: string): Promise<Buffer> {
  console.log(`[Blood Analyzer] Fetching file from URL...`);

  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`[Blood Analyzer] File fetched: ${buffer.length} bytes`);

  return buffer;
}
