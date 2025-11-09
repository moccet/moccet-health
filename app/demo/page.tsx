'use client';

import { useState, useEffect } from 'react';
import './demo.css';

export default function DemoPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('9:41');
  const [activeTab, setActiveTab] = useState('profile');

  // Ensure full viewport height on mount
  useEffect(() => {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.documentElement.style.height = '';
      document.body.style.height = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);
  const [expandedArticles, setExpandedArticles] = useState<Set<number>>(new Set());
  const [agentStarted, setAgentStarted] = useState(false);
  const [currentSequence, setCurrentSequence] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [tasks, setTasks] = useState<Array<{ text: string; status: string; id: number }>>([]);

  // Articles data
  const articles = [
    {
      category: 'UPDATE',
      urgent: true,
      headline: 'Glucose elevation detected during sleep',
      summary: 'Nighttime reading reached higher levels. System has adjusted insulin protocol and notified medical team.',
      time: '2 MIN AGO',
      detail: 'Continuous monitoring detected glucose elevation during REM sleep phase. Pattern analysis suggests delayed response from evening meal. Dr. Johns has reviewed and approved protocol adjustment. Pharmacy has been notified for supply updates.'
    },
    {
      category: 'ANALYSIS',
      headline: 'Sleep patterns affecting metabolic function',
      summary: 'Recent sleep duration below optimal range. Predictive models show correlation with insulin sensitivity.',
      time: '18 MIN AGO',
      detail: 'Harvard Medical research aligns with your current patterns. Implementing Stanford sleep optimization protocol. Expected improvement timeline: 5-7 days with consistent application.'
    },
    {
      category: 'RESEARCH',
      headline: 'New studies support current fasting protocol',
      summary: 'Medical journal validates time-restricted feeding approach. Your adherence showing positive trends.',
      time: '1 HOUR AGO',
      detail: 'Meta-analysis from leading institutions confirms benefits for glucose control. Your three-month data shows alignment with published outcomes. Minor schedule optimization recommended.'
    },
    {
      category: 'PREDICTION',
      headline: 'Energy levels forecast for tomorrow afternoon',
      summary: 'Machine learning model predicts potential fatigue. Preventive schedule adjustments implemented.',
      time: '2 HOURS AGO',
      detail: 'Algorithm analyzed sleep debt, meeting schedule, and nutrition timing. Proactively rescheduled intensive tasks to morning hours. Added recovery periods between meetings.'
    },
    {
      category: 'IMPROVEMENT',
      success: true,
      headline: 'Heart rate variability trend improving',
      summary: 'Four-week breathing protocol showing measurable results. Stress resilience markers enhanced.',
      time: '3 HOURS AGO',
      detail: 'Consistent practice has improved baseline HRV metrics. Correlation with reduced stress markers confirmed. Dr. Johns recommends continuing current protocol.'
    }
  ];

  // Task sequences
  const taskSequences = [
    {
      title: 'Analyzing glucose patterns',
      tasks: [
        'Accessing continuous glucose monitor data',
        'Processing 24-hour readings',
        'Identifying pattern anomalies',
        'Cross-referencing with meal timing',
        'Calculating time-in-range metrics',
        'Generating optimization recommendations'
      ]
    },
    {
      title: 'Consulting medical database',
      tasks: [
        'Connecting to PubMed research database',
        'Retrieving latest diabetes studies',
        'Analyzing treatment protocols',
        'Comparing with your health data',
        'Identifying applicable interventions',
        'Updating personalized protocol'
      ]
    },
    {
      title: 'Optimizing daily schedule',
      tasks: [
        'Analyzing calendar for stress factors',
        'Predicting energy levels throughout day',
        'Identifying optimal meal windows',
        'Adjusting meeting times for performance',
        'Setting intervention reminders',
        'Confirming changes with calendar system'
      ]
    }
  ];

  // Devices
  const devices = [
    { icon: '⌚', name: 'Apple Watch', status: 'Live' },
    { icon: '❤️', name: 'Apple Health', status: 'Synced' },
    { icon: '📋', name: 'Epic MyChart', status: 'Verified' },
    { icon: '🏃', name: 'Strava', status: 'Live' },
    { icon: '🧘', name: 'Headspace', status: 'Active' },
    { icon: '💍', name: 'Oura Ring', status: 'Synced' },
    { icon: '🍎', name: 'MyFitnessPal', status: 'Connected' },
    { icon: '💪', name: 'Whoop', status: 'Active' },
    { icon: '⚕️', name: 'Dr. Johns Clinic', status: 'Secure' }
  ];

  // Loading screen effect
  useEffect(() => {
    const video = document.getElementById('loading-video') as HTMLVideoElement;

    const handleVideoEnd = () => {
      setIsLoading(false);
    };

    const playVideo = async () => {
      if (video) {
        try {
          // Ensure video is ready before playing
          await video.load();
          await video.play();
          video.addEventListener('ended', handleVideoEnd);
        } catch (error) {
          console.error('Video playback failed:', error);
          // Fallback: skip loading screen after a short delay if video fails
          setTimeout(() => {
            setIsLoading(false);
          }, 500);
        }
      }
    };

    // Small delay to ensure DOM is fully ready
    const timer = setTimeout(() => {
      playVideo();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (video) {
        video.removeEventListener('ended', handleVideoEnd);
      }
    };
  }, []);

  // Update time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(`${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Toggle article expansion
  const toggleArticle = (index: number) => {
    setExpandedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Switch tabs
  const switchTab = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'agent' && !agentStarted) {
      setAgentStarted(true);
      startExecution();
    }
  };

  // Agent execution logic
  const startExecution = () => {
    if (isExecuting) return;
    setIsExecuting(true);

    const sequence = taskSequences[currentSequence % taskSequences.length];

    // Clear previous tasks
    setTasks([]);

    // Add tasks one by one
    sequence.tasks.forEach((task, index) => {
      setTimeout(() => {
        setTasks(prev => [...prev, {
          text: task,
          status: 'pending',
          id: index
        }]);
      }, index * 500);
    });

    // Start checking tasks after they're all added
    setTimeout(() => {
      checkTasks(sequence.tasks.length);
    }, sequence.tasks.length * 500 + 1000);
  };

  const checkTasks = (totalTasks: number) => {
    let currentIndex = 0;

    const processTask = (taskIndex: number) => {
      // Set to checking
      setTasks(prev => prev.map((task, i) => {
        if (i === taskIndex) {
          return { ...task, status: 'checking' };
        }
        return task;
      }));

      // After 500ms, set to completed
      setTimeout(() => {
        setTasks(prev => prev.map((task, i) => {
          if (i === taskIndex) {
            return { ...task, status: 'completed' };
          }
          return task;
        }));
      }, 500);
    };

    const checkNext = () => {
      if (currentIndex < totalTasks) {
        processTask(currentIndex);
        currentIndex++;
        setTimeout(checkNext, 1000);
      } else {
        setTimeout(() => {
          setCurrentSequence(prev => (prev + 1) % taskSequences.length);
          setIsExecuting(false);
          setTimeout(startExecution, 3000);
        }, 2000);
      }
    };

    checkNext();
  };

  return (
    <>
      {/* Loading Screen */}
      {isLoading && (
        <div className="loading-screen">
          <video
            id="loading-video"
            className="loading-video"
            src="/videos/moccet.mp4"
            playsInline
            muted
            autoPlay
            preload="auto"
            webkit-playsinline="true"
          />
        </div>
      )}

      <div className={`demo-app ${!isLoading ? 'fade-in' : ''}`}>
        {/* Status Bar */}
        <div className="status-bar">
          <span id="time">{currentTime}</span>
          <div className="status-icons">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
              <rect x="1" y="8" width="3" height="4"/>
              <rect x="5" y="6" width="3" height="6"/>
              <rect x="9" y="4" width="3" height="8"/>
              <rect x="13" y="2" width="3" height="10"/>
            </svg>
            <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
              <path d="M1 4c5-4 8-4 14 0l-7 7z"/>
            </svg>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="currentColor">
              <rect x="1" y="3" width="18" height="7" rx="1" stroke="currentColor" fill="none"/>
              <rect x="2" y="4" width="14" height="5" fill="currentColor"/>
              <rect x="20" y="5" width="2" height="2" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {/* Main Container */}
        <div className="main-container">
          {/* Insights View */}
          <div className={`view ${activeTab === 'insights' ? 'active' : ''}`} id="insights-view">
            <div className="feed-scroll">
              <div className="feed-container">
                <div className="feed-header">
                  <div className="feed-logo">moccet</div>
                  <div className="feed-meta">Your health intelligence feed</div>
                  <div className="live-indicator">
                    <span className="live-dot"></span>
                    <span className="live-text">Live</span>
                  </div>
                </div>

                <div className="articles-feed">
                  {articles.map((article, i) => (
                    <div
                      key={i}
                      className={`article ${expandedArticles.has(i) ? 'expanded' : ''}`}
                      onClick={() => toggleArticle(i)}
                    >
                      <div className={`article-category ${article.urgent ? 'urgent' : ''} ${article.success ? 'success' : ''}`}>
                        {article.category}
                      </div>
                      <div className="article-headline">{article.headline}</div>
                      <div className="article-summary">{article.summary}</div>
                      <div className="article-meta">
                        <span className="article-time">{article.time}</span>
                      </div>
                      <div className="article-expanded-content">
                        <div className="article-detail">{article.detail}</div>
                        <div className="article-actions">
                          <button className="action-btn primary">View Details</button>
                          <button className="action-btn">Share with Doctor</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Agent View */}
          <div className={`view ${activeTab === 'agent' ? 'active' : ''}`} id="agent-view">
            <div className="feed-scroll">
              <div className="agent-header">
                <h1 className="agent-title">AI Assistant</h1>
                <div className="agent-status">
                  <span className="status-indicator"></span>
                  <span>Processing health data</span>
                </div>
              </div>

              <div className="execution-container">
                <div className="execution-title">
                  <span>{taskSequences[currentSequence % taskSequences.length]?.title || 'Analyzing glucose patterns'}</span>
                </div>
                <div className="task-list">
                  {tasks.map((task) => (
                    <div key={task.id} className="task-row" style={{ animationDelay: `${task.id * 0.1}s` }}>
                      <div className={`task-checkbox ${task.status === 'checking' ? 'checking' : ''} ${task.status === 'completed' ? 'checked' : ''}`}></div>
                      <div className={`task-text ${task.status === 'completed' ? 'completed' : ''} ${task.status === 'checking' ? 'processing' : ''}`}>
                        {task.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Actions */}
              <div id="navigation-actions"></div>
            </div>
          </div>

          {/* Profile View */}
          <div className={`view ${activeTab === 'profile' ? 'active' : ''}`} id="profile-view">
            <div className="profile-view">
              <div className="profile-banner"></div>
              <div className="profile-info">
                <div className="profile-photo">AJ</div>
                <div className="profile-name">Alex Johnson</div>
                <div className="profile-email">alex.johnson@icloud.com</div>

                <div className="profile-stats">
                  <div className="stat-item">
                    <div className="stat-value">9</div>
                    <div className="stat-label">Devices</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">24/7</div>
                    <div className="stat-label">Monitoring</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">Live</div>
                    <div className="stat-label">Status</div>
                  </div>
                </div>
              </div>

              <div className="devices-section">
                <div className="section-title">Connected Devices</div>
                <div className="device-list">
                  {devices.map((device, i) => (
                    <div key={i} className="device-item">
                      <div className="device-info">
                        <div className="device-icon">{device.icon}</div>
                        <div className="device-name">{device.name}</div>
                      </div>
                      <div className="device-status">{device.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="tab-bar">
          <button className={`tab ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => switchTab('insights')}>
            <svg className="tab-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="12" rx="2"/>
              <path d="M4 9h16M9 4v12"/>
            </svg>
            <span>Feed</span>
            <span className="notification-badge"></span>
          </button>
          <button className={`tab ${activeTab === 'agent' ? 'active' : ''}`} onClick={() => switchTab('agent')}>
            <svg className="tab-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8"/>
              <path d="M12 8v4l3 3"/>
            </svg>
            <span>Agent</span>
          </button>
          <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => switchTab('profile')}>
            <svg className="tab-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3"/>
              <path d="M16 14c0-2.2-1.8-4-4-4s-4 1.8-4 4"/>
            </svg>
            <span>Profile</span>
          </button>
        </div>
      </div>
    </>
  );
}
