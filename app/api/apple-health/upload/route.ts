import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseStringPromise } from 'xml2js';
import AdmZip from 'adm-zip';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('healthData') as File;
    const email = formData.get('email') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`\n[Apple Health] Processing upload for ${email}`);
    console.log(`File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    // Read file as buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    let xmlContent: string;

    // Check if it's a ZIP file (Apple Health export is usually zipped)
    if (file.name.endsWith('.zip')) {
      console.log('[Apple Health] Extracting ZIP file...');
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();

      // Find export.xml in the zip
      const xmlEntry = zipEntries.find(entry => entry.entryName.includes('export.xml'));

      if (!xmlEntry) {
        return NextResponse.json({ error: 'No export.xml found in ZIP file' }, { status: 400 });
      }

      xmlContent = xmlEntry.getData().toString('utf8');
      console.log('[Apple Health] Extracted export.xml');
    } else if (file.name.endsWith('.xml')) {
      xmlContent = buffer.toString('utf8');
    } else {
      return NextResponse.json({ error: 'Invalid file type. Please upload .xml or .zip' }, { status: 400 });
    }

    // Parse XML
    console.log('[Apple Health] Parsing XML data...');
    const parsedData = await parseStringPromise(xmlContent);

    // Extract health data
    const healthData = parsedData.HealthData;
    if (!healthData || !healthData.Record) {
      return NextResponse.json({ error: 'Invalid Apple Health export format' }, { status: 400 });
    }

    const records = healthData.Record;
    console.log(`[Apple Health] Found ${records.length} health records`);

    // Extract key metrics
    const metrics = extractHealthMetrics(records);

    console.log('[Apple Health] Extracted metrics:', {
      totalSteps: metrics.steps?.total || 0,
      avgHeartRate: metrics.heartRate?.average || 0,
      sleepHours: metrics.sleep?.averageHours || 0,
      workouts: metrics.workouts?.count || 0,
    });

    // Save to database
    const supabase = await createClient();
    const { error } = await supabase
      .from('sage_onboarding_data')
      .update({
        apple_health_data: metrics,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);

    if (error) {
      console.error('[Apple Health] Database error:', error);
      return NextResponse.json({ error: 'Failed to save health data' }, { status: 500 });
    }

    console.log('[Apple Health] ✅ Data saved successfully\n');

    return NextResponse.json({
      success: true,
      message: 'Apple Health data uploaded and processed successfully',
      metrics: {
        steps: metrics.steps?.total || 0,
        heartRate: metrics.heartRate?.average || 0,
        sleep: metrics.sleep?.averageHours || 0,
        workouts: metrics.workouts?.count || 0,
      }
    });

  } catch (error) {
    console.error('[Apple Health] Error processing upload:', error);
    return NextResponse.json(
      {
        error: 'Failed to process Apple Health data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to extract key health metrics from Apple Health records
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractHealthMetrics(records: any[]) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Filter to last 30 days
  const recentRecords = records.filter(record => {
    const recordDate = new Date(record.$.startDate);
    return recordDate >= thirtyDaysAgo;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics: any = {
    steps: { total: 0, daily: [] },
    heartRate: { average: 0, resting: 0, records: [] },
    sleep: { averageHours: 0, records: [] },
    workouts: { count: 0, types: [] },
    activeEnergy: { total: 0, daily: [] },
    weight: { current: 0, records: [] },
  };

  // Group by metric type
  recentRecords.forEach(record => {
    const type = record.$.type;
    const value = parseFloat(record.$.value || '0');
    const date = record.$.startDate;

    switch (type) {
      case 'HKQuantityTypeIdentifierStepCount':
        metrics.steps.total += value;
        metrics.steps.daily.push({ date, value });
        break;

      case 'HKQuantityTypeIdentifierHeartRate':
        metrics.heartRate.records.push(value);
        break;

      case 'HKQuantityTypeIdentifierRestingHeartRate':
        metrics.heartRate.resting = value;
        break;

      case 'HKCategoryTypeIdentifierSleepAnalysis':
        // Sleep duration in hours
        const startDate = new Date(record.$.startDate);
        const endDate = new Date(record.$.endDate);
        const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        metrics.sleep.records.push(hours);
        break;

      case 'HKQuantityTypeIdentifierActiveEnergyBurned':
        metrics.activeEnergy.total += value;
        metrics.activeEnergy.daily.push({ date, value });
        break;

      case 'HKQuantityTypeIdentifierBodyMass':
        metrics.weight.records.push({ date, value });
        metrics.weight.current = value; // Most recent
        break;

      case 'HKWorkoutTypeIdentifier':
        metrics.workouts.count++;
        metrics.workouts.types.push(record.$.workoutActivityType || 'Unknown');
        break;
    }
  });

  // Calculate averages
  if (metrics.heartRate.records.length > 0) {
    metrics.heartRate.average = Math.round(
      metrics.heartRate.records.reduce((a: number, b: number) => a + b, 0) / metrics.heartRate.records.length
    );
  }

  if (metrics.sleep.records.length > 0) {
    metrics.sleep.averageHours = (
      metrics.sleep.records.reduce((a: number, b: number) => a + b, 0) / metrics.sleep.records.length
    ).toFixed(1);
  }

  // Calculate daily averages
  metrics.steps.dailyAverage = Math.round(metrics.steps.total / 30);
  metrics.activeEnergy.dailyAverage = Math.round(metrics.activeEnergy.total / 30);

  return metrics;
}
