'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../landing.module.css';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function PoliciesPage() {
  const [activePolicy, setActivePolicy] = useState('cookie');
  const [sidebarActive, setSidebarActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Set responsive breakpoints and sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);

      if (width > 1024) {
        setSidebarActive(true);
      } else {
        setSidebarActive(false);
      }
    };

    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const handleNavigate = (targetId: string) => {
    if (targetId.startsWith('#')) {
      // Scroll to top when navigating
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        setSidebarActive(false);
      }
    }
  };

  const handleContactSales = () => {
    console.log('Contact Sales clicked');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <Header
        onToggleSidebar={toggleSidebar}
        onContactSales={handleContactSales}
        sidebarActive={sidebarActive}
      />

      <Sidebar
        isActive={sidebarActive}
        onNavigate={handleNavigate}
      />

      <main
        style={{
          marginLeft: isMobile || isTablet ? '0' : (sidebarActive ? '240px' : '0'),
          transition: 'margin-left 0.3s ease',
          padding: isMobile ? '0 20px' : isTablet ? '0 40px' : '0 80px',
          paddingTop: '60px',
          minHeight: '100vh'
        }}
      >
        <section style={{ textAlign: 'center', padding: isMobile ? '80px 0 60px' : isTablet ? '100px 0 80px' : '120px 0 120px' }}>
          <h1 style={{
            fontSize: isMobile ? '32px' : isTablet ? '44px' : '56px',
            fontWeight: '400',
            lineHeight: '1.2',
            marginBottom: '24px',
            letterSpacing: isMobile ? '-0.5px' : '-1.5px',
            color: '#000'
          }}>
            Other Policies
          </h1>
          <p style={{
            fontSize: isMobile ? '16px' : isTablet ? '18px' : '20px',
            color: '#374151',
            marginBottom: '40px',
            maxWidth: isMobile ? '100%' : '800px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6'
          }}>
            Additional policies and guidelines for using our services
          </p>
        </section>

        {/* Policy Navigation */}
        <section style={{ marginBottom: isMobile ? '60px' : '100px' }}>
          <h2 style={{
            fontSize: isMobile ? '28px' : isTablet ? '32px' : '36px',
            fontWeight: '400',
            marginBottom: '16px',
            color: '#000',
            textAlign: 'center'
          }}>
            Select a Policy
          </h2>
          <p style={{
            fontSize: isMobile ? '16px' : '18px',
            color: '#6b7280',
            marginBottom: isMobile ? '40px' : '60px',
            textAlign: 'center',
            maxWidth: isMobile ? '100%' : '800px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6'
          }}>
            Choose a policy to view its details and guidelines.
          </p>

          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '12px' : '16px',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: isMobile ? '40px' : '60px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setActivePolicy('cookie')}
              style={{
                padding: isMobile ? '12px 20px' : '10px 20px',
                borderRadius: '8px',
                border: activePolicy === 'cookie' ? '2px solid #000' : '1px solid #e5e7eb',
                backgroundColor: activePolicy === 'cookie' ? '#000' : '#fff',
                color: activePolicy === 'cookie' ? '#fff' : '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease'
              }}
            >
              Cookie Policy
            </button>
            <button
              onClick={() => setActivePolicy('acceptable')}
              style={{
                padding: isMobile ? '12px 20px' : '10px 20px',
                borderRadius: '8px',
                border: activePolicy === 'acceptable' ? '2px solid #000' : '1px solid #e5e7eb',
                backgroundColor: activePolicy === 'acceptable' ? '#000' : '#fff',
                color: activePolicy === 'acceptable' ? '#fff' : '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease'
              }}
            >
              Acceptable Use
            </button>
            <button
              onClick={() => setActivePolicy('data')}
              style={{
                padding: isMobile ? '12px 20px' : '10px 20px',
                borderRadius: '8px',
                border: activePolicy === 'data' ? '2px solid #000' : '1px solid #e5e7eb',
                backgroundColor: activePolicy === 'data' ? '#000' : '#fff',
                color: activePolicy === 'data' ? '#fff' : '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease'
              }}
            >
              Data Processing
            </button>
            <button
              onClick={() => setActivePolicy('sla')}
              style={{
                padding: isMobile ? '12px 20px' : '10px 20px',
                borderRadius: '8px',
                border: activePolicy === 'sla' ? '2px solid #000' : '1px solid #e5e7eb',
                backgroundColor: activePolicy === 'sla' ? '#000' : '#fff',
                color: activePolicy === 'sla' ? '#fff' : '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease'
              }}
            >
              Service Level Agreement
            </button>
            <button
              onClick={() => setActivePolicy('vulnerability')}
              style={{
                padding: isMobile ? '12px 20px' : '10px 20px',
                borderRadius: '8px',
                border: activePolicy === 'vulnerability' ? '2px solid #000' : '1px solid #e5e7eb',
                backgroundColor: activePolicy === 'vulnerability' ? '#000' : '#fff',
                color: activePolicy === 'vulnerability' ? '#fff' : '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease'
              }}
            >
              Vulnerability Disclosure
            </button>
          </div>
        </section>

        {/* Cookie Policy */}
        {activePolicy === 'cookie' && (
          <section style={{
            background: '#f9fafb',
            borderRadius: isMobile ? '16px' : '24px',
            padding: isMobile ? '40px 20px' : isTablet ? '60px 40px' : '80px',
            margin: isMobile ? '0 -20px' : isTablet ? '0 -40px' : '0 -80px',
            marginBottom: isMobile ? '60px' : '100px'
          }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{
                fontSize: isMobile ? '28px' : isTablet ? '32px' : '36px',
                fontWeight: '400',
                marginBottom: '8px',
                color: '#000'
              }}>
                Cookie Policy
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '32px',
                fontStyle: 'italic'
              }}>
                Last Updated: January 1, 2024
              </p>

              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '600',
                marginBottom: '16px',
                marginTop: '32px',
                color: '#000'
              }}>
                What Are Cookies?
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                Cookies are small text files that are placed on your device when you visit
                our website. They help us provide you with a better experience by remembering
                your preferences and understanding how you use our services.
              </p>

              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '600',
                marginBottom: '16px',
                marginTop: '32px',
                color: '#000'
              }}>
                Types of Cookies We Use
              </h3>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>
                Essential Cookies
              </h4>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                These cookies are necessary for the website to function properly. They enable
                basic functions like page navigation, secure access to services, and
                remembering your cookie consent choices.
              </p>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>
                Performance Cookies
              </h4>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                These cookies help us understand how visitors interact with our website by
                collecting and reporting anonymous information. This helps us improve how
                our website works.
              </p>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>
                Functionality Cookies
              </h4>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                These cookies allow the website to remember choices you make (such as your
                username, language, or region) and provide enhanced, personalized features.
              </p>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>
                Analytics Cookies
              </h4>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                We use analytics services like Google Analytics to help us understand how
                users engage with our website. These cookies collect information in an
                aggregated form.
              </p>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>Third-Party Cookies</h4>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                Some cookies are placed by third-party services that appear on our pages.
                We do not control these cookies and encourage you to check the third-party
                websites for more information about their cookies.
              </p>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>Managing Your Cookie Preferences</h4>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                You can control and/or delete cookies as you wish. You can delete all cookies
                that are already on your computer and you can set most browsers to prevent
                them from being placed. However, if you do this, you may have to manually
                adjust some preferences every time you visit our site.
              </p>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>Browser Settings</h4>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}> 
                Most web browsers allow you to control cookies through their settings. To
                find out more about cookies, including how to see what cookies have been set,
                visit www.aboutcookies.org or www.allaboutcookies.org.
              </p>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>Updates to This Policy</h4>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                We may update this Cookie Policy from time to time. Any changes will be
                posted on this page with an updated revision date.
              </p>
            </div>
          </section>
        )}

        {/* Acceptable Use Policy */}
        {activePolicy === 'acceptable' && (
          <section style={{
            background: '#f9fafb',
            borderRadius: isMobile ? '16px' : '24px',
            padding: isMobile ? '40px 20px' : isTablet ? '60px 40px' : '80px',
            margin: isMobile ? '0 -20px' : isTablet ? '0 -40px' : '0 -80px',
            marginBottom: isMobile ? '60px' : '100px'
          }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{
                fontSize: isMobile ? '28px' : isTablet ? '32px' : '36px',
                fontWeight: '400',
                marginBottom: '8px',
                color: '#000'
              }}>
                Acceptable Use Policy
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '32px',
                fontStyle: 'italic'
              }}>
                Last Updated: January 1, 2024
              </p>

              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '600',
                marginBottom: '16px',
                marginTop: '32px',
                color: '#000'
              }}>
                Purpose
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                This Acceptable Use Policy sets forth the standards for appropriate use of
                moccet&apos;s services. By using our services, you agree to comply with this policy.
              </p>

              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '600',
                marginBottom: '16px',
                marginTop: '32px',
                color: '#000'
              }}>
                Prohibited Activities
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                You may not use our services to:
              </p>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>
                Illegal Activities
              </h4>
              <ul style={{
                marginBottom: '16px',
                paddingLeft: '24px'
              }}>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Violate any applicable laws or regulations</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Engage in fraud or fraudulent activities</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Violate the rights of others</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Promote illegal activities</li>
              </ul>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>
                Security Violations
              </h4>
              <ul style={{
                marginBottom: '16px',
                paddingLeft: '24px'
              }}>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Access systems or data without authorization</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Probe, scan, or test vulnerabilities without permission</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Breach or circumvent authentication measures</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Interfere with service to any user, host, or network</li>
              </ul>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>
                Network Abuse
              </h4>
              <ul style={{
                marginBottom: '16px',
                paddingLeft: '24px'
              }}>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Transmit viruses, worms, or malicious code</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Engage in denial of service attacks</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Intentionally distribute false or misleading information</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Use automated systems to access services in a manner that degrades performance</li>
              </ul>

              <h4 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '24px',
                color: '#111827'
              }}>
                Inappropriate Content
              </h4>
              <ul style={{
                marginBottom: '16px',
                paddingLeft: '24px'
              }}>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Upload content that is unlawful, harmful, or offensive</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Infringe on intellectual property rights</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Violate privacy rights of others</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Distribute unsolicited promotional materials</li>
              </ul>

              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '600',
                marginBottom: '16px',
                marginTop: '32px',
                color: '#000'
              }}>
                Healthcare-Specific Requirements
              </h3>
              <ul style={{
                marginBottom: '16px',
                paddingLeft: '24px'
              }}>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Maintain compliance with HIPAA and other healthcare regulations</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Ensure proper authorization for accessing patient data</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Use services only for legitimate healthcare purposes</li>
                <li style={{
                  fontSize: '16px',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  color: '#374151'
                }}>Report any suspected breaches immediately</li>
              </ul>

              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '600',
                marginBottom: '16px',
                marginTop: '32px',
                color: '#000'
              }}>
                Enforcement
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                Violations of this policy may result in suspension or termination of services,
                and may be reported to law enforcement authorities when appropriate.
              </p>

              <h3 style={{
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '600',
                marginBottom: '16px',
                marginTop: '32px',
                color: '#000'
              }}>
                Reporting Violations
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                If you become aware of any violations of this policy, please report them to
                <a href="mailto:security@moccet.com" style={{
                  color: '#000',
                  textDecoration: 'underline',
                  fontWeight: '500'
                }}> security@moccet.com</a>.
              </p>
            </div>
          </section>
        )}

        {/* Data Processing Agreement */}
        {activePolicy === 'data' && (
          <section className={styles.contentSection}>
            <div className={styles.articleContent}>
              <h2>Data Processing Agreement</h2>
              <p className={styles.legalDate}>Last Updated: January 1, 2024</p>

              <h3>Scope and Purpose</h3>
              <p>
                This Data Processing Agreement (&quot;DPA&quot;) applies when moccet processes personal
                data on behalf of customers (&quot;Data Controllers&quot;) in connection with our services.
              </p>

              <h3>Definitions</h3>
              <ul>
                <li><strong>Personal Data:</strong> Any information relating to an identified or identifiable natural person</li>
                <li><strong>Processing:</strong> Any operation performed on personal data</li>
                <li><strong>Data Controller:</strong> The entity that determines the purposes and means of processing</li>
                <li><strong>Data Processor:</strong> moccet, when processing data on behalf of the controller</li>
              </ul>

              <h3>Data Processing Principles</h3>
              <p>moccet will:</p>
              <ul>
                <li>Process personal data only on documented instructions from the controller</li>
                <li>Ensure persons authorized to process data are under confidentiality obligations</li>
                <li>Implement appropriate technical and organizational security measures</li>
                <li>Assist the controller in responding to data subject requests</li>
                <li>Delete or return all personal data at the end of services</li>
              </ul>

              <h3>Sub-processors</h3>
              <p>
                moccet may engage sub-processors to assist in providing services. We maintain
                a list of approved sub-processors and will notify customers of any changes.
                All sub-processors are bound by data protection obligations.
              </p>

              <h3>Security Measures</h3>
              <ul>
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and audits</li>
                <li>Access controls and authentication requirements</li>
                <li>Incident response procedures</li>
                <li>Business continuity and disaster recovery plans</li>
              </ul>

              <h3>International Transfers</h3>
              <p>
                When transferring personal data internationally, moccet ensures appropriate
                safeguards are in place, including standard contractual clauses or other
                approved transfer mechanisms.
              </p>

              <h3>Data Subject Rights</h3>
              <p>
                moccet will assist customers in fulfilling their obligations to respond to
                data subject requests for access, rectification, deletion, or portability
                of personal data.
              </p>

              <h3>Breach Notification</h3>
              <p>
                In the event of a personal data breach, moccet will notify the customer
                without undue delay and provide all necessary information to meet regulatory
                notification requirements.
              </p>

              <h3>Audit Rights</h3>
              <p>
                Customers have the right to audit moccet&apos;s compliance with this DPA, subject
                to reasonable notice and confidentiality requirements.
              </p>
            </div>
          </section>
        )}

        {/* Service Level Agreement */}
        {activePolicy === 'sla' && (
          <section className={styles.contentSection}>
            <div className={styles.articleContent}>
              <h2>Service Level Agreement (SLA)</h2>
              <p className={styles.legalDate}>Last Updated: January 1, 2024</p>

              <h3>Service Availability</h3>
              <p>
                moccet commits to maintaining 99.9% uptime for production services, measured
                monthly. This excludes scheduled maintenance windows.
              </p>

              <h3>Uptime Calculation</h3>
              <p>
                Uptime percentage = (Total minutes in month - Downtime minutes) / Total minutes
                in month × 100
              </p>

              <h3>Service Credits</h3>
              <table className={styles.slaTable}>
                <thead>
                  <tr>
                    <th>Monthly Uptime Percentage</th>
                    <th>Service Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>99.0% - 99.9%</td>
                    <td>10% of monthly fee</td>
                  </tr>
                  <tr>
                    <td>95.0% - 99.0%</td>
                    <td>25% of monthly fee</td>
                  </tr>
                  <tr>
                    <td>Below 95.0%</td>
                    <td>50% of monthly fee</td>
                  </tr>
                </tbody>
              </table>

              <h3>Exclusions</h3>
              <p>The SLA does not apply to:</p>
              <ul>
                <li>Scheduled maintenance (notified 48 hours in advance)</li>
                <li>Force majeure events</li>
                <li>Issues caused by customer actions or third-party services</li>
                <li>Beta or trial features</li>
                <li>Degraded performance due to customer exceeding usage limits</li>
              </ul>

              <h3>Support Response Times</h3>
              <table className={styles.slaTable}>
                <thead>
                  <tr>
                    <th>Priority Level</th>
                    <th>Initial Response</th>
                    <th>Resolution Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Critical (Service Down)</td>
                    <td>30 minutes</td>
                    <td>4 hours</td>
                  </tr>
                  <tr>
                    <td>High (Major Impact)</td>
                    <td>2 hours</td>
                    <td>24 hours</td>
                  </tr>
                  <tr>
                    <td>Medium (Limited Impact)</td>
                    <td>8 hours</td>
                    <td>72 hours</td>
                  </tr>
                  <tr>
                    <td>Low (Minimal Impact)</td>
                    <td>24 hours</td>
                    <td>Best effort</td>
                  </tr>
                </tbody>
              </table>

              <h3>Maintenance Windows</h3>
              <p>
                Scheduled maintenance is performed during off-peak hours (Saturday 10 PM -
                Sunday 2 AM PST). Emergency maintenance may be performed with minimal notice
                to address critical security or stability issues.
              </p>

              <h3>Service Credit Requests</h3>
              <p>
                To receive service credits, customers must submit a request within 30 days
                of the incident, including relevant logs and impact details.
              </p>
            </div>
          </section>
        )}

        {/* Vulnerability Disclosure */}
        {activePolicy === 'vulnerability' && (
          <section className={styles.contentSection}>
            <div className={styles.articleContent}>
              <h2>Vulnerability Disclosure Policy</h2>
              <p className={styles.legalDate}>Last Updated: January 1, 2024</p>

              <h3>Our Commitment</h3>
              <p>
                moccet is committed to working with security researchers to keep our services
                safe. We appreciate the work of security researchers who help us protect our
                customers and their data.
              </p>

              <h3>Scope</h3>
              <p>This policy applies to vulnerabilities discovered in:</p>
              <ul>
                <li>moccet web applications (*.moccet.com)</li>
                <li>moccet APIs</li>
                <li>moccet mobile applications</li>
                <li>moccet infrastructure components</li>
              </ul>

              <h3>Safe Harbor</h3>
              <p>
                moccet considers security research conducted consistent with this policy as
                authorized conduct. We will not pursue legal action against researchers who:
              </p>
              <ul>
                <li>Make a good faith effort to avoid privacy violations and disruptions</li>
                <li>Only use exploits to the extent necessary to confirm a vulnerability</li>
                <li>Do not access or modify customer data beyond what is necessary</li>
                <li>Promptly report vulnerabilities and do not disclose them publicly</li>
              </ul>

              <h3>Guidelines for Researchers</h3>

              <h4>Please DO:</h4>
              <ul>
                <li>Report vulnerabilities promptly to security@moccet.com</li>
                <li>Include detailed steps to reproduce the issue</li>
                <li>Allow reasonable time for us to address the issue before public disclosure</li>
                <li>Avoid accessing or modifying customer data</li>
                <li>Use test accounts when possible</li>
              </ul>

              <h4>Please DO NOT:</h4>
              <ul>
                <li>Perform denial of service attacks</li>
                <li>Use social engineering against our employees or customers</li>
                <li>Access customer data beyond what is necessary to demonstrate impact</li>
                <li>Modify or delete data</li>
                <li>Disclose vulnerabilities publicly before remediation</li>
              </ul>

              <h3>Reporting Process</h3>
              <ol>
                <li>Send report to security@moccet.com with vulnerability details</li>
                <li>We will acknowledge receipt within 3 business days</li>
                <li>We will provide an initial assessment within 10 business days</li>
                <li>We will keep you informed of remediation progress</li>
                <li>Once resolved, we will notify you and discuss disclosure timing</li>
              </ol>

              <h3>Recognition</h3>
              <p>
                With your permission, we may acknowledge your contribution in our security
                hall of fame. We may also provide rewards for significant vulnerabilities
                at our discretion.
              </p>

              <h3>Out of Scope</h3>
              <ul>
                <li>Vulnerabilities in third-party services we use</li>
                <li>Social engineering attacks</li>
                <li>Physical security issues</li>
                <li>Vulnerabilities requiring unlikely user interaction</li>
                <li>Issues without security impact</li>
              </ul>

              <h3>Contact</h3>
              <p>
                For questions about this policy or to report a vulnerability, contact:<br />
                Email: <a href="mailto:security@moccet.com">security@moccet.com</a><br />
                PGP Key: Available at moccet.com/security.txt
              </p>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section style={{
          textAlign: 'center',
          padding: isMobile ? '60px 0' : '80px 0',
          background: '#f9fafb',
          borderRadius: isMobile ? '16px' : '24px',
          margin: isMobile ? '0 -20px' : isTablet ? '0 -40px' : '0 -80px'
        }}>
          <h2 style={{
            fontSize: isMobile ? '28px' : isTablet ? '32px' : '36px',
            fontWeight: '400',
            lineHeight: '1.2',
            marginBottom: '16px',
            color: '#000'
          }}>
            Questions About Our Policies?
          </h2>
          <p style={{
            fontSize: isMobile ? '16px' : '18px',
            color: '#6b7280',
            marginBottom: '32px',
            maxWidth: isMobile ? '100%' : '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6'
          }}>
            We&apos;re here to help clarify any policy questions
          </p>
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center'
          }}>
            <Link href="/contact" style={{
              display: 'inline-block',
              padding: isMobile ? '14px 28px' : '12px 24px',
              backgroundColor: '#000',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              minHeight: isMobile ? '48px' : '44px',
              lineHeight: isMobile ? '20px' : 'normal',
              touchAction: 'manipulation'
            }}>
              Contact Us
            </Link>
            <Link href="/legal" style={{
              display: 'inline-block',
              padding: isMobile ? '14px 28px' : '12px 24px',
              backgroundColor: 'transparent',
              color: '#374151',
              textDecoration: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              minHeight: isMobile ? '48px' : '44px',
              lineHeight: isMobile ? '20px' : 'normal',
              touchAction: 'manipulation'
            }}>
              Legal Center
            </Link>
          </div>
        </section>
      </main>

    </div>
  );
}