'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CategorySetting {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  enabled: boolean;
}

const MOVE_OUT_CATEGORIES: CategorySetting[] = [
  {
    id: 'meeting_update',
    name: 'Meeting update',
    label: 'meeting_update',
    description: 'Calendar & meeting invites',
    color: '#5bb5a2',
    enabled: true,
  },
  {
    id: 'marketing',
    name: 'Marketing',
    label: 'marketing',
    description: 'Sales & marketing emails',
    color: '#666666',
    enabled: true,
  },
];

const KEEP_IN_INBOX_CATEGORIES: CategorySetting[] = [
  {
    id: 'to_respond',
    name: 'To respond',
    label: 'to_respond',
    description: 'Need your response',
    color: '#ef4444',
    enabled: false,
  },
  {
    id: 'fyi',
    name: 'FYI',
    label: 'fyi',
    description: 'Important, no reply needed',
    color: '#22c55e',
    enabled: false,
  },
  {
    id: 'comment',
    name: 'Comment',
    label: 'comment',
    description: 'Document comments & chats',
    color: '#a855f7',
    enabled: false,
  },
  {
    id: 'notifications',
    name: 'Notification',
    label: 'notifications',
    description: 'Automated tool notifications',
    color: '#3b82f6',
    enabled: false,
  },
  {
    id: 'awaiting_reply',
    name: 'Awaiting reply',
    label: 'awaiting_reply',
    description: 'Waiting for their reply',
    color: '#f97316',
    enabled: false,
  },
  {
    id: 'actioned',
    name: 'Actioned',
    label: 'actioned',
    description: 'Resolved & completed threads',
    color: '#eab308',
    enabled: false,
  },
];

