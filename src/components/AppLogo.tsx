import React from 'react';

interface AppLogoProps {
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = 'w-8 h-8' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    fill="none"
    className={className}
    aria-label="LifeHub Logo"
  >
    <defs>
      <linearGradient id="lifehubLogoGrad" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF7A00" />
        <stop offset="100%" stopColor="#E04E0C" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#lifehubLogoGrad)" />
    <rect
      x="1"
      y="1"
      width="62"
      height="62"
      rx="15"
      stroke="#FFFFFF"
      strokeOpacity="0.22"
      strokeWidth="1"
    />
    <path d="M20.5 16.5H30V40H44.5V48H20.5V16.5Z" fill="#FFFFFF" />
    <circle cx="42" cy="22" r="5" fill="#FFF1E6" />
  </svg>
);
