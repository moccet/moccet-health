'use client';

import { useState } from 'react';

export default function BlogCachePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCache = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/refresh-blog-cache', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to refresh cache');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh cache');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '50px auto',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ marginBottom: '20px' }}>Blog Cache Management</h1>

      <div style={{
        padding: '20px',
        background: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ marginTop: 0 }}>Refresh Cache</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Click the button below to fetch the latest posts from Substack and update the cache.
        </p>

        <button
          onClick={refreshCache}
          disabled={loading}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 600,
            background: loading ? '#ccc' : '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh Cache'}
        </button>
      </div>

      {result && (
        <div style={{
          padding: '20px',
          background: '#e8f5e9',
          border: '1px solid #4caf50',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, color: '#2e7d32' }}>✅ Success!</h3>
          <p style={{ margin: '10px 0' }}>
            <strong>Posts cached:</strong> {result.postsCount}
          </p>
          <p style={{ margin: '10px 0' }}>
            <strong>Source:</strong> {result.fromCache ? 'Used existing cache' : 'Fetched fresh from Substack'}
          </p>
          <p style={{ margin: '10px 0', fontSize: '14px', color: '#555' }}>
            {result.message}
          </p>
        </div>
      )}

      {error && (
        <div style={{
          padding: '20px',
          background: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, color: '#c62828' }}>❌ Error</h3>
          <p style={{ margin: 0, color: '#555' }}>{error}</p>
        </div>
      )}

      <div style={{
        padding: '20px',
        background: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginTop: 0 }}>ℹ️ Info</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Cache is automatically refreshed every hour</li>
          <li>Use this page to manually force a cache refresh</li>
          <li>The cache improves load times on the /news page</li>
          <li>First-time visitors will see instant results after cache population</li>
        </ul>
      </div>
    </div>
  );
}
