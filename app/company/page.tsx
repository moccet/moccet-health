'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function CompanyPage() {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [activePage, setActivePage] = useState('about');
  const [showJobListings, setShowJobListings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    jobTitle: '',
    phone: '',
    message: ''
  });

  // Set sidebar to open on desktop by default
  useEffect(() => {
    if (window.innerWidth > 1024) {
      setSidebarActive(true);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const handleContactSales = () => {
    setActivePage('contact');
  };

  const showPage = (page: string) => {
    setActivePage(page);
    setShowJobListings(false); // Reset job listings when switching pages
    // Reset form state when switching pages
    if (page !== 'contact') {
      setIsSubmitted(false);
      setFormData({
        name: '',
        email: '',
        company: '',
        jobTitle: '',
        phone: '',
        message: ''
      });
    }
    // Only close sidebar on mobile, keep it open on desktop
    if (window.innerWidth <= 1024) {
      setSidebarActive(false);
    }
    window.scrollTo(0, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Send to Slack webhook
      const slackMessage = {
        text: `New Contact Form Submission from Company Page`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Contact Form Submission (Company Page)*\\n\\n*Name:* ${formData.name}\\n*Email:* ${formData.email}\\n*Company:* ${formData.company || 'Not provided'}\\n*Job Title:* ${formData.jobTitle || 'Not provided'}\\n*Phone:* ${formData.phone || 'Not provided'}\\n*Message:* ${formData.message || 'No message provided'}`
            }
          }
        ]
      };

      // Replace with your actual Slack webhook URL
      const webhookUrl = process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL || 'YOUR_SLACK_WEBHOOK_URL_HERE';

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending form:', error);
      alert('There was an error sending your message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif', backgroundColor: '#ffffff', color: '#1a1a1a', lineHeight: '1.6' }}>
      {/* Global Header */}
      <Header onToggleSidebar={toggleSidebar} onContactSales={handleContactSales} />

      {/* Global Sidebar */}
      <Sidebar
        isActive={sidebarActive}
        onNavigate={(href) => {
          if (href.startsWith('#')) {
            const pageId = href.substring(1);
            if (pageId === 'contact') {
              showPage('contact');
            } else if (pageId === 'about') {
              showPage('about');
            } else if (pageId === 'charter') {
              showPage('charter');
            } else if (pageId === 'careers') {
              showPage('careers');
            } else if (pageId === 'founders-letter') {
              showPage('founders-letter');
            }
          }
        }}
        activePage={activePage}
      />

      {/* Main content with global sidebar layout */}
      <main style={{ marginLeft: sidebarActive ? '240px' : '0', paddingTop: '60px', transition: 'margin-left 0.2s' }}>

        {/* About Page */}
        {activePage === 'about' && (
          <div>
            <div style={{ textAlign: 'center', padding: '60px 40px 40px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '20px' }}>Company</div>
              <h1 style={{ fontSize: '72px', fontWeight: '400', letterSpacing: '-2px' }}>About</h1>
            </div>

            <div style={{ width: '100%', height: '500px', marginBottom: '80px', position: 'relative' }}>
              <img
                src="/images/The Wellness-14.png"
                alt="Team collaboration"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', padding: '80px', alignItems: 'center' }}>
              <div style={{ maxWidth: '500px' }}>
                <h2 style={{ fontSize: '42px', fontWeight: '400', marginBottom: '32px', lineHeight: '1.2', letterSpacing: '-1px' }}>
                  Our vision for the future of healthcare and enterprise AI
                </h2>
                <p style={{ fontSize: '20px', color: '#374151', lineHeight: '1.6', marginBottom: '40px' }}>
                  Our mission is to ensure that artificial intelligence—systems that can detect disease before symptoms appear and optimize business operations autonomously—benefits all of humanity.
                </p>
                <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                  <button
                    onClick={() => showPage('charter')}
                    style={{ color: '#000', textDecoration: 'none', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Our Charter ↗
                  </button>
                </div>
              </div>
              <div>
                <div style={{ width: '100%', height: '400px', borderRadius: '12px', overflow: 'hidden' }}>
                  <img
                    src="/images/wave4.jpg"
                    alt="Medical AI Visualization"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '16px' }}>
                  Illustration: Medical AI Visualization × moccet
                </div>
              </div>
            </div>

            <div style={{ padding: '80px', background: '#fafafa' }}>
              <p style={{ fontSize: '32px', fontWeight: '400', textAlign: 'center', maxWidth: '900px', margin: '0 auto', lineHeight: '1.4', letterSpacing: '-0.5px' }}>
                We are building safe and beneficial AI that transforms healthcare and enterprise operations, but will also consider our mission fulfilled if our work aids others to achieve this outcome.
              </p>
            </div>

            <div style={{ padding: '80px' }}>
              <div style={{ width: '100%', height: '500px', borderRadius: '12px', marginBottom: '80px', overflow: 'hidden' }}>
                <img
                  src="/images/Enterprise-Healthcare.jpg"
                  alt="Team working in healthcare environment"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>

            <div style={{ padding: '0 80px 80px' }}>
              <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '40px' }}>Latest news</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <div style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
                  <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                    <img
                      src="/images/gradient4.jpg"
                      alt="AI healthcare transformation"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px', lineHeight: '1.3' }}>
                      AI as the greatest source of healthcare transformation
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                      <span>Company</span>
                      <span>Sep 15, 2025</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => showPage('founders-letter')}
                >
                  <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                    <img
                      src="/images/founders.png"
                      alt="Founders Omar & Sofian"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px', lineHeight: '1.3' }}>
                      A letter from Omar & Sofian
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                      <span>Company</span>
                      <span>Sep 10, 2025</span>
                    </div>
                  </div>
                </div>

                <div style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
                  <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                    <img
                      src="/images/big feature.jpg"
                      alt="Fortune 500 companies using autonomous AI"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px', lineHeight: '1.3' }}>
                      Bringing autonomous AI to Fortune 500 companies
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                      <span>Company</span>
                      <span>Aug 28, 2025</span>
                    </div>
                  </div>
                </div>

                <div style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
                  <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                    <img
                      src="/images/sky-painting5.jpg"
                      alt="moccet global expansion"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '12px', lineHeight: '1.3' }}>
                      moccet expands globally
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                      <span>Company</span>
                      <span>Sep 22, 2025</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '80px', background: '#fafafa' }}>
              <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '40px' }}>Our research</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <div
                  style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => window.location.href = '/research/neural-connections'}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0px)'}
                >
                  <img
                    src="/images/research-neural.jpg"
                    alt="Neural network research visualization"
                    style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Neural connections</h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
                      <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>Technical</span>
                      <span>15 Sept 2025</span>
                      <span>15 min read</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => window.location.href = '/research/hierarchical-reasoning'}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0px)'}
                >
                  <img
                    src="/images/research-hrm.jpg"
                    alt="Hierarchical reasoning model research"
                    style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Hierarchical Reasoning</h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
                      <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>Technical</span>
                      <span>14 Sept 2025</span>
                      <span>10 min read</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => window.location.href = '/philosophy/machine-learning'}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0px)'}
                >
                  <img
                    src="/images/gradient4.jpg"
                    alt="Machine learning philosophy"
                    style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Machine Learning</h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
                      <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>Technical</span>
                      <span>13 Sept 2025</span>
                      <span>12 min read</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => window.location.href = '/philosophy/brain-inspired'}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0px)'}
                >
                  <img
                    src="/images/painting4.jpg"
                    alt="Brain-inspired AI architecture"
                    style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Inspired by the brain</h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
                      <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>Technical</span>
                      <span>13 Sept 2025</span>
                      <span>10 min read</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => window.location.href = '/philosophy/safety-compliance'}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0px)'}
                >
                  <img
                    src="/images/painting2.jpg"
                    alt="AI safety and compliance framework illustration"
                    style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: '#000' }}>Safety and Compliance</h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
                      <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>Safety</span>
                      <span>13 Sept 2025</span>
                      <span>8 min read</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Careers Page */}
        {activePage === 'careers' && (
          <div>
            <div style={{ textAlign: 'center', padding: '100px 40px', background: 'white' }}>
              <h1 style={{ fontSize: '56px', fontWeight: '400', marginBottom: '24px', letterSpacing: '-1.5px' }}>
                Careers at moccet
              </h1>
              <p style={{ fontSize: '20px', color: '#374151', marginBottom: '40px' }}>
                Developing safe and beneficial AI for healthcare and enterprise requires people from a wide range of disciplines and backgrounds.
              </p>
              <button
                onClick={() => setShowJobListings(!showJobListings)}
                style={{ background: '#000', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
              >
                View all careers
              </button>
            </div>

            <div style={{ width: '100%', height: '500px', overflow: 'hidden' }}>
              <img
                src="/images/painting4.jpg"
                alt="Office environment and team collaboration"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            <div style={{ padding: '120px 40px', textAlign: 'center', background: 'white' }}>
              <h2 style={{ fontSize: '48px', fontWeight: '400', marginBottom: '40px', lineHeight: '1.2', letterSpacing: '-1px' }}>
                Join us in shaping the<br />future of healthcare technology
              </h2>
              <button
                onClick={() => setShowJobListings(!showJobListings)}
                style={{ background: '#000', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
              >
                View careers
              </button>
            </div>

            {/* Job Listings */}
            {showJobListings && (
              <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>🔍</span>
                    <input
                      type="text"
                      placeholder="Search jobs..."
                      style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '16px', width: '300px' }}
                    />
                    <span style={{ color: '#6b7280' }}>42 jobs</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <select style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', fontSize: '16px', cursor: 'pointer' }}>
                      <option>All teams ↓</option>
                      <option>Engineering</option>
                      <option>Research</option>
                      <option>Clinical</option>
                      <option>Sales</option>
                    </select>
                    <select style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', fontSize: '16px', cursor: 'pointer' }}>
                      <option>All locations ↓</option>
                      <option>San Francisco</option>
                      <option>London</option>
                      <option>Remote</option>
                    </select>
                  </div>
                </div>

                <div>
                  {[
                    { title: 'Senior ML Engineer, Healthcare Models', category: 'Engineering', team: 'Engineering', location: 'San Francisco' },
                    { title: 'Clinical AI Research Scientist', category: 'Research', team: 'Research', location: 'London, UK' },
                    { title: 'Enterprise Account Executive', category: 'Sales', team: 'Go To Market', location: 'New York, NY' },
                    { title: 'Director, Hospital Partnerships', category: 'moccet for Healthcare', team: 'Sales', location: 'Boston, MA' },
                    { title: 'Product Designer, Clinical Interfaces', category: 'Design', team: 'Product', location: 'Remote' },
                    { title: 'Staff Software Engineer, Infrastructure', category: 'Engineering', team: 'Engineering', location: 'San Francisco' },
                    { title: 'Medical Director, AI Safety', category: 'Clinical', team: 'Safety', location: '2 locations' }
                  ].map((job, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
                        padding: '20px 0',
                        borderBottom: '1px solid #f3f4f6',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '500' }}>{job.title}</div>
                        <div style={{ color: '#6b7280', fontSize: '14px' }}>{job.category}</div>
                      </div>
                      <div>{job.team}</div>
                      <div style={{ color: '#6b7280' }}>{job.location}</div>
                      <div style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => showPage('contact')}
                          style={{ color: '#000', textDecoration: 'none', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Apply now ↗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Charter Page */}
        {activePage === 'charter' && (
          <div>
            <div style={{ textAlign: 'center', padding: '60px 40px 40px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '20px' }}>Company</div>
              <h1 style={{ fontSize: '72px', fontWeight: '400', letterSpacing: '-2px' }}>Our Charter</h1>
            </div>
            <div style={{ padding: '80px', maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '36px', marginBottom: '32px' }}>moccet Charter</h2>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                Our Charter describes the principles we use to execute on moccet&apos;s mission.
              </p>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                This document reflects the strategy we&apos;ve refined over the past two years, including feedback from many people internal and external to moccet. The timeline to AGI remains uncertain, but our Charter will guide us in acting in the best interests of humanity throughout its development.
              </p>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                moccet&apos;s mission is to ensure that artificial general intelligence (AGI)—by which we mean highly autonomous systems that outperform humans at most economically valuable work—benefits all of humanity. We will attempt to directly build safe and beneficial AGI, but will also consider our mission fulfilled if our work aids others to achieve this outcome. To that end, we commit to the following principles:
              </p>

              <h3 style={{ fontSize: '24px', margin: '40px 0 20px' }}>Broadly distributed benefits</h3>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                We commit to use any influence we obtain over AGI&apos;s deployment to ensure it is used for the benefit of all, and to avoid enabling uses of AI or AGI that harm humanity or unduly concentrate power.
              </p>

              <h3 style={{ fontSize: '24px', margin: '40px 0 20px' }}>Long-term safety</h3>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                We are committed to doing the research required to make AGI safe, and to driving the broad adoption of such research across the AI community. We are concerned about late-stage AGI development becoming a competitive race without time for adequate safety precautions.
              </p>

              <h3 style={{ fontSize: '24px', margin: '40px 0 20px' }}>Technical leadership</h3>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                To be effective at addressing AGI&apos;s impact on society, moccet must be on the cutting edge of AI capabilities—policy and safety advocacy alone would be insufficient. We believe that AI will have broad societal impact before AGI, and we&apos;ll strive to lead in those areas that are directly aligned with our mission and expertise.
              </p>

              <h3 style={{ fontSize: '24px', margin: '40px 0 20px' }}>Cooperative orientation</h3>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                We will actively cooperate with other research and policy institutions; we seek to create a global community working together to address AGI&apos;s global challenges. We are committed to providing public goods that help society navigate the path to AGI, such as publishing most of our AI research.
              </p>
            </div>
          </div>
        )}


        {/* Founders Letter Page */}
        {activePage === 'founders-letter' && (
          <div>
            <div style={{ textAlign: 'center', padding: '60px 40px 40px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '20px' }}>Company</div>
              <h1 style={{ fontSize: '72px', fontWeight: '400', letterSpacing: '-2px' }}>A letter from Omar & Sofian</h1>
              <div style={{ fontSize: '16px', color: '#6b7280', marginTop: '20px' }}>November 9, 2025</div>
            </div>
            <div style={{ padding: '80px', maxWidth: '800px', margin: '0 auto' }}>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                We started moccet because we believe artificial intelligence is this generation&apos;s most important technology. AI is already transforming healthcare and enterprise operations, and we see a future where it fundamentally changes how diseases are detected, treated, and prevented.
              </p>

              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                Our journey began in the research labs at Stanford, where we witnessed firsthand the gap between cutting-edge AI research and real-world healthcare applications. Too many breakthrough discoveries remained locked in academic papers, never reaching the patients and organizations that needed them most.
              </p>

              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                We founded moccet to bridge this gap. Our mission is clear: ensure that artificial general intelligence benefits all of humanity, with a particular focus on democratizing access to advanced healthcare diagnostics and optimizing enterprise operations.
              </p>

              <h3 style={{ fontSize: '24px', margin: '40px 0 20px' }}>Why healthcare matters</h3>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                Every 36 seconds, someone in the United States dies from cardiovascular disease. Many of these deaths are preventable with early detection. Our AI models can identify risk factors years before symptoms appear, giving patients and doctors the time they need to intervene.
              </p>

              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                But cardiovascular disease is just the beginning. From cancer detection to rare disease diagnosis, AI has the potential to save millions of lives. We&apos;re committed to making these capabilities accessible to healthcare systems worldwide, not just those in wealthy nations.
              </p>

              <h3 style={{ fontSize: '24px', margin: '40px 0 20px' }}>Our commitment to safety</h3>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                Building AI for healthcare comes with immense responsibility. A misdiagnosis from an AI system isn&apos;t just a data point—it&apos;s someone&apos;s life. That&apos;s why we&apos;ve made safety our top priority from day one.
              </p>

              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                We employ rigorous testing protocols, work closely with medical professionals, and maintain transparency in our model development. We believe that safe AI is not just good ethics—it&apos;s good business.
              </p>

              <h3 style={{ fontSize: '24px', margin: '40px 0 20px' }}>Looking ahead</h3>
              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                The next decade will be transformative. We see a future where AI assistants work alongside doctors to provide personalized care, where diseases are caught before they develop, and where healthcare becomes truly preventive rather than reactive.
              </p>

              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '24px' }}>
                We&apos;re building moccet to be at the forefront of this transformation. But we can&apos;t do it alone. We need partners in healthcare, researchers pushing boundaries, and team members who share our vision of AI for good.
              </p>

              <p style={{ fontSize: '18px', lineHeight: '1.8', color: '#374151', marginBottom: '40px' }}>
                Thank you for joining us on this journey.
              </p>

              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>
                  Omar & Sofian
                </div>
                <div style={{ fontSize: '16px', color: '#6b7280' }}>
                  Co-founders, moccet
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact Sales Page */}
        {activePage === 'contact' && (
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 40px' }}>
            <div style={{ textAlign: 'center' }}>
              {!isSubmitted ? (
                <>
                  <h1 style={{ fontSize: '48px', fontWeight: '400', marginBottom: '24px' }}>Get in touch with our team</h1>
                  <p style={{ fontSize: '18px', color: '#666', marginBottom: '48px' }}>
                    Learn how moccet can transform your organization with AI-powered insights.
                  </p>
                  <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '16px'
                        }}
                        required
                      />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '16px'
                        }}
                        required
                      />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Company</label>
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '16px'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Job Title</label>
                      <input
                        type="text"
                        name="jobTitle"
                        value={formData.jobTitle}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '16px'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '16px'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>How can we help you?</label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '16px',
                          resize: 'vertical'
                        }}
                        placeholder="Tell us about your needs and goals..."
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        width: '100%',
                        padding: '16px',
                        background: isSubmitting ? '#ccc' : '#000',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSubmitting ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    fontSize: '36px'
                  }}>
                    ✓
                  </div>
                  <h2 style={{ fontSize: '32px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>Message Sent!</h2>
                  <p style={{ fontSize: '18px', color: '#666', marginBottom: '32px' }}>
                    Thank you for your interest in moccet. Our team will get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => showPage('about')}
                    style={{
                      padding: '12px 24px',
                      background: '#000',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Back to About
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        @media (max-width: 768px) {
          main {
            margin-left: 0 !important;
            padding: 60px 20px 0 !important;
          }

          .vision-section {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
            padding: 40px 20px !important;
          }

          .page-title {
            font-size: 48px !important;
          }

          .vision-title {
            font-size: 32px !important;
          }

          .vision-text {
            font-size: 18px !important;
          }

          .mission-statement {
            font-size: 24px !important;
          }

          .careers-title {
            font-size: 36px !important;
          }

          .careers-hero {
            padding: 60px 20px !important;
          }
        }
      `}</style>
    </div>
  );
}