import React from 'react';

export interface DropIndicatorProps {
  type: 'vertical' | 'horizontal';
  position: 'before' | 'after';
  className?: string;
}

export function DropIndicator({ type, position, className = '' }: DropIndicatorProps) {
  if (type === 'vertical') {
    const posClass = position === 'before' ? '-left-[6px]' : '-right-[6px]';
    return (
      <div
        className={`absolute ${posClass} top-1.5 bottom-1.5 w-1 bg-[#1a73e8] dark:bg-[#8ab4f8] rounded-full z-30 pointer-events-none shadow-[0_0_8px_rgba(26,115,232,0.8)] dark:shadow-[0_0_8px_rgba(138,180,248,0.8)] animate-in fade-in duration-100 ${className}`}
      >
        <div className="absolute -top-1 -left-[3px] w-2.5 h-2.5 rounded-full bg-[#1a73e8] dark:bg-[#8ab4f8] shadow-sm" />
        <div className="absolute -bottom-1 -left-[3px] w-2.5 h-2.5 rounded-full bg-[#1a73e8] dark:bg-[#8ab4f8] shadow-sm" />
      </div>
    );
  }

  const posClass = position === 'before' ? '-top-4 -translate-y-1/2' : '-bottom-4 translate-y-1/2';
  return (
    <div
      className={`absolute ${posClass} left-0 right-0 h-1 bg-[#1a73e8] dark:bg-[#8ab4f8] rounded-full z-30 pointer-events-none shadow-[0_0_8px_rgba(26,115,232,0.8)] dark:shadow-[0_0_8px_rgba(138,180,248,0.8)] animate-in fade-in duration-100 ${className}`}
    >
      <div className="absolute -left-1 -top-[3px] w-2.5 h-2.5 rounded-full bg-[#1a73e8] dark:bg-[#8ab4f8] shadow-sm" />
      <div className="absolute -right-1 -top-[3px] w-2.5 h-2.5 rounded-full bg-[#1a73e8] dark:bg-[#8ab4f8] shadow-sm" />
    </div>
  );
}

export const DropIndicatorMemo = React.memo(DropIndicator);
export default DropIndicatorMemo;
