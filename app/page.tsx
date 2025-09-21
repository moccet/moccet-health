'use client';

import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MobileMenu from './components/MobileMenu';
import HeroSection from './components/HeroSection';
import PromptSection from './components/PromptSection';
import NewsCards from './components/NewsCards';
import ResearchSection from './components/ResearchSection';
import BusinessSection from './components/BusinessSection';
import DevelopersSection from './components/DevelopersSection';
import PricingSection from './components/PricingSection';
import StoriesSection from './components/StoriesSection';
import NewsSection from './components/NewsSection';
import ChatWidget from './components/chat/ChatWidget';
import LoginPage from './components/LoginPage';
import WaitlistPage from './components/WaitlistPage';
import DeveloperInterestPage from './components/DeveloperInterestPage';

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  const handleShowLogin = () => {
    setFadeOut(true);
    setTimeout(() => {
      setShowLogin(true);
    }, 500);
  };

  const handleShowWaitlist = () => {
    setFadeOut(true);
    setTimeout(() => {
      setShowWaitlist(true);
    }, 500);
  };

  const handleShowDeveloper = () => {
    setFadeOut(true);
    setTimeout(() => {
      setShowDeveloper(true);
    }, 500);
  };

  const handleCloseLogin = () => {
    setShowLogin(false);
    setFadeOut(false);
  };

  const handleCloseWaitlist = () => {
    setShowWaitlist(false);
    setFadeOut(false);
  };

  const handleCloseDeveloper = () => {
    setShowDeveloper(false);
    setFadeOut(false);
  };

  const handleSmoothScroll = (targetId: string) => {
    if (targetId === '/') {
      setIsScrolling(true);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => setIsScrolling(false), 300);
      }, 300);
      return;
    }

    const element = document.querySelector(targetId);
    if (element) {
      setIsScrolling(true);
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => setIsScrolling(false), 300);
      }, 300);
    }
  };

  // Make functions available globally
  useEffect(() => {
    interface ExtendedWindow extends Window {
      handleShowLogin?: () => void;
      handleShowWaitlist?: () => void;
      handleSmoothScroll?: (targetId: string) => void;
    }
    (window as ExtendedWindow).handleShowLogin = handleShowLogin;
    (window as ExtendedWindow).handleShowWaitlist = handleShowWaitlist;
    (window as ExtendedWindow).handleSmoothScroll = handleSmoothScroll;
  }, []);

  return (
    <>
      <div className={`flex min-h-screen bg-white transition-opacity duration-500 ${fadeOut || isScrolling ? 'opacity-0' : 'opacity-100'}`}>
        <Sidebar onNavigate={handleSmoothScroll} />
        <Header onLoginClick={handleShowLogin} />
        <MobileMenu onLoginClick={handleShowLogin} />

        <div className="lg:ml-[280px] flex-1 w-full lg:w-[calc(100%-280px)] pt-[57px] lg:pt-0">
          <HeroSection onWaitlistClick={handleShowWaitlist} />
          <PromptSection />
          <NewsCards />
          <ResearchSection />
          <BusinessSection />
          <DevelopersSection onWaitlistClick={handleShowDeveloper} />
          <PricingSection />
          <StoriesSection />
          <NewsSection />
        </div>

        <ChatWidget />
      </div>

      {showLogin && <LoginPage onClose={handleCloseLogin} />}
      {showWaitlist && <WaitlistPage onClose={handleCloseWaitlist} />}
      {showDeveloper && <DeveloperInterestPage onClose={handleCloseDeveloper} />}
    </>
  );
}
