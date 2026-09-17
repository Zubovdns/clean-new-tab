import React, { useState, useEffect, useMemo } from 'react';
import { getFaviconCandidates } from '@utils/favicon';

export interface FaviconImageProps {
  url: string;
  title: string;
  size?: number;
  className?: string;
  isDark?: boolean;
  letterClassName?: string;
  hideOnFallback?: boolean;
  customFavicon?: string;
  cachedFavicon?: string;
}

export function FaviconImage({
  url,
  title,
  size = 64,
  className = 'w-6 h-6 object-contain pointer-events-none',
  isDark = true,
  letterClassName = '',
  hideOnFallback = false,
  customFavicon,
  cachedFavicon,
}: FaviconImageProps) {
  const activeCachedFavicon = customFavicon || cachedFavicon;
  const candidates = useMemo(
    () => getFaviconCandidates(url, size, activeCachedFavicon),
    [url, size, activeCachedFavicon]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [url, activeCachedFavicon]);

  const nextCandidate = () => {
    setCandidateIndex((prev) => prev + 1);
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const currentSrc = candidates[candidateIndex] || '';
    // If it came from Google S2 and is a 16x16 or smaller image (Google's default pixelated globe), reject it if we have more candidates
    if (
      (currentSrc.includes('google.com/s2') || currentSrc.includes('gstatic.com')) &&
      img.naturalWidth <= 16 &&
      img.naturalHeight <= 16 &&
      candidateIndex < candidates.length - 1
    ) {
      nextCandidate();
    }
  };

  if (candidateIndex >= candidates.length) {
    if (hideOnFallback) {
      return null;
    }
    const firstLetter = (title || 'G').trim().charAt(0).toUpperCase();
    return (
      <span
        className={`font-medium pointer-events-none select-none ${
          letterClassName ||
          (isDark ? 'text-[#8ab4f8] text-[18px]' : 'text-[#1a73e8] text-[18px]')
        }`}
      >
        {firstLetter}
      </span>
    );
  }

  return (
    <img
      src={candidates[candidateIndex]}
      alt={title}
      draggable={false}
      className={className}
      onError={nextCandidate}
      onLoad={handleLoad}
    />
  );
}

export default FaviconImage;
