'use client';

import { useState } from 'react';
import { storiesArticles } from '@/lib/stories-articles';
import ResearchArticlePage from './ResearchArticlePage';

export default function StoriesSection() {
  const [selectedArticle, setSelectedArticle] = useState<typeof storiesArticles[0] | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  const handleStoryClick = (storyId: string) => {
    const article = storiesArticles.find(a => a.id === storyId);
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

  const handleNavigateArticle = (article: any) => {
    const storyArticle = storiesArticles.find(a => a.id === article.id);
    if (storyArticle) {
      setSelectedArticle(storyArticle);
    }
  };

  return (
    <>
      <section
        id="stories"
        className={`min-h-screen flex items-center p-4 sm:p-6 lg:p-10 py-8 lg:py-[60px] transition-opacity duration-300 ${
          fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-full">
          <div className="mb-5">
            <h2 className="text-base sm:text-lg font-normal text-black">Stories</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {storiesArticles.map((story) => (
              <div
                key={story.id}
                onClick={() => handleStoryClick(story.id)}
                className="cursor-pointer transition-all hover:opacity-80 hover:-translate-y-1"
              >
                <div className="w-full h-[180px] bg-gray-100 rounded-xl mb-3 overflow-hidden">
                  <img
                    src={story.image}
                    alt={story.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-base font-medium mb-2 text-black line-clamp-2">
                  {story.title}
                </h3>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{story.category}</span>
                  <span>•</span>
                  <span>{story.date}</span>
                  <span>•</span>
                  <span>{story.readTime}</span>
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
          allArticles={storiesArticles}
          onClose={handleCloseArticle}
          onNavigate={handleNavigateArticle}
        />
      )}
    </>
  );
}