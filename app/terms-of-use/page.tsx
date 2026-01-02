'use client';

import { useState } from 'react';
import Link from 'next/link';
import './terms.css';

export default function TermsOfUsePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="terms-page">
      {/* Navigation */}
      <nav className="terms-nav">
        <Link href="/" className="nav-logo" role="img" aria-label="moccet logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </Link>
        <div className="nav-menu">
          <Link href="/sage" className="nav-link">Sage</Link>
          <Link href="/moccet-mail" className="nav-link">Mail</Link>
          <Link href="/forge" className="nav-link">Forge</Link>
          <Link href="/news" className="nav-link">Stories</Link>
          <Link href="/#waitlist" className="nav-link">
            Join the waitlist
            <svg className="nav-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-menu-content" onClick={(e) => e.stopPropagation()}>
              <Link href="/sage" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Sage
              </Link>
              <Link href="/moccet-mail" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Mail
              </Link>
              <Link href="/forge" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Forge
              </Link>
              <Link href="/news" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Stories
              </Link>
              <Link href="/#waitlist" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
                Join the waitlist
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="terms-container">
        <header className="terms-header">
          <h1 className="terms-title">Terms of Use</h1>
          <p className="terms-subtitle">moccet Inc.</p>
          <p className="terms-date">Last Updated: November 21, 2025</p>
        </header>

        <section className="terms-content">
          <div className="section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              These Terms of Use (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;)
              and moccet Inc. (&ldquo;moccet,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) governing your access to and use of our
              health AI services, including but not limited to Sage (nutrition planning), Forge (training programs), and all associated
              websites, mobile applications, and platforms (collectively, the &ldquo;Services&rdquo;).
            </p>
            <p>
              By accessing or using the Services, you acknowledge that you have read, understood, and agree to be bound by these Terms
              and our <Link href="/privacy-policy">Privacy Policy</Link>. If you do not agree to these Terms, you must not access or use the Services.
            </p>
          </div>

          <div className="section">
            <h2>2. Eligibility and Account Registration</h2>

            <h3>2.1 Age Requirements</h3>
            <p>
              You must be at least 18 years of age to use the Services. By using the Services, you represent and warrant that you meet
              this age requirement. If you are under 18, you may not access or use the Services under any circumstances.
            </p>

            <h3>2.2 Account Creation</h3>
            <p>To access certain features, you must create an account. You agree to:</p>
            <ul>
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security and confidentiality of your account credentials</li>
              <li>Immediately notify us of any unauthorized use of your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>

            <h3>2.3 Account Suspension and Termination</h3>
            <p>
              We reserve the right to suspend or terminate your account at any time, with or without notice, for any reason, including
              but not limited to violation of these Terms, fraudulent activity, or behavior that we deem harmful to other users or our business interests.
            </p>
          </div>

          <div className="section">
            <h2>3. Medical Disclaimer and Health Information</h2>

            <h3>3.1 Not Medical Advice</h3>
            <p className="important-notice">
              <strong>IMPORTANT:</strong> The Services are provided for informational and educational purposes only. moccet is not a
              licensed medical provider, and the Services do not provide medical advice, diagnosis, or treatment. The information and
              recommendations provided through Sage, Forge, and other Services are not a substitute for professional medical advice
              from qualified healthcare providers.
            </p>

            <h3>3.2 Consult Healthcare Professionals</h3>
            <p>
              You should always consult with qualified healthcare professionals before:
            </p>
            <ul>
              <li>Starting any new nutrition or fitness program</li>
              <li>Making changes to your diet or exercise routine</li>
              <li>Taking any dietary supplements or medications</li>
              <li>Addressing any medical conditions or health concerns</li>
            </ul>

            <h3>3.3 No Guarantees</h3>
            <p>
              We do not guarantee any specific health outcomes, weight loss, fitness improvements, or other results from using the
              Services. Individual results may vary based on numerous factors beyond our control.
            </p>

            <h3>3.4 Risk Acknowledgment</h3>
            <p>
              You acknowledge and assume all risks associated with following nutrition plans, training programs, or other recommendations
              provided through the Services. You agree that moccet shall not be liable for any injuries, health complications, or adverse
              effects resulting from your use of the Services.
            </p>
          </div>

          <div className="section">
            <h2>4. License and Restrictions</h2>

            <h3>4.1 Limited License</h3>
            <p>
              Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license
              to access and use the Services for your personal, non-commercial use.
            </p>

            <h3>4.2 Prohibited Conduct</h3>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Services for any illegal, harmful, or unauthorized purpose</li>
              <li>Violate any applicable laws, regulations, or third-party rights</li>
              <li>Impersonate any person or entity, or falsely state or misrepresent your affiliation</li>
              <li>Access or attempt to access accounts, systems, or networks without authorization</li>
              <li>Interfere with or disrupt the integrity or performance of the Services</li>
              <li>Introduce viruses, malware, or other malicious code</li>
              <li>Scrape, crawl, or use automated means to access the Services without permission</li>
              <li>Reverse engineer, decompile, or disassemble any aspect of the Services</li>
              <li>Remove, obscure, or alter any proprietary rights notices</li>
              <li>Use the Services to compete with moccet or develop competing products</li>
              <li>Share, sell, rent, or sublicense your account or access to the Services</li>
              <li>Collect or harvest personal information of other users</li>
              <li>Post or transmit inappropriate, offensive, or harmful content</li>
              <li>Engage in any activity that could damage moccet&apos;s reputation or business</li>
            </ul>
          </div>

          <div className="section">
            <h2>5. Intellectual Property Rights</h2>

            <h3>5.1 moccet&apos;s Property</h3>
            <p>
              All content, features, functionality, designs, graphics, logos, text, software, algorithms, AI models, and other materials
              included in the Services are owned by moccet or our licensors and are protected by copyright, trademark, patent, trade
              secret, and other intellectual property laws.
            </p>

            <h3>5.2 Trademarks</h3>
            <p>
              &ldquo;moccet,&rdquo; &ldquo;Sage,&rdquo; &ldquo;Forge,&rdquo; and all associated logos and designs are trademarks of moccet Inc.
              You may not use these trademarks without our prior written consent.
            </p>

            <h3>5.3 User Content</h3>
            <p>
              By submitting, posting, or uploading content to the Services (&ldquo;User Content&rdquo;), you grant moccet a worldwide,
              royalty-free, perpetual, irrevocable, non-exclusive, transferable, sublicensable license to use, reproduce, modify, adapt,
              publish, translate, create derivative works from, distribute, and display such User Content in connection with operating,
              improving, and promoting the Services.
            </p>

            <h3>5.4 Feedback</h3>
            <p>
              Any feedback, suggestions, or ideas you provide regarding the Services become the sole property of moccet, and we may
              use such feedback without any obligation to you.
            </p>
          </div>

          <div className="section">
            <h2>6. Payment Terms and Subscriptions</h2>

            <h3>6.1 Subscription Plans</h3>
            <p>
              Certain features of the Services may require paid subscriptions. By purchasing a subscription, you agree to pay all
              applicable fees and charges, including any taxes.
            </p>

            <h3>6.2 Billing and Automatic Renewal</h3>
            <p>
              Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date. You
              authorize us to charge your payment method for the renewal fee.
            </p>

            <h3>6.3 Price Changes</h3>
            <p>
              We reserve the right to modify subscription prices at any time. Price changes will apply to subsequent billing periods
              after reasonable notice to you. Your continued use of the Services after a price change constitutes acceptance of the new price.
            </p>

            <h3>6.4 Refunds</h3>
            <p>
              All subscription fees are non-refundable except as required by law or as explicitly stated in our refund policy. We do
              not provide refunds for partial subscription periods or unused features.
            </p>

            <h3>6.5 Free Trials</h3>
            <p>
              If you receive a free trial, you must cancel before the trial ends to avoid being charged. Failure to cancel will result
              in automatic enrollment in a paid subscription.
            </p>
          </div>

          <div className="section">
            <h2>7. Disclaimers and Limitation of Liability</h2>

            <h3>7.1 &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo;</h3>
            <p className="important-notice">
              THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
              MOCCET DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>

            <h3>7.2 No Warranty</h3>
            <p>We do not warrant that:</p>
            <ul>
              <li>The Services will meet your requirements or expectations</li>
              <li>The Services will be uninterrupted, timely, secure, or error-free</li>
              <li>The results obtained from using the Services will be accurate or reliable</li>
              <li>Any errors or defects will be corrected</li>
              <li>The Services are free from viruses or other harmful components</li>
            </ul>

            <h3>7.3 Limitation of Liability</h3>
            <p className="important-notice">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, MOCCET, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF
              PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
            </p>
            <ul>
              <li>Your access to or use of (or inability to access or use) the Services</li>
              <li>Any conduct or content of third parties on the Services</li>
              <li>Any content obtained from the Services</li>
              <li>Unauthorized access, use, or alteration of your transmissions or content</li>
              <li>Health outcomes, injuries, or adverse effects from following recommendations</li>
            </ul>
            <p className="important-notice">
              IN NO EVENT SHALL MOCCET&apos;S TOTAL LIABILITY EXCEED THE GREATER OF (A) ONE HUNDRED DOLLARS ($100) OR (B) THE AMOUNT YOU
              PAID TO MOCCET IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>

            <h3>7.4 Jurisdictional Limitations</h3>
            <p>
              Some jurisdictions do not allow the exclusion or limitation of certain warranties or liabilities. In such jurisdictions,
              the above limitations may not apply to you, and our liability will be limited to the maximum extent permitted by law.
            </p>
          </div>

          <div className="section">
            <h2>8. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless moccet, its officers, directors, employees, agents, affiliates, and
              licensors from and against any claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable
              attorneys&apos; fees) arising from:
            </p>
            <ul>
              <li>Your use or misuse of the Services</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
              <li>Your User Content</li>
              <li>Any health issues, injuries, or adverse effects resulting from your use of the Services</li>
            </ul>
          </div>

          <div className="section">
            <h2>9. Third-Party Services and Links</h2>
            <p>
              The Services may contain links to third-party websites, applications, or services that are not owned or controlled by
              moccet. We have no control over and assume no responsibility for the content, privacy policies, or practices of any
              third-party services.
            </p>
            <p>
              Your use of third-party services is at your own risk, and you should review their terms and policies. We are not liable
              for any damage or loss caused by your reliance on or use of third-party services.
            </p>
          </div>

          <div className="section">
            <h2>10. Data Integrations</h2>
            <p>
              The Services may integrate with third-party health and fitness platforms (such as Apple Health, Google Fit, wearable
              devices, etc.). By connecting these services:
            </p>
            <ul>
              <li>You authorize us to access and use the data from these platforms as described in our Privacy Policy</li>
              <li>You acknowledge that we are not responsible for the accuracy or reliability of third-party data</li>
              <li>You understand that disconnecting these integrations may affect Service functionality</li>
              <li>You agree to comply with the terms of service of the connected third-party platforms</li>
            </ul>
          </div>

          <div className="section">
            <h2>11. Privacy and Data Protection</h2>
            <p>
              Your privacy is important to us. Our collection, use, and protection of your personal information is governed by our
              <Link href="/privacy-policy">Privacy Policy</Link>, which is incorporated into these Terms by reference. By using the
              Services, you consent to our data practices as described in the Privacy Policy.
            </p>
          </div>

          <div className="section">
            <h2>12. Modifications to the Services</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue any aspect of the Services at any time, with or without notice,
              for any reason. We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Services.
            </p>
            <p>
              Features, pricing, and availability may change without notice. We may also impose limits on certain features or restrict
              your access to parts or all of the Services without liability.
            </p>
          </div>

          <div className="section">
            <h2>13. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material changes by:
            </p>
            <ul>
              <li>Posting the updated Terms with a new &ldquo;Last Updated&rdquo; date</li>
              <li>Sending an email notification to your registered email address</li>
              <li>Displaying a prominent notice within the Services</li>
            </ul>
            <p>
              Your continued use of the Services after such modifications constitutes your acceptance of the updated Terms. If you do
              not agree to the modified Terms, you must stop using the Services and may request account termination.
            </p>
          </div>

          <div className="section">
            <h2>14. Termination</h2>

            <h3>14.1 Termination by You</h3>
            <p>
              You may terminate your account at any time by following the account deletion process in the Services or by contacting
              us at <a href="mailto:support@moccet.com">support@moccet.com</a>. Termination does not entitle you to a refund of any fees paid.
            </p>

            <h3>14.2 Termination by moccet</h3>
            <p>
              We may terminate or suspend your account and access to the Services immediately, without prior notice or liability, for
              any reason, including but not limited to:
            </p>
            <ul>
              <li>Breach of these Terms</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Requests by law enforcement or government agencies</li>
              <li>Extended periods of inactivity</li>
              <li>Technical or security issues</li>
            </ul>

            <h3>14.3 Effect of Termination</h3>
            <p>
              Upon termination:
            </p>
            <ul>
              <li>Your right to access and use the Services immediately ceases</li>
              <li>We may delete your account and User Content</li>
              <li>Provisions of these Terms that by their nature should survive termination shall survive, including but not limited
                to intellectual property provisions, disclaimers, limitations of liability, and indemnification</li>
            </ul>
          </div>

          <div className="section">
            <h2>15. Dispute Resolution and Arbitration</h2>

            <h3>15.1 Informal Resolution</h3>
            <p>
              Before initiating formal proceedings, you agree to contact us at <a href="mailto:legal@moccet.com">legal@moccet.com</a> to
              attempt to resolve any dispute informally. We will work in good faith to resolve disputes within 60 days.
            </p>

            <h3>15.2 Binding Arbitration</h3>
            <p>
              If informal resolution fails, any dispute arising out of or relating to these Terms or the Services shall be resolved
              through binding arbitration administered by the American Arbitration Association (AAA) in accordance with its Commercial
              Arbitration Rules.
            </p>

            <h3>15.3 Arbitration Procedures</h3>
            <ul>
              <li>The arbitration shall be conducted by a single arbitrator</li>
              <li>The arbitration shall take place in [Location to be specified]</li>
              <li>The arbitrator&apos;s decision shall be final and binding</li>
              <li>Judgment on the award may be entered in any court having jurisdiction</li>
              <li>Each party shall bear its own costs and attorneys&apos; fees, unless the arbitrator awards otherwise</li>
            </ul>

            <h3>15.4 Class Action Waiver</h3>
            <p className="important-notice">
              YOU AND MOCCET AGREE THAT ANY PROCEEDINGS TO RESOLVE DISPUTES WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A
              CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. You waive any right to participate in a class action lawsuit or class-wide arbitration.
            </p>

            <h3>15.5 Exceptions</h3>
            <p>
              Notwithstanding the above, either party may seek equitable relief in court for infringement or misappropriation of
              intellectual property rights.
            </p>
          </div>

          <div className="section">
            <h2>16. Governing Law and Jurisdiction</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of [State/Country to be specified], without
              regard to its conflict of law provisions. To the extent arbitration does not apply, you agree to submit to the exclusive
              jurisdiction of the courts located in [Location to be specified].
            </p>
          </div>

          <div className="section">
            <h2>17. Severability</h2>
            <p>
              If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining provisions shall continue
              in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable.
            </p>
          </div>

          <div className="section">
            <h2>18. Waiver</h2>
            <p>
              Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.
              Any waiver must be in writing and signed by an authorized representative of moccet.
            </p>
          </div>

          <div className="section">
            <h2>19. Assignment</h2>
            <p>
              You may not assign or transfer these Terms or your account without our prior written consent. We may assign or transfer
              these Terms and our rights and obligations without restriction, including in connection with a merger, acquisition,
              reorganization, or sale of assets.
            </p>
          </div>

          <div className="section">
            <h2>20. Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy and any other legal notices or agreements published by us, constitute the
              entire agreement between you and moccet regarding the Services and supersede all prior agreements, understandings, and
              communications, whether written or oral.
            </p>
          </div>

          <div className="section">
            <h2>21. Force Majeure</h2>
            <p>
              moccet shall not be liable for any failure or delay in performing its obligations under these Terms due to circumstances
              beyond its reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, riots,
              government actions, labor disputes, internet service provider failures, or other force majeure events.
            </p>
          </div>

          <div className="section">
            <h2>22. Export Compliance</h2>
            <p>
              You agree to comply with all applicable export and import laws and regulations. You may not use or export the Services
              in violation of U.S. export laws and regulations or any other applicable laws.
            </p>
          </div>

          <div className="section">
            <h2>23. Government Users</h2>
            <p>
              If you are a U.S. government entity, the Services are &ldquo;Commercial Items&rdquo; as defined in FAR 2.101 and are provided
              with only those rights as are granted to all other users under these Terms.
            </p>
          </div>

          <div className="section">
            <h2>24. Contact Information</h2>
            <p>
              If you have questions, concerns, or disputes regarding these Terms or the Services, please contact us:
            </p>
            <div className="contact-info">
              <p><strong>Email:</strong> <a href="mailto:legal@moccet.com">legal@moccet.com</a></p>
              <p><strong>Support:</strong> <a href="mailto:support@moccet.com">support@moccet.com</a></p>
              <p><strong>Address:</strong> moccet Inc., [Address to be added]</p>
            </div>
          </div>

          <div className="section acknowledgment">
            <h2>Acknowledgment</h2>
            <p className="important-notice">
              BY USING THE SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF USE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY
              THEM. IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT ACCESS OR USE THE SERVICES.
            </p>
          </div>
        </section>

        <footer className="terms-footer">
          <p>Thank you for using moccet.</p>
          <nav className="footer-links">
            <Link href="/">Home</Link>
            <Link href="/sage">Sage</Link>
            <Link href="/forge">Forge</Link>
            <Link href="/news">Stories</Link>
            <Link href="/privacy-policy">Privacy Policy</Link>
          </nav>
          <p className="copyright">© 2025 moccet Inc. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
