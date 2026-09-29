import React from 'react';

import { ChromeShortcutItem, ChromeSection } from '@app-types';
import { FaviconImage } from '@components/common/FaviconImage';
import { Icon } from '@components/common/Icon';

export interface GridItemOverlayProps {
  item: ChromeShortcutItem;
  isDark: boolean;
  getCachedFavicon: (url: string, favicon?: string) => string;
}

export const GridItemOverlay: React.FC<GridItemOverlayProps> = React.memo(
  ({ item, isDark, getCachedFavicon }) => {
    return (
      <div
        className={`w-28 h-28 rounded-xl flex flex-col items-center justify-center p-2 select-none cursor-grabbing border-2 scale-105 pointer-events-none transition-transform shadow-2xl ${
          isDark
            ? 'bg-[#28292c]/95 border-[#8ab4f8] shadow-black/80 text-[#e8eaed]'
            : 'bg-white/95 border-[#1a73e8] shadow-black/25 text-[#202124]'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 overflow-hidden shadow-xs pointer-events-none ${
            isDark ? 'bg-[#303134]' : 'bg-[#f1f3f4]'
          }`}
        >
          <FaviconImage
            url={item.url}
            title={item.title}
            size={32}
            isDark={isDark}
            className="w-6 h-6 object-contain pointer-events-none"
            letterClassName={isDark ? 'text-[#8ab4f8] text-[18px]' : 'text-[#1a73e8] text-[18px]'}
            customFavicon={item.favicon}
            cachedFavicon={getCachedFavicon(item.url)}
          />
        </div>
        <span className="text-[12px] font-normal truncate w-full text-center px-1 pointer-events-none">
          {item.title}
        </span>
      </div>
    );
  },
);

GridItemOverlay.displayName = 'GridItemOverlay';

export interface SectionOverlayProps {
  section: ChromeSection;
  isDark: boolean;
  getCachedFavicon: (url: string, favicon?: string) => string;
}

export const SectionOverlay: React.FC<SectionOverlayProps> = React.memo(
  ({ section, isDark, getCachedFavicon }) => {
    return (
      <div
        className={`rounded-2xl p-5 border-2 shadow-2xl scale-[1.01] cursor-grabbing max-w-[820px] w-full pointer-events-none select-none ${
          isDark
            ? 'bg-[#28292c]/95 border-[#8ab4f8] shadow-black/80 text-[#e8eaed]'
            : 'bg-white/95 border-[#1a73e8] shadow-black/25 text-[#202124]'
        }`}
      >
        {/* Section Header */}
        <div className="flex items-center justify-between mb-3.5 px-1 select-none">
          <div className="flex items-center gap-2">
            <div className={isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}>
              <Icon name="drag_indicator" size={18} />
            </div>
            <h3 className="text-sm font-semibold tracking-wide">{section.title}</h3>
            <span className="text-[11px] text-[#9aa0a6]">{section.items.length}</span>
          </div>
        </div>

        {/* Items Grid with original shortcut cards of identical size */}
        <div className="flex flex-wrap gap-y-3 gap-x-2 select-none min-h-28 items-center">
          {section.items.map((item) => (
            <div
              key={item.id}
              className="relative w-28 h-28 rounded-lg flex flex-col items-center justify-center p-2"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 overflow-hidden shadow-xs pointer-events-none ${
                  isDark ? 'bg-[#303134]' : 'bg-[#f1f3f4]'
                }`}
              >
                <FaviconImage
                  url={item.url}
                  title={item.title}
                  size={32}
                  isDark={isDark}
                  className="w-6 h-6 object-contain pointer-events-none"
                  letterClassName={
                    isDark ? 'text-[#8ab4f8] text-[18px]' : 'text-[#1a73e8] text-[18px]'
                  }
                  customFavicon={item.favicon}
                  cachedFavicon={getCachedFavicon(item.url)}
                />
              </div>
              <span
                className={`text-[12px] font-normal truncate w-full text-center px-1 pointer-events-none ${
                  isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                }`}
              >
                {item.title}
              </span>
            </div>
          ))}

          {/* "+ Добавить" Tile inside this Section */}
          <div className="relative w-28 h-28 rounded-lg flex flex-col items-center justify-center p-2 opacity-50">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                isDark ? 'bg-[#303134] text-[#e8eaed]' : 'bg-[#f1f3f4] text-[#5f6368]'
              }`}
            >
              <Icon name="add" size={20} />
            </div>
            <span
              className={`text-[12px] font-normal truncate w-full text-center px-1 ${
                isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
              }`}
            >
              Добавить
            </span>
          </div>
        </div>
      </div>
    );
  },
);

SectionOverlay.displayName = 'SectionOverlay';