export default function CategorizationPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');
  const [moveOutCategories, setMoveOutCategories] = useState(MOVE_OUT_CATEGORIES);
  const [keepInboxCategories, setKeepInboxCategories] = useState(KEEP_IN_INBOX_CATEGORIES);
  const [respectExisting, setRespectExisting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);

        // Load saved preferences
        try {
          const res = await fetch(`/api/gmail/labels/preferences?email=${encodeURIComponent(session.user.email)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.preferences) {
              // Apply saved preferences
              if (data.preferences.moveOut) {
                setMoveOutCategories(prev => prev.map(cat => ({
                  ...cat,
                  enabled: data.preferences.moveOut[cat.id] ?? cat.enabled
                })));
              }
              if (data.preferences.keepInbox) {
                setKeepInboxCategories(prev => prev.map(cat => ({
                  ...cat,
                  enabled: data.preferences.keepInbox[cat.id] ?? cat.enabled
                })));
              }
              if (data.preferences.respectExisting !== undefined) {
                setRespectExisting(data.preferences.respectExisting);
              }
            }
          }
        } catch (error) {
          console.error('Error loading preferences:', error);
        }
      }
    };
    loadPreferences();
  }, [supabase.auth]);

  const toggleMoveOutCategory = (id: string) => {
    setMoveOutCategories(prev =>
      prev.map(cat => cat.id === id ? { ...cat, enabled: !cat.enabled } : cat)
    );
  };

  const toggleKeepInboxCategory = (id: string) => {
    setKeepInboxCategories(prev =>
      prev.map(cat => cat.id === id ? { ...cat, enabled: !cat.enabled } : cat)
    );
  };

  const handleSave = async () => {
    if (!userEmail) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const preferences = {
        moveOut: Object.fromEntries(moveOutCategories.map(c => [c.id, c.enabled])),
        keepInbox: Object.fromEntries(keepInboxCategories.map(c => [c.id, c.enabled])),
        respectExisting,
      };

      const res = await fetch('/api/gmail/labels/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, preferences }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="categorization-page">
      <div className="page-content">
        {/* Header */}
        <header className="page-header">
          <h1>Categorisation</h1>
          <p>Updates apply to new emails only.</p>
        </header>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        {activeTab === 'general' && (
          <div className="settings-content">
            {/* Move out of inbox section */}
            <section className="category-section">
              <h2>Move these out of my Inbox</h2>
              <div className="category-list">
                {moveOutCategories.map((category) => (
                  <div key={category.id} className="category-item">
                    <div className="category-info">
                      <span
                        className="category-badge"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name}
                      </span>
                      <span className="category-description">{category.description}</span>
                    </div>
                    <button
                      className={`toggle ${category.enabled ? 'active' : ''}`}
                      onClick={() => toggleMoveOutCategory(category.id)}
                    >
                      <span className="toggle-handle"></span>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Keep in inbox section */}
            <section className="category-section">
              <h2>Keep these in my Inbox</h2>
              <div className="category-list">
                {keepInboxCategories.map((category) => (
                  <div key={category.id} className="category-item">
                    <div className="category-info">
                      <span
                        className="category-badge"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name}
                      </span>
                      <span className="category-description">{category.description}</span>
                    </div>
                    <button
                      className={`toggle ${category.enabled ? 'active' : ''}`}
                      onClick={() => toggleKeepInboxCategory(category.id)}
                    >
                      <span className="toggle-handle"></span>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Existing categories */}
            <section className="category-section existing-section">
              <h3>Existing categories</h3>
              <div className="category-item">
                <div className="category-info">
                  <span className="category-description">Respect my categories</span>
                </div>
                <button
                  className={`toggle ${respectExisting ? 'active' : ''}`}
                  onClick={() => setRespectExisting(!respectExisting)}
                >
                  <span className="toggle-handle"></span>
                </button>
              </div>
            </section>

            {/* Save button */}
            <div className="save-section">
              <button
                className={`save-button ${saveSuccess ? 'success' : ''}`}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Update preferences'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="settings-content">
            <div className="advanced-notice">
              <p>Advanced categorization settings coming soon.</p>
              <p>Configure custom rules and filters for your inbox.</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .categorization-page {
          min-height: 100vh;
          background-color: #fbfaf4;
        }

        .page-content {
          max-width: 700px;
          margin: 0 auto;
          padding: 40px;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h1 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 600;
          font-size: 28px;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .page-header p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 32px;
        }

        .tab {
          padding: 10px 20px;
          background: transparent;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #666;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab:hover {
          border-color: #ccc;
          color: #1a1a1a;
        }

        .tab.active {
          background: #1a1a1a;
          border-color: #1a1a1a;
          color: white;
        }

        .settings-content {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .category-section {
          margin-bottom: 32px;
          padding-bottom: 32px;
          border-bottom: 1px solid #f0f0f0;
        }

        .category-section:last-of-type {
          margin-bottom: 24px;
        }

        .category-section h2 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin: 0 0 20px 0;
        }

        .category-section h3 {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: #999;
          margin: 0 0 16px 0;
        }

        .existing-section {
          border-bottom: none;
          padding-bottom: 0;
        }

        .category-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .category-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .category-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .category-badge {
          padding: 6px 12px;
          border-radius: 6px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: white;
          white-space: nowrap;
        }

        .category-description {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
        }

        .toggle {
          width: 48px;
          height: 28px;
          background: #e0e0e0;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          position: relative;
          transition: background-color 0.2s ease;
          flex-shrink: 0;
        }

        .toggle.active {
          background: #1a1a1a;
        }

        .toggle-handle {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 22px;
          height: 22px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .toggle.active .toggle-handle {
          transform: translateX(20px);
        }

        .save-section {
          margin-top: 8px;
        }

        .save-button {
          width: 100%;
          padding: 16px 24px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 10px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .save-button:hover {
          opacity: 0.9;
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .save-button.success {
          background: #22c55e;
        }

        .advanced-notice {
          text-align: center;
          padding: 48px 24px;
        }

        .advanced-notice p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          margin: 0 0 8px 0;
        }

        .advanced-notice p:last-child {
          margin-bottom: 0;
        }

        @media (max-width: 768px) {
          .page-content {
            padding: 24px;
          }

          .settings-content {
            padding: 24px;
          }

          .category-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}
