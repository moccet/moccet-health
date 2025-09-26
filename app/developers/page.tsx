'use client';

import { useState, useEffect } from 'react';
import styles from '../landing.module.css';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState('diagnostics');
  const [sidebarActive, setSidebarActive] = useState(false);
  const [activePage, setActivePage] = useState('developers');
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
        text: `New Contact Form Submission from Developers Page`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Contact Form Submission (Developers Page)*\n\n*Name:* ${formData.name}\n*Email:* ${formData.email}\n*Company:* ${formData.company || 'Not provided'}\n*Job Title:* ${formData.jobTitle || 'Not provided'}\n*Phone:* ${formData.phone || 'Not provided'}\n*Message:* ${formData.message || 'No message provided'}`
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
    <div className={styles.container}>
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
            } else if (pageId === '') {
              showPage('developers');
            }
          }
        }}
        activePage={activePage}
      />

      {/* Main content with global sidebar layout */}
      <main className={`${styles.main} ${sidebarActive ? styles.mainWithSidebar : ''}`}>
        <div style={{ padding: '0 80px' }}>
          {/* Developers Page */}
          {activePage === 'developers' && (
            <div>
          {/* Hero Section */}
          <section style={{ textAlign: 'center', padding: '80px 0 120px' }}>
            <h1 style={{ fontSize: '56px', fontWeight: '400', lineHeight: '1.2', marginBottom: '24px', letterSpacing: '-1.5px', color: '#000' }}>
              The fastest and most powerful<br />platform for building AI products
            </h1>
            <p style={{ fontSize: '20px', color: '#374151', marginBottom: '40px', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
              Build transformative AI experiences powered by open-source models and expert guidance.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button
                onClick={handleContactSales}
                className={styles.finalCtaPrimary}
              >
                Contact Sales
              </button>
              <button className={styles.finalCtaSecondary}>
                Start building ↗
              </button>
            </div>
          </section>


          {/* Models Section */}
          <section>
            <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>Flagship models</h2>
            <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '60px', maxWidth: '800px' }}>
              Our frontier models designed for healthcare innovation, optimized for accuracy and efficiency in medical applications.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px', marginBottom: '100px' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>moccet-h5</h3>
                <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>The best model for medical diagnostics and clinical decision support</p>
                <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Multi-modal medical analysis</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Disease prediction capabilities</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Support for all clinical tools</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• 100k context length | 32k max output tokens</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Input: $2.50 | Output: $10.00 per 1M tokens</li>
                </ul>
                <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Learn more ↗</a>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>moccet-h5 mini</h3>
                <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>A faster, efficient version of moccet-h5 for routine clinical tasks</p>
                <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Medical text & imaging</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Diagnostic assistance</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Support for EMR integration</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• 100k context length | 16k max output tokens</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Input: $0.50 | Output: $2.00 per 1M tokens</li>
                </ul>
                <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Learn more ↗</a>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', background: 'white' }}>
                <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '12px', color: '#000' }}>moccet-h5 nano</h3>
                <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>The fastest, most efficient version for triage and classification</p>
                <ul style={{ listStyle: 'none', padding: '0', marginBottom: '24px' }}>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Text & vital signs analysis</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Rapid triage capabilities</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Edge deployment ready</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• 100k context length | 8k max output tokens</li>
                  <li style={{ padding: '6px 0', color: '#374151', fontSize: '14px' }}>• Input: $0.05 | Output: $0.20 per 1M tokens</li>
                </ul>
                <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Learn more ↗</a>
              </div>
            </div>

            <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', color: '#000', marginTop: '100px' }}>Build your own small models</h2>
            <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '60px', maxWidth: '800px' }}>
              Leverage frameworks like Mistral, Meta&apos;s Llama, and Google&apos;s models to create specialized healthcare AI. Our platform provides free guidance, compute resources, and deployment infrastructure to help you build models that advance medical AI.
            </p>
          </section>

          {/* API Section */}
          <section>
            <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '40px', color: '#000' }}>Access the power of our models with APIs</h2>

            <div style={{ display: 'flex', gap: '2px', marginBottom: '40px', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
              <button
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  border: 'none',
                  background: activeTab === 'diagnostics' ? 'white' : 'transparent',
                  color: activeTab === 'diagnostics' ? '#000' : '#6b7280',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onClick={() => setActiveTab('diagnostics')}
              >
                Diagnostics API
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  border: 'none',
                  background: activeTab === 'monitoring' ? 'white' : 'transparent',
                  color: activeTab === 'monitoring' ? '#000' : '#6b7280',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onClick={() => setActiveTab('monitoring')}
              >
                Monitoring API
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  border: 'none',
                  background: activeTab === 'realtime' ? 'white' : 'transparent',
                  color: activeTab === 'realtime' ? '#000' : '#6b7280',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onClick={() => setActiveTab('realtime')}
              >
                Realtime API
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  border: 'none',
                  background: activeTab === 'batch' ? 'white' : 'transparent',
                  color: activeTab === 'batch' ? '#000' : '#6b7280',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onClick={() => setActiveTab('batch')}
              >
                Batch API
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'start' }}>
              <div>
                <h3>
                  {activeTab === 'diagnostics' && 'Diagnostics API'}
                  {activeTab === 'monitoring' && 'Monitoring API'}
                  {activeTab === 'realtime' && 'Realtime API'}
                  {activeTab === 'batch' && 'Batch API'}
                </h3>
                <p>
                  {activeTab === 'diagnostics' && 'A comprehensive API for medical diagnosis, combining the simplicity of standard APIs with the ability to integrate clinical data sources, lab results, imaging, and patient history.'}
                  {activeTab === 'monitoring' && 'Real-time patient monitoring with predictive alerts, vital sign analysis, and automated escalation protocols for critical events.'}
                  {activeTab === 'realtime' && 'WebSocket-based real-time communication for continuous health monitoring, live diagnostic assistance, and instant clinical decision support.'}
                  {activeTab === 'batch' && 'Process large volumes of medical data efficiently. Ideal for population health analysis, clinical trials, and retrospective studies.'}
                </p>
                <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Learn more ↗</a>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '24px', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '14px', lineHeight: '1.5' }}>
                  {activeTab === 'diagnostics' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>1</span>
                        <span style={{ color: '#7c3aed' }}>import</span> <span style={{ color: '#059669' }}>moccet</span> <span style={{ color: '#7c3aed' }}>from</span> <span style={{ color: '#d97706' }}>&quot;moccet&quot;</span>;
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>2</span>
                        <span style={{ color: '#7c3aed' }}>const</span> <span style={{ color: '#059669' }}>client</span> = <span style={{ color: '#7c3aed' }}>new</span> <span style={{ color: '#dc2626' }}>moccet</span>();
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>3</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>4</span>
                        <span style={{ color: '#7c3aed' }}>const</span> <span style={{ color: '#059669' }}>diagnosis</span> = <span style={{ color: '#7c3aed' }}>await</span> <span style={{ color: '#059669' }}>client</span>.<span style={{ color: '#dc2626' }}>diagnose</span>({`{`}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>5</span>
                        &nbsp;&nbsp;<span style={{ color: '#059669' }}>model</span>: <span style={{ color: '#d97706' }}>&quot;moccet-h5&quot;</span>,
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>6</span>
                        &nbsp;&nbsp;<span style={{ color: '#059669' }}>input</span>: <span style={{ color: '#d97706' }}>&quot;Patient presents with chest pain...&quot;</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>7</span>
                        {`}`});
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>8</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>9</span>
                        <span style={{ color: '#dc2626' }}>console</span>.<span style={{ color: '#dc2626' }}>log</span>(<span style={{ color: '#059669' }}>diagnosis</span>.<span style={{ color: '#059669' }}>output_text</span>);
                      </div>
                    </div>
                  )}
                  {activeTab === 'monitoring' && (
                    <div className="space-y-1">
                      <div><span className="text-gray-400">1</span> <span className="text-purple-600">const</span> <span className="text-red-600">monitor</span> = <span className="text-purple-600">await</span> <span className="text-red-600">client</span>.<span className="text-blue-600">monitor</span>({`{`}</div>
                      <div><span className="text-gray-400">2</span>   <span className="text-red-600">patient_id</span>: <span className="text-green-600">&quot;P-12345&quot;</span>,</div>
                      <div><span className="text-gray-400">3</span>   <span className="text-red-600">vitals</span>: {`{`}<span className="text-red-600">hr</span>: 120, <span className="text-red-600">bp</span>: <span className="text-green-600">&quot;160/95&quot;</span>{`}`},</div>
                      <div><span className="text-gray-400">4</span>   <span className="text-red-600">alert_threshold</span>: <span className="text-green-600">&quot;critical&quot;</span></div>
                      <div><span className="text-gray-400">5</span> {`}`});</div>
                    </div>
                  )}
                  {activeTab === 'realtime' && (
                    <div className="space-y-1">
                      <div><span className="text-gray-400">1</span> <span className="text-purple-600">const</span> <span className="text-red-600">ws</span> = <span className="text-purple-600">new</span> <span className="text-blue-600">WebSocket</span>(<span className="text-green-600">&apos;wss://api.moccet.com/realtime&apos;</span>);</div>
                      <div><span className="text-gray-400">2</span> <span className="text-red-600">ws</span>.<span className="text-blue-600">send</span>({`{`}</div>
                      <div><span className="text-gray-400">3</span>   <span className="text-red-600">type</span>: <span className="text-green-600">&quot;stream_vitals&quot;</span>,</div>
                      <div><span className="text-gray-400">4</span>   <span className="text-red-600">data</span>: <span className="text-red-600">ecg_stream</span></div>
                      <div><span className="text-gray-400">5</span> {`}`});</div>
                    </div>
                  )}
                  {activeTab === 'batch' && (
                    <div className="space-y-1">
                      <div><span className="text-gray-400">1</span> <span className="text-purple-600">const</span> <span className="text-red-600">batch</span> = <span className="text-purple-600">await</span> <span className="text-red-600">client</span>.<span className="text-blue-600">batch</span>.<span className="text-blue-600">create</span>({`{`}</div>
                      <div><span className="text-gray-400">2</span>   <span className="text-red-600">model</span>: <span className="text-green-600">&quot;moccet-h5&quot;</span>,</div>
                      <div><span className="text-gray-400">3</span>   <span className="text-red-600">file</span>: <span className="text-green-600">&quot;./patient_cohort.jsonl&quot;</span>,</div>
                      <div><span className="text-gray-400">4</span>   <span className="text-red-600">analysis</span>: <span className="text-green-600">&quot;population_risk&quot;</span></div>
                      <div><span className="text-gray-400">5</span> {`}`});</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Tools Section */}
          <section>
            <h2 style={{ fontSize: '36px', fontWeight: '400', marginBottom: '16px', color: '#000' }}>Extend model capabilities with clinical tools</h2>

            {/* Lab Analysis Tool */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'start', marginBottom: '80px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '24px', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '14px', lineHeight: '1.5' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>1</span>
                      <span style={{ color: '#7c3aed' }}>const</span> <span style={{ color: '#059669' }}>response</span> = <span style={{ color: '#7c3aed' }}>await</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>2</span>
                      &nbsp;&nbsp;<span style={{ color: '#059669' }}>client</span>.<span style={{ color: '#dc2626' }}>diagnose</span>.<span style={{ color: '#dc2626' }}>create</span>({`{`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>3</span>
                      &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#059669' }}>model</span>: <span style={{ color: '#d97706' }}>&quot;moccet-h5&quot;</span>,
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>4</span>
                      &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#059669' }}>tools</span>: [{`{`}<span style={{ color: '#059669' }}>type</span>: <span style={{ color: '#d97706' }}>&quot;lab_analysis&quot;</span>{`}`}],
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>5</span>
                      &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#059669' }}>input</span>: <span style={{ color: '#d97706' }}>&quot;Analyze CBC results: WBC 15.2...&quot;</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>6</span>
                      &nbsp;&nbsp;{`}`});
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>7</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: '#9ca3af', marginRight: '16px', userSelect: 'none', width: '20px' }}>8</span>
                      <span style={{ color: '#dc2626' }}>console</span>.<span style={{ color: '#dc2626' }}>log</span>(<span style={{ color: '#059669' }}>response</span>.<span style={{ color: '#059669' }}>output_text</span>);
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0' }}>
                <h3>Lab Analysis</h3>
                <p>
                  Enhance model responses with comprehensive lab result interpretation, reference range checking, and clinical correlation using the same capabilities as our clinical platform.
                </p>
                <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                  Learn more ↗
                </a>
              </div>
            </div>

            {/* Medical Records Tool */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'start', marginBottom: '80px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '0' }}>
                  <div style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <span style={{ color: '#6b7280', fontSize: '14px', cursor: 'pointer' }}>Playground</span>
                      <span style={{ color: '#000', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>Dashboard</span>
                      <span style={{ color: '#6b7280', fontSize: '14px', cursor: 'pointer' }}>Docs</span>
                      <span style={{ color: '#6b7280', fontSize: '14px', cursor: 'pointer' }}>API reference</span>
                    </div>
                    <button style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '14px' }}>+ Create</button>
                  </div>
                  <div style={{ padding: '24px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '16px' }}>Model Performance</div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ color: '#6b7280', fontSize: '14px' }}>ID</span>
                        <span style={{ color: '#000', fontSize: '14px', fontFamily: 'ui-monospace, monospace' }}>vs_87caBVARkc4LV1aRbc1Rte99Xk5RRBe</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ color: '#6b7280', fontSize: '14px' }}>Estimated usage</span>
                        <span style={{ color: '#000', fontSize: '14px' }}>10 MB hours so far this month · $0.11 / GB per day</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ color: '#6b7280', fontSize: '14px' }}>Size</span>
                        <span style={{ color: '#000', fontSize: '14px' }}>1 KB</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ color: '#6b7280', fontSize: '14px' }}>Last active</span>
                        <span style={{ color: '#000', fontSize: '14px' }}>Mar 9, 2025, 6:37 PM</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ color: '#6b7280', fontSize: '14px' }}>Files attached</span>
                        <span style={{ color: '#000', fontSize: '14px' }}>📄 patient_records.txt</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0' }}>
                <h3>Medical Records</h3>
                <p>
                  Build fast, accurate semantic search to augment model responses with patient history, clinical notes, and treatment records in just a few lines of code.
                </p>
                <a href="#" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                  Learn more ↗
                </a>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section style={{ textAlign: 'center', padding: '100px 0', background: '#f9fafb', margin: '100px -80px 0', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '48px', fontWeight: '400', lineHeight: '1.2', marginBottom: '40px', color: '#000' }}>The best developers<br />build with moccet</h2>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button
                onClick={() => showPage('contact')}
                className={styles.finalCtaPrimary}
                style={{ padding: '16px 32px', fontSize: '16px' }}
              >
                Get early access →
              </button>
              <button
                onClick={() => showPage('contact')}
                className={styles.finalCtaSecondary}
                style={{ padding: '16px 32px', fontSize: '16px' }}
              >
                Watch video ↗
              </button>
            </div>
          </section>
            </div>
          )}

          {/* Contact Sales Page */}
          {activePage === 'contact' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center' }}>
                {!isSubmitted ? (
                  <>
                    <h1 style={{ fontSize: '48px', fontWeight: '400', marginBottom: '24px' }}>Get in touch with our sales team</h1>
                    <p style={{ fontSize: '18px', color: '#666', marginBottom: '48px' }}>
                      Learn how moccet can transform your development workflow with AI that delivers autonomous insights.
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
                          placeholder="Tell us about your development needs and goals..."
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
                      Thank you for your interest in moccet. Our sales team will get back to you within 24 hours.
                    </p>
                    <button
                      onClick={() => showPage('developers')}
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
                      Back to Developers
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
