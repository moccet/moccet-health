'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const REPLY_FREQUENCY_OPTIONS = [
  { value: 'almost_everything', label: 'I reply to almost everything, even just to be polite' },
  { value: 'most_things', label: 'I reply to most things that need a response' },
  { value: 'important_only', label: 'I only reply to important emails' },
  { value: 'minimal', label: 'I try to minimize my email responses' },
];

export default function DraftsSettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'general' | 'signatures' | 'custom'>('general');
  const [replyFrequency, setReplyFrequency] = useState('almost_everything');
  const [draftsEnabled, setDraftsEnabled] = useState(true);
  const [followUpsEnabled, setFollowUpsEnabled] = useState(true);
  const [followUpDays, setFollowUpDays] = useState(3);
  const [customToneEnabled, setCustomToneEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showGmailHelp, setShowGmailHelp] = useState(false);
  const [showOutlookHelp, setShowOutlookHelp] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);

        try {
          const res = await fetch(`/api/gmail/drafts/settings?email=${encodeURIComponent(session.user.email)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.settings) {
              setReplyFrequency(data.settings.replyFrequency || 'almost_everything');
              setDraftsEnabled(data.settings.draftsEnabled ?? true);
              setFollowUpsEnabled(data.settings.followUpsEnabled ?? true);
              setFollowUpDays(data.settings.followUpDays ?? 3);
              setCustomToneEnabled(data.settings.customToneEnabled ?? false);
            }
          }
        } catch (error) {
          console.error('Error loading settings:', error);
        }
      }
    };
    loadSettings();
  }, [supabase.auth]);

  const handleSave = async () => {
    if (!userEmail) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const settings = {
        replyFrequency,
        draftsEnabled,
        followUpsEnabled,
        followUpDays,
        customToneEnabled,
      };

      const res = await fetch('/api/gmail/drafts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, settings }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="drafts-page">
      <div className="page-content">
        {/* Header */}
        <header className="page-header">
          <h1>Drafts</h1>
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
            className={`tab ${activeTab === 'signatures' ? 'active' : ''}`}
            onClick={() => setActiveTab('signatures')}
          >
            Signatures
          </button>
          <button
            className={`tab ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom files
          </button>
        </div>

        {activeTab === 'general' && (
          <div className="settings-content">
            {/* Reply Frequency */}
            <section className="setting-section">
              <label className="setting-label">How often do you like to reply?</label>
              <div className="select-wrapper">
                <select
                  value={replyFrequency}
                  onChange={(e) => setReplyFrequency(e.target.value)}
                  className="setting-select"
                >
                  {REPLY_FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="select-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </section>

            {/* Enable Drafts */}
            <section className="setting-section">
              <div className="setting-row">
                <div className="setting-info">
                  <label className="setting-label">Enable drafts</label>
                  <p className="setting-description">Enable draft replies</p>
                </div>
                <button
                  className={`toggle ${draftsEnabled ? 'active' : ''}`}
                  onClick={() => setDraftsEnabled(!draftsEnabled)}
                >
                  <span className="toggle-handle"></span>
                </button>
              </div>
            </section>

            {/* Follow Ups */}
            <section className="setting-section">
              <div className="setting-row">
                <div className="setting-info">
                  <label className="setting-label">Follow ups</label>
                  <p className="setting-description">Enable follow-up drafts</p>
                </div>
                <button
                  className={`toggle ${followUpsEnabled ? 'active' : ''}`}
                  onClick={() => setFollowUpsEnabled(!followUpsEnabled)}
                >
                  <span className="toggle-handle"></span>
                </button>
              </div>

              {followUpsEnabled && (
                <div className="sub-setting">
                  <label className="setting-label-small">Days before following up</label>
                  <div className="stepper">
                    <button
                      className="stepper-btn"
                      onClick={() => setFollowUpDays(Math.max(1, followUpDays - 1))}
                      disabled={followUpDays <= 1}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="stepper-value">{followUpDays} day{followUpDays !== 1 ? 's' : ''}</span>
                    <button
                      className="stepper-btn"
                      onClick={() => setFollowUpDays(Math.min(14, followUpDays + 1))}
                      disabled={followUpDays >= 14}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Custom Draft Tone */}
            <section className="setting-section">
              <div className="setting-row">
                <div className="setting-info">
                  <label className="setting-label">Custom draft tone</label>
                  <p className="setting-description">Enable custom instructions</p>
                </div>
                <button
                  className={`toggle ${customToneEnabled ? 'active' : ''}`}
                  onClick={() => setCustomToneEnabled(!customToneEnabled)}
                >
                  <span className="toggle-handle"></span>
                </button>
              </div>
            </section>

            {/* Info Box */}
            <section className="info-box">
              <div className="info-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="info-content">
                <p>
                  For draft replies to work smoothly, your Gmail or Outlook should group related emails into a single
                  thread. We save drafts within the thread for easy access.
                </p>
                <p>
                  By default, both Gmail and Outlook do this automatically. If your emails aren&apos;t grouping, you can enable
                  threading by following the steps below:
                </p>
              </div>
            </section>

            {/* Help Accordions */}
            <div className="help-accordions">
              <button
                className={`accordion ${showGmailHelp ? 'open' : ''}`}
                onClick={() => setShowGmailHelp(!showGmailHelp)}
              >
                <span>How to enable threading in Gmail</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showGmailHelp && (
                <div className="accordion-content">
                  <ol>
                    <li>Open Gmail and click the gear icon in the top right</li>
                    <li>Click &quot;See all settings&quot;</li>
                    <li>In the General tab, find &quot;Conversation View&quot;</li>
                    <li>Select &quot;Conversation view on&quot;</li>
                    <li>Scroll down and click &quot;Save Changes&quot;</li>
                  </ol>
                </div>
              )}

              <button
                className={`accordion ${showOutlookHelp ? 'open' : ''}`}
                onClick={() => setShowOutlookHelp(!showOutlookHelp)}
              >
                <span>How to enable threading in Outlook</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showOutlookHelp && (
                <div className="accordion-content">
                  <ol>
                    <li>Open Outlook and go to View tab</li>
                    <li>Click &quot;Show as Conversations&quot;</li>
                    <li>Choose &quot;All mailboxes&quot; or &quot;This folder&quot;</li>
                    <li>Your emails will now be grouped by conversation</li>
                  </ol>
                </div>
              )}
            </div>

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

        {activeTab === 'signatures' && (
          <div className="settings-content">
            <div className="placeholder-notice">
              <p>Signature settings coming soon.</p>
              <p>Configure your email signatures for draft replies.</p>
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="settings-content">
            <div className="placeholder-notice">
              <p>Custom files coming soon.</p>
              <p>Upload reference documents to improve AI draft quality.</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .drafts-page {
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

        .setting-section {
          margin-bottom: 28px;
          padding-bottom: 28px;
          border-bottom: 1px solid #f0f0f0;
        }

        .setting-section:last-of-type {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .setting-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .setting-info {
          flex: 1;
        }

        .setting-label {
          display: block;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          margin-bottom: 8px;
        }

        .setting-label-small {
          display: block;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: #666;
          margin-bottom: 12px;
        }

        .setting-description {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          margin: 0;
        }

        .select-wrapper {
          position: relative;
        }

        .setting-select {
          width: 100%;
          padding: 14px 40px 14px 16px;
          background: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #1a1a1a;
          cursor: pointer;
          appearance: none;
          transition: border-color 0.15s ease;
        }

        .setting-select:hover {
          border-color: #ccc;
        }

        .setting-select:focus {
          outline: none;
          border-color: #1a1a1a;
        }

        .select-arrow {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          color: #666;
          pointer-events: none;
        }

        .select-arrow svg {
          width: 100%;
          height: 100%;
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

        .sub-setting {
          margin-top: 20px;
          padding: 16px;
          background: #f8f7f2;
          border-radius: 10px;
        }

        .stepper {
          display: flex;
          align-items: center;
          gap: 0;
          background: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }

        .stepper-btn {
          width: 40px;
          height: 40px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
        }

        .stepper-btn:hover:not(:disabled) {
          background: #f5f5f5;
        }

        .stepper-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .stepper-btn svg {
          width: 18px;
          height: 18px;
        }

        .stepper-value {
          flex: 1;
          text-align: center;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
        }

        .info-box {
          display: flex;
          gap: 12px;
          padding: 20px;
          background: #f8f7f2;
          border-radius: 12px;
          margin-top: 24px;
          margin-bottom: 16px;
        }

        .info-icon {
          width: 24px;
          height: 24px;
          color: #666;
          flex-shrink: 0;
        }

        .info-icon svg {
          width: 100%;
          height: 100%;
        }

        .info-content p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          line-height: 1.5;
          margin: 0 0 12px 0;
        }

        .info-content p:last-child {
          margin-bottom: 0;
        }

        .help-accordions {
          margin-bottom: 24px;
        }

        .accordion {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 8px;
        }

        .accordion:hover {
          border-color: #ccc;
        }

        .accordion.open {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          margin-bottom: 0;
        }

        .accordion svg {
          width: 20px;
          height: 20px;
          color: #666;
          transition: transform 0.2s ease;
        }

        .accordion.open svg {
          transform: rotate(180deg);
        }

        .accordion-content {
          padding: 20px;
          background: #ffffff;
          border: 1px solid #e0e0e0;
          border-top: none;
          border-radius: 0 0 10px 10px;
          margin-bottom: 8px;
        }

        .accordion-content ol {
          margin: 0;
          padding-left: 20px;
        }

        .accordion-content li {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          color: #666;
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .accordion-content li:last-child {
          margin-bottom: 0;
        }

        .save-section {
          margin-top: 24px;
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

        .placeholder-notice {
          text-align: center;
          padding: 48px 24px;
        }

        .placeholder-notice p {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          color: #666;
          margin: 0 0 8px 0;
        }

        .placeholder-notice p:last-child {
          margin-bottom: 0;
        }

        @media (max-width: 768px) {
          .page-content {
            padding: 24px;
          }

          .settings-content {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}
