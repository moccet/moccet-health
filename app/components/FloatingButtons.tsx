'use client';

export default function FloatingButtons() {
  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChat = () => {
    alert('moccet health chat - Coming soon with launch');
  };

  return (
    <>
      <button
        onClick={handleChat}
        className="fixed bottom-5 right-5 px-3.5 py-2 bg-white border border-gray-300 rounded-full flex items-center gap-1.5 cursor-pointer shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg text-[13px] text-gray-600"
      >
        Ask moccet Health
      </button>

      <button
        onClick={handleScrollTop}
        className="fixed bottom-[70px] right-5 w-9 h-9 bg-white border border-gray-300 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-gray-50"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
          <path d="M8 4l-6 6h12z" />
        </svg>
      </button>
    </>
  );
}