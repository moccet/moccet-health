'use client';

import { useState } from 'react';
import Link from 'next/link';
import './forge.css';

export default function ForgePage() {
  const [email, setEmail] = useState('');
  const [buttonText, setButtonText] = useState('Join the waitlist');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Disable button during submission
    setIsSubmitting(true);
    setButtonText('Sending...');

    try {
      // Send Slack notification
      try {
        await fetch('/api/notify-slack', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            source: 'Forge Landing Page',
          }),
        });
      } catch (slackError) {
        console.error('Error sending Slack notification:', slackError);
        // Continue even if notification fails
      }

      // Send forge welcome email
      try {
        await fetch('/api/send-forge-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
          }),
        });
      } catch (emailError) {
        console.error('Error sending forge email:', emailError);
        // Continue even if email fails
      }

      // Show success message
      setButtonText('Sent!');
      setEmail('');

      // Reset button after 2 seconds
      setTimeout(() => {
        setButtonText('Join the waitlist');
        setIsSubmitting(false);
      }, 2000);

    } catch (error) {
      console.error('Error:', error);
      alert('There was an error. Please try again.');
      setButtonText('Join the waitlist');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="landing-page-moccet">
      <section
        className="first-page"
        style={{
          backgroundImage: "url('https://c.animaapp.com/EVbz3TeZ/img/susan-wilkinson-eo76daedyim-unsplash.jpg')"
        }}
      >
        <Link href="/" className="product-link product-link-left">moccet</Link>
        <div className="logo" role="img" aria-label="Forge logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </div>
        <Link href="/sage" className="product-link product-link-right">sage</Link>
        <header className="title-centered">
          <h1 className="forge-title">forge</h1>
        </header>
        <div className="content">
          <img
            className="your-personal"
            src="https://c.animaapp.com/EVbz3TeZ/img/your-personal-training-program-@4x.png"
            alt="Your personal training program"
          />
          <form className="enter-email" onSubmit={handleSubmit} noValidate>
            <input
              type="email"
              id="email-input"
              name="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              className="email-input-field"
              disabled={isSubmitting}
            />
            <button type="submit" className="button" disabled={isSubmitting}>
              <span className="text-wrapper-3">{buttonText}</span>
            </button>
          </form>
          <p className="p">1000+ people on the list for early access</p>
          <nav className="social-links" aria-label="Social media links and footer navigation">
            <a
              href="https://x.com/moccet"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Moccet on X (formerly Twitter)"
            >
              <img
                className="social-link"
                src="https://c.animaapp.com/EVbz3TeZ/img/social-link-3-1.svg"
                alt="X social media icon"
              />
            </a>
            <a
              href="https://www.linkedin.com/company/moccet/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Moccet on LinkedIn"
            >
              <img
                className="social-link"
                src="https://c.animaapp.com/EVbz3TeZ/img/social-link-2-1.svg"
                alt="LinkedIn social media icon"
              />
            </a>
            <div className="div-wrapper">
              <a href="#privacy-policy" className="text-wrapper-4">Privacy Policy</a>
            </div>
            <div className="social-link-2">
              <span className="text-wrapper-5">moccet Inc © 2025</span>
            </div>
          </nav>
        </div>
      </section>

      {/* Content Section */}
      <section className="content-section">
        <div className="image-container">
          <img src="/images/3.png" alt="Training programs illustration" />
        </div>

        <div className="content-container">
          <div className="content-block">
            <h2 className="section-title">Building training programs from biology</h2>
            <p className="section-text">Training plans follow this same pattern. You answer a questionnaire about your goals and experience level. You get a template — beginner, intermediate, advanced. Push-pull-legs. Upper-lower split. The plan might adjust for your age or whether you want to &quot;lose weight&quot; or &quot;build muscle,&quot; but it doesn&apos;t account for the variable that matters most: your internal state right now.</p>
            <p className="section-text">Two people follow identical training programs. One recovers well, makes steady progress, hits new PRs every month. The other stagnates, feels exhausted, develops nagging injuries, and eventually quits. Same program, different biology.</p>
            <p className="section-text"><strong>moccet</strong> built <strong>forge</strong> to solve this problem.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">How <strong>forge</strong> works</h2>
            <p className="section-text"><strong>forge</strong> generates training programs from your metabolic data and behavioral patterns. Not templates with minor adjustments — protocols built from biomarkers, wearable data, activity patterns, and how your body responds to training stress.</p>
            <p className="section-text">The system takes multiple data streams.</p>
          </div>

          <div className="content-block data-section">
            <h3 className="subsection-title">From blood work</h3>
            <ul className="data-list">
              <li className="section-text">Glucose regulation: fasting glucose, HbA1c, insulin sensitivity markers</li>
              <li className="section-text">Lipid metabolism: complete cholesterol panel including particle sizes</li>
              <li className="section-text">Inflammatory status: CRP, homocysteine, cytokines</li>
              <li className="section-text">Hormone function: testosterone, cortisol, thyroid markers, sex hormones</li>
              <li className="section-text">Recovery capacity: creatine kinase, lactate dehydrogenase</li>
              <li className="section-text">Nutrient status: vitamin D, iron, B vitamins, magnesium</li>
            </ul>
          </div>

          <div className="content-block data-section">
            <h3 className="subsection-title">From wearables and health tracking</h3>
            <ul className="data-list">
              <li className="section-text">Heart rate variability trends over time</li>
              <li className="section-text">Resting heart rate patterns and recovery</li>
              <li className="section-text">Sleep duration, timing, quality scores, sleep stage distribution</li>
              <li className="section-text">Daily activity levels and movement patterns</li>
              <li className="section-text">Training load if you&apos;re already tracking workouts</li>
              <li className="section-text">Heart rate zones during exercise</li>
            </ul>
          </div>

          <div className="content-block data-section">
            <h3 className="subsection-title">From connected apps</h3>
            <ul className="data-list">
              <li className="section-text">Calendar data showing stress periods and travel</li>
              <li className="section-text">Email patterns indicating work intensity</li>
              <li className="section-text">Notion or productivity tools showing project demands</li>
              <li className="section-text">Medical records including injury history and diagnoses</li>
            </ul>
          </div>

          <div className="content-block">
            <p className="section-text">You don&apos;t need everything to start. Give <strong>forge</strong> basic glucose markers and smartphone step tracking, you get a functional program. Add HRV data, sleep quality, and hormone levels, the plan becomes more precise. Connect your full digital life — calendar, work patterns, travel schedule — and <strong>forge</strong> accounts for how stress, travel, and work demands affect your training capacity.</p>
            <p className="section-text">The system maps inputs to training adaptations. High fasting glucose plus low HRV suggests impaired glucose disposal and elevated stress load. Your program emphasizes moderate-intensity work with extended rest periods, prioritizing glucose uptake without adding systemic stress. Elevated cortisol combined with poor sleep means compromised recovery capacity. Training volume decreases, frequency adjusts, deload weeks appear sooner.</p>
            <p className="section-text">Low testosterone with high training volume often indicates under-recovery. The plan shifts toward strength work with reduced volume, more rest days, specific protocols supporting hormonal recovery. High inflammatory markers might trigger full-body sessions three times per week instead of five-day splits — less frequent stimulus, more time between sessions for recovery.</p>
            <p className="section-text">When your calendar shows heavy travel weeks or email patterns indicate high work stress, <strong>forge</strong> adjusts training load before you even step in the gym. Not generic &quot;listen to your body&quot; advice — automated adjustments based on measurable stress signals.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">What you get</h2>
            <p className="section-text"><strong>forge</strong> generates complete training programs.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Training split</h3>
            <p className="section-text">How to structure your week based on recovery capacity and metabolic state. Someone with elevated inflammation might train three days per week with full rest days between sessions. Someone with strong biomarkers and excellent HRV can handle higher frequency and volume.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Exercise selection</h3>
            <p className="section-text">Movements matched to current capacity and goals. If biomarkers suggest joint inflammation, exercises emphasize better load distribution. If glucose disposal is the priority, more compound movements shown to improve insulin sensitivity.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Intensity and volume</h3>
            <p className="section-text">Specific set-rep schemes matched to hormonal state and recovery markers. High cortisol typically means lower volume, moderate intensity. Strong recovery markers allow higher volumes and intensity variance.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Progression strategy</h3>
            <p className="section-text">How to advance week to week based on adaptive capacity. Someone with excellent biomarkers and strong HRV can handle aggressive progression. Someone showing stress markers gets conservative loading with planned deload weeks.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Recovery protocols</h3>
            <p className="section-text">Rest day strategies, mobility work, active recovery matched to inflammatory markers and sleep quality. Not generic &quot;take rest days&quot; but specific approaches based on what your body needs right now.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">Early testing</h2>
            <p className="section-text">We ran <strong>forge</strong> with 47 people over 12 weeks. Everyone got blood work at baseline, week 6, and week 12. Wearables tracked sleep, HRV, and activity daily.</p>
            <p className="section-text">One user started with fasting glucose at 108 mg/dL, elevated cortisol, poor HRV. Previous training was high-intensity six days per week — making everything worse. <strong>forge</strong> adjusted training to four days weekly, moderate intensity, extended rest periods, emphasis on glucose disposal. After 12 weeks: fasting glucose dropped to 94 mg/dL, HRV improved 23%, cortisol normalized.</p>
            <p className="section-text">Another user had strong glucose markers but low testosterone (310 ng/dL) and high training frequency. <strong>forge</strong> reduced volume 40%, focused on heavy compounds, added rest days. Testosterone increased to 445 ng/dL over 10 weeks without other interventions.</p>
            <p className="section-text">The pattern held. When training matched internal state, biomarkers improved. When training fought biology, markers stagnated or declined regardless of effort.</p>
          </div>
        </div>

        <div className="image-container">
          <img src="/images/4.png" alt="Architecture illustration" />
        </div>

        <div className="content-container">
          <div className="content-block">
            <h2 className="section-title">The architecture</h2>
            <p className="section-text"><strong>forge</strong> runs on three connected systems.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Biomarker interpreter</h3>
            <p className="section-text">Maps lab values to metabolic states and recovery capacity. Uses clinical research ranges, not standard reference ranges. Fasting glucose at 95 mg/dL appears &quot;normal&quot; on lab reports but suggests early insulin resistance, <strong>forge</strong> accounts for this.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Pattern analyzer</h3>
            <p className="section-text">Extracts signals from wearable data and connected apps. Not just today&apos;s HRV but seven-day and thirty-day trends. Sleep consistency matters more than single nights. Heart rate recovery trends indicate adaptive capacity better than resting HR alone. Calendar patterns reveal stress cycles before they show up in biomarkers.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Protocol generator</h3>
            <p className="section-text">Combines biomarker state and behavioral patterns to build programs. Holds protocols from exercise physiology research — what works for different metabolic states, recovery capacities, training histories.</p>
            <p className="section-text">The three systems communicate continuously. As data updates, the protocol generator flags when to push harder or back off, even between formal program updates.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">Medical grounding</h2>
            <p className="section-text">Every recommendation traces to peer-reviewed research. When <strong>forge</strong> emphasizes moderate-intensity exercise for someone with insulin resistance, that links to specific studies. When it recommends reduced volume for elevated cortisol, you see the evidence base.</p>
            <p className="section-text">We don&apos;t make clinical claims. We show what research says about training adaptations for different metabolic states, then generate programs applying those findings to your data.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">Data flexibility</h2>
            <p className="section-text"><strong>forge</strong> scales to what you provide.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Minimal data</h3>
            <p className="section-text">Basic metabolic panel + smartphone step tracking gets you a starter program calibrated to glucose regulation and activity patterns. Limited precision but functional.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Standard data</h3>
            <p className="section-text">Full metabolic panel plus wearable with HRV generates programs matched to current state and patterns. Most people start here.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Advanced data</h3>
            <p className="section-text">Complete biomarkers plus advanced wearable metrics plus connected apps plus training history creates fully individualized protocols adapting to your state continuously.</p>
            <p className="section-text">More data doesn&apos;t just add features. It changes decision quality. With complete data, <strong>forge</strong> distinguishes between poor performance from under-recovery versus under-training — and adjusts strategy accordingly.</p>
            <p className="section-text">If you don&apos;t have blood work, <strong>forge</strong> shows which tests to request. Most primary care physicians can order these panels, or you can access them through direct-to-consumer lab services. Upload whatever data you have — <strong>forge</strong> works with partial information and improves as you add more.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">Using <strong>forge</strong></h2>
            <p className="section-text">Go to <a href="https://moccet.ai/forge" target="_blank" rel="noopener noreferrer">moccet.ai/forge</a>. Upload labs, connect wearables through Apple Health, Garmin, Whoop, Oura, or Fitbit. Connect calendar, email, productivity tools if you want <strong>forge</strong> to account for life stress. Answer questions about training history and goals.</p>
            <p className="section-text">You get your program immediately. Request a new plan if you want it to be updated. If HRV trends down for a week, <strong>forge</strong> flags it and suggests modifications. If your calendar shows a heavy travel period coming up, training adjusts before you leave.</p>
            <p className="section-text"><strong>forge</strong> is free for early users. If it&apos;s useful, share with your friends to use it too and join the waitlist at <a href="https://moccet.com" target="_blank" rel="noopener noreferrer">moccet.com</a> for the full platform that delivers daily insights across all aspects of health, not just training.</p>
          </div>
        </div>

        <div className="image-container">
          <img src="/images/5.png" alt="Final illustration" />
        </div>

      </section>
    </main>
  );
}
