'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import '../mail.css';

interface User {
  email: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [meetingsExpanded, setMeetingsExpanded] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/moccet-mail');
        return;
      }
      setUser(session.user as User);
      setIsLoading(false);
    };
    checkAuth();
  }, [router, supabase.auth]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (userMenuOpen && !target.closest('.user-profile-container')) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/moccet-mail');
  };

  const getUserDisplayName = () => {
    if (!user) return '';
    const name = user.user_metadata?.full_name || user.user_metadata?.name;
    if (name) return name;
    return user.email?.split('@')[0] || 'User';
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name.substring(0, 1).toUpperCase();
  };

  const getUserFirstName = () => {
    if (!user) return '';
    const name = user.user_metadata?.full_name || user.user_metadata?.name;
    if (name) return name.split(' ')[0];
    return user.email?.split('@')[0] || 'User';
  };

  interface NavItem {
    href: string;
    label: string;
    icon: string;
    subItems?: { href: string; label: string; icon: string }[];
  }

  const navItems: NavItem[] = [
    { href: '/moccet-mail/dashboard', label: 'Home', icon: 'home' },
    { href: '/moccet-mail/dashboard/categorization', label: 'Categorization', icon: 'tag' },
    { href: '/moccet-mail/dashboard/drafts', label: 'Drafts', icon: 'edit' },
    {
      href: '/moccet-mail/dashboard/meetings',
      label: 'Meetings',
      icon: 'calendar',
      subItems: [
        { href: '/moccet-mail/dashboard/meetings/recordings', label: 'Recordings', icon: 'video' },
        { href: '/moccet-mail/dashboard/meetings/upcoming', label: 'Upcoming', icon: 'calendar-upcoming' },
        { href: '/moccet-mail/dashboard/meetings/settings', label: 'Settings', icon: 'settings-small' },
      ],
    },
    { href: '/moccet-mail/dashboard/scheduling', label: 'Scheduling', icon: 'clock' },
    { href: '/moccet-mail/dashboard/settings', label: 'Settings', icon: 'settings' },
  ];

  // Auto-expand meetings section if on a meetings page
  useEffect(() => {
    if (pathname?.startsWith('/moccet-mail/dashboard/meetings')) {
      setMeetingsExpanded(true);
    }
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/moccet-mail/dashboard') {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const renderIcon = (icon: string) => {
    const iconSize = { width: 20, height: 20 };
    switch (icon) {
      case 'home':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case 'tag':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        );
      case 'edit':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'calendar':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'clock':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'settings':
      case 'settings-small':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'video':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'calendar-upcoming':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v4l2 2" />
          </svg>
        );
      case 'chevron-down':
        return (
          <svg {...iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Top Branding Header */}
        <div className="sidebar-branding">
          <Link href="/moccet-mail/dashboard" className="branding-logo">
            <span className="branding-text">moccet</span>
          </Link>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-label">Platform</span>
            {navItems.map((item) => (
              <div key={item.href}>
                {item.subItems ? (
                  <>
                    <button
                      onClick={() => {
                        if (!sidebarCollapsed) {
                          setMeetingsExpanded(!meetingsExpanded);
                        } else {
                          router.push(item.href);
                        }
                      }}
                      className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'flex', flexShrink: 0 }}>{renderIcon(item.icon)}</span>
                        <span className="nav-label">{item.label}</span>
                      </span>
                      {!sidebarCollapsed && (
                        <span
                          style={{
                            display: 'flex',
                            flexShrink: 0,
                            transform: meetingsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}
                          className="nav-label"
                        >
                          {renderIcon('chevron-down')}
                        </span>
                      )}
                    </button>
                    {meetingsExpanded && !sidebarCollapsed && (
                      <div className="nav-subitems">
                        {item.subItems.map((subItem) => (
                          <button
                            key={subItem.href}
                            onClick={() => router.push(subItem.href)}
                            className={`nav-subitem ${pathname === subItem.href ? 'active' : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              flexDirection: 'row',
                            }}
                          >
                            <span style={{ display: 'flex', flexShrink: 0, width: 16, height: 16 }}>
                              {renderIcon(subItem.icon)}
                            </span>
                            <span className="nav-label">{subItem.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => router.push(item.href)}
                    className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexDirection: 'row'
                    }}
                  >
                    <span style={{ display: 'flex', flexShrink: 0 }}>{renderIcon(item.icon)}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* User Profile */}
        <div className="sidebar-footer">
          <div className="user-profile-container">
            <div
              className="user-profile"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="user-avatar">
                {getUserInitials()}
              </div>
              <div className="user-info">
                <span className="user-name">{getUserDisplayName()}</span>
                <span className="user-email">{user?.email}</span>
              </div>
              <button className="user-menu-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </button>
            </div>

            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">{getUserInitials()}</div>
                  <div className="dropdown-user-info">
                    <span className="dropdown-user-name">{getUserDisplayName()}</span>
                    <span className="dropdown-user-email">{user?.email}</span>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button
                  onClick={() => router.push('/moccet-mail/dashboard/rewards')}
                  className="dropdown-item"
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Rewards
                </button>
                <button
                  onClick={() => router.push('/moccet-mail/dashboard/account')}
                  className="dropdown-item"
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Account
                </button>
                <button
                  onClick={handleLogout}
                  className="dropdown-item logout"
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {children}
      </main>

      <style jsx>{`
        .dashboard-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #fbfaf4;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #1a1a1a;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .dashboard-layout {
          display: flex;
          min-height: 100vh;
          background-color: #fbfaf4;
        }

        .dashboard-sidebar {
          width: 260px;
          background-color: #ffffff;
          border-right: 1px solid #e8e8e8;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 100;
          transition: width 0.2s ease;
        }

        .dashboard-sidebar.collapsed {
          width: 72px;
        }

        .sidebar-branding {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 16px 20px;
        }

        .branding-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
        }

        .branding-text {
          font-family: "Inter", Helvetica;
          font-weight: 900;
          font-size: 20px;
          color: #1a1a1a;
          letter-spacing: -0.02em;
        }

        .branding-logo svg {
          color: #1a1a1a;
        }

        .dashboard-sidebar.collapsed .branding-text,
        .dashboard-sidebar.collapsed .branding-logo svg {
          display: none;
        }

        .notification-button {
          position: relative;
          width: 36px;
          height: 36px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #666;
          padding: 8px;
          border-radius: 8px;
          transition: background-color 0.15s ease;
        }

        .notification-button:hover {
          background-color: #f5f5f5;
        }

        .notification-button svg {
          width: 100%;
          height: 100%;
        }

        .notification-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          min-width: 16px;
          height: 16px;
          background: #ef4444;
          color: white;
          font-family: "Inter", Helvetica;
          font-weight: 600;
          font-size: 10px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }

        .dashboard-sidebar.collapsed .notification-button {
          display: none;
        }

        .sidebar-header {
          padding: 12px 20px 20px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #f0f0f0;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .logo-icon {
          width: 40px;
          height: 40px;
          background: #1a1a1a;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .logo-icon svg {
          width: 22px;
          height: 22px;
          color: white;
        }

        .logo-text {
          display: flex;
          flex-direction: column;
        }

        .dashboard-sidebar.collapsed .logo-text {
          display: none;
        }

        .logo-title {
          font-family: "Inter", Helvetica;
          font-weight: 900;
          font-size: 16px;
          color: #1a1a1a;
        }

        .logo-subtitle {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 11px;
          color: #666;
          letter-spacing: 0.5px;
        }

        .sidebar-toggle {
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #666;
          padding: 4px;
          border-radius: 6px;
          transition: background-color 0.2s;
        }

        .sidebar-toggle:hover {
          background-color: #f5f5f5;
        }

        .sidebar-toggle svg {
          width: 100%;
          height: 100%;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px 12px;
          overflow-y: auto;
        }

        .nav-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-section-label {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 11px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 12px;
          margin-bottom: 4px;
        }

        .dashboard-sidebar.collapsed .nav-section-label {
          display: none;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: #4a4a4a;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          transition: all 0.15s ease;
        }

        .nav-item:hover {
          background-color: #f8f7f2;
          color: #1a1a1a;
        }

        .nav-item.active {
          background-color: #f0f0f0;
          color: #1a1a1a;
          font-weight: 500;
        }

        .nav-subitems {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-left: 32px;
          margin-top: 2px;
          margin-bottom: 4px;
        }

        .nav-subitem {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          text-decoration: none;
          color: #666;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 13px;
          transition: all 0.15s ease;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
          cursor: pointer;
        }

        .nav-subitem:hover {
          background-color: #f8f7f2;
          color: #4a4a4a;
        }

        .nav-subitem.active {
          background-color: #e8e8e8;
          color: #1a1a1a;
          font-weight: 500;
        }

        .nav-subitem svg {
          width: 16px;
          height: 16px;
        }

        .nav-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .nav-icon svg {
          width: 100%;
          height: 100%;
        }

        .dashboard-sidebar.collapsed .nav-label {
          display: none;
        }

        .dashboard-sidebar.collapsed .nav-section {
          gap: 8px;
          align-items: center;
        }

        .dashboard-sidebar.collapsed .nav-item {
          justify-content: center;
          padding: 14px;
          width: 48px;
          height: 48px;
        }

        .dashboard-sidebar.collapsed .sidebar-nav {
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .dashboard-sidebar.collapsed .sidebar-branding {
          justify-content: center;
          padding: 20px 12px 16px 12px;
        }

        .dashboard-sidebar.collapsed .branding-text {
          display: none;
        }

        .dashboard-sidebar.collapsed .sidebar-toggle {
          margin: 0;
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid #f0f0f0;
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .user-profile:hover {
          background-color: #f8f7f2;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          background: #ffffff;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1a1a1a;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          flex-shrink: 0;
        }

        .user-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .dashboard-sidebar.collapsed .user-info,
        .dashboard-sidebar.collapsed .user-menu-button {
          display: none;
        }

        .user-name {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 13px;
          color: #1a1a1a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-email {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 12px;
          color: #666;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-menu-button {
          width: 24px;
          height: 24px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #999;
          padding: 0;
          flex-shrink: 0;
        }

        .user-menu-button svg {
          width: 100%;
          height: 100%;
        }

        .user-profile-container {
          position: relative;
        }

        .user-dropdown {
          position: absolute;
          bottom: 0;
          left: 100%;
          margin-left: 8px;
          width: 240px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
          border: 1px solid #e8e8e8;
          padding: 8px;
          z-index: 200;
        }

        .dropdown-item {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: #4a4a4a;
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 14px;
          transition: background-color 0.15s ease;
          cursor: pointer;
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
        }

        .dropdown-item:hover {
          background-color: #f8f7f2;
          color: #1a1a1a;
        }

        .dropdown-item.logout {
          color: #dc2626;
        }

        .dropdown-item.logout:hover {
          background-color: #fef2f2;
          color: #dc2626;
        }

        .dropdown-item svg {
          flex-shrink: 0;
        }

        .dropdown-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
        }

        .dropdown-avatar {
          width: 36px;
          height: 36px;
          background: #f5f5f5;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1a1a1a;
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          flex-shrink: 0;
        }

        .dropdown-user-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .dropdown-user-name {
          font-family: "SF Pro", -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
        }

        .dropdown-user-email {
          font-family: "Inter", Helvetica;
          font-weight: 400;
          font-size: 12px;
          color: #666;
        }

        .dropdown-divider {
          height: 1px;
          background: #f0f0f0;
          margin: 4px 0;
        }

        .dashboard-main {
          flex: 1;
          margin-left: 260px;
          min-height: 100vh;
          transition: margin-left 0.2s ease;
        }

        .dashboard-sidebar.collapsed + .dashboard-main {
          margin-left: 72px;
        }

        @media (max-width: 768px) {
          .dashboard-sidebar {
            transform: translateX(-100%);
            width: 260px;
          }

          .dashboard-sidebar.collapsed {
            width: 260px;
          }

          .dashboard-main {
            margin-left: 0;
          }

          .dashboard-sidebar.collapsed + .dashboard-main {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
