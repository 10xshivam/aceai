import React from 'react';

export const AceIcon = ({ className = '', size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    className={className}
    fill="currentColor"
  >
    <circle cx="50" cy="50" r="50" className="fill-current opacity-10" />
    <path
      d="M30 70 L50 30 L70 70 L50 55 Z"
      className="fill-current"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);