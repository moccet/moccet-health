'use client';

const news = [
  {
    date: 'Dec 15, 2024',
    title: 'moccet Achieves 98.5% Diagnostic Accuracy',
    description: 'Latest clinical trials show unprecedented accuracy in early disease detection.'
  },
  {
    date: 'Dec 10, 2024',
    title: 'Partnership with Mayo Clinic Announced',
    description: 'Strategic collaboration to deploy AI health monitoring across all facilities.'
  },
  {
    date: 'Dec 5, 2024',
    title: '$150M Series B Funding Round',
    description: 'Investment to accelerate global expansion and research initiatives.'
  }
];

export default function NewsSection() {
  return (
    <section id="news" className="min-h-screen flex items-center py-20 px-6">
      <div className="w-full">
        <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-12 text-center">Latest News</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {news.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <p className="text-sm text-gray-500 mb-2">{item.date}</p>
              <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
}