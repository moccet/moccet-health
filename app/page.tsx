'use client';

import { useState, useEffect } from 'react';
import './landing-new.css';

export default function LandingPage() {
  const [userPosition] = useState(2848);
  const [userEmail, setUserEmail] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0);
  const [notificationActive, setNotificationActive] = useState(false);

  const notifications = [
    {
      category: 'CREATIVE PERFORMANCE',
      time: 'now',
      title: 'Your best ideas: 11:15 AM, post-coffee',
      body: 'After 4-shot lattes at 10:30, you ship breakthroughs by noon. Schedule creative work then - worth $40K/month in output.'
    },
    {
      category: 'SLEEP QUALITY',
      time: '6:00 AM',
      title: 'Late dinner killed your REM',
      body: '9 PM meals cut REM by 35 min. When you eat by 7:30, you wake sharp. Dinner earlier = $15K more closed deals/quarter.'
    },
    {
      category: 'WORKOUT TIMING',
      time: 'now',
      title: 'Your PRs happen Thursdays at 6 AM',
      body: 'HRV peaks Wednesday nights. Hit the gym Thursday mornings - you lift 12% heavier and recover faster.'
    },
    {
      category: 'FOCUS WINDOW',
      time: '2:30 PM',
      title: 'Deep work now: 90-min peak ahead',
      body: 'Your cortisol and dopamine align at 3 PM daily. Block calendar for your hardest thinking - emails can wait.'
    },
    {
      category: 'MEDICATION RESPONSE',
      time: '5 days ago',
      title: 'New dose working perfectly',
      body: 'Blood pressure stable for 5 days, side effects down 60%. Your doctor can confirm this is the right level.'
    },
    {
      category: 'INFLAMMATION TRIGGER',
      time: 'now',
      title: 'Gluten leads to joint pain in 36 hours',
      body: 'CRP spikes every time. Last 3 incidents: pasta Tuesday, pain Thursday. Try eliminating for 2 weeks.'
    },
    {
      category: 'DECISION FATIGUE',
      time: 'now',
      title: '38 decisions before 2 PM',
      body: 'Glucose at 3.8 mmol/L. Move that contract call to tomorrow 10 AM when you are sharp - saves $50K mistakes.'
    },
    {
      category: 'RECOVERY ALERT',
      time: 'now',
      title: 'Skip the run, do yoga instead',
      body: 'HRV dropped 18%. Your body needs rest. Light movement today = crushing your 10K on Saturday.'
    }
  ];

  // Start notification animation after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setNotificationActive(true);
    }, 1200);

    const interval = setInterval(() => {
      setCurrentNotificationIndex((prev) => (prev + 1) % notifications.length);
    }, 6000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [notifications.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Email submitted:', userEmail);
    setShowReferral(true);
  };

  const addMoreInputs = () => {
    const container = document.getElementById('emailInputs');
    if (container) {
      const newInput = document.createElement('input');
      newInput.type = 'email';
      newInput.className = 'friend-email-input';
      newInput.placeholder = "Friend's email";
      container.appendChild(newInput);
    }
  };

  const sendInvites = () => {
    const inputs = document.querySelectorAll('.friend-email-input') as NodeListOf<HTMLInputElement>;
    const emails: string[] = [];

    inputs.forEach((input) => {
      if (input.value && input.value.trim() !== '') {
        emails.push(input.value.trim());
        input.value = '';
      }
    });

    if (emails.length === 0) {
      alert('Please enter at least one email address');
      return;
    }

    console.log('Sending invites to:', emails);
    alert('Invites sent');
  };

  const copyLink = () => {
    const linkInput = document.getElementById('shareLink') as HTMLInputElement;
    const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;

    if (linkInput && copyBtn) {
      linkInput.select();
      linkInput.setSelectionRange(0, 99999);

      navigator.clipboard.writeText(linkInput.value).then(() => {
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('copied');

        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    }
  };

  const getShareMessage = () => {
    return `Check out moccet - AI that learns your body and predicts what matters. Join the waitlist: moccet.com/r/user${userPosition}`;
  };

  const shareTwitter = () => {
    const message = getShareMessage();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const shareWhatsApp = () => {
    const message = getShareMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const shareSMS = () => {
    const message = getShareMessage();
    const url = `sms:?&body=${encodeURIComponent(message)}`;
    window.location.href = url;
  };

  const shareEmail = () => {
    const link = `moccet.com/r/user${userPosition}`;
    const subject = 'Check out moccet';
    const body = `I thought you might be interested in moccet - AI that learns your body and predicts what matters.\n\nJoin the waitlist: ${link}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  const nextNotification = () => {
    setCurrentNotificationIndex((prev) => (prev + 1) % notifications.length);
  };

  const goToNotification = (index: number) => {
    setCurrentNotificationIndex(index);
  };

  const currentNotification = notifications[currentNotificationIndex];

  return (
    <>
      <section className="hero-section">
        <img src="/images/logo.png" alt="moccet logo" className="top-logo" />
        <div className="hero-content">
          <h1 className="logo">moccet</h1>
          <p className={`tagline ${showReferral ? 'hidden' : ''}`} id="tagline">
            Your <em>personal</em> health AI.
          </p>

          <form className={`signup-form ${showReferral ? 'hidden' : ''}`} id="signupForm" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <input
                type="email"
                className="email-input"
                id="emailInput"
                placeholder="Enter your email address"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
              />
              <button type="submit" className="join-button">Join the waitlist</button>
            </div>
          </form>

          <div className={`waitlist-count ${showReferral ? 'hidden' : ''}`} id="waitlistCount">
            2000+ people waiting for early access
          </div>

          <div className={`referral-section ${showReferral ? 'visible' : ''}`} id="referralSection">
            <div className="success-message">You&apos;re in</div>
            <span className="position-number" id="positionNumber">#{userPosition}</span>

            <div className="share-message">
              Help your loved ones live better. Share moccet with friends and family who care about their health.
            </div>

            <div className="email-inputs" id="emailInputs">
              <input type="email" className="friend-email-input" placeholder="Friend's email" />
              <input type="email" className="friend-email-input" placeholder="Friend's email" />
              <input type="email" className="friend-email-input" placeholder="Friend's email" />
            </div>

            <div className="button-row">
              <button type="button" className="add-btn" onClick={addMoreInputs}>Add more</button>
              <button type="button" className="send-btn" onClick={sendInvites}>Send invites</button>
            </div>

            <div className="section-label">Or share on</div>
            <div className="share-buttons">
              <button type="button" className="share-btn" onClick={shareTwitter}>
                <svg viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                X
              </button>
              <button type="button" className="share-btn" onClick={shareWhatsApp}>
                <svg viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
              <button type="button" className="share-btn" onClick={shareSMS}>
                <svg viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
                iMessage
              </button>
              <button type="button" className="share-btn" onClick={shareEmail}>
                <svg viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                Email
              </button>
            </div>

            <div className="link-display">
              <input type="text" className="link-input" id="shareLink" readOnly value={`moccet.com/r/user${userPosition}`} />
              <button type="button" className="copy-btn" id="copyBtn" onClick={copyLink}>Copy</button>
            </div>
          </div>
        </div>

        <div className="notification-area">
          <div className={`notification-card ${notificationActive ? 'active' : ''}`} id="notificationCard">
            <div className="notification-header">
              <div className="notification-left">
                <div className="notification-brand">moccet</div>
                <div className="notification-category">{currentNotification.category}</div>
              </div>
              <div className="notification-right">
                <div className="notification-time">{currentNotification.time}</div>
                <div className="notification-close" onClick={nextNotification}>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            </div>
            <div className="notification-title">{currentNotification.title}</div>
            <div className="notification-body">{currentNotification.body}</div>
            <div className="notification-nav">
              {notifications.map((_, index) => (
                <div
                  key={index}
                  className={`nav-dot ${index === currentNotificationIndex ? 'active' : ''}`}
                  onClick={() => goToNotification(index)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="footer">
          <a href="https://x.com/moccet" target="_blank" rel="noopener">
            <svg className="social-icon" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="https://linkedin.com/company/moccet" target="_blank" rel="noopener">
            <svg className="social-icon" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#cookies">Cookie Policy</a>
          <span>&copy; 2025 moccet</span>
        </div>
      </section>
    </>
  );
}
