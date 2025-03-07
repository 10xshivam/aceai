import React from 'react';
import { LogIn } from 'lucide-react';

interface SignInBannerProps {
  onSignIn: () => void;
}

export function SignInBanner({ onSignIn }: SignInBannerProps) {
  return (
    <div className="bg-white border border-gray-200 text-black w-full px-4 py-3 flex items-center justify-between shadow-sm">
      <p className="text-sm font-medium">
        <span className="hidden md:inline">Sign in to save your chats and access them from any device</span>
        <span className="md:hidden">Sign in to save your chats</span>
      </p>
      <button
        onClick={onSignIn}
        className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm font-medium"
      >
        <LogIn size={16} />
        Sign In
      </button>
    </div>
  );
}