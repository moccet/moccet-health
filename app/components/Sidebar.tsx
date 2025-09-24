'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  isExternal?: boolean;
}

interface SidebarProps {
  isActive?: boolean;
  onNavigate?: (targetId: string) => void;
  activePage?: string;
}

// Define navigation items for different routes
const getNavItems = (pathname: string): NavItem[] => {
  // Business page navigation
  if (pathname === '/business') {
    return [
      { href: '/', label: '← Home' },
      { href: '#overview', label: 'Business Overview' },
      { href: '#pricing', label: 'moccet Pricing' },
      { href: '#contact', label: 'Contact Sales' },
    ];
  }

  // Research page navigation
  if (pathname === '/research') {
    return [
      { href: '/', label: '← Home' },
      { href: '#research', label: 'Research' },
    ];
  }

  // Pricing page navigation
  if (pathname === '/pricing') {
    return [
      { href: '/', label: '← Home' },
      { href: '#', label: 'Pricing' },
      { href: '#contact', label: 'Contact Sales' },
    ];
  }

  // Developers page navigation
  if (pathname === '/developers') {
    return [
      { href: '/', label: '← Home' },
      { href: '#', label: 'Developers' },
      { href: '#contact', label: 'Contact Sales' },
    ];
  }

  // Solutions page navigation
  if (pathname === '/solutions') {
    return [
      { href: '/', label: '← Home' },
      { href: '#', label: 'Solutions' },
      { href: '#contact', label: 'Contact Sales' },
    ];
  }

  // Company page navigation
  if (pathname === '/company') {
    return [
      { href: '/', label: '← Home' },
      { href: '#about', label: 'About Us' },
      { href: '#charter', label: 'Our Charter' },
      { href: '#careers', label: 'Careers' },
      { href: '#brand', label: 'Brand Guidelines' },
    ];
  }

  // Safety page navigation
  if (pathname === '/safety') {
    return [
      { href: '/', label: '← Home' },
      { href: '#', label: 'Safety' },
      { href: '#contact', label: 'Contact Safety Team' },
    ];
  }

  // Health page navigation
  if (pathname === '/health') {
    return [
      { href: '/', label: '← Home' },
      { href: '#overview', label: 'Health Overview' },
      { href: '#wellness', label: 'The Wellness' },
      { href: '#hospitals', label: 'For Hospitals' },
      { href: '#research', label: 'Research' },
      { href: '#safety', label: 'Safety & Privacy' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#contact', label: 'Join Waitlist' },
    ];
  }

  // Legal page navigation
  if (pathname === '/legal') {
    return [
      { href: '/', label: '← Home' },
      { href: '#', label: 'Legal' },
    ];
  }

  // Default navigation for landing page and other pages
  return [
    { href: '/research', label: 'Research' },
    { href: '/safety', label: 'Safety' },
    { href: '/business', label: 'For Business' },
    { href: '/developers', label: 'For Developers' },
    { href: '/health', label: 'Health' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/solutions', label: 'Solutions' },
    { href: '/company', label: 'Company' },
    { href: '/news', label: 'News' },
  ];
};

export default function Sidebar({ isActive = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(pathname);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Handle section navigation (anchors)
    if (href.startsWith('#')) {
      e.preventDefault();
      if (onNavigate) {
        onNavigate(href);
      } else {
        // Fallback to scroll behavior
        const element = document.querySelector(href);
        element?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // Handle home navigation with scroll
    if (href === '/' && pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Let normal Link navigation handle other routes
  };

  // Different styling based on the page type
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

  // Business page now uses the same sidebar as landing page (removed custom business sidebar)

  if (isLandingPage || isResearchPage || isSafetyPage || isBusinessPage || isDevelopersPage || isPricingPage || isContactPage || isSolutionsPage || isCompanyPage || isLegalPage || isHealthPage) {
    // Landing page style - styled navigation with vertical centering
    const baseClasses = "fixed top-0 left-0 h-full transition-transform duration-200 border-r-0 z-[999]";
    const activeClasses = isActive ? "translate-x-0" : "-translate-x-full";
    const widthClasses = "w-[240px]"; // Match the original sidebar width

    return (
      <nav
        className={`${baseClasses} ${activeClasses} ${widthClasses}`}
        id="sidebar"
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          boxShadow: 'none',
          border: 'none',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}
      >
        {/* Navigation items vertically centered */}
        <div
          className="space-y-0.5"
          style={{ paddingLeft: '40px', paddingRight: '24px' }}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block text-black font-medium transition-colors"
              style={{
                display: 'block',
                padding: '10px 0',
                color: '#000',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '500',
                transition: 'color 0.15s',
                cursor: 'pointer'
              }}
              onClick={(e) => handleClick(e, item.href)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  // Default/research page style - similar to original
  return (
    <aside className="hidden lg:block w-64 bg-white pl-3 pr-6 py-6 fixed h-screen overflow-y-auto border-r border-gray-200">
      <Link
        href="/"
        className="block text-[22px] font-bold mb-12 pl-4 cursor-pointer tracking-tight moccet-brand"
      >
        moccet
      </Link>

      <nav className="space-y-2 px-7">
        {navItems.map((item) => {
          if (item.href.startsWith('#')) {
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleClick(e, item.href)}
                className="block px-4 py-2 text-black text-[18px] font-medium rounded-md transition-colors hover:bg-gray-50"
              >
                {item.label}
              </a>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 text-black text-[18px] font-medium rounded-md transition-colors hover:bg-gray-50"
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}