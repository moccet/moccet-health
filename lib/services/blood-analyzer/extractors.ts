/**
 * Blood Analyzer Extractors
 * Batch extraction of biomarkers using GPT-4o-mini for cost efficiency
 * Uses OpenAI Assistants API with file_search for PDF analysis
 * Uses GPT-4o vision for image analysis (PNG, JPG, etc.)
 */

import OpenAI from 'openai';
import {
  Biomarker,
  BatchConfig,
  BatchExtractionResult,
  CATEGORY_CONFIGS,
  BATCH_CONFIGS
} from './types';

const openai = new OpenAI();

// Image extensions that need vision-based analysis
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

/**
 * Check if a file is an image based on extension
 */
export function isImageFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Build the extraction prompt for a batch of categories
 */
function buildBatchPrompt(categories: string[]): string {
  const categoryDetails = categories.map(cat => {
    const config = CATEGORY_CONFIGS[cat];
    return `### ${config.name}
Expected markers (extract ALL you find, not just these):
${config.expectedMarkers.join(', ')}`;
  }).join('\n\n');

  return `You are a clinical laboratory data extraction specialist. Your task is to extract ALL biomarkers from the blood test document for the following categories.

## CRITICAL INSTRUCTIONS:
1. Extract EVERY SINGLE biomarker you find in these categories - do not skip any
2. Include biomarkers even if they use different names than expected (e.g., "Haemoglobin" = "Hemoglobin" = "Hb")
3. Extract the EXACT value, unit, and reference range as shown in the document
4. If a biomarker appears multiple times (e.g., on different pages), include the most recent/final value
5. DO NOT make up values - only extract what is explicitly shown in the document
6. If you're unsure about a category, still include the biomarker with your best guess

## Categories to Extract:

${categoryDetails}

## Required JSON Output Format:
{
  "biomarkers": [
    {
      "name": "Biomarker Name (standardized)",
      "value": "123.4",
      "unit": "mg/dL",
      "referenceRange": "70-100",
      "status": "normal|optimal|borderline|high|low|critical",
      "category": "category_key",
      "significance": "Brief explanation of what this marker measures",
      "implications": "What this result means for health"
    }
  ]
}

## Status Guidelines:
- "optimal": Within ideal/optimal range (if specified separately from normal)
- "normal": Within normal reference range
- "borderline": Just outside normal range (within 10% of limits)
- "high": Above normal range
- "low": Below normal range
- "critical": Significantly outside range (>2x normal limits or flagged critical)

Extract ALL biomarkers from the document for these categories. Be thorough - missing biomarkers is worse than including extras.
Return ONLY valid JSON, no markdown formatting.`;
}

/**
 * Clean and parse JSON from AI response
 */
function cleanAndParseJSON(text: string): string {
  let cleaned = text.trim();

  // Strip markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  cleaned = cleaned.trim();

  // Extract JSON object
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  return cleaned;
}

/**
 * Extract biomarkers from an image using GPT-4o vision
 */
