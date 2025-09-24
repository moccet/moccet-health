'use client';

import styles from '../landing.module.css';

export default function BenefitsGrid() {
  const benefits = [
    "Find $10M+ in hidden operational inefficiencies",
    "Deploy world-class experts in your infrastructure",
    "Automate complex workflows without integration",
    "Discover insights your team hasn't thought to ask",
    "Cut operational costs by 40% in first quarter",
    "Scale expertise across unlimited departments",
    "Transform supply chain with zero downtime",
    "Execute strategic initiatives 10x faster",
    "Predict and prevent operational failures",
    "Optimize resource allocation in real-time",
    "Build competitive moats with AI-first operations",
    "Deploy Monday, see ROI by Friday"
  ];

  return (
    <section className={styles.benefitsSection}>
      <div className={styles.benefitsGrid}>
        {benefits.map((benefit, index) => (
          <div key={index} className="benefit-card-force-styles">
            <h3>{benefit}</h3>
            <span className="arrow-icon-force">↗</span>
          </div>
        ))}
      </div>
    </section>
  );
}