'use client';

import { useState } from 'react';

interface DebugResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  data: any;
  duration?: number;
}

export default function EcosystemDebugPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (step: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(step)) {
      newExpanded.delete(step);
    } else {
      newExpanded.add(step);
    }
    setExpandedSections(newExpanded);
  };

  const runDiagnostics = async () => {
    if (!email) {
      alert('Please enter an email');
      return;
    }

    setLoading(true);
    setResults([]);
    const newResults: DebugResult[] = [];

    // Step 1: Check stored tokens
    try {
      const start = Date.now();
      const res = await fetch(`/api/admin/ecosystem-debug/tokens?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      newResults.push({
        step: '1. Stored Tokens',
        status: data.tokens?.length > 0 ? 'success' : 'warning',
        data: data,
        duration: Date.now() - start,
      });
    } catch (error) {
      newResults.push({
        step: '1. Stored Tokens',
        status: 'error',
        data: { error: String(error) },
      });
    }
    setResults([...newResults]);

    // Step 2: Check Oura data
    try {
      const start = Date.now();
      const res = await fetch(`/api/admin/ecosystem-debug/oura?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      newResults.push({
        step: '2. Oura Ring Data',
        status: data.success ? 'success' : data.notConnected ? 'warning' : 'error',
        data: data,
        duration: Date.now() - start,
      });
    } catch (error) {
      newResults.push({
        step: '2. Oura Ring Data',
        status: 'error',
        data: { error: String(error) },
      });
    }
    setResults([...newResults]);

    // Step 3: Check aggregate context
    try {
      const start = Date.now();
      const res = await fetch('/api/aggregate-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          contextType: 'forge',
          forceRefresh: true,
        }),
      });
      const data = await res.json();
      newResults.push({
        step: '3. Aggregated Context',
        status: data.context ? 'success' : 'warning',
        data: data,
        duration: Date.now() - start,
      });
    } catch (error) {
      newResults.push({
        step: '3. Aggregated Context',
        status: 'error',
        data: { error: String(error) },
      });
    }
    setResults([...newResults]);

    // Step 4: Check onboarding data
    try {
      const start = Date.now();
      const res = await fetch(`/api/admin/ecosystem-debug/onboarding?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      newResults.push({
        step: '4. Onboarding Data',
        status: data.data ? 'success' : 'warning',
        data: data,
        duration: Date.now() - start,
      });
    } catch (error) {
      newResults.push({
        step: '4. Onboarding Data',
        status: 'error',
        data: { error: String(error) },
      });
    }
    setResults([...newResults]);

    // Step 5: Check ecosystem sync status
    try {
      const start = Date.now();
      const res = await fetch(`/api/admin/ecosystem-debug/sync-status?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      newResults.push({
        step: '5. Ecosystem Sync Status',
        status: data.syncStatus ? 'success' : 'warning',
        data: data,
        duration: Date.now() - start,
      });
    } catch (error) {
      newResults.push({
        step: '5. Ecosystem Sync Status',
        status: 'error',
        data: { error: String(error) },
      });
    }
    setResults([...newResults]);

    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#f44336';
      case 'warning': return '#ff9800';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'warning': return '⚠';
      default: return '?';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      padding: '40px',
      fontFamily: 'monospace',
    }}>
      <h1 style={{ marginBottom: '8px' }}>Ecosystem Debug</h1>
      <p style={{ color: '#888', marginBottom: '32px' }}>
        Test ecosystem connectors and data aggregation
      </p>

      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>
          User Email
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
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <button
            onClick={runDiagnostics}
            disabled={loading}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              background: loading ? '#333' : '#fff',
              color: loading ? '#666' : '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Running...' : 'Run Diagnostics'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results.map((result, index) => (
            <div
              key={index}
              style={{
                background: '#1a1a1a',
                border: `1px solid ${getStatusColor(result.status)}33`,
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => toggleSection(result.step)}
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: expandedSections.has(result.step) ? '1px solid #333' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: `${getStatusColor(result.status)}22`,
                    color: getStatusColor(result.status),
                    fontWeight: 'bold',
                  }}>
                    {getStatusIcon(result.status)}
                  </span>
                  <span style={{ fontWeight: 600 }}>{result.step}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {result.duration && (
                    <span style={{ color: '#666', fontSize: '14px' }}>
                      {result.duration}ms
                    </span>
                  )}
                  <span style={{ color: '#666' }}>
                    {expandedSections.has(result.step) ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {expandedSections.has(result.step) && (
                <div style={{ padding: '16px 20px' }}>
                  <pre style={{
                    margin: 0,
                    padding: '16px',
                    background: '#0d0d0d',
                    borderRadius: '8px',
                    overflow: 'auto',
                    maxHeight: '400px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: '32px', padding: '20px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #333' }}>
          <h3 style={{ marginBottom: '16px' }}>Manual Sync Test</h3>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '14px' }}>
            Manually trigger a sync to fetch fresh data from connected providers
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['oura', 'dexcom', 'vital'].map((provider) => (
              <button
                key={provider}
                onClick={async () => {
                  const res = await fetch('/api/admin/ecosystem-debug/test-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, provider }),
                  });
                  const data = await res.json();
                  alert(`${provider.toUpperCase()} Sync Result:\n\n${JSON.stringify(data, null, 2)}`);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Sync {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: '32px', padding: '20px', background: '#1a1a1a', borderRadius: '12px' }}>
          <h3 style={{ marginBottom: '16px' }}>Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ color: '#888', fontSize: '14px', marginBottom: '4px' }}>Total Steps</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{results.length}</div>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: '14px', marginBottom: '4px' }}>Successful</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                {results.filter(r => r.status === 'success').length}
              </div>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: '14px', marginBottom: '4px' }}>Warnings</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                {results.filter(r => r.status === 'warning').length}
              </div>
            </div>
            <div>
              <div style={{ color: '#888', fontSize: '14px', marginBottom: '4px' }}>Errors</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f44336' }}>
                {results.filter(r => r.status === 'error').length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
