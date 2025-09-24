'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onContactSales?: () => void;
  onLoginClick?: () => void;
  sidebarActive?: boolean;
}

export default function Header({ onToggleSidebar, onContactSales, onLoginClick }: HeaderProps) {
  const pathname = usePathname();

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

  // Landing page, Research page, Safety page, Business page, Developers page, Pricing page, Contact page, Solutions page, Company page, Legal page, and Health page header - using CSS modules styling
  if (isLandingPage || isResearchPage || isSafetyPage || isBusinessPage || isDevelopersPage || isPricingPage || isContactPage || isSolutionsPage || isCompanyPage || isLegalPage || isHealthPage) {
    return (
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-white z-[1000] flex items-center" style={{ padding: '0 32px' }}>
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center gap-10">
            <button
              className="w-6 h-6 flex items-center justify-center cursor-pointer bg-none border-none p-0"
              onClick={onToggleSidebar}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 7.5H17.5M2.5 12.5H17.5" strokeLinecap="round"/>
              </svg>
            </button>
            <Link href="/" className="text-[22px] font-black text-black no-underline tracking-[-0.8px] cursor-pointer moccet-brand">
              moccet
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onContactSales}
              style={{
                padding: '8px 16px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.opacity = '0.9'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.opacity = '1'}
            >
              Contact Sales
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
    <header className="flex justify-between items-center px-8 py-4 border-b border-gray-200 bg-white sticky top-0 z-50">
      <Link href="/" className="text-xl font-semibold text-black no-underline">
        moccet
      </Link>
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button
            className="lg:hidden bg-none border-none text-2xl cursor-pointer"
            onClick={onToggleSidebar}
          >
            ☰
          </button>
        )}
        <button className="bg-none border-none text-sm cursor-pointer px-3 py-1.5" onClick={onLoginClick}>
          Log in
        </button>
      </div>
    </header>
  );
}