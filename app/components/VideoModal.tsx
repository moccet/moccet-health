'use client';

import { useEffect, useRef } from 'react';
import styles from './VideoModal.module.css';

interface VideoModalProps {
  onClose: () => void;
}

export default function VideoModal({ onClose }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Play video when modal opens
    if (videoRef.current) {
      videoRef.current.play();
    }

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay}>
      {/* Close button - X icon */}
      <button
        onClick={onClose}
        className={styles.closeButton}
        aria-label="Close video"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          className={styles.video}
          controls
          autoPlay
          playsInline
        >
          <source src="/videos/zuckaburg.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}