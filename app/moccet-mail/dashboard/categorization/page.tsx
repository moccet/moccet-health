'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CategorySetting {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  moveOutOfInbox: boolean; // true = archive, false = keep in inbox
}

// All categories - moveOutOfInbox: true means toggle is ON (will be archived)
const DEFAULT_CATEGORIES: CategorySetting[] = [
  {
    id: 'to_respond',
    name: 'To respond',
    label: 'to_respond',
    description: 'Need your response',
    color: '#ef4444',
    moveOutOfInbox: false, // Keep in inbox by default
  },
  {
    id: 'meeting_update',
    name: 'Meeting update',
    label: 'meeting_update',
    description: 'Calendar & meeting invites',
    color: '#5bb5a2',
    moveOutOfInbox: true, // Archive by default
  },
  {
    id: 'fyi',
    name: 'FYI',
    label: 'fyi',
    description: 'Important, no reply needed',
    color: '#22c55e',
    moveOutOfInbox: false, // Keep in inbox
  },
  {
    id: 'comment',
    name: 'Comment',
    label: 'comment',
    description: 'Document comments & chats',
    color: '#a855f7',
    moveOutOfInbox: false, // Keep in inbox
  },
  {
    id: 'notifications',
    name: 'Notification',
    label: 'notifications',
    description: 'Automated tool notifications',
    color: '#3b82f6',
    moveOutOfInbox: false, // Keep in inbox
  },
  {
    id: 'awaiting_reply',
    name: 'Awaiting reply',
    label: 'awaiting_reply',
    description: 'Waiting for their reply',
    color: '#f97316',
    moveOutOfInbox: false, // Keep in inbox
  },
  {
    id: 'actioned',
    name: 'Actioned',
    label: 'actioned',
    description: 'Resolved & completed threads',
    color: '#eab308',
    moveOutOfInbox: false, // Keep in inbox
  },
  {
    id: 'marketing',
    name: 'Marketing',
    label: 'marketing',
    description: 'Sales & marketing emails',
    color: '#666666',
    moveOutOfInbox: false, // Keep in inbox
  },
];

export default function CategorizationPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
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
            if (data.preferences?.categories) {
              // Apply saved preferences
              setCategories(prev => prev.map(cat => ({
                ...cat,
                moveOutOfInbox: data.preferences.categories[cat.id] ?? cat.moveOutOfInbox
              })));
            }
            if (data.preferences?.respectExisting !== undefined) {
              setRespectExisting(data.preferences.respectExisting);
            }
          }
        } catch (error) {
          console.error('Error loading preferences:', error);
        }
      }
    };
    loadPreferences();
  }, [supabase.auth]);

  const toggleCategory = (id: string) => {
    setCategories(prev =>
      prev.map(cat => cat.id === id ? { ...cat, moveOutOfInbox: !cat.moveOutOfInbox } : cat)
    );
  };

  // Split categories into two groups for display
  const moveOutCategories = categories.filter(c => c.moveOutOfInbox);
  const keepInboxCategories = categories.filter(c => !c.moveOutOfInbox);

  const [isLabeling, setIsLabeling] = useState(false);
  const [labelingProgress, setLabelingProgress] = useState<string | null>(null);

  const handleSave = async () => {
    if (!userEmail) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setLabelingProgress(null);

    try {
      const preferences = {
        // categories: { id: true/false } where true = move out of inbox
        categories: Object.fromEntries(categories.map(c => [c.id, c.moveOutOfInbox])),
        respectExisting,
      };

      // Save preferences
      const res = await fetch('/api/gmail/labels/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, preferences }),
      });

      if (res.ok) {
        setSaveSuccess(true);

        // Auto-label last 100 emails (website only - replaces existing labels)
        setIsLabeling(true);
        setLabelingProgress('Setting up labels...');

        try {
          // First ensure labels are set up in Gmail
          await fetch('/api/gmail/labels/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, backfill: false }),
          });

          setLabelingProgress('Labeling your emails...');

          // Then backfill last 100 emails with labels
          const backfillRes = await fetch('/api/gmail/labels/backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              count: 100,
              replaceExisting: !respectExisting
            }),
          });

          if (backfillRes.ok) {
            const backfillData = await backfillRes.json();
            setLabelingProgress(`Done! Labeled ${backfillData.labeled || 0} emails`);
          } else {
            setLabelingProgress('Preferences saved. Email labeling will apply to new emails.');
          }
        } catch (labelError) {
          console.error('Error labeling emails:', labelError);
          setLabelingProgress('Preferences saved. Email labeling will apply to new emails.');
        } finally {
          setIsLabeling(false);
          setTimeout(() => {
            setSaveSuccess(false);
            setLabelingProgress(null);
          }, 5000);
        }
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
            {/* Move out of inbox section - shows categories with toggle ON */}
            <section className="category-section">
              <h2>Move these out of my Inbox</h2>
              <p className="section-hint">Toggle ON to archive these emails automatically</p>
              <div className="category-list">
                {moveOutCategories.length > 0 ? (
                  moveOutCategories.map((category) => (
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
                        className="toggle active"
                        onClick={() => toggleCategory(category.id)}
                      >
                        <span className="toggle-handle"></span>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty-section">No categories set to archive</p>
                )}
              </div>
            </section>

            {/* Keep in inbox section - shows categories with toggle OFF */}
            <section className="category-section">
              <h2>Keep these in my Inbox</h2>
              <p className="section-hint">Toggle OFF to keep these emails in your inbox</p>
              <div className="category-list">
                {keepInboxCategories.length > 0 ? (
                  keepInboxCategories.map((category) => (
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
                        className="toggle"
                        onClick={() => toggleCategory(category.id)}
                      >
                        <span className="toggle-handle"></span>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty-section">All categories set to archive</p>
                )}
              </div>
            </section>

            {/* Existing categories */}
            <section className="category-section existing-section">
              <h3>Existing categories</h3>
              <div className="category-item">
                <div className="category-info">
                  <div className="respect-label">
                    <span className="category-name-text">Respect my categories</span>
                    <span className="category-description">We won't categorize emails that already have labels applied by you or that have been filtered into a folder.</span>
                  </div>
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
                disabled={isSaving || isLabeling}
              >
                {isSaving ? 'Saving...' : isLabeling ? 'Labeling emails...' : saveSuccess ? 'Saved!' : 'Update preferences'}
              </button>
              {labelingProgress && (
                <p className="labeling-progress">{labelingProgress}</p>
              )}
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
          margin: 0 0 8px 0;
        }

        .section-hint {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 12px;
          color: #999;
          margin: 0 0 16px 0;
        }

        .empty-section {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #999;
          font-style: italic;
          padding: 12px 0;
        }

        .respect-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .category-name-text {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
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

        .labeling-progress {
          margin-top: 12px;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          text-align: center;
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
