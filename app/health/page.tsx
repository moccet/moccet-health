'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function HealthPage() {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [currentSection, setCurrentSection] = useState('overview');

  useEffect(() => {
    // Set sidebar to open on desktop by default
    if (window.innerWidth > 768) {
      setSidebarActive(true);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const handleNavigate = (targetId: string) => {
    if (targetId.startsWith('#')) {
      const section = targetId.replace('#', '');
      setCurrentSection(section);

      // Scroll to top when switching sections
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        setSidebarActive(false);
      }
    }
  };

  const calculateROI = () => {
    const patientVolumeEl = document.getElementById('patientVolume') as HTMLInputElement;
    const revenuePerPatientEl = document.getElementById('revenuePerPatient') as HTMLInputElement;
    const roiResultEl = document.getElementById('roiResult');

    if (!patientVolumeEl || !revenuePerPatientEl || !roiResultEl) return;

    const patientVolume = parseInt(patientVolumeEl.value) || 50000;
    const revenuePerPatient = parseInt(revenuePerPatientEl.value) || 3000;

    const totalRevenue = patientVolume * revenuePerPatient;
    const savings = totalRevenue * 0.10;

    let formattedSavings;
    if (savings >= 1000000) {
      formattedSavings = '$' + (savings / 1000000).toFixed(1) + 'M';
    } else if (savings >= 1000) {
      formattedSavings = '$' + (savings / 1000).toFixed(0) + 'K';
    } else {
      formattedSavings = '$' + savings.toFixed(0);
    }

    roiResultEl.textContent = formattedSavings;
  };

  const calculateHospitalROI = () => {
    const patientVolumeEl = document.getElementById('hospitalPatientVolume') as HTMLInputElement;
    const revenuePerPatientEl = document.getElementById('hospitalRevenuePerPatient') as HTMLInputElement;
    const roiResultEl = document.getElementById('hospitalRoiResult');

    if (!patientVolumeEl || !revenuePerPatientEl || !roiResultEl) return;

    const patientVolume = parseInt(patientVolumeEl.value) || 50000;
    const revenuePerPatient = parseInt(revenuePerPatientEl.value) || 3000;

    const totalRevenue = patientVolume * revenuePerPatient;
    const savings = totalRevenue * 0.10;

    let formattedSavings;
    if (savings >= 1000000) {
      formattedSavings = '$' + (savings / 1000000).toFixed(0) + 'M';
    } else if (savings >= 1000) {
      formattedSavings = '$' + (savings / 1000).toFixed(0) + 'K';
    } else {
      formattedSavings = '$' + savings.toFixed(0);
    }

    roiResultEl.textContent = formattedSavings;
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <Header
        onToggleSidebar={toggleSidebar}
        onContactSales={() => handleNavigate('#contact')}
        sidebarActive={sidebarActive}
      />

      <Sidebar
        isActive={sidebarActive}
        onNavigate={handleNavigate}
      />

      <main
        style={{
          marginLeft: sidebarActive ? '240px' : '0',
          paddingTop: '60px',
          transition: 'margin-left 0.2s ease',
          minHeight: 'calc(100vh - 60px)'
        }}
      >
        <style jsx>{`
        .content {
            padding: 64px 48px;
            max-width: 1400px;
            margin: 0 auto;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            color: #000;
            line-height: 1.6;
        }

        .page-section {
            display: none;
        }

        .page-section.active {
            display: block;
        }

        /* Hero Section */
        .hero {
            text-align: center;
            margin-bottom: 80px;
        }

        .hero h1 {
            font-size: 56px;
            font-weight: 400;
            line-height: 1.1;
            margin-bottom: 24px;
            letter-spacing: -1px;
        }

        .hero-subtitle {
            font-size: 20px;
            color: #333;
            margin-bottom: 40px;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }

        .hero-buttons {
            display: flex;
            gap: 16px;
            justify-content: center;
        }

        .btn-primary {
            background: #000;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 15px;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .btn-primary:hover {
            background: #333;
        }

        .btn-secondary {
            background: white;
            color: #000;
            border: 1px solid #d0d0d0;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 15px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }

        .btn-secondary:hover {
            border-color: #000;
        }

        /* Product Cards */
        .products {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-bottom: 80px;
        }

        .product-card {
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            padding: 32px;
        }

        .product-card h2 {
            font-size: 24px;
            font-weight: 500;
            margin-bottom: 16px;
        }

        .product-card p {
            color: #333;
            margin-bottom: 24px;
            font-size: 16px;
        }

        .product-features {
            list-style: none;
            margin-bottom: 32px;
        }

        .product-features li {
            padding: 8px 0;
            padding-left: 24px;
            position: relative;
            font-size: 15px;
            color: #333;
        }

        .product-features li:before {
            content: "•";
            position: absolute;
            left: 0;
        }

        .product-link {
            color: #000;
            text-decoration: none;
            font-size: 15px;
            border-bottom: 1px solid transparent;
        }

        .product-link:hover {
            border-bottom: 1px solid #000;
        }

        /* Pricing Cards */
        .pricing-section {
            margin: 80px 0;
        }

        .pricing-title {
            font-size: 48px;
            font-weight: 400;
            text-align: center;
            margin-bottom: 60px;
        }

        .pricing-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 32px;
            margin-bottom: 60px;
        }

        .pricing-card {
            background: #fafafa;
            border-radius: 16px;
            padding: 40px 32px;
            position: relative;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .pricing-card.featured {
            background: #000;
            color: white;
        }

        .pricing-card.featured .pricing-subtitle,
        .pricing-card.featured .feature-item {
            color: rgba(255, 255, 255, 0.8);
        }

        .pricing-tier {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .pricing-card.featured .pricing-tier {
            color: rgba(255, 255, 255, 0.6);
        }

        .pricing-price {
            font-size: 48px;
            font-weight: 400;
            margin-bottom: 8px;
        }

        .pricing-subtitle {
            font-size: 15px;
            color: #666;
            margin-bottom: 32px;
        }

        .pricing-features {
            list-style: none;
            flex-grow: 1;
        }

        .feature-item {
            padding: 12px 0;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            font-size: 15px;
        }

        .feature-item:before {
            content: "✓";
            color: #10b981;
            font-weight: bold;
            margin-top: 2px;
        }

        .pricing-card.featured .feature-item:before {
            color: #4ade80;
        }

        .pricing-cta {
            margin-top: 32px;
        }

        .pricing-btn {
            width: 100%;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            display: block;
            border: 1px solid #d0d0d0;
            background: white;
            color: #000;
        }

        .pricing-card.featured .pricing-btn {
            background: white;
            color: #000;
            border: none;
        }

        .pricing-btn:hover {
            background: #f5f5f5;
        }

        /* Demo Section */
        .demo-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-bottom: 80px;
        }

        .demo-card {
            background: #f7f7f7;
            border-radius: 12px;
            padding: 24px;
            height: 300px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        /* Logos Section */
        .logos-section {
            text-align: center;
            padding: 60px 0;
            border-top: 1px solid #e5e5e5;
            border-bottom: 1px solid #e5e5e5;
            margin-bottom: 80px;
        }

        .logos-grid {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 60px;
            flex-wrap: wrap;
            margin-top: 40px;
        }

        .logo-item {
            font-size: 20px;
            font-weight: 600;
            color: #000;
            opacity: 0.7;
        }

        /* Customer Stories */
        .stories-section {
            margin-bottom: 80px;
        }

        .stories-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
        }

        .story-card {
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
        }

        .story-image {
            width: 100%;
            height: 200px;
            background-size: cover;
            background-position: center;
        }

        .story-content {
            padding: 16px;
        }

        .story-title {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 8px;
        }

        .story-meta {
            font-size: 14px;
            color: #666;
        }

        /* Feature Sections */
        .feature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            align-items: center;
            margin-bottom: 100px;
        }

        .feature-content h2 {
            font-size: 36px;
            font-weight: 400;
            margin-bottom: 24px;
            line-height: 1.2;
        }

        .feature-list {
            list-style: none;
        }

        .feature-list li {
            padding: 12px 0;
            font-size: 16px;
            color: #333;
            padding-left: 24px;
            position: relative;
        }

        .feature-list li:before {
            content: "•";
            position: absolute;
            left: 0;
        }

        .feature-visual {
            background: #f0f0f0;
            border-radius: 12px;
            height: 400px;
        }

        .feature-visual img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 12px;
        }

        /* Resources Section */
        .resources-section {
            text-align: center;
            padding: 60px 0;
        }

        .resources-title {
            font-size: 42px;
            font-weight: 400;
            margin-bottom: 48px;
            line-height: 1.2;
        }

        /* Explore More */
        .explore-section {
            margin-top: 80px;
        }

        .explore-title {
            font-size: 32px;
            font-weight: 400;
            margin-bottom: 40px;
        }

        .explore-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
        }

        .explore-card {
            cursor: pointer;
        }

        .explore-image {
            width: 100%;
            height: 180px;
            border-radius: 8px;
            margin-bottom: 16px;
        }

        .explore-card h3 {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 8px;
        }

        .explore-meta {
            display: flex;
            gap: 12px;
            font-size: 13px;
            color: #666;
        }

        .wellness-logo {
            height: 160px;
            width: auto;
        }

        /* Mobile */
        @media (max-width: 768px) {
            .nav-toggle {
                display: block;
            }

            .sidebar {
                position: fixed;
                left: -200px;
                top: 60px;
                background: white;
                z-index: 99;
                transition: left 0.3s;
                box-shadow: 2px 0 8px rgba(0,0,0,0.1);
            }

            .sidebar.open {
                left: 0;
            }

            .content {
                padding: 40px 20px;
            }

            .hero h1 {
                font-size: 36px;
            }

            .wellness-logo {
                height: 80px;
            }

            .products {
                grid-template-columns: 1fr;
            }

            .pricing-grid {
                grid-template-columns: 1fr;
            }

            .demo-section {
                grid-template-columns: 1fr;
            }

            .stories-grid {
                grid-template-columns: 1fr;
            }

            .feature-section {
                grid-template-columns: 1fr;
            }

            .explore-grid {
                grid-template-columns: 1fr;
            }
        }
      `}</style>

        <div className="content">
          {/* Health Overview Page */}
          {currentSection === 'overview' && (
            <div className="page-section active">
            {/* Hero Section */}
            <div className="hero">
              <h1>Your health. Your data. Your AI.</h1>
              <p className="hero-subtitle">
                Small AI models that detect disease before symptoms appear. Complete privacy with you holding the keys. Expert implementation through leading hospitals.
              </p>
              <div className="hero-buttons">
                <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} className="btn-primary">Join waitlist &rarr;</a>
                <a href="#" onClick={() => { handleNavigate('#hospitals'); return false; }} className="btn-secondary">For hospitals</a>
              </div>
            </div>

            {/* Product Cards */}
            <div className="products">
              <div className="product-card">
                <h2>moccet Health Personal</h2>
                <p>Your personal AI health model that learns and protects.</p>

                <ul className="product-features">
                  <li>Detect cancer months before symptoms with high accuracy</li>
                  <li>End-to-end encryption - you hold the only keys</li>
                  <li>Small specialized models that run on your device</li>
                  <li>Continuous monitoring through wearables and blood tests</li>
                </ul>

                <a href="#" onClick={() => { handleNavigate('#pricing'); return false; }} className="product-link">See pricing</a>
              </div>

              <div className="product-card">
                <h2>moccet + The Wellness</h2>
                <p>Complete health AI with comprehensive testing included.</p>

                <ul className="product-features">
                  <li>Quarterly comprehensive blood panels</li>
                  <li>Annual full-body MRI with AI analysis</li>
                  <li>Monthly at-home testing kits</li>
                  <li>Priority access to specialists</li>
                </ul>

                <div style={{display: 'flex', gap: '16px'}}>
                  <a href="#" onClick={() => { handleNavigate('#wellness'); return false; }} className="product-link">Learn more</a>
                  <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} className="product-link">Join waitlist &rarr;</a>
                </div>
              </div>
            </div>

            {/* Demo Section */}
            <div className="demo-section">
              <div className="demo-card">
                <div style={{background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)', padding: '40px', borderRadius: '8px'}}>
                  <div style={{textAlign: 'center', marginBottom: '20px', fontWeight: '500'}}>AI detects early warning signs:</div>
                  <div style={{background: 'white', borderRadius: '6px', padding: '16px', marginBottom: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <div style={{width: '24px', height: '24px', background: '#ff6b6b', borderRadius: '4px'}}></div>
                      <span style={{fontSize: '14px'}}>Pancreatic cancer risk: High probability detected</span>
                    </div>
                  </div>
                  <div style={{background: 'white', borderRadius: '6px', padding: '16px', marginBottom: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <div style={{width: '24px', height: '24px', background: '#4ecdc4', borderRadius: '4px'}}></div>
                      <span style={{fontSize: '14px'}}>Cardiac event probability: 67% in 30 days</span>
                    </div>
                  </div>
                  <div style={{background: 'white', borderRadius: '6px', padding: '16px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <div style={{width: '24px', height: '24px', background: '#95e77e', borderRadius: '4px'}}></div>
                      <span style={{fontSize: '14px'}}>Kidney function declining: Intervention needed</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="demo-card">
                <div style={{background: 'linear-gradient(135deg, #e3f2fd, #bbdefb)', padding: '40px', borderRadius: '8px'}}>
                  <div style={{textAlign: 'center', marginBottom: '20px', fontWeight: '500'}}>Your Health Dashboard</div>
                  <div style={{background: 'white', borderRadius: '8px', padding: '20px'}}>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px'}}>
                      <div style={{background: '#f3f4f6', height: '40px', borderRadius: '4px'}}></div>
                      <div style={{background: '#f3f4f6', height: '40px', borderRadius: '4px'}}></div>
                      <div style={{background: '#f3f4f6', height: '40px', borderRadius: '4px'}}></div>
                    </div>
                    <div style={{background: '#f3f4f6', height: '100px', borderRadius: '4px', marginBottom: '8px'}}></div>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                      <div style={{background: '#f3f4f6', height: '60px', borderRadius: '4px'}}></div>
                      <div style={{background: '#f3f4f6', height: '60px', borderRadius: '4px'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            <h2 style={{fontSize: '36px', textAlign: 'center', marginBottom: '40px'}}>The future of medicine is predictive, not reactive</h2>

            {/* Customer Stories */}
            <div className="stories-section">
              <div className="stories-grid">
                <div className="story-card">
                  <img className="story-image" src="/images/research-neural.jpg" alt="AI cancer detection patient story" />
                  <div className="story-content">
                    <h3 className="story-title">AI detects cancer before symptoms</h3>
                    <div className="story-meta">
                      <span>Patient Story</span>
                    </div>
                  </div>
                </div>
                <div className="story-card">
                  <img className="story-image" src="/images/Enterprise-Healthcare.jpg" alt="Cleveland Clinic error reduction case study" />
                  <div className="story-content">
                    <h3 className="story-title">Cleveland Clinic: 40% error reduction</h3>
                    <div className="story-meta">
                      <span>Hospital</span>
                    </div>
                  </div>
                </div>
                <div className="story-card">
                  <img className="story-image" src="/images/research-hrm.jpg" alt="AI stroke prediction research" />
                  <div className="story-content">
                    <h3 className="story-title">Preventing strokes with AI prediction</h3>
                    <div className="story-meta">
                      <span>Research</span>
                    </div>
                  </div>
                </div>
                <div className="story-card">
                  <img className="story-image" src="/images/wave4.jpg" alt="Data privacy and security" />
                  <div className="story-content">
                    <h3 className="story-title">Your data stays yours forever</h3>
                    <div className="story-meta">
                      <span>Privacy</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enable Early Detection Section */}
            <div className="feature-section">
              <div className="feature-content">
                <h2>Detect disease before symptoms appear</h2>
                <ul className="feature-list">
                  <li>Advanced early detection of pancreatic cancer</li>
                  <li>Predict cardiac events 30 days in advance</li>
                  <li>Identify rare diseases physicians often miss</li>
                  <li>Track 47+ biomarkers and their subtle patterns</li>
                </ul>
                <div style={{marginTop: '32px'}}>
                  <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} style={{color: '#000', textDecoration: 'none'}}>Join waitlist &rarr;</a><br/>
                  <a href="#" onClick={() => { handleNavigate('#pricing'); return false; }} style={{color: '#000', textDecoration: 'none', marginTop: '8px', display: 'inline-block'}}>View pricing options &rarr;</a>
                </div>
              </div>
              <div className="feature-visual">
              <img
                src="/images/Enterprise-Healthcare.jpg"
                alt="AI early disease detection visualization"
                style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
              />
            </div>
            </div>

            {/* Privacy Section */}
            <div className="feature-section">
              <div className="feature-visual">
                <img
                  src="/images/wave1.jpg"
                  alt="Privacy and security visualization"
                  style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
                />
              </div>
              <div className="feature-content">
                <h2>Complete privacy: We can&apos;t see your data</h2>
                <ul className="feature-list">
                  <li>End-to-end encryption with keys only you control</li>
                  <li>Zero-knowledge architecture - we process without seeing</li>
                  <li>Models train on your device, not our servers</li>
                  <li>Homomorphic encryption for computations</li>
                </ul>
                <div style={{marginTop: '32px'}}>
                  <a href="#" onClick={() => { handleNavigate('#wellness'); return false; }} style={{color: '#000', textDecoration: 'none'}}>Learn about privacy &rarr;</a>
                </div>
              </div>
            </div>

            {/* Small Models Section */}
            <div className="feature-section">
              <div className="feature-content">
                <h2>Small specialized models outperform general AI</h2>
                <ul className="feature-list">
                  <li>200+ specialized models, each expert in one area</li>
                  <li>10x better sensitivity than general medical AI</li>
                  <li>Runs on your phone - no cloud required</li>
                  <li>Interpretable decisions physicians can understand</li>
                  <li>Continuous learning from millions of cases</li>
                </ul>
                <div style={{marginTop: '32px'}}>
                  <a href="#" style={{color: '#000', textDecoration: 'none'}}>Read the research &rarr;</a>
                </div>
              </div>
              <div className="feature-visual">
                <img
                  src="/images/big feature.jpg"
                  alt="Small specialized AI models visualization"
                  style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
                />
              </div>
            </div>

            {/* Resources Section */}
            <div className="resources-section">
              <h2 className="resources-title">Learn how AI will transform<br/>personal medicine forever</h2>
              <a href="#" className="btn-secondary">Explore research</a>
            </div>

            {/* Explore More Section */}
            <div className="explore-section">
              <h2 className="explore-title">Latest developments</h2>
              <div className="explore-grid">
                <div className="explore-card">
                  <img className="explore-image" src="/images/research-neural.jpg" alt="AI cancer detection research" />
                  <h3>AI detects cancer before symptoms</h3>
                  <div className="explore-meta">
                    <span>Research</span>
                    <span>Sep 17, 2025</span>
                  </div>
                </div>
                <div className="explore-card">
                  <img className="explore-image" src="/images/The Wellness-14.png" alt="The Wellness partnership" />
                  <h3>The Wellness partnership announced</h3>
                  <div className="explore-meta">
                    <span>Partnership</span>
                    <span>Sep 16, 2025</span>
                  </div>
                </div>
                <div className="explore-card">
                  <img className="explore-image" src="/images/painting2.jpg" alt="Mayo Clinic deployment" />
                  <h3>Mayo Clinic system-wide deployment</h3>
                  <div className="explore-meta">
                    <span>Hospital</span>
                    <span>Sep 11, 2025</span>
                  </div>
                </div>
                <div className="explore-card">
                  <img className="explore-image" src="/images/wave4.jpg" alt="Data privacy and security" />
                  <h3>Your health data stays yours forever</h3>
                  <div className="explore-meta">
                    <span>Privacy</span>
                    <span>Sep 10, 2025</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Pricing Page */}
          {currentSection === 'pricing' && (
            <div className="page-section active">
            <div className="pricing-section">
              <h1 className="pricing-title">Choose your health protection level</h1>

              <div className="pricing-grid">
                {/* Personal Tier */}
                <div className="pricing-card">
                  <div className="pricing-tier">Personal</div>
                  <div className="pricing-price">$99</div>
                  <div className="pricing-subtitle">per month</div>

                  <ul className="pricing-features">
                    <li className="feature-item">Personal AI health model</li>
                    <li className="feature-item">Disease detection capabilities</li>
                    <li className="feature-item">End-to-end encryption</li>
                    <li className="feature-item">Wearable integration</li>
                    <li className="feature-item">Monthly health insights</li>
                  </ul>

                  <div className="pricing-cta">
                    <button className="pricing-btn" onClick={() => handleNavigate('#contact')}>Join waitlist</button>
                  </div>
                </div>

                {/* Complete Tier */}
                <div className="pricing-card featured">
                  <div className="pricing-tier">Complete</div>
                  <div className="pricing-price">$299</div>
                  <div className="pricing-subtitle">per month</div>

                  <ul className="pricing-features">
                    <li className="feature-item">Everything in Personal</li>
                    <li className="feature-item">Quarterly blood panels</li>
                    <li className="feature-item">Annual full-body MRI</li>
                    <li className="feature-item">Genetic testing</li>
                    <li className="feature-item">Monthly at-home tests</li>
                    <li className="feature-item">Priority specialist access</li>
                  </ul>

                  <div className="pricing-cta">
                    <button className="pricing-btn" onClick={() => handleNavigate('#contact')}>Join waitlist</button>
                  </div>
                </div>

                {/* Enterprise Tier */}
                <div className="pricing-card">
                  <div className="pricing-tier">Enterprise</div>
                  <div className="pricing-price">Custom</div>
                  <div className="pricing-subtitle">For health systems</div>

                  <ul className="pricing-features">
                    <li className="feature-item">200+ specialized models</li>
                    <li className="feature-item">On-premise deployment</li>
                    <li className="feature-item">EMR integration</li>
                    <li className="feature-item">Training &amp; support</li>
                    <li className="feature-item">HIPAA compliant</li>
                  </ul>

                  <div className="pricing-cta">
                    <button className="pricing-btn" onClick={() => handleNavigate('#contact')}>Contact sales</button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Contact/Waitlist Page */}
          {currentSection === 'contact' && (
            <div className="page-section active">
            <div style={{maxWidth: '600px', margin: '0 auto', textAlign: 'center'}}>
              <h1 style={{fontSize: '48px', marginBottom: '24px'}}>Join the moccet health waitlist</h1>
              <p style={{fontSize: '18px', color: '#666', marginBottom: '48px'}}>
                Be among the first to have AI protection against disease. Complete privacy. Expert implementation.
              </p>

              <form style={{textAlign: 'left'}}>
                <div style={{marginBottom: '24px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500'}}>Name *</label>
                  <input type="text" style={{width: '100%', padding: '10px', border: '1px solid #d0d0d0', borderRadius: '6px'}} required />
                </div>

                <div style={{marginBottom: '24px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500'}}>Email *</label>
                  <input type="email" style={{width: '100%', padding: '10px', border: '1px solid #d0d0d0', borderRadius: '6px'}} required />
                </div>

                <div style={{marginBottom: '24px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500'}}>I&apos;m interested in:</label>
                  <select style={{width: '100%', padding: '10px', border: '1px solid #d0d0d0', borderRadius: '6px'}} required>
                    <option>Personal health tracking</option>
                    <option>Family health management</option>
                    <option>moccet + The Wellness</option>
                    <option>Hospital deployment</option>
                    <option>Research partnership</option>
                  </select>
                </div>

                <div style={{marginBottom: '24px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500'}}>Organization (optional)</label>
                  <input type="text" style={{width: '100%', padding: '10px', border: '1px solid #d0d0d0', borderRadius: '6px'}} placeholder="Hospital, clinic, or company" />
                </div>

                <div style={{marginBottom: '32px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500'}}>Questions or special requirements?</label>
                  <textarea style={{width: '100%', padding: '10px', border: '1px solid #d0d0d0', borderRadius: '6px', minHeight: '120px'}}></textarea>
                </div>

                <button type="submit" style={{width: '100%', padding: '12px', background: '#000', color: 'white', border: 'none', borderRadius: '24px', fontSize: '16px', cursor: 'pointer'}}>
                  Join Waitlist
                </button>
              </form>

              <p style={{marginTop: '48px', fontSize: '14px', color: '#666'}}>
                Launch expected Q2 2026. Early access pricing available for waitlist members.
              </p>
            </div>
            </div>
          )}

          {/* Hospitals Page */}
          {currentSection === 'hospitals' && (
            <div className="page-section active">
            {/* Hero Section */}
            <div className="hero">
              <h1>Transform healthcare with specialized AI</h1>
              <p className="hero-subtitle">
                Deploy specialized medical AI models across your health system. On-premise installation ensures complete data control while improving diagnostic accuracy.
              </p>
              <div className="hero-buttons">
                <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} className="btn-primary">Request early access &rarr;</a>
                <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} className="btn-secondary">Contact sales</a>
              </div>
            </div>

            {/* Product Cards */}
            <div className="products">
              <div className="product-card">
                <h2>moccet for Hospitals</h2>
                <p>Enterprise deployment of specialized medical AI models.</p>

                <ul className="product-features">
                  <li>200+ specialized models across all departments</li>
                  <li>Can detect diseases before symptoms appear</li>
                  <li>On-premise deployment - data never leaves your network</li>
                  <li>Full EMR integration with Epic, Cerner, and others</li>
                </ul>

                <a href="#" onClick={() => { scrollToSection('hospitalPricingSection'); return false; }} className="product-link">See pricing</a>
              </div>

              <div className="product-card">
                <h2>Platform Capabilities</h2>
                <p>Build custom solutions for your health system.</p>

                <ul className="product-features">
                  <li>Custom model training on your patient population</li>
                  <li>Department-specific workflow integration</li>
                  <li>Federated learning across facilities</li>
                  <li>Expert implementation and training included</li>
                </ul>

                <div style={{display: 'flex', gap: '16px'}}>
                  <a href="#" onClick={() => { scrollToSection('implementationSection'); return false; }} className="product-link">Start building</a>
                  <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} className="product-link">Contact sales &rarr;</a>
                </div>
              </div>
            </div>

            {/* Demo Section */}
            <div className="demo-section">
              <div className="demo-card">
                <div style={{background: 'linear-gradient(135deg, #a8e6cf, #7fcdbb)', padding: '40px', borderRadius: '8px'}}>
                  <div style={{textAlign: 'center', marginBottom: '20px', fontWeight: '500'}}>AI can identify:</div>
                  <div style={{background: 'white', borderRadius: '6px', padding: '16px', marginBottom: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <div style={{width: '24px', height: '24px', background: '#fbbf24', borderRadius: '4px'}}></div>
                      <span style={{fontSize: '14px'}}>Early-stage cancer patterns</span>
                    </div>
                  </div>
                  <div style={{background: 'white', borderRadius: '6px', padding: '16px', marginBottom: '12px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <div style={{width: '24px', height: '24px', background: '#60a5fa', borderRadius: '4px'}}></div>
                      <span style={{fontSize: '14px'}}>Sepsis risk 6 hours before onset</span>
                    </div>
                  </div>
                  <div style={{background: 'white', borderRadius: '6px', padding: '16px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <div style={{width: '24px', height: '24px', background: '#a78bfa', borderRadius: '4px'}}></div>
                      <span style={{fontSize: '14px'}}>Rare diseases often missed</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="demo-card">
                <div style={{background: 'linear-gradient(135deg, #bfdbfe, #93c5fd)', padding: '40px', borderRadius: '8px'}}>
                  <div style={{textAlign: 'center', marginBottom: '20px', fontWeight: '500'}}>ROI Calculator</div>
                  <div style={{background: 'white', borderRadius: '8px', padding: '20px'}}>
                    <div style={{marginBottom: '16px'}}>
                      <label style={{fontSize: '12px', color: '#666'}}>Annual patient volume</label>
                      <input type="number" id="hospitalPatientVolume" defaultValue="50000" style={{width: '100%', padding: '8px', border: '1px solid #e5e5e5', borderRadius: '4px', marginTop: '4px'}} onChange={() => calculateHospitalROI()} />
                    </div>
                    <div style={{marginBottom: '16px'}}>
                      <label style={{fontSize: '12px', color: '#666'}}>Average revenue per patient</label>
                      <input type="number" id="hospitalRevenuePerPatient" defaultValue="3000" style={{width: '100%', padding: '8px', border: '1px solid #e5e5e5', borderRadius: '4px', marginTop: '4px'}} onChange={() => calculateHospitalROI()} />
                    </div>
                    <div style={{background: '#f3f4f6', padding: '12px', borderRadius: '4px', marginTop: '16px'}}>
                      <div style={{fontSize: '12px', color: '#666'}}>Estimated annual savings</div>
                      <div id="hospitalRoiResult" style={{fontSize: '24px', fontWeight: '600', color: '#10b981'}}>$15M</div>
                      <div style={{fontSize: '11px', color: '#666', marginTop: '4px'}}>Based on 10% efficiency gain</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            <h2 style={{fontSize: '36px', textAlign: 'center', marginBottom: '40px'}}>The AI platform powering leading health systems</h2>

            {/* Customer Stories */}
            <div className="stories-section">
              <div className="stories-grid">
                <div className="story-card">
                  <img className="story-image" src="/images/gradient4.jpg" alt="Diagnostic accuracy improvement" />
                  <div className="story-content">
                    <h3 className="story-title">Improving diagnostic accuracy</h3>
                    <div className="story-meta">
                      <span>Cleveland Clinic</span>
                    </div>
                  </div>
                </div>
                <div className="story-card">
                  <img className="story-image" src="/images/painting2.jpg" alt="Early sepsis detection" />
                  <div className="story-content">
                    <h3 className="story-title">Can detect sepsis hours earlier</h3>
                    <div className="story-meta">
                      <span>Emergency Medicine</span>
                    </div>
                  </div>
                </div>
                <div className="story-card">
                  <img className="story-image" src="/images/sky-painting5.jpg" alt="Reducing readmission rates" />
                  <div className="story-content">
                    <h3 className="story-title">Reducing readmission rates</h3>
                    <div className="story-meta">
                      <span>Mayo Clinic</span>
                    </div>
                  </div>
                </div>
                <div className="story-card">
                  <img className="story-image" src="/images/painting4.jpg" alt="Rare disease detection" />
                  <div className="story-content">
                    <h3 className="story-title">Finding rare diseases</h3>
                    <div className="story-meta">
                      <span>Diagnosis</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enable Workforce Section */}
            <div className="feature-section">
              <div className="feature-content">
                <h2>Enable your physicians with AI assistance</h2>
                <ul className="feature-list">
                  <li>AI can analyze patterns invisible to human observation</li>
                  <li>Seamless integration with existing EMR workflows</li>
                  <li>Interpretable recommendations physicians can understand</li>
                  <li>Continuous learning from your patient population</li>
                </ul>
                <div style={{marginTop: '32px'}}>
                  <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} style={{color: '#000', textDecoration: 'none'}}>Request early access &rarr;</a><br/>
                  <a href="#" onClick={() => { scrollToSection('hospitalPricingSection'); return false; }} style={{color: '#000', textDecoration: 'none', marginTop: '8px', display: 'inline-block'}}>View pricing options &rarr;</a>
                </div>
              </div>
              <div className="feature-visual">
                <img
                  src="/images/gradient4.jpg"
                  alt="AI-assisted physicians and healthcare"
                  style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
                />
              </div>
            </div>

            {/* Build AI-native Section */}
            <div className="feature-section">
              <div className="feature-visual">
                <img
                  src="/images/painting4.jpg"
                  alt="Department-specific AI solutions"
                  style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
                />
              </div>
              <div className="feature-content">
                <h2>Build department-specific solutions</h2>
                <ul className="feature-list">
                  <li>200+ specialized models for every department</li>
                  <li>Custom training on your patient demographics</li>
                  <li>Expert support and physician training included</li>
                </ul>
                <div style={{marginTop: '32px'}}>
                  <a href="#" onClick={() => { scrollToSection('modelsSection'); return false; }} style={{color: '#000', textDecoration: 'none'}}>Explore models &rarr;</a>
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="feature-section">
              <div className="feature-content">
                <h2>Enterprise-grade security and compliance</h2>
                <ul className="feature-list">
                  <li>On-premise deployment with complete data control</li>
                  <li>HIPAA, HITECH, and 21st Century Cures Act compliant</li>
                  <li>Air-gapped deployment options available</li>
                  <li>Full audit trails and access controls</li>
                  <li>Zero patient data leaves your network</li>
                </ul>
                <div style={{marginTop: '32px'}}>
                  <a href="#" onClick={() => { handleNavigate('#safety'); return false; }} style={{color: '#000', textDecoration: 'none'}}>View security documentation &rarr;</a>
                </div>
              </div>
              <div className="feature-visual">
                <img
                  src="/images/sky-painting5.jpg"
                  alt="Enterprise security and compliance"
                  style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
                />
              </div>
            </div>

            {/* Models by Department Section */}
            <div id="modelsSection" style={{margin: '80px 0'}}>
              <h2 style={{fontSize: '36px', textAlign: 'center', marginBottom: '40px'}}>200+ specialized models by department</h2>

              <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px'}}>
                <div style={{padding: '24px', border: '1px solid #e5e5e5', borderRadius: '12px'}}>
                  <h3 style={{fontSize: '20px', marginBottom: '16px'}}>Cardiology (47 models)</h3>
                  <ul style={{listStyle: 'none', fontSize: '14px', color: '#666', lineHeight: '1.8'}}>
                    <li>• Arrhythmia detection</li>
                    <li>• Heart failure prediction</li>
                    <li>• MI risk stratification</li>
                    <li>• Vascular disease patterns</li>
                  </ul>
                </div>

                <div style={{padding: '24px', border: '1px solid #e5e5e5', borderRadius: '12px'}}>
                  <h3 style={{fontSize: '20px', marginBottom: '16px'}}>Oncology (63 models)</h3>
                  <ul style={{listStyle: 'none', fontSize: '14px', color: '#666', lineHeight: '1.8'}}>
                    <li>• Early cancer detection</li>
                    <li>• Treatment response prediction</li>
                    <li>• Metastasis risk assessment</li>
                    <li>• Personalized therapy selection</li>
                  </ul>
                </div>

                <div style={{padding: '24px', border: '1px solid #e5e5e5', borderRadius: '12px'}}>
                  <h3 style={{fontSize: '20px', marginBottom: '16px'}}>Emergency (24 models)</h3>
                  <ul style={{listStyle: 'none', fontSize: '14px', color: '#666', lineHeight: '1.8'}}>
                    <li>• Rapid triage optimization</li>
                    <li>• Sepsis early warning</li>
                    <li>• Critical event prediction</li>
                    <li>• Resource allocation AI</li>
                  </ul>
                </div>

                <div style={{padding: '24px', border: '1px solid #e5e5e5', borderRadius: '12px'}}>
                  <h3 style={{fontSize: '20px', marginBottom: '16px'}}>Neurology (31 models)</h3>
                  <ul style={{listStyle: 'none', fontSize: '14px', color: '#666', lineHeight: '1.8'}}>
                    <li>• Stroke risk prediction</li>
                    <li>• Alzheimer progression</li>
                    <li>• Seizure forecasting</li>
                    <li>• Movement disorders</li>
                  </ul>
                </div>

                <div style={{padding: '24px', border: '1px solid #e5e5e5', borderRadius: '12px'}}>
                  <h3 style={{fontSize: '20px', marginBottom: '16px'}}>Internal Medicine (38 models)</h3>
                  <ul style={{listStyle: 'none', fontSize: '14px', color: '#666', lineHeight: '1.8'}}>
                    <li>• Diabetes complications</li>
                    <li>• Kidney disease progression</li>
                    <li>• Liver function analysis</li>
                    <li>• Autoimmune detection</li>
                  </ul>
                </div>

                <div style={{padding: '24px', border: '1px solid #e5e5e5', borderRadius: '12px'}}>
                  <h3 style={{fontSize: '20px', marginBottom: '16px'}}>Radiology (27 models)</h3>
                  <ul style={{listStyle: 'none', fontSize: '14px', color: '#666', lineHeight: '1.8'}}>
                    <li>• Automated screening</li>
                    <li>• Anomaly detection</li>
                    <li>• Report generation</li>
                    <li>• Priority flagging</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Implementation Timeline */}
            <div id="implementationSection" style={{margin: '80px 0'}}>
              <h2 style={{fontSize: '36px', textAlign: 'center', marginBottom: '40px'}}>Implementation roadmap</h2>

              <div style={{display: 'flex', justifyContent: 'space-between', maxWidth: '1000px', margin: '0 auto'}}>
                <div style={{flex: '1', textAlign: 'center', padding: '0 20px'}}>
                  <div style={{width: '60px', height: '60px', background: '#000', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', fontWeight: '600'}}>1</div>
                  <h4 style={{fontSize: '16px', marginBottom: '8px'}}>Week 1-2</h4>
                  <p style={{fontSize: '14px', color: '#666'}}>System assessment &amp; planning</p>
                </div>

                <div style={{flex: '1', textAlign: 'center', padding: '0 20px'}}>
                  <div style={{width: '60px', height: '60px', background: '#000', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', fontWeight: '600'}}>2</div>
                  <h4 style={{fontSize: '16px', marginBottom: '8px'}}>Week 3-4</h4>
                  <p style={{fontSize: '14px', color: '#666'}}>Infrastructure setup</p>
                </div>

                <div style={{flex: '1', textAlign: 'center', padding: '0 20px'}}>
                  <div style={{width: '60px', height: '60px', background: '#000', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', fontWeight: '600'}}>3</div>
                  <h4 style={{fontSize: '16px', marginBottom: '8px'}}>Week 5-8</h4>
                  <p style={{fontSize: '14px', color: '#666'}}>Model deployment &amp; EMR integration</p>
                </div>

                <div style={{flex: '1', textAlign: 'center', padding: '0 20px'}}>
                  <div style={{width: '60px', height: '60px', background: '#000', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', fontWeight: '600'}}>4</div>
                  <h4 style={{fontSize: '16px', marginBottom: '8px'}}>Week 9-12</h4>
                  <p style={{fontSize: '14px', color: '#666'}}>Staff training &amp; go-live</p>
                </div>
              </div>
            </div>

            {/* Hospital Pricing Section */}
            <div id="hospitalPricingSection" className="pricing-section">
              <h1 className="pricing-title">Enterprise pricing models</h1>

              <div className="pricing-grid">
                {/* Pilot */}
                <div className="pricing-card">
                  <div className="pricing-tier">Pilot Program</div>
                  <div className="pricing-price">$500K</div>
                  <div className="pricing-subtitle">6-month proof of value</div>

                  <ul className="pricing-features">
                    <li className="feature-item">1 department deployment</li>
                    <li className="feature-item">10-15 specialized models</li>
                    <li className="feature-item">Full implementation support</li>
                    <li className="feature-item">ROI measurement</li>
                    <li className="feature-item">Success guarantee</li>
                  </ul>

                  <div className="pricing-cta">
                    <button className="pricing-btn" onClick={() => handleNavigate('#contact')}>Start pilot</button>
                  </div>
                </div>

                {/* Enterprise */}
                <div className="pricing-card featured">
                  <div className="pricing-tier">Enterprise</div>
                  <div className="pricing-price">Custom</div>
                  <div className="pricing-subtitle">Full hospital deployment</div>

                  <ul className="pricing-features">
                    <li className="feature-item">All 200+ models</li>
                    <li className="feature-item">Complete EMR integration</li>
                    <li className="feature-item">Dedicated success team</li>
                    <li className="feature-item">24/7 support</li>
                    <li className="feature-item">Continuous model updates</li>
                    <li className="feature-item">Custom model development</li>
                  </ul>

                  <div className="pricing-cta">
                    <button className="pricing-btn" onClick={() => handleNavigate('#contact')}>Contact sales</button>
                  </div>
                </div>

                {/* Network */}
                <div className="pricing-card">
                  <div className="pricing-tier">Health System</div>
                  <div className="pricing-price">Custom</div>
                  <div className="pricing-subtitle">Multi-facility networks</div>

                  <ul className="pricing-features">
                    <li className="feature-item">Volume licensing</li>
                    <li className="feature-item">Centralized management</li>
                    <li className="feature-item">Cross-facility learning</li>
                    <li className="feature-item">Network analytics</li>
                    <li className="feature-item">Executive dashboards</li>
                  </ul>

                  <div className="pricing-cta">
                    <button className="pricing-btn" onClick={() => handleNavigate('#contact')}>Get quote</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Resources Section */}
            <div className="resources-section">
              <h2 className="resources-title">Implementation guides and<br/>best practices for health systems</h2>
              <a href="#" onClick={() => handleNavigate('#research')} className="btn-secondary">Learn more</a>
            </div>

            {/* Explore More Section */}
            <div className="explore-section">
              <h2 className="explore-title">Explore more</h2>
              <div className="explore-grid">
                <div className="explore-card">
                  <img className="explore-image" src="/images/research-hrm.jpg" alt="moccet for Hospitals updates" />
                  <h3>New in moccet for Hospitals: September 2025</h3>
                  <div className="explore-meta">
                    <span>Webinar</span>
                    <span>Sep 24, 2025</span>
                  </div>
                </div>
                <div className="explore-card">
                  <img className="explore-image" src="/images/pricing-custom.jpg" alt="Cleveland Clinic case study" />
                  <h3>Cleveland Clinic deployment case study</h3>
                  <div className="explore-meta">
                    <span>Case Study</span>
                    <span>Sep 18, 2025</span>
                  </div>
                </div>
                <div className="explore-card">
                  <img className="explore-image" src="/images/pricing-pilot.jpg" alt="ROI analysis results" />
                  <h3>ROI analysis: 12-month results</h3>
                  <div className="explore-meta">
                    <span>Research</span>
                    <span>Sep 5, 2025</span>
                  </div>
                </div>
                <div className="explore-card">
                  <img className="explore-image" src="/images/wave3.jpg" alt="Emergency department optimization" />
                  <h3>Emergency department optimization</h3>
                  <div className="explore-meta">
                    <span>Webinar</span>
                    <span>Aug 8, 2025</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Research Page */}
          {currentSection === 'research' && (
            <div className="page-section active">
              <h1 style={{fontSize: '48px', marginBottom: '24px'}}>Research</h1>
              <p style={{fontSize: '18px', color: '#666'}}>Advancing the science of predictive health.</p>
            </div>
          )}

          {/* Safety Page */}
          {currentSection === 'safety' && (
            <div className="page-section active">
              <h1 style={{fontSize: '48px', marginBottom: '24px'}}>Safety &amp; Privacy</h1>
              <p style={{fontSize: '18px', color: '#666'}}>Zero-knowledge architecture protects your data.</p>
            </div>
          )}

          {/* Wellness Page */}
          {currentSection === 'wellness' && (
            <div className="page-section active">
              {/* Hero Section */}
              <div className="hero">
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '32px'}}>
                  <img
                    src="/images/thewellness.png"
                    alt="The Wellness"
                    className="wellness-logo"
                  />
                </div>
                <h1>AI-Powered Healthcare Partnership</h1>
                <p className="hero-subtitle">
                  Revolutionary AI doctor with intelligent EHR system, automated document processing, and smart referral generation. Reduce administrative time by 70% while delivering superior patient care.
                </p>
                <div className="hero-buttons">
                  <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} className="btn-primary">Get Started &rarr;</a>
                  <a href="#" className="btn-secondary">Learn More</a>
                </div>
              </div>

              {/* Partnership Overview Cards */}
              <div className="products">
                <div className="product-card">
                  <h2>WellnessAI Doctor</h2>
                  <p>Intelligent AI physician providing real-time diagnostics, treatment recommendations, and clinical insights.</p>

                  <ul className="product-features">
                    <li>Real-time diagnostic assistance</li>
                    <li>Evidence-based treatment recommendations</li>
                    <li>Clinical decision support</li>
                    <li>24/7 AI medical consultation</li>
                  </ul>

                  <a href="https://thewellnesslondon.com/ai-doctor" className="product-link">Explore AI Doctor &rarr;</a>
                </div>

                <div className="product-card">
                  <h2>Intelligent EHR System</h2>
                  <p>Smart electronic health record system with AI scribe, automated processing, and intelligent insights.</p>

                  <ul className="product-features">
                    <li>AI-powered medical scribe</li>
                    <li>Automatic document processing</li>
                    <li>Intelligent health insights</li>
                    <li>Seamless workflow integration</li>
                  </ul>

                  <a href="#" className="product-link">See EHR Features &rarr;</a>
                </div>
              </div>

              {/* Key Features Section */}
              <div className="feature-section">
                <div className="feature-content">
                  <h2>Automated Administrative Excellence</h2>
                  <ul className="feature-list">
                    <li>Automatic document processing eliminates manual data entry</li>
                    <li>Automated referral generation with intelligent prompting</li>
                    <li>Smart scheduling and appointment management</li>
                    <li>Integrated billing and insurance processing</li>
                    <li>Real-time compliance monitoring and reporting</li>
                  </ul>
                  <div style={{marginTop: '32px'}}>
                    <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} style={{color: '#000', textDecoration: 'none'}}>Request Demo &rarr;</a>
                  </div>
                </div>
                <div className="feature-visual">
                  <img
                    src="/images/The Wellness-14.png"
                    alt="Administrative automation visualization"
                    style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
                  />
                </div>
              </div>

              {/* Demo Section - 70% Reduction */}
              <div className="demo-section">
                <div className="demo-card">
                  <div style={{background: 'linear-gradient(135deg, #fee2e2, #fecaca)', padding: '40px', borderRadius: '8px'}}>
                    <div style={{textAlign: 'center', marginBottom: '20px', fontWeight: '500'}}>Traditional Healthcare Admin</div>
                    <div style={{background: 'white', borderRadius: '6px', padding: '16px', marginBottom: '12px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div style={{width: '24px', height: '24px', background: '#ef4444', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '14px'}}>Manual documentation: 3 hours/day</span>
                      </div>
                    </div>
                    <div style={{background: 'white', borderRadius: '6px', padding: '16px', marginBottom: '12px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div style={{width: '24px', height: '24px', background: '#f97316', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '14px'}}>Referral processing: 45 min/referral</span>
                      </div>
                    </div>
                    <div style={{background: 'white', borderRadius: '6px', padding: '16px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div style={{width: '24px', height: '24px', background: '#eab308', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '14px'}}>Administrative tasks: 60% of workday</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="demo-card">
                  <div style={{background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', padding: '40px', borderRadius: '8px'}}>
                    <div style={{textAlign: 'center', marginBottom: '20px', fontWeight: '500'}}>With moccet + The Wellness</div>
                    <div style={{background: 'white', borderRadius: '6px', padding: '16px', marginBottom: '12px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div style={{width: '24px', height: '24px', background: '#22c55e', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '14px'}}>AI documentation: 20 minutes/day</span>
                      </div>
                    </div>
                    <div style={{background: 'white', borderRadius: '6px', padding: '16px', marginBottom: '12px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div style={{width: '24px', height: '24px', background: '#16a34a', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '14px'}}>Auto referrals: 5 minutes/referral</span>
                      </div>
                    </div>
                    <div style={{background: 'white', borderRadius: '6px', padding: '16px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div style={{width: '24px', height: '24px', background: '#15803d', borderRadius: '4px'}}></div>
                        <span style={{fontSize: '14px'}}>Admin tasks: Only 18% of workday</span>
                      </div>
                    </div>
                    <div style={{textAlign: 'center', marginTop: '20px', padding: '12px', background: '#f0fdf4', borderRadius: '6px'}}>
                      <strong style={{color: '#15803d', fontSize: '18px'}}>70% Time Savings</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Benefits Section */}
              <div className="feature-section">
                <div className="feature-visual">
                  <img
                    src="/images/gradient4.jpg"
                    alt="Healthcare benefits visualization"
                    style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
                  />
                </div>
                <div className="feature-content">
                  <h2>Transform Your Practice</h2>
                  <ul className="feature-list">
                    <li><strong>For Practices:</strong> Reduce overhead costs, improve efficiency, increase patient satisfaction</li>
                    <li><strong>For Patients:</strong> Faster service, more face time with providers, better health outcomes</li>
                    <li><strong>For Providers:</strong> Focus on patient care, not paperwork - spend 70% more time practicing medicine</li>
                    <li><strong>For Staff:</strong> Eliminate repetitive tasks, focus on high-value patient interaction</li>
                  </ul>
                  <div style={{marginTop: '32px'}}>
                    <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} style={{color: '#000', textDecoration: 'none'}}>Start Your Transformation &rarr;</a>
                  </div>
                </div>
              </div>

              {/* Partnership Details */}
              <div className="feature-section">
                <div className="feature-content">
                  <h2>Seamless Integration & Support</h2>
                  <ul className="feature-list">
                    <li>White-glove implementation with dedicated support team</li>
                    <li>Comprehensive staff training and ongoing education</li>
                    <li>24/7 technical support and system monitoring</li>
                    <li>Regular updates and feature enhancements</li>
                    <li>Full HIPAA compliance and enterprise security</li>
                  </ul>
                  <div style={{marginTop: '32px'}}>
                    <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} style={{color: '#000', textDecoration: 'none'}}>Schedule Implementation Call &rarr;</a><br/>
                    <a href="#" onClick={() => { handleNavigate('#pricing'); return false; }} style={{color: '#000', textDecoration: 'none', marginTop: '8px', display: 'inline-block'}}>View Partnership Pricing &rarr;</a>
                  </div>
                </div>
                <div className="feature-visual">
                  <img
                    src="/images/pricing-custom.jpg"
                    alt="Partnership implementation and support"
                    style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px'}}
                  />
                </div>
              </div>

              {/* Call to Action */}
              <div className="resources-section">
                <h2 className="resources-title">Ready to revolutionize your practice?</h2>
                <div style={{display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap'}}>
                  <a href="#" onClick={() => { handleNavigate('#contact'); return false; }} className="btn-primary">Get Started Today</a>
                  <a href="#" className="btn-secondary">Schedule Demo</a>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}