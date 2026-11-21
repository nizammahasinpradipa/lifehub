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
      <linearGradient id="lifehubLogoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#355B2B" />
        <stop offset="100%" stopColor="#193116" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="url(#lifehubLogoGrad)" />
    <rect
      x="1.5"
      y="1.5"
      width="61"
      height="61"
      rx="16.5"
      stroke="#DFE1A6"
      strokeOpacity="0.34"
      strokeWidth="1.5"
    />
    <path d="M20 16H30.5V39.5H45V48.5H20V16Z" fill="#FBFBF4" />
    <circle cx="42" cy="22" r="5.5" fill="#F4C95D" />
  </svg>
);
