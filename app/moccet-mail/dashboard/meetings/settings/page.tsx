'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface NotetakerSettings {
  autoJoinEnabled: boolean;
  joinBufferMinutes: number;
  defaultLanguage: string;
  enableSpeakerDiarization: boolean;
  defaultSummaryStyle: 'executive' | 'chronological' | 'sales';
  autoSendSummary: boolean;
  sendToAttendees: boolean;
  recapDistributionEmails: string[];
  autoGenerateFollowup: boolean;
  matchEmailStyle: boolean;
  retainRecordingsDays: number;
  retainTranscriptsDays: number;
}

interface CustomWord {
  word: string;
  category?: string;
}

export default function MeetingSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [settings, setSettings] = useState<NotetakerSettings | null>(null);
  const [customWords, setCustomWords] = useState<CustomWord[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newDistributionEmail, setNewDistributionEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'custom-words'>('general');

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          router.push('/moccet-mail');
          return;
        }

        setUserEmail(session.user.email);

        // Fetch settings
        const settingsResponse = await fetch(
          `/api/meetings/settings?email=${encodeURIComponent(session.user.email)}`
        );

        if (settingsResponse.ok) {
          const data = await settingsResponse.json();
          setSettings(data.settings);
        }

        // Fetch custom words
        const wordsResponse = await fetch(
          `/api/meetings/custom-words?email=${encodeURIComponent(session.user.email)}`
        );

        if (wordsResponse.ok) {
          const data = await wordsResponse.json();
          setCustomWords(data.words || []);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router, supabase.auth]);

  const handleSave = async () => {
    if (!settings || !userEmail) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/meetings/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          ...settings,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSaveMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomWord = async () => {
    if (!newWord.trim() || !userEmail) return;

    try {
      const response = await fetch('/api/meetings/custom-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          word: newWord.trim(),
        }),
      });

      if (response.ok) {
        setCustomWords([...customWords, { word: newWord.trim() }]);
        setNewWord('');
      }
    } catch (err) {
      console.error('Error adding custom word:', err);
    }
  };

  const handleRemoveCustomWord = async (word: string) => {
    if (!userEmail) return;

    try {
      const response = await fetch('/api/meetings/custom-words', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          word,
        }),
      });

      if (response.ok) {
        setCustomWords(customWords.filter((w) => w.word !== word));
      }
    } catch (err) {
      console.error('Error removing custom word:', err);
    }
  };

  const handleAddDistributionEmail = () => {
    if (!newDistributionEmail.trim() || !settings) return;

    const email = newDistributionEmail.trim().toLowerCase();
    if (!email.includes('@')) return;

    if (!settings.recapDistributionEmails.includes(email)) {
      setSettings({
        ...settings,
        recapDistributionEmails: [...settings.recapDistributionEmails, email],
      });
    }
    setNewDistributionEmail('');
  };

  const handleRemoveDistributionEmail = (email: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      recapDistributionEmails: settings.recapDistributionEmails.filter((e) => e !== email),
    });
  };

  if (isLoading) {
    return (
      <div className="settings-loading">
        <div className="loading-spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="settings-error">
        <p>Failed to load settings. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Meeting settings</h1>
        <p className="settings-subtitle">
          Configure how & when Moccet AI joins your meetings.
        </p>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab-button ${activeTab === 'custom-words' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom-words')}
        >
          Custom words
        </button>
      </div>

      {activeTab === 'general' && (
        <div className="settings-content">
          {/* Auto-join */}
          <div className="setting-group">
            <label className="setting-label">Automatically join</label>
            <select
              className="setting-select"
              value={settings.autoJoinEnabled ? 'all' : 'none'}
              onChange={(e) =>
                setSettings({ ...settings, autoJoinEnabled: e.target.value === 'all' })
              }
            >
              <option value="all">All meetings</option>
              <option value="none">No meetings (manual only)</option>
            </select>
            <p className="setting-help">
              Moccet AI will join all meetings with a meeting link.
            </p>
          </div>

          {/* Transcript language */}
          <div className="setting-group">
            <label className="setting-label">Transcript language</label>
            <select
              className="setting-select"
              value={settings.defaultLanguage}
              onChange={(e) =>
                setSettings({ ...settings, defaultLanguage: e.target.value })
              }
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="it">Italian</option>
              <option value="nl">Dutch</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>

          {/* Summary style */}
          <div className="setting-group">
            <label className="setting-label">Default summary style</label>
            <select
              className="setting-select"
              value={settings.defaultSummaryStyle}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultSummaryStyle: e.target.value as 'executive' | 'chronological' | 'sales',
                })
              }
            >
              <option value="executive">Executive</option>
              <option value="chronological">Chronological</option>
              <option value="sales">Sales</option>
            </select>
          </div>

          {/* Send meeting recap to */}
          <div className="setting-group">
            <label className="setting-label">Send meeting recap to</label>
            <select
              className="setting-select"
              value={settings.sendToAttendees ? 'attendees' : 'me'}
              onChange={(e) =>
                setSettings({ ...settings, sendToAttendees: e.target.value === 'attendees' })
              }
            >
              <option value="me">Only me</option>
              <option value="attendees">Everyone on the calendar invite</option>
            </select>
            <p className="setting-help">
              Choose who automatically receives meeting recordings via email.
            </p>
          </div>

          {/* Auto share recordings */}
          <div className="setting-group">
            <label className="setting-label">Automatically share recordings</label>
            <p className="setting-help" style={{ marginBottom: 12 }}>
              Emails added below will be auto-invited to your Moccet AI meeting recordings.
            </p>

            <div className="email-list">
              {settings.recapDistributionEmails.map((email) => (
                <div key={email} className="email-tag">
                  <span>{email}</span>
                  <button
                    onClick={() => handleRemoveDistributionEmail(email)}
                    className="remove-button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="add-email-row">
              <input
                type="email"
                placeholder="Enter email address"
                value={newDistributionEmail}
                onChange={(e) => setNewDistributionEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDistributionEmail()}
                className="email-input"
              />
              <button onClick={handleAddDistributionEmail} className="add-button">
                + Add email
              </button>
            </div>
          </div>

          {/* Follow-up emails */}
          <div className="setting-group">
            <div className="toggle-row">
              <div>
                <label className="setting-label">Auto-generate follow-up emails</label>
                <p className="setting-help">
                  Automatically draft follow-up emails after meetings.
                </p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.autoGenerateFollowup}
                  onChange={(e) =>
                    setSettings({ ...settings, autoGenerateFollowup: e.target.checked })
                  }
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Match email style */}
          <div className="setting-group">
            <div className="toggle-row">
              <div>
                <label className="setting-label">Match my email style</label>
                <p className="setting-help">
                  Use your learned email writing style for follow-ups.
                </p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.matchEmailStyle}
                  onChange={(e) =>
                    setSettings({ ...settings, matchEmailStyle: e.target.checked })
                  }
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Send failure emails */}
          <div className="setting-group">
            <div className="toggle-row">
              <div>
                <label className="setting-label">Send failure emails if we couldn&apos;t join the meeting</label>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.autoSendSummary}
                  onChange={(e) =>
                    setSettings({ ...settings, autoSendSummary: e.target.checked })
                  }
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Save button */}
          <div className="settings-actions">
            {saveMessage && (
              <span className={`save-message ${saveMessage.type}`}>
                {saveMessage.text}
              </span>
            )}
            <button
              className="save-button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'custom-words' && (
        <div className="settings-content">
          <div className="setting-group">
            <label className="setting-label">Custom words</label>
            <p className="setting-help" style={{ marginBottom: 16 }}>
              Improve your transcription accuracy by adding custom words (e.g., company names,
              technical terms, or acronyms).
            </p>

            <div className="add-word-row">
              <input
                type="text"
                placeholder="Add custom word"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomWord()}
                className="word-input"
              />
              <button onClick={handleAddCustomWord} className="add-button">
                + Add custom word
              </button>
            </div>

            {customWords.length > 0 && (
              <div className="custom-words-list">
                {customWords.map((word) => (
                  <div key={word.word} className="word-tag">
                    <span>{word.word}</span>
                    <button
                      onClick={() => handleRemoveCustomWord(word.word)}
                      className="remove-button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="setting-help" style={{ marginTop: 16 }}>
              You can add up to 100 custom words. {customWords.length}/100 used.
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .settings-page {
          padding: 32px 40px;
          max-width: 700px;
        }

        .settings-loading,
        .settings-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 16px;
          color: #666;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #1a1a1a;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .settings-header {
          margin-bottom: 24px;
        }

        .settings-header h1 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 28px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .settings-subtitle {
          font-family: "Inter", Helvetica;
          font-size: 15px;
          color: #666;
          margin: 0;
        }

        .settings-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 32px;
        }

        .tab-button {
          padding: 8px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          background: white;
          color: #666;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-button:hover {
          background: #f8f7f2;
          color: #1a1a1a;
        }

        .tab-button.active {
          background: #1a1a1a;
          color: white;
          border-color: #1a1a1a;
        }

        .settings-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .setting-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .setting-label {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
        }

        .setting-help {
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #666;
          margin: 0;
        }

        .setting-select {
          padding: 10px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #1a1a1a;
          background: white;
          cursor: pointer;
          max-width: 300px;
        }

        .setting-select:focus {
          outline: none;
          border-color: #1a1a1a;
        }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }

        .toggle {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
        }

        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #e0e0e0;
          transition: 0.2s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.2s;
          border-radius: 50%;
        }

        .toggle input:checked + .toggle-slider {
          background-color: #1a1a1a;
        }

        .toggle input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .email-list,
        .custom-words-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .email-tag,
        .word-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #f5f5f5;
          border-radius: 6px;
          font-family: "Inter", Helvetica;
          font-size: 13px;
          color: #4a4a4a;
        }

        .remove-button {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          line-height: 1;
        }

        .remove-button:hover {
          color: #666;
        }

        .add-email-row,
        .add-word-row {
          display: flex;
          gap: 8px;
        }

        .email-input,
        .word-input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          color: #1a1a1a;
        }

        .email-input:focus,
        .word-input:focus {
          outline: none;
          border-color: #1a1a1a;
        }

        .add-button {
          padding: 10px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: white;
          color: #1a1a1a;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .add-button:hover {
          background: #f8f7f2;
        }

        .settings-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 16px;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e8e8e8;
        }

        .save-message {
          font-family: "Inter", Helvetica;
          font-size: 14px;
        }

        .save-message.success {
          color: #166534;
        }

        .save-message.error {
          color: #991b1b;
        }

        .save-button {
          padding: 12px 24px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 8px;
          font-family: "Inter", Helvetica;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .save-button:hover {
          background: #333;
        }

        .save-button:disabled {
          background: #999;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
