'use client';

import React, { useState } from 'react';

interface Insight {
  dataObservation: string;
  title: string;
  insight: string;
  impact: string;
  evidence: string;
}

interface DayPlan {
  day: string;
  plan: string;
}

export default function SageTestingPage() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [error, setError] = useState('');

  const [fitnessLoading, setFitnessLoading] = useState(false);
  const [fitnessPlan, setFitnessPlan] = useState<DayPlan[]>([]);
  const [fitnessError, setFitnessError] = useState('');

  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionPlan, setNutritionPlan] = useState<DayPlan[]>([]);
  const [nutritionError, setNutritionError] = useState('');

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');

  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeam, setSlackTeam] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInsights([]);

    try {
      const formData = new FormData(e.currentTarget);

      const response = await fetch('/api/analyze-health-data', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setInsights(data.insights);
      } else {
        setError(data.error || 'Failed to analyze data');
      }
    } catch (err) {
      setError('Error uploading files or analyzing data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFitnessPlan = async () => {
    setFitnessLoading(true);
    setFitnessError('');
    setFitnessPlan([]);

    try {
      const response = await fetch('/api/generate-fitness-plan', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setFitnessPlan(data.plan);
      } else {
        setFitnessError(data.error || 'Failed to generate fitness plan');
      }
    } catch (err) {
      setFitnessError('Error generating fitness plan');
      console.error(err);
    } finally {
      setFitnessLoading(false);
    }
  };

  const handleNutritionPlan = async () => {
    setNutritionLoading(true);
    setNutritionError('');
    setNutritionPlan([]);

    try {
      const response = await fetch('/api/generate-nutrition-plan', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setNutritionPlan(data.plan);
      } else {
        setNutritionError(data.error || 'Failed to generate nutrition plan');
      }
    } catch (err) {
      setNutritionError('Error generating nutrition plan');
      console.error(err);
    } finally {
      setNutritionLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      // Initiate OAuth flow
      const response = await fetch('/api/gmail/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open OAuth in new window
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error('Error connecting Gmail:', err);
      alert('Failed to connect Gmail');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      // Call API to clear cookies
      await fetch('/api/gmail/disconnect', { method: 'POST' });

      setGmailConnected(false);
      setGmailEmail('');

      // Force reload to clear cookies
      window.location.reload();
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
    }
  };

  const handleConnectSlack = async () => {
    try {
      // Initiate OAuth flow
      const response = await fetch('/api/slack/auth');
      const data = await response.json();

      if (data.authUrl) {
        // Open OAuth in new window
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error('Error connecting Slack:', err);
      alert('Failed to connect Slack');
    }
  };

  const handleDisconnectSlack = async () => {
    try {
      // Call API to clear cookies
      await fetch('/api/slack/disconnect', { method: 'POST' });

      setSlackConnected(false);
      setSlackTeam('');

      // Force reload to clear cookies
      window.location.reload();
    } catch (err) {
      console.error('Error disconnecting Slack:', err);
    }
  };

  // Check if Gmail and Slack are already connected on mount
  React.useEffect(() => {
    // Check cookies for gmail connection
    const cookies = document.cookie.split(';');
    const gmailEmailCookie = cookies.find(c => c.trim().startsWith('gmail_email='));
    const slackTeamCookie = cookies.find(c => c.trim().startsWith('slack_team='));

    if (gmailEmailCookie) {
      const email = gmailEmailCookie.split('=')[1];
      setGmailConnected(true);
      setGmailEmail(decodeURIComponent(email));
    }

    if (slackTeamCookie) {
      const team = slackTeamCookie.split('=')[1];
      setSlackConnected(true);
      setSlackTeam(decodeURIComponent(team));
    }
  }, []);

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Health Data Analysis - Testing Page</h1>
      <p>Upload your health data files to generate personalized insights.</p>

      <form onSubmit={handleSubmit} style={{ marginTop: '30px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Blood Test Results (PDF)
          </label>
          <input
            type="file"
            name="bloodTest"
            accept=".pdf"
            style={{ display: 'block' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            CGM Data (CSV or JSON)
          </label>
          <input
            type="file"
            name="cgm"
            accept=".csv,.json"
            style={{ display: 'block' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Food Diary (CSV or TXT)
          </label>
          <input
            type="file"
            name="foodDiary"
            accept=".csv,.txt"
            style={{ display: 'block' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Whoop Data (CSV or JSON)
          </label>
          <input
            type="file"
            name="whoop"
            accept=".csv,.json"
            style={{ display: 'block' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Oura Ring Data (CSV or JSON)
          </label>
          <input
            type="file"
            name="oura"
            accept=".csv,.json"
            style={{ display: 'block' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Gmail Integration
          </label>
          {gmailConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#388e3c', fontWeight: 'bold' }}>Connected: {gmailEmail}</span>
              <button
                type="button"
                onClick={handleDisconnectGmail}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  backgroundColor: '#d32f2f',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGmail}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#1976d2',
                color: '#fff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Connect Gmail
            </button>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Slack Integration
          </label>
          {slackConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#388e3c', fontWeight: 'bold' }}>Connected: {slackTeam}</span>
              <button
                type="button"
                onClick={handleDisconnectSlack}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  backgroundColor: '#d32f2f',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectSlack}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#611f69',
                color: '#fff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Connect Slack
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#000',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '20px'
          }}
        >
          {loading ? 'Analyzing...' : 'Generate Insights'}
        </button>
      </form>

      <div style={{ marginTop: '30px', display: 'flex', gap: '20px' }}>
        <button
          onClick={handleFitnessPlan}
          disabled={fitnessLoading}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: fitnessLoading ? '#ccc' : '#1976d2',
            color: '#fff',
            border: 'none',
            cursor: fitnessLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {fitnessLoading ? 'Generating...' : 'Generate 7-Day Fitness Plan'}
        </button>

        <button
          onClick={handleNutritionPlan}
          disabled={nutritionLoading}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: nutritionLoading ? '#ccc' : '#388e3c',
            color: '#fff',
            border: 'none',
            cursor: nutritionLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {nutritionLoading ? 'Generating...' : 'Generate 7-Day Nutrition Plan'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#ffebee', color: '#c62828' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: '30px', fontSize: '18px' }}>
          Processing your health data and generating insights...
        </div>
      )}

      {insights.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h2>Your Personalized Health Insights ({insights.length})</h2>
          <div style={{ marginTop: '20px' }}>
            {insights.map((insight, index) => (
              <div
                key={index}
                style={{
                  border: '2px solid #e0e0e0',
                  padding: '24px',
                  marginBottom: '30px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {insight.dataObservation && (
                  <div style={{
                    backgroundColor: '#e8f4f8',
                    padding: '16px',
                    marginBottom: '18px',
                    borderLeft: '5px solid #0288d1',
                    fontSize: '15px',
                    lineHeight: '1.6',
                    fontFamily: 'monospace'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#01579b', marginBottom: '8px', fontFamily: 'inherit' }}>
                      YOUR DATA
                    </div>
                    <div style={{ color: '#424242' }}>
                      {insight.dataObservation}
                    </div>
                  </div>
                )}
                <h3 style={{ marginTop: 0 }}>
                  {index + 1}. {insight.title}
                </h3>
                <p style={{ marginBottom: '10px' }}>
                  <strong>Insight:</strong> {insight.insight}
                </p>
                {insight.impact && (
                  <p style={{ marginBottom: '10px' }}>
                    <strong>Potential Impact:</strong> {insight.impact}
                  </p>
                )}
                {insight.evidence && (
                  <p style={{ marginBottom: 0, fontSize: '14px', color: '#666' }}>
                    <strong>Evidence:</strong> {insight.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {fitnessError && (
        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#ffebee', color: '#c62828' }}>
          <strong>Error:</strong> {fitnessError}
        </div>
      )}

      {fitnessPlan.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h2>Your 7-Day Fitness Plan</h2>
          <div style={{ marginTop: '20px' }}>
            {fitnessPlan.map((dayPlan, index) => (
              <div
                key={index}
                style={{
                  border: '2px solid #1565c0',
                  padding: '24px',
                  marginBottom: '20px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '8px'
                }}
              >
                <h3 style={{ marginTop: 0, color: '#1565c0' }}>{dayPlan.day}</h3>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                  {dayPlan.plan}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {nutritionError && (
        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#ffebee', color: '#c62828' }}>
          <strong>Error:</strong> {nutritionError}
        </div>
      )}

      {nutritionPlan.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h2>Your 7-Day Nutrition Plan</h2>
          <div style={{ marginTop: '20px' }}>
            {nutritionPlan.map((dayPlan, index) => (
              <div
                key={index}
                style={{
                  border: '2px solid #2e7d32',
                  padding: '24px',
                  marginBottom: '20px',
                  backgroundColor: '#e8f5e9',
                  borderRadius: '8px'
                }}
              >
                <h3 style={{ marginTop: 0, color: '#2e7d32' }}>{dayPlan.day}</h3>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                  {dayPlan.plan}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
