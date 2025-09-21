'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ArticleType {
  id: string;
  title: string;
  content: string;
  date: string;
  readTime: string;
  image: string;
  category?: string;
  subtitle?: string;
  description?: string;
  label?: string;
  overlayText?: string;
}

interface ResearchArticlePageProps<T extends ArticleType> {
  article: T;
  allArticles: T[];
  onClose: () => void;
  onNavigate: (article: T) => void;
}

export default function ResearchArticlePage<T extends ArticleType>({
  article,
  allArticles,
  onClose,
  onNavigate
}: ResearchArticlePageProps<T>) {
  const [fadeOut, setFadeOut] = useState(false);
  const currentIndex = allArticles.findIndex(a => a.id === article.id);
  const hasNext = currentIndex < allArticles.length - 1;
  const hasPrev = currentIndex > 0;

  const handleNavigate = (direction: 'next' | 'prev') => {
    setFadeOut(true);
    setTimeout(() => {
      const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      onNavigate(allArticles[newIndex]);
      setFadeOut(false);
    }, 300);
  };

  useEffect(() => {
    // Lock body scroll when article is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Format content with proper paragraph breaks and styling
  const formatContent = (content: string) => {
    return content.split('\n\n').map((paragraph, index) => {
      // Check if it's a formula line
      if (paragraph.includes('=') && (paragraph.includes('O(') || paragraph.includes('·'))) {
        return (
          <div key={index} className="my-6 p-4 bg-gray-50 rounded-lg font-mono text-sm">
            {paragraph}
          </div>
        );
      }
      // Check if it's the moccet labs CTA (bold text)
      if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
        return (
          <div key={index} className="mt-8 p-6 bg-black text-white rounded-2xl">
            <p className="font-semibold">
              {paragraph.replace(/\*\*/g, '')}
            </p>
          </div>
        );
      }
      return (
        <p key={index} className="text-gray-700 leading-relaxed mb-4">
          {paragraph}
        </p>
      );
    });
  };

  return (
    <div className={`fixed inset-0 bg-white z-[100] transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100 animate-fadeIn'}`}>
      <div className="h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close article"
                >
                  <X size={24} className="text-gray-600" />
                </button>
                <div>
                  <p className="text-sm text-gray-500">{article.category} • {article.readTime}</p>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => hasPrev && handleNavigate('prev')}
                  disabled={!hasPrev}
                  className={`p-2 rounded-full transition-colors ${
                    hasPrev ? 'hover:bg-gray-100' : 'opacity-30 cursor-not-allowed'
                  }`}
                  aria-label="Previous article"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-500 px-2">
                  {currentIndex + 1} / {allArticles.length}
                </span>
                <button
                  onClick={() => hasNext && handleNavigate('next')}
                  disabled={!hasNext}
                  className={`p-2 rounded-full transition-colors ${
                    hasNext ? 'hover:bg-gray-100' : 'opacity-30 cursor-not-allowed'
                  }`}
                  aria-label="Next article"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Article Content */}
        <article className="max-w-4xl mx-auto px-6 py-12">
          <header className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
              {article.title}
            </h1>
            <p className="text-gray-500">
              {article.date}
            </p>
          </header>

          <div className="prose prose-lg max-w-none">
            {formatContent(article.content)}
          </div>

          {/* Bottom Navigation */}
          <div className="mt-16 pt-8 border-t border-gray-200">
            <div className="flex justify-between items-center">
              {hasPrev ? (
                <button
                  onClick={() => handleNavigate('prev')}
                  className="group flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
                >
                  <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  <div className="text-left">
                    <p className="text-sm text-gray-500">Previous</p>
                    <p className="font-medium">{allArticles[currentIndex - 1].title}</p>
                  </div>
                </button>
              ) : (
                <div />
              )}

              {hasNext ? (
                <button
                  onClick={() => handleNavigate('next')}
                  className="group flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
                >
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Next</p>
                    <p className="font-medium">{allArticles[currentIndex + 1].title}</p>
                  </div>
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}