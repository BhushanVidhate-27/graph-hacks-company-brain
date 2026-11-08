import React from 'react';

interface HelioLogoProps {
  className?: string;
  showText?: boolean;
}

export const HelioLogo: React.FC<HelioLogoProps> = ({ className = '', showText = true }) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img
        src="/icons/helio-logo.png"
        alt="helio logo"
        className="h-8 w-8 shrink-0 object-contain"
        width={32}
        height={32}
      />
      {showText && (
        <div className="flex items-center gap-1 font-mono font-bold tracking-tight text-xl leading-none text-[#282828]">
          <span className="lowercase">helio</span>
          <span className="helio-dot w-1.5 h-1.5 rounded-full inline-block" aria-hidden="true" />
        </div>
      )}
    </div>
  );
};
