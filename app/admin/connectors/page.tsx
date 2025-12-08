'use client';

import { useState, useEffect } from 'react';

interface Connector {
  id: string;
  name: string;
  description: string;
  category: 'health' | 'productivity' | 'communication';
  icon: string;
  authEndpoint: string;
  dataEndpoint?: string;
}

interface ConnectorStatus {
  id: string;
  connected: boolean;
  lastSync?: string;
  providerUserId?: string;
  error?: string;
}

interface ConnectorData {
  provider: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

const CONNECTORS: Connector[] = [
  // Health & Fitness
  {
    id: 'oura',
    name: 'Oura Ring',
    description: 'Sleep, readiness, and activity tracking',
    category: 'health',
    icon: '💍',
    authEndpoint: '/api/oura/auth',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Activity, heart rate, and sleep data',
    category: 'health',
    icon: '⌚',
    authEndpoint: '/api/fitbit/auth',
  },
  {
    id: 'strava',
    name: 'Strava',
    description: 'Running, cycling, and workout activities',
    category: 'health',
    icon: '🏃',
    authEndpoint: '/api/strava/auth',
  },
  {
    id: 'dexcom',
    name: 'Dexcom',
    description: 'Continuous glucose monitoring data',
    category: 'health',
    icon: '📊',
    authEndpoint: '/api/dexcom/auth',
  },
  // Productivity
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email and calendar integration',
    category: 'productivity',
    icon: '📧',
    authEndpoint: '/api/gmail/auth',
  },
  {
    id: 'outlook',
    name: 'Outlook Calendar',
    description: 'Microsoft calendar and email',
    category: 'productivity',
    icon: '📅',
    authEndpoint: '/api/outlook/auth',
  },
  // Communication
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team messaging and channels',
    category: 'communication',
    icon: '💬',
    authEndpoint: '/api/slack/auth',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Team collaboration and meetings',
    category: 'communication',
    icon: '👥',
    authEndpoint: '/api/teams/auth',
  },
];

