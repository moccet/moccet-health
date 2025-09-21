'use client';

import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '#safety', label: 'Safety' },
  { href: '#research', label: 'Research' },
  { href: '#business', label: 'For Business' },
  { href: '#developers', label: 'For Developers' },
  { href: '#health', label: 'moccet Health' },
  { href: '#wellness', label: 'The Wellness' },
  { href: '#stories', label: 'Stories' },
  { href: '#news', label: 'News' },
];

interface SidebarProps {
  onNavigate?: (targetId: string) => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(href);
    } else {
      // Fallback to normal navigation
      if (href === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const element = document.querySelector(href);
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <aside className="hidden lg:block w-[280px] bg-white p-6 fixed h-screen overflow-y-auto border-r border-gray-200">
      <a
        href="/"
        onClick={(e) => handleClick(e, '/')}
        className="block text-[22px] font-bold mb-12 pl-4 cursor-pointer tracking-tight"
      >
        moccet
      </a>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={(e) => handleClick(e, item.href)}
            className="block px-4 py-3 text-gray-900 text-[15px] rounded-md transition-colors hover:bg-gray-50"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}