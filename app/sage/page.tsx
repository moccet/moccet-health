'use client';

import { useState } from 'react';
import Link from 'next/link';
import './sage.css';

export default function SagePage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

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
            source: 'Sage Landing Page',
          }),
        });
      } catch (slackError) {
        console.error('Error sending Slack notification:', slackError);
        // Continue even if notification fails
      }

      // Send sage welcome email
      try {
        await fetch('/api/send-sage-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
          }),
        });
      } catch (emailError) {
        console.error('Error sending sage email:', emailError);
        // Continue even if email fails
      }

      // Show welcome message
      setIsSubmitted(true);

    } catch (error) {
      console.error('Error:', error);
      alert('There was an error. Please try again.');
    }
  };

  return (
    <main className="landing-page-moccet">
      <section
        className="first-page"
        style={{
          backgroundImage: "url('https://c.animaapp.com/ArhZSyxG/img/frank-sepulveda-st9ymbaqqg4-unsplash.jpg')"
        }}
      >
        <Link href="/" className="product-link product-link-left">moccet</Link>
        <div className="logo" role="img" aria-label="Sage logo">
          <div className="ellipse"></div>
          <div className="div"></div>
          <div className="ellipse-2"></div>
          <div className="ellipse-3"></div>
          <div className="ellipse-4"></div>
          <div className="ellipse-5"></div>
          <div className="ellipse-6"></div>
        </div>
        <Link href="/forge" className="product-link product-link-right">forge</Link>
        <header className="title-centered">
          <h1 className="sage-title">sage</h1>
        </header>
        <div className="content">
          <img
            className="your-personal"
            src="https://c.animaapp.com/ArhZSyxG/img/your-personal-nutrition-plan-@4x.png"
            alt="Your personal nutrition plan"
          />
          {!isSubmitted ? (
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
              />
              <button type="submit" className="button">
                <span className="text-wrapper-3">Get started</span>
              </button>
            </form>
          ) : (
            <div className="success-message">Welcome to sage</div>
          )}
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
                src="https://c.animaapp.com/ArhZSyxG/img/social-link-3-1.svg"
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
                src="https://c.animaapp.com/ArhZSyxG/img/social-link-2-1.svg"
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
          <img src="/images/1.png" alt="Nutrition plans illustration" />
        </div>

        <div className="content-container">
          <div className="content-block">
            <h2 className="section-title">Nutrition plans from metabolic state</h2>
            <p className="section-text">Generic meal plans fail because humans aren&apos;t generic.</p>
            <p className="section-text">Two people eat the same meal. Person A&apos;s glucose stays stable, they feel energized, recovery improves. Person B&apos;s glucose spikes, they crash 90 minutes later, inflammation markers tick up over time.</p>
            <p className="section-text">Same meal, different biology. Individual response depends on insulin sensitivity, gut microbiome composition, muscle mass, liver function, stress hormones, sleep quality, and activity patterns. All of these show up in data.</p>
            <p className="section-text"><strong>moccet</strong> built <strong>sage</strong> to solve this problem.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">How <strong>sage</strong> works</h2>
            <p className="section-text"><strong>sage</strong> generates nutrition plans from your metabolic data and behavioral patterns. Not macro calculators with corrections for activity level. Plans built from biomarkers, wearable patterns, microbiome analysis, and real-time behavior.</p>
            <p className="section-text">The system takes multiple data streams.</p>
          </div>

          <div className="content-block data-section">
            <h3 className="subsection-title">From blood work</h3>
            <ul className="data-list">
              <li className="section-text">Glucose regulation: fasting glucose, HbA1c, insulin, HOMA-IR if available</li>
              <li className="section-text">Lipid metabolism: full panel plus particle sizes if available</li>
              <li className="section-text">Liver function: AST, ALT, GGT</li>
              <li className="section-text">Kidney function: creatinine, BUN, GFR</li>
              <li className="section-text">Inflammatory status: CRP, ESR, cytokines if available</li>
              <li className="section-text">Hormone balance: thyroid, cortisol, sex hormones</li>
              <li className="section-text">Micronutrient status: vitamin D, B12, folate, iron, magnesium, zinc</li>
              <li className="section-text">Metabolic health markers: uric acid, homocysteine</li>
            </ul>
          </div>

          <div className="content-block data-section">
            <h3 className="subsection-title">From wearables and health tracking</h3>
            <ul className="data-list">
              <li className="section-text">Continuous glucose monitor data if you have it</li>
              <li className="section-text">Step counts and activity patterns</li>
              <li className="section-text">Sleep duration, timing, and quality scores</li>
              <li className="section-text">Heart rate patterns throughout the day</li>
              <li className="section-text">Meal timing from manual logs or connected apps</li>
            </ul>
          </div>

          <div className="content-block data-section">
            <h3 className="subsection-title">From microbiome analysis</h3>
            <ul className="data-list">
              <li className="section-text">Bacterial composition and diversity</li>
              <li className="section-text">Metabolic capacity: what your gut can break down</li>
              <li className="section-text">Inflammatory potential</li>
              <li className="section-text">Production of beneficial compounds like short-chain fatty acids</li>
            </ul>
          </div>

          <div className="content-block data-section">
            <h3 className="subsection-title">From genome data (optional)</h3>
            <ul className="data-list">
              <li className="section-text">Nutrient metabolism variants: MTHFR, vitamin D receptor, others</li>
              <li className="section-text">Caffeine metabolism</li>
              <li className="section-text">Lactose tolerance</li>
              <li className="section-text">Fat metabolism patterns</li>
            </ul>
          </div>

          <div className="content-block data-section">
            <h3 className="subsection-title">From connected apps</h3>
            <ul className="data-list">
              <li className="section-text">Calendar data showing meal timing patterns and stress periods</li>
              <li className="section-text">Email and work patterns affecting eating schedule</li>
              <li className="section-text">Notion or food tracking apps with meal history</li>
              <li className="section-text">Medical records including dietary restrictions and diagnoses</li>
            </ul>
          </div>

          <div className="content-block">
            <p className="section-text">You don&apos;t need everything to start. Give <strong>sage</strong> fasting glucose and activity data, you get a functional plan. Add microbiome analysis, CGM data, and sleep patterns, the plan becomes surgically precise. Connect your calendar and work patterns, <strong>sage</strong> adjusts meal timing and composition to match your actual schedule.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">What <strong>sage</strong> builds</h2>
            <p className="section-text">Complete meal plans with implementation strategies.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Daily meal structure</h3>
            <p className="section-text">Not just &quot;eat 3 meals&quot; but specific timing matched to your glucose patterns and lifestyle. If your CGM shows glucose spikes in the evening, meals shift more calories earlier. If you&apos;re most insulin sensitive post-workout, higher-carb meals land there. If your calendar shows early morning meetings, breakfast gets simpler and faster to prepare.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Macro targets by meal</h3>
            <p className="section-text">Protein, carbs, and fats adjusted for each meal based on when your body handles them best. Someone with morning glucose elevation might get higher protein and fat at breakfast, carbs pushed to later meals when insulin sensitivity improves.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Specific food lists</h3>
            <p className="section-text">Not &quot;eat vegetables&quot; but which vegetables based on microbiome capacity and nutrient needs. If your microbiome is weak at breaking down certain fibers, those foods get limited. If your iron is low and you have good B12, you get more heme iron sources paired with vitamin C.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Meal timing protocols</h3>
            <p className="section-text">When to eat based on activity, sleep, and metabolic patterns. If your cortisol is high and you wake with elevated glucose, you might delay breakfast. If you train in the morning and recover poorly, you get specific post-workout nutrition timing.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Supplement guidance</h3>
            <p className="section-text">Only when food can&apos;t cover it. If your vitamin D is low and you live in Seattle, you need supplementation. If your omega-3 index is low and you won&apos;t eat fish, you get dosing guidance based on your current levels.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">Real implementation</h2>
            <p className="section-text">We ran <strong>sage</strong> with 52 people over 16 weeks. Everyone got baseline labs, microbiome analysis, and connected wearables. 31 used CGMs for the first four weeks to establish glucose patterns.</p>
            <p className="section-text">One user had &quot;normal&quot; fasting glucose at 94 mg/dL but CGM showed significant postprandial spikes — hitting 160+ mg/dL after standard meals. Microbiome analysis revealed low bacterial diversity and poor fiber metabolism. <strong>sage</strong> built a plan with moderate carbs from sources this person&apos;s microbiome could handle, higher protein to blunt glucose response, meal timing to avoid compounding spikes. After 16 weeks: average glucose dropped from 102 mg/dL to 91 mg/dL, postprandial spikes under 130 mg/dL, HbA1c improved from 5.4% to 5.0%.</p>
            <p className="section-text">Another user had elevated triglycerides (186 mg/dL), low HDL (38 mg/dL), and high inflammatory markers. Microbiome showed overgrowth of inflammatory species. <strong>sage</strong> generated an anti-inflammatory protocol emphasizing polyphenols, omega-3s, and specific fibers to reshape microbiome. After 14 weeks: triglycerides dropped to 98 mg/dL, HDL increased to 52 mg/dL, CRP cut by 60%.</p>
            <p className="section-text">The pattern held. When nutrition matched metabolic capacity, biomarkers improved reliably. When nutrition fought biology, results stagnated regardless of dietary &quot;quality.&quot;</p>
          </div>
        </div>

        <div className="image-container">
          <img src="/images/2.png" alt="Architecture illustration" />
        </div>

        <div className="content-container">
          <div className="content-block">
            <h2 className="section-title">The architecture</h2>
            <p className="section-text"><strong>sage</strong> runs on four connected systems.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Metabolic interpreter</h3>
            <p className="section-text">Reads biomarkers to determine your current state. Not just whether values are &quot;normal&quot; but what they reveal about metabolic flexibility, insulin sensitivity, inflammatory status, and nutrient processing capacity.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Microbiome analyzer</h3>
            <p className="section-text">Maps bacterial composition to metabolic capacity. Different bacterial species process different compounds. Your gut&apos;s capacity to ferment certain fibers, produce beneficial metabolites, or generate inflammatory compounds shapes what foods help versus harm.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Pattern detector</h3>
            <p className="section-text">Analyzes wearable, CGM data, and connected apps to find glucose patterns, activity rhythms, sleep-food interactions, work stress impacts on eating. If your glucose crashes every afternoon at 3pm, sage sees it. If you sleep poorly after late carbs, it shows up. If your calendar shows you eat lunch at your desk during stressful meetings, meal plans adapt.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Protocol generator</h3>
            <p className="section-text">Combines all inputs to build meal plans. This system holds research on nutrient timing, macronutrient ratios for different metabolic states, anti-inflammatory nutrition protocols, and microbiome-supporting dietary patterns.</p>
            <p className="section-text">These systems communicate continuously. As your wearable data updates, <strong>sage</strong> can flag changes in real time. If your sleep deteriorates for a week, it might suggest adjusting evening carbs. If your step count drops, carb targets adjust downward. If your calendar shows upcoming travel, meal plans shift to include portable options.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">Medical evidence</h2>
            <p className="section-text">Every recommendation traces to research. When <strong>sage</strong> emphasizes protein at breakfast for someone with morning glucose elevation, that links to studies on protein&apos;s effect on postprandial glucose. When it recommends specific fibers for microbiome health, you see the evidence base.</p>
            <p className="section-text">We cite sources at the recommendation level. You&apos;re not following generic advice — you&apos;re implementing protocols shown to work for your specific metabolic state.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">Data flexibility</h2>
            <p className="section-text"><strong>sage</strong> scales to what you provide.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Basic data</h3>
            <p className="section-text">Metabolic panel plus activity tracking from your phone gets you a starter plan calibrated to glucose regulation and activity level. Useful but limited precision.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Standard data</h3>
            <p className="section-text">Full metabolic panel plus wearable with sleep and heart rate plus food logging generates plans matched to your current state and patterns. Most people start here.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Advanced data</h3>
            <p className="section-text">All biomarkers plus microbiome analysis plus CGM data plus genome creates fully individualized nutrition protocols. <strong>sage</strong> can distinguish between poor glucose control from timing versus composition versus microbiome issues — and target the right fix.</p>
          </div>

          <div className="content-block">
            <h3 className="subsection-title">Expert data</h3>
            <p className="section-text">Everything above plus continuous tracking over months plus connected apps showing real-world patterns. <strong>sage</strong> builds a model of how your body responds to different interventions and continuously refines recommendations. This is where the platform becomes truly predictive.</p>
            <p className="section-text">More data doesn&apos;t just add features. It changes decision quality. With full data, <strong>sage</strong> can see why something isn&apos;t working and adjust strategy, not just tactics.</p>
            <p className="section-text">If you don&apos;t have blood work or microbiome analysis, <strong>sage</strong> shows which tests to get. You can access these through your doctor or direct-to-consumer services. Upload whatever data you have — <strong>sage</strong> works with partial information and improves as you add more.</p>
          </div>

          <div className="content-block">
            <h2 className="section-title">Using <strong>sage</strong></h2>
            <p className="section-text">Go to <a href="https://moccet.ai/sage" target="_blank" rel="noopener noreferrer">moccet.ai/sage</a>. Upload labs, connect wearables and health apps like Apple Health and CGM apps. Upload microbiome test results if you have them. Connect calendar and productivity tools if you want <strong>sage</strong> to account for your real schedule. Answer questions about dietary preferences, cooking ability, time constraints, food access.</p>
            <p className="section-text">You get meal plans immediately. Plans can be updated as patterns emerge from your tracking data. If your glucose starts trending up, <strong>sage</strong> flags it and adjusts composition or timing. If your calendar shows a busy week ahead, meals get simpler without losing nutritional targets.</p>
            <p className="section-text"><strong>sage</strong> is free for the first users. If you find useful, feel free to share with your friends. Join the waitlist at <a href="https://moccet.ai" target="_blank" rel="noopener noreferrer">moccet.com</a> for the full platform that delivers daily insights across all aspects of health, not just nutrition.</p>
          </div>

        </div>
      </section>
    </main>
  );
}
