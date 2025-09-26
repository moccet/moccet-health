'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function BusinessPage() {
  const [activePage, setActivePage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set sidebar to open on desktop by default
  useEffect(() => {
    if (window.innerWidth > 1024) {
      setSidebarOpen(true);
    }
  }, []);

  // Also open sidebar when navigating to pricing or contact sections
  useEffect(() => {
    if ((activePage === 'pricing' || activePage === 'contact') && window.innerWidth > 1024) {
      setSidebarOpen(true);
    }
  }, [activePage]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const showPage = (page: string) => {
    console.log('showPage called with:', page);
    setActivePage(page);
    // Only close sidebar on mobile, keep it open on desktop
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-white font-system">
      {/* Global Header */}
      <Header
        onToggleSidebar={toggleSidebar}
        onContactSales={() => showPage('contact')}
        sidebarActive={sidebarOpen}
      />

      {/* Global Sidebar */}
      <Sidebar
        isActive={sidebarOpen}
        onNavigate={(href) => {
          if (href.startsWith('#')) {
            // Remove # and show that page
            const pageId = href.substring(1);
            console.log('Navigating to page:', pageId);
            showPage(pageId);
          }
        }}
        activePage={activePage}
      />

      {/* Main Content */}
      <main className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-[240px] ml-0' : 'ml-0'} pt-[60px]`}>
        <div className="max-w-7xl mx-auto px-4 py-8 md:px-8 lg:px-12 md:py-12 lg:py-16">
          {/* Business Overview Page */}
          {activePage === 'overview' && (
            <div>
              {/* Hero Section */}
              <div className="text-center mb-12 md:mb-16 lg:mb-20">
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-light leading-tight mb-4 md:mb-6 tracking-tight">
                  The next era of work is here
                </h1>
                <p className="text-lg md:text-xl text-gray-700 mb-8 md:mb-10 max-w-4xl mx-auto px-4">
                  Omnisight autonomously analyzes your data and delivers actionable insights without any prompting required.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <button
                    onClick={() => showPage('contact')}
                    className="bg-black text-white border-none px-6 py-3 rounded-full text-base cursor-pointer inline-flex items-center justify-center gap-1 hover:bg-gray-800 min-h-[44px] w-full sm:w-auto touch-manipulation"
                  >
                    Request early access →
                  </button>
                  <button
                    onClick={() => showPage('contact')}
                    className="bg-white text-black border border-gray-400 px-6 py-3 rounded-full text-base cursor-pointer hover:border-black min-h-[44px] w-full sm:w-auto touch-manipulation"
                  >
                    Contact sales
                  </button>
                </div>
              </div>

              {/* Product Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
                <div className="border border-gray-200 rounded-xl p-8">
                  <h2 className="text-2xl font-medium mb-4">moccet for Business</h2>
                  <p className="text-gray-700 mb-6 text-base">
                    Transform your operations with autonomous AI analysis.
                  </p>

                  <ul className="list-none mb-8">
                    <li className="py-2 pl-6 relative text-base text-gray-700">
                      <span className="absolute left-0">•</span>
                      Autonomous data analysis without prompting required
                    </li>
                    <li className="py-2 pl-6 relative text-base text-gray-700">
                      <span className="absolute left-0">•</span>
                      Discovers insights and provides solutions across all operations
                    </li>
                    <li className="py-2 pl-6 relative text-base text-gray-700">
                      <span className="absolute left-0">•</span>
                      Enterprise-grade security, admin controls, and compliance
                    </li>
                    <li className="py-2 pl-6 relative text-base text-gray-700">
                      <span className="absolute left-0">•</span>
                      Connects to your existing systems - SAP, Oracle, Salesforce, and 1000+ more
                    </li>
                  </ul>

                  <button
                    onClick={() => showPage('pricing')}
                    className="text-black no-underline text-base border-b border-transparent hover:border-black"
                  >
                    See pricing
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl p-8">
                  <h2 className="text-2xl font-medium mb-4">Platform Capabilities</h2>
                  <p className="text-gray-700 mb-6 text-base">
                    Build industry-specific solutions with our platform.
                  </p>

                  <ul className="list-none mb-8">
                    <li className="py-2 pl-6 relative text-base text-gray-700">
                      <span className="absolute left-0">•</span>
                      Pre-built solution library for immediate deployment
                    </li>
                    <li className="py-2 pl-6 relative text-base text-gray-700">
                      <span className="absolute left-0">•</span>
                      Industry-specific templates and workflows
                    </li>
                    <li className="py-2 pl-6 relative text-base text-gray-700">
                      <span className="absolute left-0">•</span>
                      Proprietary small models ensure data never leaves your server
                    </li>
                    <li className="py-2 pl-6 relative text-base text-gray-700">
                      <span className="absolute left-0">•</span>
                      Expert support and training programs included
                    </li>
                  </ul>

                  <div className="flex gap-4">
                    <button
                      onClick={() => showPage('contact')}
                      className="text-black no-underline text-base border-b border-transparent hover:border-black"
                    >
                      Start building
                    </button>
                    <button
                      onClick={() => showPage('contact')}
                      className="text-black no-underline text-base border-b border-transparent hover:border-black"
                    >
                      Contact sales →
                    </button>
                  </div>
                </div>
              </div>

              {/* Demo Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-12 md:mb-16 lg:mb-20">
                <div className="bg-gray-100 rounded-xl p-4 md:p-6 h-64 md:h-72 lg:h-80 flex flex-col justify-center items-center">
                  <div className="relative p-6 md:p-8 lg:p-10 rounded-lg w-full overflow-hidden">
                    <img src="/images/gradient4.jpg" alt="Business insights" className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    <div className="relative z-10 text-center mb-5 font-medium">Omnisight discovers:</div>
                    <div className="relative z-10 space-y-3">
                      <div className="bg-white rounded p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-yellow-400 rounded"></div>
                          <span className="text-sm">$2.4M in shipping inefficiencies</span>
                        </div>
                      </div>
                      <div className="bg-white rounded p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-400 rounded"></div>
                          <span className="text-sm">18% inventory optimization opportunity</span>
                        </div>
                      </div>
                      <div className="bg-white rounded p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-purple-400 rounded"></div>
                          <span className="text-sm">340 hours of process redundancy</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-100 rounded-xl p-4 md:p-6 h-64 md:h-72 lg:h-80 flex flex-col justify-center items-center">
                  <div className="relative p-6 md:p-8 lg:p-10 rounded-lg w-full overflow-hidden">
                    <img src="/images/wave1.jpg" alt="Analysis dashboard" className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    <div className="relative z-10 text-center mb-5 font-medium">Autonomous Analysis Dashboard</div>
                    <div className="relative z-10 bg-white rounded-lg p-5">
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="bg-gray-100 h-10 rounded"></div>
                        <div className="bg-gray-100 h-10 rounded"></div>
                        <div className="bg-gray-100 h-10 rounded"></div>
                      </div>
                      <div className="bg-gray-100 h-24 rounded mb-2"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-100 h-16 rounded"></div>
                        <div className="bg-gray-100 h-16 rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logos Section */}
              <div className="text-center py-8 md:py-12 lg:py-16 border-t border-b border-gray-200 mb-12 md:mb-16 lg:mb-20">
                <div className="flex justify-center items-center gap-4 md:gap-8 lg:gap-16 flex-wrap mt-6 md:mt-8 lg:mt-10">
                  <div className="text-xl font-semibold text-black opacity-70">BCG</div>
                  <div className="text-xl font-semibold text-black opacity-70">ESTÉE LAUDER</div>
                  <div className="text-xl font-semibold text-black opacity-70">moderna</div>
                  <div className="text-xl font-semibold text-black opacity-70">AMGEN</div>
                  <div className="text-xl font-semibold text-black opacity-70">BAIN & COMPANY</div>
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl lg:text-4xl text-center mb-6 md:mb-8 lg:mb-10">The AI platform behind thousands of companies</h2>

              {/* Customer Stories */}
              <div className="mb-12 md:mb-16 lg:mb-20">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="rounded-xl overflow-hidden cursor-pointer">
                    <img src="/images/painting4.jpg" alt="Business case study" className="w-full h-52 object-cover" />
                    <div className="p-4">
                      <h3 className="text-base font-medium mb-2">Discovering hidden operational value</h3>
                      <div className="text-sm text-gray-600">
                        <span>Enterprise</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden cursor-pointer">
                    <img src="/images/painting2.jpg" alt="Operations transformation" className="w-full h-52 object-cover" />
                    <div className="p-4">
                      <h3 className="text-base font-medium mb-2">From reactive to predictive operations</h3>
                      <div className="text-sm text-gray-600">
                        <span>Manufacturing</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden cursor-pointer">
                    <img src="/images/wave3.jpg" alt="Predictive analytics" className="w-full h-52 object-cover" />
                    <div className="p-4">
                      <h3 className="text-base font-medium mb-2">Optimizing supply chain autonomously</h3>
                      <div className="text-sm text-gray-600">
                        <span>Retail</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden cursor-pointer">
                    <img src="/images/wave4.jpg" alt="Process optimization" className="w-full h-52 object-cover" />
                    <div className="p-4">
                      <h3 className="text-base font-medium mb-2">Data-driven decision making</h3>
                      <div className="text-sm text-gray-600">
                        <span>Financial Services</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enable Workforce Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-12 md:mb-16 lg:mb-24">
                <div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-light mb-4 md:mb-6 leading-tight">
                    Enable your workforce with autonomous intelligence
                  </h2>
                  <ul className="list-none">
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Omnisight autonomously studies data, analyzes insights, and provides solutions without prompting
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Connects to all your data sources—SAP, Oracle, Salesforce, and 1000+ integrations
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Proprietary small models ensure unique insights with no data leaving your server
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Pre-built solution library for immediate deployment across industries
                    </li>
                  </ul>
                  <div className="mt-8">
                    <button
                      onClick={() => showPage('contact')}
                      className="text-black no-underline border-b border-transparent hover:border-black block mb-2"
                    >
                      Request early access →
                    </button>
                    <button
                      onClick={() => showPage('pricing')}
                      className="text-black no-underline border-b border-transparent hover:border-black"
                    >
                      View pricing options →
                    </button>
                  </div>
                </div>
                <img src="/images/big feature.jpg" alt="Platform features" className="w-full h-96 object-cover rounded-xl" />
              </div>

              {/* Build AI-native Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-12 md:mb-16 lg:mb-24">
                <img src="/images/sky-painting5.jpg" alt="Enterprise solutions" className="w-full h-96 object-cover rounded-xl" />
                <div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-light mb-4 md:mb-6 leading-tight">
                    Build industry-specific solutions with autonomous AI
                  </h2>
                  <ul className="list-none">
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      No prompting required—Omnisight automatically discovers patterns and opportunities
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Industry-specific solutions with robust library of pre-built templates
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Expert support and training programs for rapid deployment
                    </li>
                  </ul>
                  <div className="mt-8">
                    <button
                      onClick={() => showPage('solutions')}
                      className="text-black no-underline border-b border-transparent hover:border-black"
                    >
                      Explore solutions →
                    </button>
                  </div>
                </div>
              </div>

              {/* Security Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-12 md:mb-16 lg:mb-24">
                <div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-light mb-4 md:mb-6 leading-tight">
                    Enterprise-grade data privacy, security, and admin controls
                  </h2>
                  <ul className="list-none">
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      No customer data or metadata in training pipeline
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Data encryption at rest and in transit
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Custom data retention window and zero data retention options
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      Single Sign-On (SSO) with domain verification
                    </li>
                    <li className="py-3 text-base text-gray-700 pl-6 relative">
                      <span className="absolute left-0">•</span>
                      CCPA, CSA STAR, and SOC 2 Type 2 compliance, HIPAA support, and BAAs
                    </li>
                  </ul>
                  <div className="mt-8">
                    <a href="#" className="text-black no-underline border-b border-transparent hover:border-black">
                      View enterprise privacy →
                    </a>
                  </div>
                </div>
                <img src="/images/Enterprise-Healthcare.jpg" alt="Healthcare solutions" className="w-full h-96 object-cover rounded-xl" />
              </div>

              {/* Resources Section */}
              <div className="text-center py-8 md:py-12 lg:py-16">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-light mb-8 md:mb-10 lg:mb-12 leading-tight">
                  Guides and resources for<br />integrating AI into your business
                </h2>
                <button className="bg-white text-black border border-gray-400 px-5 py-3 rounded-full text-base cursor-pointer hover:border-black">
                  Learn more
                </button>
              </div>

              {/* Explore More Section */}
              <div className="mt-12 md:mt-16 lg:mt-20">
                <h2 className="text-2xl md:text-3xl font-light mb-6 md:mb-8 lg:mb-10">Explore more</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="cursor-pointer">
                    <img src="/images/research-neural.jpg" alt="Solution demo" className="w-full h-44 object-cover rounded-lg mb-4" />
                    <h3 className="text-base font-medium mb-2">New in moccet for Business: April 2025</h3>
                    <div className="flex gap-3 text-sm text-gray-600">
                      <span>Webinar</span>
                      <span>Apr 24, 2025</span>
                    </div>
                  </div>
                  <div className="cursor-pointer">
                    <img src="/images/research-hrm.jpg" alt="Solution implementation" className="w-full h-44 object-cover rounded-lg mb-4" />
                    <h3 className="text-base font-medium mb-2">Introducing data residency in Europe</h3>
                    <div className="flex gap-3 text-sm text-gray-600">
                      <span>Product</span>
                      <span>Feb 5, 2025</span>
                    </div>
                  </div>
                  <div className="cursor-pointer">
                    <img src="/images/pricing-research.jpg" alt="Solution deployment" className="w-full h-44 object-cover rounded-lg mb-4" />
                    <h3 className="text-base font-medium mb-2">Enabling a Data-Driven Workforce</h3>
                    <div className="flex gap-3 text-sm text-gray-600">
                      <span>Webinar</span>
                      <span>Aug 8, 2024</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Page */}
          {activePage === 'pricing' && (
            <div className="py-8 px-4 md:py-12 lg:py-16 md:px-8 lg:px-12">
              {/* Hero Section */}
              <div className="text-center mb-12 md:mb-16 lg:mb-20">
                <div className="text-sm text-gray-600 mb-4 md:mb-6">moccet</div>
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-normal mb-4 md:mb-6 tracking-tight">Pricing</h1>
                <p className="text-base md:text-lg text-gray-700 px-4">See pricing for our pilot, enterprise, and research plans.</p>
              </div>

              {/* Main Pricing Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6 mb-10 md:mb-16 w-full max-w-sm sm:max-w-none mx-auto">
                {/* Research/Free Tier */}
                <div className="border border-gray-200 rounded-xl p-4 md:p-6 lg:p-8 bg-white w-[90%] sm:w-full mx-auto sm:mx-0">
                  <h2 className="text-xl md:text-2xl font-medium mb-2 md:mb-3">Research</h2>
                  <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 min-h-[40px] md:min-h-[48px]">
                    Explore how AI can transform your research with full platform access
                  </p>

                  <div className="mb-6 md:mb-8">
                    <span className="text-4xl md:text-5xl font-normal">$0</span>
                    <span className="text-sm md:text-base text-gray-600 ml-1">/ month</span>
                  </div>

                  <button
                    onClick={() => showPage('contact')}
                    className="w-full py-2.5 md:py-3 px-4 md:px-6 mb-4 md:mb-6 bg-white text-black border border-gray-300 rounded-3xl font-medium hover:bg-gray-50 transition-colors min-h-[44px] touch-manipulation text-sm md:text-base"
                  >
                    Apply →
                  </button>

                  <ul className="list-none space-y-1.5 md:space-y-2">
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Full access to Omnisight platform for academic use</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Autonomous data analysis without prompting</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Research license and documentation</span>
                    </li>
                  </ul>
                </div>

                {/* Pilot Tier */}
                <div className="border border-gray-200 rounded-xl p-4 md:p-6 lg:p-8 bg-white w-[90%] sm:w-full mx-auto sm:mx-0">
                  <h2 className="text-xl md:text-2xl font-medium mb-2 md:mb-3">Pilot</h2>
                  <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 min-h-[40px] md:min-h-[48px]">
                    Prove value with a 30-day deployment across your organization
                  </p>

                  <div className="mb-6 md:mb-8">
                    <span className="text-4xl md:text-5xl font-normal">$100K</span>
                    <span className="text-sm md:text-base text-gray-600 ml-1">/ pilot</span>
                  </div>

                  <button
                    onClick={() => showPage('contact')}
                    className="w-full py-2.5 md:py-3 px-4 md:px-6 mb-4 md:mb-6 bg-black text-white rounded-3xl font-medium hover:bg-gray-800 transition-colors min-h-[44px] touch-manipulation text-sm md:text-base"
                  >
                    Request early access →
                  </button>

                  <div className="text-xs md:text-sm font-semibold text-black mb-2 md:mb-3">
                    Everything in Research and:
                  </div>

                  <ul className="list-none space-y-1.5 md:space-y-2">
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Full deployment across 5 data sources</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Weekly consultations with expert operators</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>ROI analysis and impact reporting</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Money-back guarantee if ROI targets not met</span>
                    </li>
                  </ul>
                </div>

                {/* Enterprise Tier */}
                <div className="border border-gray-200 rounded-xl p-4 md:p-6 lg:p-8 bg-white w-[90%] sm:w-full mx-auto sm:mx-0">
                  <h2 className="text-xl md:text-2xl font-medium mb-2 md:mb-3">Enterprise</h2>
                  <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 min-h-[40px] md:min-h-[48px]">
                    Scale AI across your entire organization with dedicated support
                  </p>

                  <div className="mb-6 md:mb-8">
                    <span className="text-4xl md:text-5xl font-normal">Custom</span>
                  </div>

                  <button
                    onClick={() => showPage('contact')}
                    className="w-full py-2.5 md:py-3 px-4 md:px-6 mb-4 md:mb-6 bg-black text-white rounded-3xl font-medium hover:bg-gray-800 transition-colors min-h-[44px] touch-manipulation text-sm md:text-base"
                  >
                    Contact sales →
                  </button>

                  <div className="text-xs md:text-sm font-semibold text-black mb-2 md:mb-3">
                    Everything in Pilot and:
                  </div>

                  <ul className="list-none space-y-1.5 md:space-y-2">
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Unlimited data sources and integrations</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Dedicated team of expert operators</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Custom model training for your industry</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>24/7 priority support with SLAs</span>
                    </li>
                    <li className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm py-1 md:py-0">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Air-gapped deployment options</span>
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          )}

          {/* Contact Page */}
          {activePage === 'contact' && (
            <div>
              <div className="max-w-2xl mx-auto text-center">
                <h1 className="text-5xl mb-6">Get in touch with our sales team</h1>
                <p className="text-lg text-gray-600 mb-12">
                  Learn how moccet Omnisight can transform your organization with AI that doesn&apos;t require prompting.
                </p>

                <form className="text-left">
                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium">Name *</label>
                    <input
                      type="text"
                      className="w-full p-2.5 border border-gray-400 rounded-md"
                      required
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium">Email *</label>
                    <input
                      type="email"
                      className="w-full p-2.5 border border-gray-400 rounded-md"
                      required
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium">Company *</label>
                    <input
                      type="text"
                      className="w-full p-2.5 border border-gray-400 rounded-md"
                      required
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium">Company Size *</label>
                    <select
                      className="w-full p-2.5 border border-gray-400 rounded-md"
                      required
                    >
                      <option>1-50 employees</option>
                      <option>51-200 employees</option>
                      <option>201-1000 employees</option>
                      <option>1000+ employees</option>
                    </select>
                  </div>

                  <div className="mb-6 md:mb-8">
                    <label className="block mb-2 text-sm font-medium">How can we help?</label>
                    <textarea
                      className="w-full p-2.5 border border-gray-400 rounded-md min-h-32"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-black text-white border-none rounded-3xl text-base cursor-pointer hover:bg-gray-800"
                  >
                    Submit
                  </button>
                </form>

                <p className="mt-12 text-sm text-gray-600">
                  Or call us at +1 (707) 400-5566
                </p>
              </div>
            </div>
          )}

          {/* Other placeholder pages */}
          {activePage === 'startup' && (
            <div>
              <h1 className="text-5xl mb-6">moccet for Startups</h1>
              <p className="text-lg text-gray-600">
                Special pricing and support for early-stage companies. Build with the most advanced AI platform from day one.
              </p>
            </div>
          )}

          {activePage === 'solutions' && (
            <div>
              <h1 className="text-5xl mb-6">Solutions</h1>
              <p className="text-lg text-gray-600">
                Industry-specific solutions powered by moccet Omnisight. Pre-built templates and workflows for immediate value.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}