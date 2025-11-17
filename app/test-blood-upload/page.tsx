'use client';

import { useState } from 'react';

export default function TestBloodUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [email, setEmail] = useState('test@dev.com');
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('bloodTest', file);
      formData.append('email', email);

      console.log('Uploading PDF for analysis...');
      const response = await fetch('/api/analyze-blood-results', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('Response:', data);

      if (response.ok && data.success) {
        setResult(data.analysis);
      } else {
        setError(data.error || 'Failed to analyze PDF');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ marginBottom: '20px' }}>🧪 Dev Blood PDF Upload Test</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Upload a blood test PDF to test the AI analysis API
      </p>

      <div style={{ marginBottom: '30px', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Email (for caching):
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Blood Test PDF:
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            style={{ fontSize: '14px' }}
          />
          {file && (
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={loading || !file}
          style={{
            padding: '12px 24px',
            background: loading || !file ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: loading || !file ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analyzing...' : 'Upload & Analyze'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '15px',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '30px' }}>
          <h2 style={{ marginBottom: '20px', color: '#333' }}>✅ Analysis Result</h2>

          {/* Summary */}
          <div style={{
            padding: '20px',
            background: '#f0f9ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0, color: '#1e40af' }}>Summary</h3>
            <p style={{ margin: 0, lineHeight: '1.6' }}>{result.summary}</p>
          </div>

          {/* Biomarkers */}
          {result.biomarkers && result.biomarkers.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ marginBottom: '15px' }}>Biomarkers ({result.biomarkers.length})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {result.biomarkers.map((marker: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: '15px',
                      background: 'white',
                      border: `2px solid ${
                        marker.status === 'Optimal' ? '#10b981' :
                        marker.status === 'Normal' ? '#3b82f6' :
                        marker.status === 'Borderline' ? '#f59e0b' :
                        '#ef4444'
                      }`,
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <strong style={{ fontSize: '16px' }}>{marker.name}</strong>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: marker.status === 'Optimal' ? '#d1fae5' :
                                   marker.status === 'Normal' ? '#dbeafe' :
                                   marker.status === 'Borderline' ? '#fef3c7' : '#fee2e2',
                        color: marker.status === 'Optimal' ? '#065f46' :
                               marker.status === 'Normal' ? '#1e40af' :
                               marker.status === 'Borderline' ? '#92400e' : '#991b1b'
                      }}>
                        {marker.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '5px' }}>{marker.value}</div>
                    {marker.referenceRange && (
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                        Range: {marker.referenceRange}
                      </div>
                    )}
                    <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#555' }}>
                      <strong>Significance:</strong> {marker.significance}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concerns */}
          {result.concerns && result.concerns.length > 0 && (
            <div style={{
              padding: '20px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, color: '#991b1b' }}>⚠️ Areas of Concern</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {result.concerns.map((concern: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: '8px' }}>{concern}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Positives */}
          {result.positives && result.positives.length > 0 && (
            <div style={{
              padding: '20px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, color: '#065f46' }}>✅ Positive Findings</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {result.positives.map((positive: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: '8px' }}>{positive}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw JSON */}
          <details style={{ marginTop: '30px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '500', marginBottom: '10px' }}>
              📋 View Raw JSON
            </summary>
            <pre style={{
              padding: '15px',
              background: '#1e1e1e',
              color: '#d4d4d4',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px',
              lineHeight: '1.5'
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
