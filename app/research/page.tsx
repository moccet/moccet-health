'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

interface ResearchItem {
  id: string;
  title: string;
  type: 'Publication' | 'Release' | 'Conclusion' | 'Milestone';
  date: string;
  description: string;
}

export default function ResearchPage() {
  const [selectedTab, setSelectedTab] = useState('All');
  const [sidebarActive, setSidebarActive] = useState(false);

  // Set sidebar to open on desktop by default
  useEffect(() => {
    if (window.innerWidth > 1024) {
      setSidebarActive(true);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const handleContactSales = () => {
    // Handle contact sales action
    console.log('Contact Sales clicked');
  };

  const researchItems: ResearchItem[] = [
    {
      id: 'detecting-preventing-disease-progression',
      title: 'Detecting and preventing disease progression in early access pilots',
      type: 'Publication',
      date: 'Sep 17, 2025',
      description: 'moccet Research and select healthcare partners in our private pilot program developed evaluation frameworks for early disease detection ("pre-symptomatic identification") and found behaviors consistent with predictive modeling in controlled tests across frontier models. The team demonstrates how autonomous monitoring in pilot deployments can identify health risks months before traditional screening methods.'
    },
    {
      id: 'nexus-enterprise-upgrades',
      title: 'Introducing upgrades to Nexus for enterprise pilot partners',
      type: 'Release',
      date: 'Sep 15, 2025',
      description: 'Nexus just got faster, more reliable, and better at real-time business intelligence for our select enterprise pilot partners—whether via the terminal, IDE, web, or even your phone. Currently available exclusively to waitlist-approved organizations.'
    },
    {
      id: 'healthhub-early-access-partners',
      title: 'How early access partners are using HealthHub',
      type: 'Publication',
      date: 'Sep 15, 2025',
      description: 'New research from our private pilot program shows how select healthcare organizations create clinical value through both diagnostic assistance and operational efficiency. Adoption is expanding within our waitlist-approved institutions, revolutionizing patient care in controlled deployments.'
    },
    {
      id: 'moccet-h5-codex-addendum',
      title: 'Addendum to moccet-h5 system card: moccet-h5-Codex for pilot partners',
      type: 'Publication',
      date: 'Sep 15, 2025',
      description: 'This addendum to the moccet-h5 system card on the further optimized variant moccet-h5-Codex, a version of moccet-h5 further optimized for clinical diagnostic tasks, reflects its enhanced medical reasoning capabilities. Currently in testing with select pilot institutions.'
    },
    {
      id: 'introducing-moccet-h5',
      title: 'Introducing moccet-h5 to select pilot partners',
      type: 'Release',
      date: 'Aug 7, 2025',
      description: 'We are introducing moccet-h5 to our waitlist-approved partners, our best AI system yet. moccet-h5 is a significant leap in intelligence over all our previous models, featuring state-of-the-art performance across healthcare, finance, and operations. Currently in private pilot phase with select organizations.'
    },
    {
      id: 'pilot-value-creation-milestone',
      title: '$500M in value created during private pilot phase',
      type: 'Milestone',
      date: 'Jul 28, 2025',
      description: 'A landmark achievement: our pilot partners have collectively generated over $500 million in value through cost savings, efficiency gains, and improved patient outcomes during the private pilot phase. This validates our approach as we prepare for broader waitlist access.'
    },
    {
      id: 'financial-fraud-detection-pilots',
      title: 'Financial fraud detection in pilot deployments',
      type: 'Publication',
      date: 'Jul 15, 2025',
      description: 'Research from our private pilot program shows how moccet AI prevents financial fraud with 94% accuracy while reducing false positives by 67% compared to traditional methods. Currently being tested with select financial institution partners.'
    },
    {
      id: 'autonomous-supply-chain-optimization',
      title: 'Autonomous supply chain optimization: Results from early pilots',
      type: 'Publication',
      date: 'Jun 25, 2025',
      description: 'Discover how our specialized AI model, moccet-4b logistics, helped pilot manufacturing partners reduce costs by 34% and improve delivery times through predictive routing. Full deployment pending waitlist approval.'
    }
  ];

  const tabs = ['All', 'Publication', 'Conclusion', 'Milestone', 'Release'];

  const filteredItems = selectedTab === 'All'
    ? researchItems
    : researchItems.filter(item => item.type === selectedTab);

  return (
    <div className="min-h-screen bg-white">
      {/* Global Header */}
      <Header onToggleSidebar={toggleSidebar} onContactSales={handleContactSales} />

      {/* Global Sidebar */}
      <Sidebar isActive={sidebarActive} />

      {/* Main content with global sidebar layout */}
      <main className={`transition-all duration-200 ${sidebarActive ? 'ml-[240px]' : 'ml-0'} pt-[60px]`}>
        <div className="px-8">
          {/* Main content */}
          <div className="py-10">
            <h1 className="text-6xl font-light mb-10 tracking-tight">Research</h1>

            {/* Filter section */}
            <div className="mb-8">
              <div className="flex justify-between items-start pb-3 border-b border-gray-200 relative">
                <div className="flex gap-8">
                  {tabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      className={`text-base pb-3 relative ${
                        selectedTab === tab
                          ? 'text-black'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 items-center">
                  <button className="bg-white border border-gray-300 px-2.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                    Filter ⚙
                  </button>
                  <button className="bg-white border border-gray-300 px-2.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                    Sort ↓
                  </button>
                  <button className="bg-white border border-gray-300 px-2.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-50">
                    ☰
                  </button>
                  <button className="bg-white border border-gray-300 px-2.5 py-1 rounded text-xs text-gray-600 hover:bg-gray-50">
                    ⋮
                  </button>
                </div>
              </div>
            </div>

            {/* Research items */}
            <div className="flex flex-col">
              {filteredItems.map(item => (
                <Link key={item.id} href={`/research/${item.id}`} className="py-6 border-b border-gray-200 cursor-pointer hover:opacity-70">
                  <div className="flex gap-4 mb-3 text-xs text-gray-400">
                    <span className="text-gray-600">{item.type}</span>
                  </div>
                  <div className="flex gap-4 mb-3 text-xs text-gray-400">
                    <span>{item.date}</span>
                  </div>
                  <h2 className="text-xl font-medium mb-2 leading-tight text-black">{item.title}</h2>
                  <p className="text-gray-600 leading-relaxed text-sm">{item.description}</p>
                </Link>
              ))}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}