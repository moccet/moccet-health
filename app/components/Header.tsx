'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onContactSales?: () => void;
  onLoginClick?: () => void;
  sidebarActive?: boolean;
}

export default function Header({ onToggleSidebar, onContactSales, onLoginClick }: HeaderProps) {
  const pathname = usePathname();
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Different header styles based on route
  const isLandingPage = pathname === '/';
  const isBusinessPage = pathname === '/business';
  const isResearchPage = pathname === '/research';
  const isSafetyPage = pathname === '/safety';
  const isDevelopersPage = pathname === '/developers';
  const isPricingPage = pathname === '/pricing';
  const isContactPage = pathname === '/contact';
  const isSolutionsPage = pathname === '/solutions';
  const isCompanyPage = pathname === '/company';
  const isLegalPage = pathname === '/legal';
  const isHealthPage = pathname === '/health';
  const isCareersPage = pathname === '/careers';

  // Landing page, Research page, Safety page, Business page, Developers page, Pricing page, Contact page, Solutions page, Company page, Legal page, Health page, and Careers page header - using CSS modules styling
  if (isLandingPage || isResearchPage || isSafetyPage || isBusinessPage || isDevelopersPage || isPricingPage || isContactPage || isSolutionsPage || isCompanyPage || isLegalPage || isHealthPage || isCareersPage) {
    return (
      <header
        className="fixed top-0 left-0 right-0 h-[60px] bg-white z-[1000] flex items-center"
        style={{
          paddingLeft: windowWidth >= 1280 ? '48px' : windowWidth >= 1024 ? '40px' : windowWidth >= 768 ? '32px' : '16px',
          paddingRight: windowWidth >= 1280 ? '48px' : windowWidth >= 1024 ? '40px' : windowWidth >= 768 ? '32px' : '16px'
        }}>
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center gap-4 md:gap-6 lg:gap-10">
            <button
              className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center cursor-pointer bg-none border-none p-0 touch-manipulation"
              onClick={onToggleSidebar}
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="md:w-5 md:h-5">
                <path d="M2.5 7.5H17.5M2.5 12.5H17.5" strokeLinecap="round"/>
              </svg>
            </button>
            <Link href="/" className="text-[18px] md:text-[20px] lg:text-[22px] font-black text-black no-underline tracking-[-0.6px] md:tracking-[-0.8px] cursor-pointer moccet-brand">
              moccet
            </Link>
          </div>
          <div className="flex items-center gap-2 md:gap-4 pr-2 md:pr-0">
            <button
              onClick={onContactSales}
              className="touch-manipulation text-xs md:text-sm md:px-4 md:py-2"
              style={{
                padding: '4px 12px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                minWidth: '44px',
                minHeight: '28px'
              }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.opacity = '0.9'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.opacity = '1'}
            >
              <span className="hidden sm:inline">Contact Sales</span>
              <span className="sm:hidden">Sales</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Business page now uses the same header as landing page (removed custom business header)

  // Research page will use the default header (removed custom research header)

  // Default header for other pages
  return (
    <header className="flex justify-between items-center px-4 md:px-6 lg:px-8 py-3 md:py-4 border-b border-gray-200 bg-white sticky top-0 z-50">
      <Link href="/" className="text-lg md:text-xl font-semibold text-black no-underline">
        moccet
      </Link>
      <div className="flex items-center gap-2 md:gap-4">
        {onToggleSidebar && (
          <button
            className="lg:hidden bg-none border-none text-xl md:text-2xl cursor-pointer p-2 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
            onClick={onToggleSidebar}
          >
            ☰
          </button>
        )}
        <button className="bg-none border-none text-xs md:text-sm cursor-pointer px-2 md:px-3 py-2 md:py-1.5 min-h-[40px] touch-manipulation" onClick={onLoginClick}>
          Log in
        </button>
      </div>
    </header>
  );
}