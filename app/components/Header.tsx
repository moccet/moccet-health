'use client';

interface HeaderProps {
  onLoginClick?: () => void;
}

export default function Header({ onLoginClick }: HeaderProps) {
  return (
    <header className="hidden lg:flex fixed top-0 right-0 p-5 px-6 gap-3 items-center z-[100]">
      <button
        onClick={onLoginClick}
        className="px-3 py-1.5 bg-white text-black border border-gray-300 rounded-md text-sm transition-colors hover:bg-gray-50"
      >
        Log in
      </button>
    </header>
  );
}