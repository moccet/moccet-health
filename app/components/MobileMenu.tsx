'use client';

import { useState } from 'react';
import Link from 'next/link';

interface MobileMenuProps {
  onLoginClick?: () => void;
}

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

export default function MobileMenu({ onLoginClick }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 bg-white z-50 px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-[19px] font-bold tracking-tight">
          moccet
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={onLoginClick}
            className="px-3 py-1.5 bg-white text-black border border-gray-300 rounded-md text-sm"
          >
            Log in
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              {isOpen ? (
                <>
                  <path d="M6 6L14 14M6 14L14 6" />
                </>
              ) : (
                <>
                  <path d="M3 6H17M3 10H17M3 14H17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-[57px] right-0 w-[280px] bg-white h-[calc(100vh-57px)] z-40 transform transition-transform duration-300 shadow-lg lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2.5 text-gray-900 text-sm rounded-md transition-colors hover:bg-gray-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}