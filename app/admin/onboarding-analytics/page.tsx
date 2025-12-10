'use client';

import { useEffect, useState } from 'react';

interface ProgressRecord {
  id: string;
  session_id: string;
  email: string | null;
  product: 'forge' | 'sage';
  current_screen: string;
  screen_index: number;
  total_screens: number;
  started_at: string;
  last_updated_at: string;
  completed_at: string | null;
  dropped_off: boolean;
}

interface DropoffStats {
  screen: string;
  screen_index: number;
  total_reached: number;
  total_dropped: number;
  dropoff_rate: number;
}

interface FunnelData {
  screen: string;
  screen_index: number;
  users_reached: number;
  conversion_from_previous: number;
  overall_conversion: number;
}

const FORGE_SCREEN_LABELS: Record<string, string> = {
  'intro': 'Intro Video',
  'welcome': 'Welcome',
  'name': 'Name',
  'age': 'Age',
  'gender': 'Gender',
  'weight': 'Weight',
  'height': 'Height',
  'email': 'Email',
  'objective-intro': 'Objectives Intro',
  'primary-goal': 'Primary Goal',
  'time-horizon': 'Time Horizon',
  'training-days': 'Training Days',
  'baseline-intro': 'Baseline Intro',
  'injuries': 'Injuries',
  'movement-restrictions': 'Movement Restrictions',
  'medical-conditions': 'Medical Conditions',
  'environment-intro': 'Environment Intro',
  'equipment': 'Equipment',
  'training-location': 'Training Location',
  'session-length': 'Session Length',
  'exercise-time': 'Exercise Time',
  'sleep-quality': 'Sleep Quality',
  'stress-level': 'Stress Level',
  'forge-intake-intro': 'Intake Intro',
  'training-experience': 'Training Experience',
  'skills-priority': 'Skills Priority',
  'current-bests': 'Current Bests',
  'conditioning-preferences': 'Conditioning',
  'soreness-preference': 'Soreness Preference',
  'daily-activity': 'Daily Activity',
  'completion': 'Completion Summary',
  'final-step-intro': 'Final Steps Intro',
  'ecosystem-integration': 'Integrations',
  'lab-upload': 'Lab Upload',
  'payment': 'Payment',
  'final-completion': 'Completed'
};

const SAGE_SCREEN_LABELS: Record<string, string> = {
  'intro': 'Intro Video',
  'welcome': 'Welcome',
  'name': 'Name',
  'age': 'Age',
  'gender': 'Gender',
  'weight': 'Weight',
  'height': 'Height',
  'email': 'Email',
  'ikigai-intro': 'Ikigai Intro',
  'main-priority': 'Main Priority',
  'driving-goal': 'Driving Goal',
  'baseline-intro': 'Baseline Intro',
  'allergies': 'Allergies',
  'medications': 'Medications',
  'supplements': 'Supplements',
  'medical-conditions': 'Medical Conditions',
  'fuel-intro': 'Fuel Intro',
  'eating-style': 'Eating Style',
  'first-meal': 'First Meal',
  'energy-crash': 'Energy Crash',
  'protein-sources': 'Protein Sources',
  'food-dislikes': 'Food Dislikes',
  'meals-cooked': 'Meals Cooked',
  'completion': 'Completion Summary',
  'final-step-intro': 'Final Steps Intro',
  'ecosystem-integration': 'Integrations',
  'lab-upload': 'Lab Upload',
  'payment': 'Payment',
  'final-completion': 'Completed'
};

export default function OnboardingAnalyticsDashboard() {
  const [product, setProduct] = useState<'forge' | 'sage'>('forge');
  const [timeRange, setTimeRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [dropoffStats, setDropoffStats] = useState<DropoffStats[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);

  const screenLabels = product === 'forge' ? FORGE_SCREEN_LABELS : SAGE_SCREEN_LABELS;

  useEffect(() => {
    fetchData();
  }, [product, timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/onboarding-analytics?product=${product}&days=${timeRange}`
      );
      const data = await response.json();

      if (data.error) {
        console.error('Error fetching data:', data.error);
        return;
      }

      setProgressRecords(data.progressRecords || []);
      setDropoffStats(data.dropoffStats || []);
      setFunnelData(data.funnelData || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary stats
  const totalStarted = progressRecords.length;
  const totalCompleted = progressRecords.filter(r => r.completed_at).length;
  const totalWithEmail = progressRecords.filter(r => r.email).length;
  const completionRate = totalStarted > 0 ? ((totalCompleted / totalStarted) * 100).toFixed(1) : '0';
  const emailCaptureRate = totalStarted > 0 ? ((totalWithEmail / totalStarted) * 100).toFixed(1) : '0';

  // Group records by screen for drop-off analysis
  const screenStats = dropoffStats.sort((a, b) => a.screen_index - b.screen_index);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Onboarding Analytics</h1>
          <p className="text-gray-600 mt-2">
            Track user progress and identify drop-off points in your onboarding flow
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-8 flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value as 'forge' | 'sage')}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="forge">Forge (Fitness)</option>
              <option value="sage">Sage (Nutrition)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <button
            onClick={fetchData}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Total Started</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalStarted}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Emails Captured</h3>
                <p className="text-3xl font-bold text-blue-600 mt-2">{totalWithEmail}</p>
                <p className="text-sm text-gray-500 mt-1">{emailCaptureRate}% of started</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Completed</h3>
                <p className="text-3xl font-bold text-green-600 mt-2">{totalCompleted}</p>
                <p className="text-sm text-gray-500 mt-1">{completionRate}% completion rate</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Dropped Off</h3>
                <p className="text-3xl font-bold text-red-600 mt-2">{totalStarted - totalCompleted}</p>
                <p className="text-sm text-gray-500 mt-1">{(100 - Number(completionRate)).toFixed(1)}% drop-off</p>
              </div>
            </div>

            {/* Funnel Visualization */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Conversion Funnel</h2>
              <div className="space-y-2">
                {funnelData.map((step, index) => (
                  <div key={step.screen} className="flex items-center gap-4">
                    <div className="w-40 text-sm text-gray-600 truncate">
                      {screenLabels[step.screen] || step.screen}
                    </div>
                    <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          step.screen === 'email' ? 'bg-blue-500' :
                          step.screen === 'final-completion' ? 'bg-green-500' :
                          'bg-indigo-500'
                        }`}
                        style={{ width: `${step.overall_conversion}%` }}
                      />
                    </div>
                    <div className="w-24 text-right">
                      <span className="font-medium">{step.users_reached}</span>
                      <span className="text-sm text-gray-500 ml-1">({step.overall_conversion}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop-off by Screen */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Drop-off by Screen</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Screen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Users Reached
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dropped Here
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Drop-off Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {screenStats.map((stat) => (
                      <tr
                        key={stat.screen}
                        className={stat.dropoff_rate > 20 ? 'bg-red-50' : ''}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {screenLabels[stat.screen] || stat.screen}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.total_reached}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.total_dropped}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            stat.dropoff_rate > 20 ? 'bg-red-100 text-red-800' :
                            stat.dropoff_rate > 10 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {stat.dropoff_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Sessions</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Screen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {progressRecords.slice(0, 50).map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.email || <span className="text-gray-400">No email yet</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {screenLabels[record.current_screen] || record.current_screen}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: `${(record.screen_index / record.total_screens) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs">
                              {record.screen_index + 1}/{record.total_screens}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(record.started_at).toLocaleDateString()} {new Date(record.started_at).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.completed_at ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Completed
                            </span>
                          ) : record.dropped_off ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Dropped Off
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
