'use client';

import { useState, useEffect } from 'react';

export default function LandingPage() {
  const [activePage, setActivePage] = useState('home');
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);
  const [headerTransform, setHeaderTransform] = useState('translateY(0)');

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll <= 0) {
        setHeaderScrolled(false);
        setHeaderTransform('translateY(0)');
      } else if (currentScroll > lastScroll && currentScroll > 80) {
        setHeaderTransform('translateY(-100%)');
      } else if (currentScroll < lastScroll) {
        setHeaderTransform('translateY(0)');
        if (currentScroll > 50) {
          setHeaderScrolled(true);
        }
      }

      setLastScroll(currentScroll);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScroll]);

  const showPage = (page: string) => {
    setActivePage(page);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #333;
          line-height: 1.6;
          background: #f1f2f0;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        header {
          padding: 24px 40px;
          position: fixed;
          top: 0;
          width: 100%;
          background: transparent;
          z-index: 1000;
          transition: padding 0.3s ease, transform 0.3s ease, background 0.3s ease;
        }

        header.scrolled {
          padding: 16px 40px;
          background: rgba(241, 242, 240, 0.98);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        nav {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
        }

        .logo {
          font-size: 26px;
          font-weight: 900;
          color: #000;
          text-decoration: none;
          letter-spacing: -0.5px;
          transition: opacity 0.2s ease;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          cursor: pointer;
        }

        .logo:hover {
          opacity: 0.7;
        }

        .nav-links {
          display: flex;
          gap: 32px;
          align-items: center;
          font-size: 15px;
          margin-left: auto;
        }

        .nav-links a {
          color: #333;
          text-decoration: none;
          transition: color 0.2s ease;
          cursor: pointer;
        }

        .nav-links a:hover {
          color: #000;
        }

        .container {
          max-width: 760px;
          margin: 0 auto;
          padding: 130px 40px 80px;
        }

        .hero-title {
          font-size: 72px;
          font-weight: 300;
          letter-spacing: -2px;
          color: #999;
          text-align: center;
          margin-bottom: 10px;
          line-height: 1;
        }

        .hero-subtitle {
          font-size: 72px;
          font-weight: 300;
          letter-spacing: -2px;
          color: #999;
          text-align: center;
          margin-bottom: 50px;
          line-height: 1;
        }

        .new-badge {
          text-align: center;
          margin-bottom: 60px;
        }

        .new-badge span {
          display: inline-block;
          background: #f5f5f5;
          padding: 6px 12px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #999;
          border-radius: 3px;
        }

        .new-badge strong {
          color: #333;
          font-weight: 600;
        }

        p {
          margin-bottom: 20px;
          font-size: 16px;
          line-height: 1.7;
          color: #444;
        }

        h2 {
          font-size: 24px;
          font-weight: 600;
          margin-top: 60px;
          margin-bottom: 30px;
          text-align: center;
          color: #000;
        }

        em {
          font-style: italic;
        }

        strong {
          font-weight: 600;
          color: #222;
        }

        .jobs-section {
          margin-top: 100px;
        }

        .job-row {
          display: flex;
          justify-content: space-between;
          padding: 20px 0;
          border-bottom: 1px solid #f0f0f0;
          transition: padding-left 0.2s ease;
        }

        .job-row:hover {
          padding-left: 8px;
        }

        .job-title {
          flex: 1;
          font-size: 16px;
          color: #333;
        }

        .job-location {
          color: #999;
          font-size: 15px;
          text-align: right;
        }

        .page-content {
          min-height: 60vh;
        }

        .blog-posts {
          margin-top: 40px;
        }

        .blog-post {
          padding: 30px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .blog-post:last-child {
          border-bottom: none;
        }

        .blog-date {
          color: #999;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .blog-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .blog-title a {
          color: #000;
          text-decoration: none;
        }

        .blog-title a:hover {
          text-decoration: underline;
        }

        .blog-excerpt {
          color: #666;
          font-size: 16px;
          line-height: 1.6;
        }

        footer {
          margin-top: 120px;
          padding: 40px 0 60px;
          text-align: center;
          font-size: 14px;
          color: #999;
        }

        footer a {
          color: #999;
          text-decoration: none;
          margin: 0 8px;
        }

        footer a:hover {
          color: #333;
          text-decoration: underline;
        }

        a {
          color: #0066cc;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }

        .page {
          display: none;
        }

        .page.active {
          display: block;
        }

        .fade-in {
          animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          header {
            padding: 20px 24px;
          }

          header.scrolled {
            padding: 14px 24px;
          }

          nav {
            padding: 0 20px;
          }

          .logo {
            font-size: 24px;
            position: static;
            transform: none;
            margin-right: auto;
          }

          .nav-links {
            gap: 24px;
            font-size: 14px;
            margin-left: 0;
          }

          .hero-title, .hero-subtitle {
            font-size: 48px;
            letter-spacing: -1px;
          }

          .container {
            padding: 110px 24px 60px;
          }

          h2 {
            font-size: 20px;
            margin-top: 48px;
            margin-bottom: 24px;
          }

          p {
            font-size: 15px;
          }

          .job-row {
            flex-direction: column;
            gap: 4px;
          }

          .job-row:hover {
            padding-left: 0;
          }

          .job-location {
            text-align: left;
            font-size: 14px;
          }

          footer {
            margin-top: 80px;
            padding: 30px 24px 50px;
          }
        }

        @media (max-width: 480px) {
          .hero-title, .hero-subtitle {
            font-size: 36px;
          }

          .container {
            padding: 100px 20px 50px;
          }
        }
      `}</style>

      <header className={headerScrolled ? 'scrolled' : ''} style={{ transform: headerTransform }}>
        <nav>
          <div className="logo" onClick={() => showPage('home')}>moccet</div>
          <div className="nav-links">
            <a onClick={() => showPage('join')}>Join us</a>
          </div>
        </nav>
      </header>

      {/* Home Page */}
      <div className={`page ${activePage === 'home' ? 'active' : ''}`}>
        <div className="container fade-in">
          <h1 className="hero-title">BUILDING</h1>
          <h1 className="hero-subtitle">PERSONAL HEALTH AI</h1>

          <p>
            Every person generates thousands of health data points daily. These signals—from wearables, blood tests, and medical records—contain patterns that predict health events days or weeks before symptoms appear. But they&apos;re scattered across systems that don&apos;t communicate.
          </p>

          <p>
            We&apos;re building a personal health AI that integrates all health data streams and learns what&apos;s actually happening in your body.
          </p>

          <h2>Health data is everywhere and nowhere</h2>

          <p>
            The average person&apos;s health information lives in 18 different systems. Your continuous glucose monitor tracks blood sugar patterns. Your smartwatch measures heart rate variability. Your lab portal holds blood test results. Your doctor&apos;s notes sit in an electronic health record you can barely access.
          </p>

          <p>
            Each system is sophisticated on its own. Together, they could reveal the complete picture of your health. But right now, even the most engaged patients and physicians make decisions with less than 5% of available health information.
          </p>

          <p>
            This fragmentation means we miss the signals. A slight rise in resting heart rate combined with changed sleep patterns and specific blood markers often predicts infection 72 hours before you feel sick. But when these signals live in different places, nobody catches the pattern.
          </p>

          <h2>How personal health AI works</h2>

          <p>
            Our platform connects to your existing health data sources—wearables, lab results, medical records, prescriptions, imaging. It doesn&apos;t require new devices or behavior changes. You keep using what you already use.
          </p>

          <p>
            The AI learns your personal baseline across all biomarkers. Not population averages or normal ranges, but what&apos;s specifically normal for your body. It then continuously monitors for meaningful deviations across multiple signals simultaneously.
          </p>

          <p>
            When the system detects patterns that matter—like the specific combination of markers that precede illness in your body—it provides actionable insights. Not another dashboard to check, but clear guidance when something needs attention.
          </p>

          <h2>What changes when AI understands your health</h2>

          <p>
            <em>Illness becomes predictable.</em> Your AI identifies the patterns that occur 72 hours before you get sick. You start treatment early, adjust your schedule, or simply rest more. What used to surprise you becomes manageable.
          </p>

          <p>
            <em>Medications work better.</em> Everyone metabolizes drugs differently. Your AI tracks how you specifically respond to medications across all body systems, identifying in days whether a treatment is working. It can even help optimize dosing based on your real-time biomarkers.
          </p>

          <p>
            <em>Your biology becomes clear.</em> You learn how specific foods affect your blood sugar and energy. Which activities improve your sleep. What triggers inflammation. Health stops being guesswork and becomes data-driven.
          </p>

          <h2>The technology</h2>

          <p>
            We use transformer architectures to process time-series health data. Graph neural networks map interactions between biological systems. Ensemble methods combine predictions from different data modalities into unified insights.
          </p>

          <p>
            The platform runs locally when possible, using cloud computing only for complex predictions. All data is end-to-end encrypted. We&apos;re HIPAA compliant and undergo regular security audits.
          </p>

          <p>
            We don&apos;t sell data to insurance companies or advertisers. Your health intelligence belongs to you.
          </p>

          <h2>Early validation</h2>

          <p>
            We&apos;re working with initial users to validate core predictions. Our focus is demonstrating one clear capability first—predicting illness 72 hours before symptoms with 85% accuracy.
          </p>

          <p>
            From there, we&apos;ll expand to medication optimization and treatment response prediction. Each feature will be validated through clinical partnerships before wide release.
          </p>

          <h2>Who should join</h2>

          <p>
            This platform is for people who already track some aspect of their health. If you wear a smartwatch, use a CGM, get regular blood work, or simply want to understand your body better, you&apos;re ready for personal health AI.
          </p>

          <p>
            It&apos;s particularly valuable if you:
          </p>
          <p>
            Manage chronic conditions<br/>
            Take regular medications<br/>
            Have family history of preventable diseases<br/>
            Want to optimize your health and performance
          </p>

          <h2>Early access</h2>

          <p>
            We&apos;re opening access gradually to ensure quality and gather feedback. Early users will shape the platform&apos;s development and receive preferred pricing.
          </p>

          <p>
            <a href="mailto:waitlist@moccet.com">Join the waitlist</a>
          </p>

          <p>
            Questions? Contact <a href="mailto:waitlist@moccet.com">waitlist@moccet.com</a>
          </p>
        </div>
      </div>

      {/* Blog Page */}
      <div className={`page ${activePage === 'blog' ? 'active' : ''}`}>
        <div className="container page-content fade-in">
          <h1 className="hero-title" style={{ fontSize: '48px', marginBottom: '40px' }}>BLOG</h1>

          <div className="blog-posts">
            <article className="blog-post">
              <div className="blog-date">September 15, 2025</div>
              <h3 className="blog-title"><a href="#">Predicting Respiratory Infections: A 72-Hour Window</a></h3>
              <p className="blog-excerpt">Our latest research demonstrates how combining heart rate variability, sleep architecture, and inflammatory markers can predict respiratory infections three days before symptom onset with 85% accuracy.</p>
            </article>

            <article className="blog-post">
              <div className="blog-date">September 1, 2025</div>
              <h3 className="blog-title"><a href="#">The Architecture of Personal Health AI</a></h3>
              <p className="blog-excerpt">A technical deep dive into how we process multimodal time-series health data using transformer architectures and graph neural networks to create personalized health predictions.</p>
            </article>

            <article className="blog-post">
              <div className="blog-date">August 20, 2025</div>
              <h3 className="blog-title"><a href="#">Why Your Health Data Needs AI</a></h3>
              <p className="blog-excerpt">The average person generates 2GB of health data annually, yet 95% remains unused. We explore how AI can transform this dormant information into actionable health insights.</p>
            </article>

            <article className="blog-post">
              <div className="blog-date">August 5, 2025</div>
              <h3 className="blog-title"><a href="#">Building Privacy-First Health AI</a></h3>
              <p className="blog-excerpt">How we&apos;re implementing end-to-end encryption, local processing, and HIPAA compliance to ensure your health data remains yours alone.</p>
            </article>
          </div>
        </div>
      </div>

      {/* Join Page */}
      <div className={`page ${activePage === 'join' ? 'active' : ''}`}>
        <div className="container page-content fade-in">
          <h1 className="hero-title" style={{ fontSize: '48px', marginBottom: '40px' }}>JOIN US</h1>

          <p style={{ textAlign: 'center', color: '#666', marginBottom: '60px' }}>
            We&apos;re building AI systems that push technical boundaries while delivering real value to millions. Join our team to help shape the future of personal health.
          </p>

          <div className="jobs-section">
            <h2>Current openings</h2>

            <div className="job-row">
              <div className="job-title">Senior ML Engineer - Medical Imaging</div>
              <div className="job-location">Palo Alto</div>
            </div>

            <div className="job-row">
              <div className="job-title">Clinical Research Scientist</div>
              <div className="job-location">Cambridge</div>
            </div>

            <div className="job-row">
              <div className="job-title">Full-stack Engineer</div>
              <div className="job-location">Palo Alto</div>
            </div>

            <div className="job-row">
              <div className="job-title">Senior Backend Engineer</div>
              <div className="job-location">Palo Alto</div>
            </div>

            <div className="job-row">
              <div className="job-title">Head of Regulatory Affairs</div>
              <div className="job-location">Palo Alto</div>
            </div>

            <div className="job-row">
              <div className="job-title">Product Designer</div>
              <div className="job-location">Palo Alto</div>
            </div>

            <div className="job-row">
              <div className="job-title">Research Scientist - Biomarkers</div>
              <div className="job-location">Cambridge</div>
            </div>

            <div className="job-row">
              <div className="job-title">Infrastructure Engineer</div>
              <div className="job-location">Palo Alto</div>
            </div>
          </div>

          <p style={{ marginTop: '60px', textAlign: 'center' }}>
            Don&apos;t see your role? We&apos;re always looking for exceptional talent.<br/>
            Send your resume to <a href="mailto:careers@moccet.com">careers@moccet.com</a>
          </p>
        </div>
      </div>

      <footer>
        <p>moccet © 2025 · <a href="#">Terms of service</a> · <a href="#">Privacy notice</a></p>
      </footer>
    </>
  );
}
