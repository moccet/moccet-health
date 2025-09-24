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
      <main className={`transition-all duration-200 ${sidebarOpen ? 'ml-[240px]' : 'ml-0'} pt-[60px]`}>
        <div className="max-w-7xl mx-auto px-12 py-16">
          {/* Business Overview Page */}
          {activePage === 'overview' && (
            <div>
              {/* Hero Section */}
              <div className="text-center mb-20">
                <h1 className="text-6xl font-light leading-tight mb-6 tracking-tight">
                  The next era of work is here
                </h1>
                <p className="text-xl text-gray-700 mb-10 max-w-4xl mx-auto">
                  Omnisight autonomously analyzes your data and delivers actionable insights without any prompting required.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => showPage('contact')}
                    className="bg-black text-white border-none px-5 py-3 rounded-full text-base cursor-pointer inline-flex items-center gap-1 hover:bg-gray-800"
                  >
                    Request early access →
                  </button>
                  <button
                    onClick={() => showPage('contact')}
                    className="bg-white text-black border border-gray-400 px-5 py-3 rounded-full text-base cursor-pointer hover:border-black"
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
                <div className="bg-gray-100 rounded-xl p-6 h-80 flex flex-col justify-center items-center">
                  <div className="bg-gradient-to-br from-green-200 to-green-300 p-10 rounded-lg w-full">
                    <div className="text-center mb-5 font-medium">Omnisight discovers:</div>
                    <div className="space-y-3">
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

                <div className="bg-gray-100 rounded-xl p-6 h-80 flex flex-col justify-center items-center">
                  <div className="bg-gradient-to-br from-blue-200 to-blue-300 p-10 rounded-lg w-full">
                    <div className="text-center mb-5 font-medium">Autonomous Analysis Dashboard</div>
                    <div className="bg-white rounded-lg p-5">
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
              <div className="text-center py-16 border-t border-b border-gray-200 mb-20">
                <div className="flex justify-center items-center gap-16 flex-wrap mt-10">
                  <div className="text-xl font-semibold text-black opacity-70">BCG</div>
                  <div className="text-xl font-semibold text-black opacity-70">ESTÉE LAUDER</div>
                  <div className="text-xl font-semibold text-black opacity-70">moderna</div>
                  <div className="text-xl font-semibold text-black opacity-70">AMGEN</div>
                  <div className="text-xl font-semibold text-black opacity-70">BAIN & COMPANY</div>
                </div>
              </div>

              <h2 className="text-4xl text-center mb-10">The AI platform behind thousands of companies</h2>

              {/* Customer Stories */}
              <div className="mb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="rounded-xl overflow-hidden cursor-pointer">
                    <div className="w-full h-52 bg-gradient-to-br from-yellow-200 to-yellow-400"></div>
                    <div className="p-4">
                      <h3 className="text-base font-medium mb-2">Discovering hidden operational value</h3>
                      <div className="text-sm text-gray-600">
                        <span>Enterprise</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden cursor-pointer">
                    <div className="w-full h-52 bg-gradient-to-br from-gray-500 to-gray-600"></div>
                    <div className="p-4">
                      <h3 className="text-base font-medium mb-2">From reactive to predictive operations</h3>
                      <div className="text-sm text-gray-600">
                        <span>Manufacturing</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden cursor-pointer">
                    <div className="w-full h-52 bg-gradient-to-br from-green-300 to-green-400"></div>
                    <div className="p-4">
                      <h3 className="text-base font-medium mb-2">Optimizing supply chain autonomously</h3>
                      <div className="text-sm text-gray-600">
                        <span>Retail</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden cursor-pointer">
                    <div className="w-full h-52 bg-gradient-to-br from-red-300 to-red-400"></div>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
                <div>
                  <h2 className="text-4xl font-light mb-6 leading-tight">
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
                <div className="bg-gradient-to-br from-blue-200 to-blue-400 rounded-xl h-96"></div>
              </div>

              {/* Build AI-native Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
                <div className="bg-gradient-to-br from-green-300 to-green-400 rounded-xl h-96"></div>
                <div>
                  <h2 className="text-4xl font-light mb-6 leading-tight">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
                <div>
                  <h2 className="text-4xl font-light mb-6 leading-tight">
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
                <div className="bg-gradient-to-br from-indigo-200 to-indigo-300 rounded-xl h-96"></div>
              </div>

              {/* Resources Section */}
              <div className="text-center py-16">
                <h2 className="text-5xl font-light mb-12 leading-tight">
                  Guides and resources for<br />integrating AI into your business
                </h2>
                <button className="bg-white text-black border border-gray-400 px-5 py-3 rounded-full text-base cursor-pointer hover:border-black">
                  Learn more
                </button>
              </div>

              {/* Explore More Section */}
              <div className="mt-20">
                <h2 className="text-3xl font-light mb-10">Explore more</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="cursor-pointer">
                    <div className="w-full h-44 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg mb-4"></div>
                    <h3 className="text-base font-medium mb-2">New in moccet for Business: April 2025</h3>
                    <div className="flex gap-3 text-sm text-gray-600">
                      <span>Webinar</span>
                      <span>Apr 24, 2025</span>
                    </div>
                  </div>
                  <div className="cursor-pointer">
                    <div className="w-full h-44 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg mb-4"></div>
                    <h3 className="text-base font-medium mb-2">New in moccet for Business: March 2025</h3>
                    <div className="flex gap-3 text-sm text-gray-600">
                      <span>Webinar</span>
                      <span>Mar 18, 2025</span>
                    </div>
                  </div>
                  <div className="cursor-pointer">
                    <div className="w-full h-44 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg mb-4"></div>
                    <h3 className="text-base font-medium mb-2">Introducing data residency in Europe</h3>
                    <div className="flex gap-3 text-sm text-gray-600">
                      <span>Product</span>
                      <span>Feb 5, 2025</span>
                    </div>
                  </div>
                  <div className="cursor-pointer">
                    <div className="w-full h-44 bg-gradient-to-br from-blue-300 to-blue-400 rounded-lg mb-4"></div>
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
            <div className="py-16 px-12">
              {/* Hero Section */}
              <div className="text-center mb-20">
                <div className="text-sm text-gray-600 mb-6">moccet</div>
                <h1 className="text-6xl font-normal mb-6 tracking-tight">Pricing</h1>
                <p className="text-lg text-gray-700">See pricing for our pilot, enterprise, and research plans.</p>
              </div>

              {/* Main Pricing Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
                {/* Research/Free Tier */}
                <div className="border border-gray-200 rounded-xl p-8 bg-white">
                  <h2 className="text-2xl font-medium mb-3">Research</h2>
                  <p className="text-gray-600 mb-8 min-h-[48px]">
                    Explore how AI can transform your research with full platform access
                  </p>

                  <div className="mb-8">
                    <span className="text-5xl font-normal">$0</span>
                    <span className="text-gray-600 ml-1">/ month</span>
                  </div>

                  <button
                    onClick={() => showPage('contact')}
                    className="w-full py-3 px-6 mb-6 bg-white text-black border border-gray-300 rounded-3xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Apply →
                  </button>

                  <ul className="list-none space-y-2">
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Full access to Omnisight platform for academic use</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Autonomous data analysis without prompting</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Research license and documentation</span>
                    </li>
                  </ul>
                </div>

                {/* Pilot Tier */}
                <div className="border border-gray-200 rounded-xl p-8 bg-white">
                  <h2 className="text-2xl font-medium mb-3">Pilot</h2>
                  <p className="text-gray-600 mb-8 min-h-[48px]">
                    Prove value with a 30-day deployment across your organization
                  </p>

                  <div className="mb-8">
                    <span className="text-5xl font-normal">$50K</span>
                    <span className="text-gray-600 ml-1">/ pilot</span>
                  </div>

                  <button
                    onClick={() => showPage('contact')}
                    className="w-full py-3 px-6 mb-6 bg-black text-white rounded-3xl font-medium hover:bg-gray-800 transition-colors"
                  >
                    Request early access →
                  </button>

                  <div className="text-sm font-semibold text-black mb-3">
                    Everything in Research and:
                  </div>

                  <ul className="list-none space-y-2">
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Full deployment across 5 data sources</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Weekly consultations with expert operators</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>ROI analysis and impact reporting</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Money-back guarantee if ROI targets not met</span>
                    </li>
                  </ul>
                </div>

                {/* Enterprise Tier */}
                <div className="border border-gray-200 rounded-xl p-8 bg-white">
                  <h2 className="text-2xl font-medium mb-3">Enterprise</h2>
                  <p className="text-gray-600 mb-8 min-h-[48px]">
                    Scale AI across your entire organization with dedicated support
                  </p>

                  <div className="mb-8">
                    <span className="text-5xl font-normal">Custom</span>
                  </div>

                  <button
                    onClick={() => showPage('contact')}
                    className="w-full py-3 px-6 mb-6 bg-black text-white rounded-3xl font-medium hover:bg-gray-800 transition-colors"
                  >
                    Contact sales →
                  </button>

                  <div className="text-sm font-semibold text-black mb-3">
                    Everything in Pilot and:
                  </div>

                  <ul className="list-none space-y-2">
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Unlimited data sources and integrations</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Dedicated team of expert operators</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Custom model training for your industry</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>24/7 priority support with SLAs</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Air-gapped deployment options</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Business & Enterprise Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-20">
                <div className="border border-gray-200 rounded-xl p-8 bg-white">
                  <h3 className="text-xl font-medium mb-3">Business</h3>
                  <p className="text-gray-600 mb-6">
                    A secure, collaborative workspace for startups and growing businesses
                  </p>

                  <div className="mb-20"></div>

                  <button
                    onClick={() => showPage('contact')}
                    className="w-full py-3 px-6 mb-6 bg-black text-white rounded-3xl font-medium hover:bg-gray-800 transition-colors"
                  >
                    Request early access →
                  </button>

                  <div className="text-sm font-semibold text-black mb-3 flex items-center gap-1">
                    Everything in Pilot and:
                  </div>

                  <ul className="list-none space-y-2">
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Connectors to internal knowledge systems</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>A secure, dedicated workspace with essential admin controls, SAML SSO, and MFA</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Support for compliance with GDPR, CCPA, and other privacy laws</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Business features like data analysis, custom workflows, and reporting</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Encryption at rest and in transit, no training on your business data</span>
                    </li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-xl p-8 bg-white">
                  <h3 className="text-xl font-medium mb-3">Enterprise</h3>
                  <p className="text-gray-600 mb-6">
                    Enterprise-grade AI, security, and support at scale
                  </p>

                  <div className="mb-14"></div>

                  <button
                    onClick={() => showPage('contact')}
                    className="w-full py-3 px-6 mb-6 bg-white text-black border border-gray-300 rounded-3xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Contact Sales
                  </button>

                  <div className="text-sm font-semibold text-black mb-3 flex items-center gap-1">
                    Everything in Business and:
                  </div>

                  <ul className="list-none space-y-2">
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Expanded context window for larger data sets and complex analyses</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Enterprise-level security and controls, including SCIM, user analytics, and role-based access</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Advanced data privacy with custom retention policies and encryption</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>24/7 priority support, SLAs, custom legal terms, and dedicated success team</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-black font-bold mt-0.5">✓</span>
                      <span>Invoicing and billing, volume discounts</span>
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

                  <div className="mb-8">
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