export default function ConnectorsPage() {
  const [email, setEmail] = useState('');
  const [statuses, setStatuses] = useState<Record<string, ConnectorStatus>>({});
  const [loading, setLoading] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [fetchingDataId, setFetchingDataId] = useState<string | null>(null);
  const [connectorData, setConnectorData] = useState<Record<string, ConnectorData>>({});
  const [expandedData, setExpandedData] = useState<Set<string>>(new Set());
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, any>>({});

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type?.includes('-connected') || event.data?.type?.includes('-error')) {
        // Refresh statuses after OAuth callback
        if (email) {
          fetchStatuses();
        }
        setConnectingId(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [email]);

  const fetchStatuses = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/connectors/status?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.statuses) {
        setStatuses(data.statuses);
      }
    } catch (error) {
      console.error('Failed to fetch statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (connector: Connector) => {
    if (!email) {
      alert('Please enter an email first');
      return;
    }

    setConnectingId(connector.id);
    try {
      const res = await fetch(connector.authEndpoint);
      const data = await res.json();

      if (data.authUrl) {
        // Encode email in state parameter for the callback
        const authUrl = new URL(data.authUrl);
        const currentState = authUrl.searchParams.get('state') || '';
        const stateData = JSON.stringify({
          email,
          returnPath: '/admin/connectors',
          originalState: currentState,
        });
        authUrl.searchParams.set('state', encodeURIComponent(stateData));

        // Open OAuth in popup for desktop, redirect for mobile
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        window.open(
          authUrl.toString(),
          `${connector.id}-auth`,
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
        );
      } else if (data.error) {
        alert(`Error: ${data.error}`);
        setConnectingId(null);
      }
    } catch (error) {
      console.error('Failed to initiate auth:', error);
      alert('Failed to connect. Check console for details.');
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (connectorId: string) => {
    if (!email) return;

    if (!confirm(`Are you sure you want to disconnect ${connectorId}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/connectors/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, provider: connectorId }),
      });
      const data = await res.json();

      if (data.success) {
        fetchStatuses();
      } else {
        alert(`Failed to disconnect: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleFetchData = async (connectorId: string) => {
    if (!email) return;

    setFetchingDataId(connectorId);
    try {
      const res = await fetch('/api/admin/connectors/fetch-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, provider: connectorId }),
      });
      const data = await res.json();

      setConnectorData((prev) => ({
        ...prev,
        [connectorId]: {
          provider: connectorId,
          success: data.success,
          data: data.data,
          error: data.error,
          timestamp: new Date().toISOString(),
        },
      }));

      // Auto-expand to show the data
      setExpandedData((prev) => new Set(prev).add(connectorId));
    } catch (error) {
      setConnectorData((prev) => ({
        ...prev,
        [connectorId]: {
          provider: connectorId,
          success: false,
          error: String(error),
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setFetchingDataId(null);
    }
  };

  const toggleDataExpand = (connectorId: string) => {
    setExpandedData((prev) => {
      const next = new Set(prev);
      if (next.has(connectorId)) {
        next.delete(connectorId);
      } else {
        next.add(connectorId);
      }
      return next;
    });
  };

  // Full analysis endpoints for each connector
  const analysisEndpoints: Record<string, string> = {
    gmail: '/api/gmail/fetch-data',
    oura: '/api/oura/sync',
    fitbit: '/api/fitbit/sync',
    strava: '/api/strava/sync',
  };

  const handleRunAnalysis = async (connectorId: string) => {
    if (!email) return;

    const endpoint = analysisEndpoints[connectorId];
    if (!endpoint) {
      alert(`Full analysis not yet implemented for ${connectorId}`);
      return;
    }

    setAnalyzingId(connectorId);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      setAnalysisResults((prev) => ({
        ...prev,
        [connectorId]: {
          success: data.success !== false,
          data,
          timestamp: new Date().toISOString(),
        },
      }));

      // Auto-expand to show the analysis
      setExpandedData((prev) => new Set(prev).add(`${connectorId}-analysis`));
    } catch (error) {
      setAnalysisResults((prev) => ({
        ...prev,
        [connectorId]: {
          success: false,
          error: String(error),
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setAnalyzingId(null);
    }
  };

  const categories = [
    { id: 'health', name: 'Health & Fitness', color: '#4CAF50' },
    { id: 'productivity', name: 'Productivity', color: '#2196F3' },
    { id: 'communication', name: 'Communication', color: '#9C27B0' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        padding: '40px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '8px', fontSize: '28px' }}>Ecosystem Connectors</h1>
        <p style={{ color: '#888', marginBottom: '32px' }}>
          Test OAuth connections and view data from each integration
        </p>

        {/* Email Input */}
        <div
          style={{
            marginBottom: '32px',
            padding: '24px',
            background: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid #333',
          }}
        >
          <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '14px' }}>
            User Email (for token storage)
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              style={{
                flex: 1,
                maxWidth: '400px',
                padding: '12px 16px',
                fontSize: '16px',
                background: '#0d0d0d',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <button
              onClick={fetchStatuses}
              disabled={!email || loading}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                background: loading ? '#333' : '#fff',
                color: loading ? '#666' : '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || !email ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Checking...' : 'Check Connections'}
            </button>
          </div>
        </div>

        {/* Connectors by Category */}
        {categories.map((category) => {
          const categoryConnectors = CONNECTORS.filter((c) => c.category === category.id);
          if (categoryConnectors.length === 0) return null;

          return (
            <div key={category.id} style={{ marginBottom: '32px' }}>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  marginBottom: '16px',
                  color: category.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: category.color,
                  }}
                />
                {category.name}
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '16px',
                }}
              >
                {categoryConnectors.map((connector) => {
                  const status = statuses[connector.id];
                  const isConnected = status?.connected;
                  const isConnecting = connectingId === connector.id;
                  const isFetching = fetchingDataId === connector.id;
                  const isAnalyzing = analyzingId === connector.id;
                  const data = connectorData[connector.id];
                  const analysis = analysisResults[connector.id];
                  const isExpanded = expandedData.has(connector.id);
                  const isAnalysisExpanded = expandedData.has(`${connector.id}-analysis`);
                  const hasAnalysisEndpoint = !!analysisEndpoints[connector.id];

                  return (
                    <div
                      key={connector.id}
                      style={{
                        background: '#1a1a1a',
                        border: `1px solid ${isConnected ? '#4CAF5055' : '#333'}`,
                        borderRadius: '12px',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Connector Header */}
                      <div style={{ padding: '20px' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '28px' }}>{connector.icon}</span>
                            <div>
                              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                                {connector.name}
                              </h3>
                              <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
                                {connector.description}
                              </p>
                            </div>
                          </div>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              background: isConnected ? '#4CAF5022' : '#33333388',
                              color: isConnected ? '#4CAF50' : '#888',
                            }}
                          >
                            {isConnected ? 'Connected' : 'Not Connected'}
                          </span>
                        </div>

                        {/* Status Info */}
                        {status && isConnected && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#666',
                              marginBottom: '12px',
                              padding: '8px 12px',
                              background: '#0d0d0d',
                              borderRadius: '6px',
                            }}
                          >
                            {status.providerUserId && (
                              <div>User ID: {status.providerUserId}</div>
                            )}
                            {status.lastSync && (
                              <div>Last Sync: {new Date(status.lastSync).toLocaleString()}</div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {!isConnected ? (
                            <button
                              onClick={() => handleConnect(connector)}
                              disabled={isConnecting || !email}
                              style={{
                                flex: 1,
                                padding: '10px 16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                background: isConnecting ? '#333' : category.color,
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: isConnecting || !email ? 'not-allowed' : 'pointer',
                                opacity: !email ? 0.5 : 1,
                              }}
                            >
                              {isConnecting ? 'Connecting...' : 'Connect'}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleFetchData(connector.id)}
                                disabled={isFetching}
                                style={{
                                  padding: '10px 16px',
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  background: isFetching ? '#333' : '#444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: isFetching ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {isFetching ? 'Fetching...' : 'Quick Test'}
                              </button>
                              {hasAnalysisEndpoint && (
                                <button
                                  onClick={() => handleRunAnalysis(connector.id)}
                                  disabled={isAnalyzing}
                                  style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    background: isAnalyzing ? '#333' : category.color,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  {isAnalyzing ? 'Analyzing...' : 'Full Analysis'}
                                </button>
                              )}
                              <button
                                onClick={() => handleDisconnect(connector.id)}
                                style={{
                                  padding: '10px 16px',
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  background: 'transparent',
                                  color: '#f44336',
                                  border: '1px solid #f4433644',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                }}
                              >
                                Disconnect
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Data Section */}
                      {data && (
                        <div style={{ borderTop: '1px solid #333' }}>
                          <div
                            onClick={() => toggleDataExpand(connector.id)}
                            style={{
                              padding: '12px 20px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#151515',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: data.success ? '#4CAF50' : '#f44336',
                              }}
                            >
                              {data.success ? 'Data Retrieved' : 'Error'}
                              <span style={{ color: '#666', marginLeft: '8px' }}>
                                {new Date(data.timestamp).toLocaleTimeString()}
                              </span>
                            </span>
                            <span style={{ color: '#666' }}>{isExpanded ? '▼' : '▶'}</span>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '12px 20px', paddingTop: 0 }}>
                              <pre
                                style={{
                                  margin: 0,
                                  padding: '12px',
                                  background: '#0d0d0d',
                                  borderRadius: '6px',
                                  overflow: 'auto',
                                  maxHeight: '300px',
                                  fontSize: '12px',
                                  lineHeight: '1.4',
                                  color: '#ccc',
                                }}
                              >
                                {JSON.stringify(data.data || data.error, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Full Analysis Results */}
                      {analysis && (
                        <div style={{ borderTop: '1px solid #333' }}>
                          <div
                            onClick={() => toggleDataExpand(`${connector.id}-analysis`)}
                            style={{
                              padding: '12px 20px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#0f1f0f',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: analysis.success ? '#4CAF50' : '#f44336',
                              }}
                            >
                              Full Analysis {analysis.success ? 'Complete' : 'Error'}
                              <span style={{ color: '#666', marginLeft: '8px' }}>
                                {new Date(analysis.timestamp).toLocaleTimeString()}
                              </span>
                            </span>
                            <span style={{ color: '#666' }}>{isAnalysisExpanded ? '▼' : '▶'}</span>
                          </div>

                          {isAnalysisExpanded && (
                            <div style={{ padding: '12px 20px', paddingTop: 0 }}>
                              {/* Show insights summary if available */}
                              {analysis.data?.patterns?.insights && (
                                <div style={{ marginBottom: '12px', padding: '12px', background: '#1a2a1a', borderRadius: '6px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#4CAF50', marginBottom: '8px' }}>Insights</div>
                                  {analysis.data.patterns.insights.map((insight: string, i: number) => (
                                    <div key={i} style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>• {insight}</div>
                                  ))}
                                </div>
                              )}
                              {/* Show metrics if available */}
                              {analysis.data?.metrics && (
                                <div style={{ marginBottom: '12px', padding: '12px', background: '#1a1a2a', borderRadius: '6px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#2196F3', marginBottom: '8px' }}>Metrics</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px', color: '#ccc' }}>
                                    {Object.entries(analysis.data.metrics).map(([key, value]) => (
                                      <div key={key}><span style={{ color: '#888' }}>{key}:</span> {String(value)}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Raw data */}
                              <pre
                                style={{
                                  margin: 0,
                                  padding: '12px',
                                  background: '#0d0d0d',
                                  borderRadius: '6px',
                                  overflow: 'auto',
                                  maxHeight: '400px',
                                  fontSize: '11px',
                                  lineHeight: '1.4',
                                  color: '#ccc',
                                }}
                              >
                                {JSON.stringify(analysis.data || analysis.error, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Quick Links */}
        <div
          style={{
            marginTop: '48px',
            padding: '24px',
            background: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid #333',
          }}
        >
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Related Tools</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="/admin/ecosystem-debug"
              style={{
                padding: '10px 20px',
                background: '#333',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            >
              Ecosystem Debug
            </a>
            <a
              href="/forge/onboarding"
              style={{
                padding: '10px 20px',
                background: '#333',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            >
              User Onboarding
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
