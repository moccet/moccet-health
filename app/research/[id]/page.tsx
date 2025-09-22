'use client';

import { useParams, useRouter } from 'next/navigation';
import { researchShowcaseArticles } from '@/lib/research-showcase-articles';
import styles from './article.module.css';

export default function ResearchArticle() {
  const params = useParams();
  const router = useRouter();
  const article = researchShowcaseArticles.find(a => a.id === params.id);

  if (!article) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Article not found</h1>
          <button onClick={() => router.push('/')} className={styles.backButton}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={() => router.push('/')} className={styles.backButton}>
          ← Back
        </button>
        <div className={styles.logo}>moccet</div>
      </header>

      <article className={styles.article}>
        <div className={styles.articleHeader}>
          <div className={styles.meta}>
            <span className={styles.category}>{article.category}</span>
            <span className={styles.date}>{article.date}</span>
            <span className={styles.readTime}>{article.readTime}</span>
          </div>
          <h1 className={styles.title}>{article.title}</h1>
        </div>

        <div className={styles.heroImage}>
          <img src={article.image} alt={article.title} />
        </div>

        <div className={styles.content}>
          {article.content.split('\n\n').map((paragraph, index) => {
            if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
              return (
                <p key={index} className={styles.highlight}>
                  {paragraph.replace(/\*\*/g, '')}
                </p>
              );
            }
            return <p key={index}>{paragraph}</p>;
          })}
        </div>

        <div className={styles.footer}>
          <button onClick={() => router.push('/')} className={styles.ctaButton}>
            Explore More Research
          </button>
        </div>
      </article>
    </div>
  );
}