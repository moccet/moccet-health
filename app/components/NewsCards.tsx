'use client';

import { useState } from 'react';
import { newsArticles, type NewsArticle } from '@/lib/news-articles';
import ResearchArticlePage from './ResearchArticlePage';

export default function NewsCards() {
  const [selectedArticle, setSelectedArticle] = useState<typeof newsArticles[0] | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  const handleArticleClick = (articleId: string) => {
    const article = newsArticles.find(a => a.id === articleId);
    if (article) {
      setFadeOut(true);
      setTimeout(() => {
        setSelectedArticle(article);
      }, 300);
    }
  };

  const handleCloseArticle = () => {
    setSelectedArticle(null);
    setFadeOut(false);
  };

  const handleNavigateArticle = (article: NewsArticle) => {
    const newsArticle = newsArticles.find(a => a.id === article.id);
    if (newsArticle) {
      setSelectedArticle(newsArticle);
    }
  };

  return (
    <>
      <section
        id="wellness"
        className={`min-h-screen flex items-center px-4 sm:px-6 lg:px-10 py-8 lg:py-[60px] pb-10 transition-opacity duration-300 ${
          fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-[18px] mb-5">
            {newsArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => handleArticleClick(article.id)}
                className="rounded-xl overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5 border border-gray-100"
              >
                <div className="w-full h-[200px] relative flex items-end p-5">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {article.overlayText && (
                    <span className="text-white text-sm font-medium drop-shadow whitespace-pre-line z-10">
                      {article.overlayText}
                    </span>
                  )}
                </div>
                <div className="px-5 py-[18px] bg-white">
                  <h3 className="text-base font-normal mb-2.5 text-black leading-snug">{article.title}</h3>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{article.category}</span>
                    <span>{article.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Article Modal */}
      {selectedArticle && (
        <ResearchArticlePage
          article={selectedArticle}
          allArticles={newsArticles}
          onClose={handleCloseArticle}
          onNavigate={handleNavigateArticle}
        />
      )}
    </>
  );
}