async function extractBatchFromImage(
  imageBase64: string,
  mimeType: string,
  batchConfig: BatchConfig
): Promise<BatchExtractionResult> {
  const startTime = Date.now();

  console.log(`[Blood Analyzer] Extracting batch from IMAGE: ${batchConfig.name}`);
  console.log(`[Blood Analyzer] Categories: ${batchConfig.categories.join(', ')}`);

  try {
    const systemPrompt = buildBatchPrompt(batchConfig.categories);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // GPT-4o has vision capability
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please analyze this blood test image and extract ALL biomarkers for the categories: ${batchConfig.categories.map(c => CATEGORY_CONFIGS[c].name).join(', ')}.

IMPORTANT: Examine the entire image carefully. Extract EVERY biomarker you find in these categories. Return the complete analysis as JSON.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.1
    });

    let responseText = response.choices[0]?.message?.content || '';
    responseText = cleanAndParseJSON(responseText);

    const parsed = JSON.parse(responseText);
    const biomarkers: Biomarker[] = parsed.biomarkers || [];

    // Validate and clean biomarkers
    const cleanedBiomarkers = biomarkers.filter(b => {
      if (!b.name || !b.value) {
        console.warn(`[Blood Analyzer] Skipping invalid biomarker:`, b);
        return false;
      }
      return true;
    }).map(b => ({
      ...b,
      unit: b.unit || '',
      referenceRange: b.referenceRange || 'Not specified',
      status: b.status || 'normal',
      significance: b.significance || '',
      implications: b.implications || ''
    }));

    console.log(`[Blood Analyzer] Batch "${batchConfig.name}" extracted ${cleanedBiomarkers.length} biomarkers from image`);

    return {
      batchName: batchConfig.name,
      categories: batchConfig.categories,
      biomarkers: cleanedBiomarkers,
      rawCount: cleanedBiomarkers.length,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error) {
    console.error(`[Blood Analyzer] Error extracting batch ${batchConfig.name} from image:`, error);
    return {
      batchName: batchConfig.name,
      categories: batchConfig.categories,
      biomarkers: [],
      rawCount: 0,
      processingTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Extract biomarkers for a batch of categories from a PDF using Assistants API
 */
export async function extractBatch(
  openaiFileId: string,
  batchConfig: BatchConfig
): Promise<BatchExtractionResult> {
  const startTime = Date.now();

  console.log(`[Blood Analyzer] Extracting batch: ${batchConfig.name}`);
  console.log(`[Blood Analyzer] Categories: ${batchConfig.categories.join(', ')}`);

  let assistantId: string | null = null;

  try {
    const systemPrompt = buildBatchPrompt(batchConfig.categories);

    // Create a temporary assistant for this extraction
    const assistant = await openai.beta.assistants.create({
      model: batchConfig.model,
      instructions: systemPrompt,
      tools: [{ type: 'file_search' }]
    });
    assistantId = assistant.id;

    // Create a thread with the file attached
    const thread = await openai.beta.threads.create({
      messages: [{
        role: 'user',
        content: `Please analyze this blood test document and extract ALL biomarkers for the categories: ${batchConfig.categories.map(c => CATEGORY_CONFIGS[c].name).join(', ')}.

IMPORTANT: Read ALL pages of the document. Extract EVERY biomarker you find in these categories. Return the complete analysis as JSON.`,
        attachments: [{ file_id: openaiFileId, tools: [{ type: 'file_search' }] }]
      }]
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id
    });

    if (run.status !== 'completed') {
      throw new Error(`Assistant run failed with status: ${run.status}`);
    }

    // Get the response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(m => m.role === 'assistant');

    if (!assistantMessage || assistantMessage.content[0].type !== 'text') {
      throw new Error('No valid response from assistant');
    }

    let responseText = assistantMessage.content[0].text.value;
    responseText = cleanAndParseJSON(responseText);

    const parsed = JSON.parse(responseText);
    const biomarkers: Biomarker[] = parsed.biomarkers || [];

    // Validate and clean biomarkers
    const cleanedBiomarkers = biomarkers.filter(b => {
      if (!b.name || !b.value) {
        console.warn(`[Blood Analyzer] Skipping invalid biomarker:`, b);
        return false;
      }
      return true;
    }).map(b => ({
      ...b,
      // Ensure all fields have values
      unit: b.unit || '',
      referenceRange: b.referenceRange || 'Not specified',
      status: b.status || 'normal',
      significance: b.significance || '',
      implications: b.implications || ''
    }));

    // Clean up assistant
    await openai.beta.assistants.delete(assistant.id);
    assistantId = null;

    console.log(`[Blood Analyzer] Batch "${batchConfig.name}" extracted ${cleanedBiomarkers.length} biomarkers`);

    return {
      batchName: batchConfig.name,
      categories: batchConfig.categories,
      biomarkers: cleanedBiomarkers,
      rawCount: cleanedBiomarkers.length,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error) {
    console.error(`[Blood Analyzer] Error extracting batch ${batchConfig.name}:`, error);

    // Clean up assistant on error
    if (assistantId) {
      try {
        await openai.beta.assistants.delete(assistantId);
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      batchName: batchConfig.name,
      categories: batchConfig.categories,
      biomarkers: [],
      rawCount: 0,
      processingTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Get MIME type for image files
 */
function getImageMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/png';
}

/**
 * Run all batch extractions sequentially
 * For PDFs: uses Assistants API with file_search
 * For images: uses GPT-4o vision
 */
export async function runAllBatchExtractions(
  openaiFileId: string | null,
  fileBuffer?: Buffer,
  fileName?: string
): Promise<BatchExtractionResult[]> {
  const results: BatchExtractionResult[] = [];

  // Check if this is an image file
  const isImage = fileName && isImageFile(fileName);

  if (isImage && fileBuffer && fileName) {
    console.log(`[Blood Analyzer] Using VISION mode for image file: ${fileName}`);
    const imageBase64 = fileBuffer.toString('base64');
    const mimeType = getImageMimeType(fileName);

    for (const batchConfig of BATCH_CONFIGS) {
      const result = await extractBatchFromImage(imageBase64, mimeType, batchConfig);
      results.push(result);

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else if (openaiFileId) {
    console.log(`[Blood Analyzer] Using FILE_SEARCH mode for PDF file`);

    for (const batchConfig of BATCH_CONFIGS) {
      const result = await extractBatch(openaiFileId, batchConfig);
      results.push(result);

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else {
    throw new Error('No valid file provided for extraction');
  }

  return results;
}

/**
 * Upload a file to OpenAI for processing
 */
export async function uploadFileToOpenAI(
  fileBuffer: Buffer,
  fileName: string
): Promise<string> {
  console.log(`[Blood Analyzer] Uploading file to OpenAI: ${fileName}`);

  // Create a Blob from buffer for OpenAI upload
  const mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/*';
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  const file = new File([blob], fileName, { type: mimeType });

  const uploadedFile = await openai.files.create({
    file: file,
    purpose: 'assistants'
  });

  console.log(`[Blood Analyzer] File uploaded: ${uploadedFile.id}`);
  return uploadedFile.id;
}

/**
 * Delete a file from OpenAI after processing
 */
export async function deleteFileFromOpenAI(fileId: string): Promise<void> {
  try {
    await openai.files.delete(fileId);
    console.log(`[Blood Analyzer] File deleted: ${fileId}`);
  } catch (error) {
    console.error(`[Blood Analyzer] Error deleting file ${fileId}:`, error);
    // Don't throw - file deletion is not critical
  }
}
