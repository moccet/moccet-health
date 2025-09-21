'use client';

import { useState } from 'react';
import { researchArticles } from '@/lib/research-articles';
import ResearchArticlePage from './ResearchArticlePage';

export default function ResearchSection() {
  const [selectedArticle, setSelectedArticle] = useState<typeof researchArticles[0] | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  // Take first 4 articles for the grid display
  const displayArticles = researchArticles.slice(0, 4);

  const handleArticleClick = (article: typeof researchArticles[0]) => {
    setFadeOut(true);
    setTimeout(() => {
      setSelectedArticle(article);
    }, 300);
  };

  const handleCloseArticle = () => {
    setSelectedArticle(null);
    setFadeOut(false);
  };

  const handleNavigateArticle = (article: typeof researchArticles[0]) => {
    setSelectedArticle(article);
  };

  return (
    <>
      <section
        id="research"
        className={`min-h-screen flex items-center p-4 sm:p-6 lg:p-10 transition-opacity duration-300 ${
          fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-full">
          <div className="mb-5">
            <h2 className="text-base sm:text-lg font-normal text-black">Latest research</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {displayArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => handleArticleClick(article)}
                className="flex flex-col sm:flex-row gap-4 cursor-pointer transition-all hover:opacity-80 hover:-translate-y-1"
              >
                <div className="w-full sm:w-[200px] h-[150px] bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-medium mb-2 text-black line-clamp-2">
                    {article.title}
                  </h3>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{article.category}</span>
                    <span>{article.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Show more button */}
          <div className="mt-8 text-center">
            <button
              onClick={() => handleArticleClick(researchArticles[0])}
              className="inline-block px-6 py-3 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Read All Research
            </button>
          </div>
        </div>
      </section>

      {/* Article Modal */}
      {selectedArticle && (
        <ResearchArticlePage
          article={selectedArticle}
          allArticles={researchArticles}
          onClose={handleCloseArticle}
          onNavigate={handleNavigateArticle}
        />
      )}
    </>
  );
}