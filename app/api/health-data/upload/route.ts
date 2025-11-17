import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const email = formData.get('email') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!type || !['oura-ring', 'whoop', 'cgm'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid data type' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are allowed' },
        { status: 400 }
      );
    }

    // Read and parse file content
    const fileContent = await file.text();
    const rows = fileContent.split('\n').filter(row => row.trim());

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'CSV file appears to be empty or invalid' },
        { status: 400 }
      );
    }

    // Parse CSV (simple CSV parser - works for most cases)
    const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = rows.slice(1).map(row => {
      const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });

    // Analyze data based on type
    let analysis;
    switch (type) {
      case 'oura-ring':
        analysis = analyzeOuraData(data);
        break;
      case 'whoop':
        analysis = analyzeWhoopData(data);
        break;
      case 'cgm':
        analysis = analyzeCGMData(data);
        break;
      default:
        analysis = { summary: 'Data uploaded' };
    }

    // Store in cookie for session (in production, store in database)
    const cookieStore = await cookies();
    cookieStore.set(`health_data_${type}`, JSON.stringify({
      fileName: file.name,
      uploadDate: new Date().toISOString(),
      rowCount: data.length,
      analysis
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    console.log(`Analyzed ${type} data:`, {
      fileName: file.name,
      rowCount: data.length,
      analysis
    });

    return NextResponse.json({
      success: true,
      message: `${type} data uploaded and analyzed successfully`,
      dataType: type,
      fileName: file.name,
      rowsProcessed: data.length,
      analysis
    });

  } catch (error) {
    console.error('Error uploading health data:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

function analyzeOuraData(data: Record<string, string>[]) {
  // Extract key metrics from Oura Ring data
  const sleepScores = data.map(d => parseFloat(d.sleep_score || d['Sleep Score'] || '0')).filter(s => s > 0);
  const readinessScores = data.map(d => parseFloat(d.readiness_score || d['Readiness Score'] || '0')).filter(s => s > 0);
  const totalSleep = data.map(d => parseFloat(d.total_sleep || d['Total Sleep'] || '0')).filter(s => s > 0);
  const remSleep = data.map(d => parseFloat(d.rem_sleep || d['REM Sleep'] || '0')).filter(s => s > 0);
  const deepSleep = data.map(d => parseFloat(d.deep_sleep || d['Deep Sleep'] || '0')).filter(s => s > 0);

  const avgSleepScore = sleepScores.length > 0 ? Math.round(sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length) : 0;
  const avgReadiness = readinessScores.length > 0 ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length) : 0;
  const avgTotalSleep = totalSleep.length > 0 ? Math.round(totalSleep.reduce((a, b) => a + b, 0) / totalSleep.length / 60) : 0; // Convert to hours
  const avgREMSleep = remSleep.length > 0 ? Math.round(remSleep.reduce((a, b) => a + b, 0) / remSleep.length / 60) : 0;
  const avgDeepSleep = deepSleep.length > 0 ? Math.round(deepSleep.reduce((a, b) => a + b, 0) / deepSleep.length / 60) : 0;

  return {
    type: 'Oura Ring',
    period: `${data.length} days`,
    metrics: {
      avgSleepScore,
      avgReadiness,
      avgTotalSleep: `${avgTotalSleep}h`,
      avgREMSleep: `${avgREMSleep}h`,
      avgDeepSleep: `${avgDeepSleep}h`
    },
    insights: generateOuraInsights(avgSleepScore, avgReadiness, avgTotalSleep)
  };
}

function analyzeWhoopData(data: Record<string, string>[]) {
  // Extract key metrics from WHOOP data
  const recoveryScores = data.map(d => parseFloat(d.recovery || d['Recovery'] || d['Recovery %'] || '0')).filter(s => s > 0);
  const strainScores = data.map(d => parseFloat(d.strain || d['Strain'] || d['Day Strain'] || '0')).filter(s => s > 0);
  const sleepPerformance = data.map(d => parseFloat(d.sleep_performance || d['Sleep Performance'] || d['Sleep Performance %'] || '0')).filter(s => s > 0);
  const hrv = data.map(d => parseFloat(d.hrv || d['HRV'] || d['Resting Heart Rate Variability'] || '0')).filter(s => s > 0);

  const avgRecovery = recoveryScores.length > 0 ? Math.round(recoveryScores.reduce((a, b) => a + b, 0) / recoveryScores.length) : 0;
  const avgStrain = strainScores.length > 0 ? (strainScores.reduce((a, b) => a + b, 0) / strainScores.length).toFixed(1) : '0';
  const avgSleepPerf = sleepPerformance.length > 0 ? Math.round(sleepPerformance.reduce((a, b) => a + b, 0) / sleepPerformance.length) : 0;
  const avgHRV = hrv.length > 0 ? Math.round(hrv.reduce((a, b) => a + b, 0) / hrv.length) : 0;

  return {
    type: 'WHOOP',
    period: `${data.length} days`,
    metrics: {
      avgRecovery: `${avgRecovery}%`,
      avgStrain,
      avgSleepPerformance: `${avgSleepPerf}%`,
      avgHRV: avgHRV > 0 ? `${avgHRV}ms` : 'N/A'
    },
    insights: generateWhoopInsights(avgRecovery, parseFloat(avgStrain))
  };
}

function analyzeCGMData(data: Record<string, string>[]) {
  // Extract glucose readings from CGM data
  let glucoseReadings = data.map(d => parseFloat(
    d.glucose || d['Glucose'] || d['Glucose Value'] || d['Historic Glucose mg/dL'] ||
    d['mg/dL'] || d['mmol/L'] || d['Historic Glucose mmol/L'] || '0'
  )).filter(g => g > 0);

  if (glucoseReadings.length === 0) {
    return {
      type: 'CGM',
      period: `${data.length} readings`,
      metrics: {},
      insights: ['No valid glucose readings found in the data']
    };
  }

  // Detect if readings are in mmol/L or mg/dL
  // mmol/L range is typically 3-15, mg/dL range is typically 50-300
  const avgReading = glucoseReadings.reduce((a, b) => a + b, 0) / glucoseReadings.length;
  const isMMOL = avgReading < 30; // If average is less than 30, likely mmol/L

  // Convert mmol/L to mg/dL if needed (1 mmol/L = 18 mg/dL)
  if (isMMOL) {
    glucoseReadings = glucoseReadings.map(g => g * 18);
  }

  // Filter out invalid readings after conversion
  glucoseReadings = glucoseReadings.filter(g => g > 0 && g < 500);

  if (glucoseReadings.length === 0) {
    return {
      type: 'CGM',
      period: `${data.length} readings`,
      metrics: {},
      insights: ['No valid glucose readings found in the data']
    };
  }

  const avgGlucose = Math.round(glucoseReadings.reduce((a, b) => a + b, 0) / glucoseReadings.length);
  const minGlucose = Math.min(...glucoseReadings);
  const maxGlucose = Math.max(...glucoseReadings);
  const inRange = glucoseReadings.filter(g => g >= 70 && g <= 140).length;
  const timeInRange = Math.round((inRange / glucoseReadings.length) * 100);

  const unit = isMMOL ? 'mmol/L (converted to mg/dL)' : 'mg/dL';

  return {
    type: 'CGM',
    period: `${glucoseReadings.length} readings`,
    unit,
    metrics: {
      avgGlucose: `${avgGlucose} mg/dL`,
      minGlucose: `${Math.round(minGlucose)} mg/dL`,
      maxGlucose: `${Math.round(maxGlucose)} mg/dL`,
      timeInRange: `${timeInRange}%`
    },
    insights: generateCGMInsights(avgGlucose, timeInRange, minGlucose, maxGlucose)
  };
}

function generateOuraInsights(sleepScore: number, readiness: number, totalSleep: number): string[] {
  const insights = [];

  if (sleepScore < 70) {
    insights.push('Your sleep quality could be improved. Consider optimizing your sleep environment and bedtime routine.');
  } else if (sleepScore >= 85) {
    insights.push('Excellent sleep quality! Your current sleep habits are working well.');
  }

  if (readiness < 70) {
    insights.push('Low readiness suggests you may need more recovery. Consider lighter training or additional rest.');
  }

  if (totalSleep < 7) {
    insights.push('You\'re averaging less than 7 hours of sleep. Aim for 7-9 hours for optimal recovery.');
  }

  return insights.length > 0 ? insights : ['Your sleep metrics look good overall'];
}

function generateWhoopInsights(recovery: number, strain: number): string[] {
  const insights = [];

  if (recovery < 33) {
    insights.push('Low recovery detected. Prioritize rest and avoid high-intensity training.');
  } else if (recovery >= 67) {
    insights.push('High recovery! Your body is well-rested and ready for intense training.');
  }

  if (strain > 18) {
    insights.push('High strain levels. Ensure adequate recovery to prevent overtraining.');
  }

  return insights.length > 0 ? insights : ['Your recovery and strain metrics are balanced'];
}

function generateCGMInsights(avgGlucose: number, timeInRange: number, minGlucose: number, maxGlucose: number): string[] {
  const insights = [];

  if (avgGlucose > 120) {
    insights.push('Average glucose is elevated. Consider reducing refined carbohydrates and increasing fiber intake.');
  } else if (avgGlucose < 70) {
    insights.push('Average glucose is low. Ensure regular meals and consider complex carbohydrates.');
  }

  if (timeInRange < 70) {
    insights.push('Time in range could be improved. Focus on balanced meals and consistent eating patterns.');
  } else if (timeInRange >= 80) {
    insights.push('Excellent glucose control! Your current dietary approach is working well.');
  }

  if (maxGlucose > 180) {
    insights.push('Glucose spikes detected. Avoid high-glycemic foods and pair carbs with protein/fat.');
  }

  if (minGlucose < 70) {
    insights.push('Low glucose episodes detected. Avoid long fasting periods and ensure balanced meals.');
  }

  return insights;
}
