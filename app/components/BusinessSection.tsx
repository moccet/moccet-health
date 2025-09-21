'use client';

import { useState } from 'react';
import { businessArticles, type BusinessArticle } from '@/lib/business-articles';
import ResearchArticlePage from './ResearchArticlePage';

export default function BusinessSection() {
  const [selectedArticle, setSelectedArticle] = useState<BusinessArticle | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  const handleCardClick = (articleId: string) => {
    const article = businessArticles.find(a => a.id === articleId);
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

  const handleNavigateArticle = (article: BusinessArticle) => {
    const businessArticle = businessArticles.find(a => a.id === article.id);
    if (businessArticle) {
      setSelectedArticle(businessArticle);
    }
  };

  return (
    <>
      <section
        id="business"
        className={`min-h-screen flex items-center p-4 sm:p-6 lg:p-10 bg-gray-50 transition-opacity duration-300 ${
          fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-full">
          <div className="mb-5">
            <h2 className="text-base sm:text-lg font-normal text-black">moccet for healthcare business</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {businessArticles.map((card) => (
              <div
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="w-full h-[200px] relative">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2 text-black">{card.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{card.subtitle}</p>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{card.description}</p>
                  <div className="text-xs text-gray-500">{card.label}</div>
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
          allArticles={businessArticles}
          onClose={handleCloseArticle}
          onNavigate={handleNavigateArticle}
        />
      )}
    </>
  );
}