'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import styles from '../landing.module.css';

export default function LegalPage() {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Set sidebar to open on desktop by default
  useEffect(() => {
    if (window.innerWidth > 1024) {
      setSidebarActive(true);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const handleContactSales = () => {
    // Contact sales handler for consistency with landing page
  };

  return (
    <div className={styles.container}>
      <Header
        onToggleSidebar={toggleSidebar}
        onContactSales={handleContactSales}
        sidebarActive={sidebarActive}
      />
      <Sidebar isActive={sidebarActive} />

      {/* Main Content */}
      <main className={`${styles.main} ${sidebarActive ? styles.mainWithSidebar : ''}`}>
        <div style={{
          padding: '80px',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          <h1 style={{
            fontSize: '64px',
            fontWeight: '400',
            marginBottom: '60px',
            letterSpacing: '-2px',
            lineHeight: '1'
          }}>
            Terms of use
          </h1>

          <div style={{
            fontSize: '17px',
            color: '#1a1a1a',
            marginBottom: '60px'
          }}>
            Effective: December 11, 2024 (<Link href="#" style={{ color: 'inherit' }}>previous version</Link>)
          </div>

          <div style={{ marginBottom: '60px' }}>
            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              Thank you for using moccet!
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              These Terms of Use apply to your use of HealthHub, m-vision, and moccet&apos;s other services for individuals,
              along with any associated software applications and websites (all together, &quot;Services&quot;). These Terms form
              an agreement between you and moccet, L.L.C., a Delaware company, and they include our Service Terms and
              important provisions for resolving disputes through arbitration. By using our Services, you agree to these Terms.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              If you reside in the European Economic Area, Switzerland, or the UK, your use of the Services is governed by{' '}
              <Link href="#" style={{ color: '#000', textDecoration: 'underline' }}>these terms</Link>.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              Our Business Terms govern use of HealthHub Enterprise, our APIs, and our other services for businesses and developers.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              Our Privacy Policy explains how we collect and use personal information. Although it does not form part of
              these Terms, it is an important document that you should read.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Who we are
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              moccet is an AI research and deployment company. Our mission is to ensure that artificial general intelligence
              benefits all of humanity. For more information about moccet, please visit{' '}
              <Link href="#" style={{ color: '#000', textDecoration: 'underline' }}>https://moccet.com/about</Link>.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Registration and access
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Minimum age.</strong> You must be at least 13 years old or the
              minimum age required in your country to consent to use the Services. If you are under 18 you must have
              your parent or legal guardian&apos;s permission to use the Services.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Registration.</strong> You must provide accurate and complete
              information to register for an account to use our Services. You may not share your account credentials
              or make your account available to anyone else and are responsible for all activities that occur under
              your account. If you create an account or use the Services on behalf of another person or entity, you
              must have the authority to accept these Terms on their behalf.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Using our Services
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>What you can do.</strong> Subject to your compliance with these
              Terms, you may access and use our Services. In using our Services, you must comply with all applicable
              laws as well as our Usage Policies and any other documentation, guidelines, or policies we make available to you.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>What you cannot do.</strong> You may not use our Services for any
              illegal, harmful, or abusive activity. For example, you may not:
            </p>

            <ul style={{
              margin: '24px 0',
              paddingLeft: '28px'
            }}>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Use our Services in a way that infringes, misappropriates or violates anyone&apos;s rights.
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Modify, copy, lease, sell or distribute any of our Services.
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Attempt to or assist anyone to reverse engineer, decompile or discover the source code of underlying
                components of our Services, including our models, algorithms, or systems (except to the extent this
                restriction is prohibited by applicable law).
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Automatically or programmatically extract data or Output (defined below).
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Represent that Output was human-generated when it was not.
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Interfere with or disrupt our Services, including circumvent any rate limits or restrictions or
                bypass any protective measures or safety mitigations we put on our Services.
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Use Output to develop models that compete with moccet.
              </li>
            </ul>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Software.</strong> Our Services may allow you to download software,
              such as mobile applications, which may update automatically to ensure you&apos;re using the latest version.
              Our software may include open source software that is governed by its own licenses that we&apos;ve made available to you.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Corporate domains.</strong> If you create an account using an
              email address owned by an organization (for example, your employer or educational institution), that
              organization may be added to the organization&apos;s business account with us, and we will provide notice to
              the email address. If this happens, the organization&apos;s administrators may be able to control your account,
              including being able to access your content and restrict or remove your access to the account. Your use
              of the Services may also be subject to the organization&apos;s policies. If you do not want an organization
              to control your account, use a personal email address to create the account. If you are an administrator
              and want to learn more about managing an organization account, please contact us.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Third party services.</strong> Our Services may include third party
              software, services, or other materials. Our Services may also provide you with the ability to interact
              directly with third party sites and services—for example through integrations. Your use of any third party
              services are governed by their own terms.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Content
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Your content.</strong> You may provide input to the Services
              (&quot;Input&quot;), and receive output from the Services based on the Input (&quot;Output&quot;). Input and Output are
              collectively &quot;Content.&quot; You are responsible for Content, including ensuring that it does not violate any
              applicable law or these Terms. You represent and warrant that you have all rights, licenses, and permissions
              needed to provide Input to our Services.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Ownership of content.</strong> As between you and moccet, and to
              the extent permitted by applicable law, you (a) retain your ownership rights in Input and (b) own the Output.
              We hereby assign to you all our right, title, and interest, if any, in and to Output.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Use of content to improve Services.</strong> We do not train our
              models on Content from our consumer services like HealthHub, except (i) where users affirmatively share
              certain content with us for training or (ii) when Content is flagged for Trust & Safety review. We may use
              Content to provide, maintain, develop, and improve our Services, comply with applicable law, enforce our
              terms and policies, and keep our Services safe.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Accuracy.</strong> Artificial intelligence and machine learning are
              rapidly evolving fields of study. We are constantly working to improve our Services to make them more
              accurate, reliable, safe, and beneficial. Given the probabilistic nature of machine learning, use of our
              Services may, in some situations, result in Output that does not accurately reflect real people, places, or facts.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              When you use our Services, you understand and agree:
            </p>

            <ul style={{
              margin: '24px 0',
              paddingLeft: '28px'
            }}>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Output may not always be accurate. You should not rely on Output from our Services as a sole source
                of truth or factual information, or as a substitute for professional advice.
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                You must evaluate Output for accuracy and appropriateness for your use case, including using human
                review as appropriate.
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                You should not use our Services in contexts where inaccurate Output could result in significant harm,
                such as making final determinations about a person&apos;s health, fitness for employment, creditworthiness,
                or other purposes that could have legal or material impact on a person.
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                Our Services may provide incomplete, incorrect, or offensive Output that does not represent moccet&apos;s views.
                If Output references any third party products or services, it doesn&apos;t mean the third party endorses or
                is affiliated with moccet.
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Healthcare-specific terms
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Medical disclaimer.</strong> Our Services, including HealthHub and
              any health-related features, are not intended to be a substitute for professional medical advice, diagnosis,
              or treatment. Always seek the advice of your physician or other qualified health provider with any questions
              you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking
              it because of something you have read or received from our Services.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Emergency situations.</strong> If you think you may have a medical
              emergency, call your doctor, go to the emergency department, or call emergency services immediately. Our
              Services are not designed or intended for use in medical emergencies.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>HIPAA.</strong> Our Services are not covered entities or business
              associates under HIPAA. For healthcare organizations requiring HIPAA compliance, please contact us about
              moccet Enterprise solutions.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Fees and payments
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Fees.</strong> We may charge fees for use of our Services, which
              will be disclosed to you before you incur any fees. All fees are exclusive of taxes (except where the fees
              expressly include taxes), and you will be responsible for any taxes (except for our income taxes).
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Free services.</strong> We may make certain Services available to
              you at no charge, including free versions of our Services or free credits or tokens that allow you to use
              our paid Services up to certain limits. We may change or stop providing free versions or free credits or
              tokens at any time without notice.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Confidentiality, security, and data protection
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Confidentiality.</strong> You may be given access to certain
              non-public information, software, and specifications relating to our Services (&quot;Confidential Information&quot;),
              which is confidential and proprietary to moccet. You may use Confidential Information only as needed to
              use the Services as permitted under these Terms. You may not disclose Confidential Information to any third
              party, and you will protect Confidential Information in the same manner that you protect your own confidential
              information of a similar nature, using at least reasonable care. Confidential Information does not include
              information that: (a) is or becomes generally available to the public through no fault of yours; (b) you
              already possess without any confidentiality obligations when you received it under these Terms; (c) is
              rightfully disclosed to you by a third party without any confidentiality obligations; or (d) you independently
              developed without using Confidential Information. You may disclose Confidential Information when required by
              law or the valid order of a court or other governmental authority if you give us reasonable advance written
              notice and use reasonable efforts to limit the scope of disclosure.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Security.</strong> You must implement reasonable and appropriate
              measures designed to help secure your access to and use of our Services. If you discover any vulnerabilities
              or breaches related to your use of our Services, you must promptly contact us and provide details of the
              vulnerability or breach.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Processing of personal data.</strong> If you use our Services to
              process personal information, you are responsible for compliance with applicable data protection laws. Our
              Data Processing Addendum governs our processing of personal information on your behalf in connection with
              your use of our Services for business purposes.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Termination and suspension
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Termination.</strong> You are free to stop using our Services at
              any time. We reserve the right to suspend or terminate your access to our Services or delete your account
              if we reasonably believe:
            </p>

            <ul style={{
              margin: '24px 0',
              paddingLeft: '28px'
            }}>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                You have violated these Terms;
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                You are using our Services in a manner that could cause a risk of harm or loss to us or other users; or
              </li>
              <li style={{
                fontSize: '17px',
                lineHeight: '1.7',
                color: '#1a1a1a',
                marginBottom: '16px',
                listStyleType: 'disc'
              }}>
                You don&apos;t have an active paid account and you haven&apos;t accessed our Services for over a year.
              </li>
            </ul>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              We will make reasonable efforts to provide you with advance notice when possible. We may reinstate your
              account at our sole discretion.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Effect of termination.</strong> Upon termination, you&apos;ll remain
              obligated to pay all fees and amounts you owe. Provisions of these Terms that by their nature should survive
              termination will survive (for example, indemnification, warranty disclaimers, limitation of liability,
              dispute resolution, and general terms).
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Indemnification; disclaimer of warranties; limitations on liability
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Indemnification.</strong> To the fullest extent permitted by law,
              you will defend, indemnify, and hold harmless us, our affiliates, and our personnel, from and against any
              claims, losses, and expenses (including attorneys&apos; fees) arising from or relating to your use of our Services,
              including your Content, your violation of these Terms, your violation of applicable law, or your negligent
              or willful misconduct.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Disclaimer of warranties.</strong> OUR SERVICES ARE PROVIDED &quot;AS IS.&quot;
              TO THE FULLEST EXTENT PERMITTED BY LAW, WE AND OUR AFFILIATES AND LICENSORS MAKE NO WARRANTIES (EXPRESS,
              IMPLIED, STATUTORY, OR OTHERWISE) WITH RESPECT TO THE SERVICES, AND DISCLAIM ALL WARRANTIES INCLUDING, BUT
              NOT LIMITED TO, WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, SATISFACTORY QUALITY,
              NON-INFRINGEMENT, AND QUIET ENJOYMENT, AND ANY WARRANTIES ARISING OUT OF ANY COURSE OF DEALING OR TRADE USAGE.
              WE DO NOT WARRANT THAT OUR SERVICES WILL BE UNINTERRUPTED, ACCURATE OR ERROR-FREE, OR THAT ANY OUTPUT WILL
              BE ACCURATE, RELIABLE, OR COMPLETE.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Limitations on liability.</strong> TO THE FULLEST EXTENT PERMITTED
              BY LAW, WE AND OUR AFFILIATES WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, PUNITIVE, CONSEQUENTIAL,
              SPECIAL, OR EXEMPLARY DAMAGES, INCLUDING DAMAGES FOR LOST PROFITS, LOST REVENUES, LOST BUSINESS, OR LOST DATA,
              OR ANY MEDICAL OR HEALTH-RELATED DAMAGES, EVEN IF WE KNEW OR SHOULD HAVE KNOWN SUCH DAMAGES WERE POSSIBLE.
              OUR AGGREGATE LIABILITY UNDER THESE TERMS WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU HAVE PAID US FOR THE
              SERVICE THAT GAVE RISE TO THE LIABILITY DURING THE 12 MONTHS BEFORE THE LIABILITY AROSE OR ONE HUNDRED DOLLARS
              ($100). THE LIMITATIONS IN THIS SECTION APPLY ONLY TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              Dispute resolution
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              You and moccet agree to the following mandatory arbitration and class action waiver provisions:
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Mandatory arbitration.</strong> You and moccet agree to resolve any
              past or present claims arising out of or relating to these Terms through final and binding arbitration,
              except that you have the right to opt out of these arbitration and class action waiver provisions by filling
              out <Link href="#" style={{ color: '#000', textDecoration: 'underline' }}>this form</Link> within 30 days
              of agreeing to these Terms. Arbitration under these Terms will be conducted by the American Arbitration
              Association (&quot;AAA&quot;) under the AAA Consumer Arbitration Rules. If you are a resident of a country outside
              of the United States, arbitration shall be conducted by the International Centre for Dispute Resolution
              (&quot;ICDR&quot;) in accordance with the ICDR Rules. The arbitrator&apos;s award will be binding and may be entered as
              a judgment in any court of competent jurisdiction. You may opt out of mandatory arbitration within 30 days
              of the date you first agreed to these Terms by completing{' '}
              <Link href="#" style={{ color: '#000', textDecoration: 'underline' }}>this form</Link>.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>No class actions.</strong> To the fullest extent permitted by
              applicable law, you and moccet agree that each of us may bring claims against the other only on an individual
              basis and not as a plaintiff or class member in any purported class or representative action or proceeding.
              The arbitrator may not consolidate more than one person&apos;s claims and may not otherwise preside over any form
              of a class or representative action or proceeding.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Exceptions.</strong> Nothing in this section prevents either party
              from filing a lawsuit in court for (a) claims that qualify for small claims court, or (b) to seek equitable
              remedies for violations of our Terms or infringement of intellectual property rights.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Governing law.</strong> These Terms are governed by the laws of the
              State of Delaware, excluding its conflict of laws principles.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Venue.</strong> Any dispute that is not subject to arbitration will
              be resolved exclusively in the state or federal courts of Delaware.
            </p>
          </div>

          <div style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '400',
              marginBottom: '32px',
              marginTop: '60px'
            }}>
              General terms
            </h2>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Assignment.</strong> You may not assign or transfer these Terms or
              any rights or obligations under these Terms and any attempt to do so will be void. We may assign these Terms
              to any affiliate, successor, or entity that acquires all or substantially all of our assets or business relating
              to these Terms.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Changes to these Terms.</strong> We may update these Terms from time
              to time by posting a revised version on our website or communicating the update through our Services. If we
              make material changes, we will provide notice. By continuing to use our Services, you agree to the revised Terms.
              You can review the current version of these Terms at any time by visiting{' '}
              <Link href="#" style={{ color: '#000', textDecoration: 'underline' }}>this page</Link>.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Delay in enforcing these Terms.</strong> Our failure to enforce a
              provision is not a waiver of our right to do so later. Except as provided in the dispute resolution section
              above, if any portion of these Terms is determined to be invalid or unenforceable, that portion will be enforced
              to the maximum extent permissible and it will not affect the enforceability of any other terms.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Trade controls.</strong> You must comply with all applicable trade laws,
              including sanctions and export control laws. Our Services may not be used in or for the benefit of certain
              countries or by prohibited persons under applicable trade laws.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Entire agreement.</strong> These Terms contain the entire agreement
              between you and moccet regarding our Services and, other than any Service-specific terms or agreements,
              supersede any prior or contemporaneous agreements between you and moccet.
            </p>

            <p style={{
              fontSize: '17px',
              lineHeight: '1.7',
              color: '#1a1a1a',
              marginBottom: '24px'
            }}>
              <strong style={{ fontWeight: '600' }}>Contact.</strong> If you have any questions about these Terms, please
              contact us at legal@moccet.com.
            </p>
          </div>
        </div>
      </main>


      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            width: '40px',
            height: '40px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          ↑
        </button>
      )}
    </div>
  );
}