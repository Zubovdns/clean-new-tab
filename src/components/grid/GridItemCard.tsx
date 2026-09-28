import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';

import { useNewtabContext } from '@/context/NewtabContext';
import { ChromeShortcutItem } from '@app-types';
import { FaviconImage } from '@components/common/FaviconImage';
import { Icon } from '@components/common/Icon';

export interface GridItemCardProps {
  item: ChromeShortcutItem;
  itemIndex: number;
  sectionId: string;
}

export const GridItemCard = React.memo(({ item, sectionId }: GridItemCardProps) => {
  const {
    isDark,
    onItemClick,
    onEditShortcut,
    onDeleteShortcut,
    getCachedFavicon,
    activeMenuId,
    setActiveMenuId,
  } = useNewtabContext();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: {
      type: 'item',
      item,
      sectionId,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Render placeholder slot in the grid when this item is actively being dragged
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`relative w-28 h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2 select-none pointer-events-none transition-all duration-150 ${
          isDark
            ? 'border-[#8ab4f8]/60 bg-[#8ab4f8]/10 text-[#8ab4f8]'
            : 'border-[#1a73e8]/60 bg-[#1a73e8]/10 text-[#1a73e8]'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 border border-dashed transition-colors ${
            isDark
              ? 'border-[#8ab4f8]/40 bg-[#8ab4f8]/15 text-[#8ab4f8]'
              : 'border-[#1a73e8]/40 bg-[#1a73e8]/15 text-[#1a73e8]'
          }`}
        >
          <Icon name="drive_file_move" size={20} />
        </div>
        <span className="text-[11px] font-medium tracking-wide">Сюда</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => onItemClick(item, sectionId, e)}
      onAuxClick={(e) => {
        if (e.button === 1) onItemClick(item, sectionId, e);
      }}
      className={`group relative w-28 h-28 rounded-lg flex flex-col items-center justify-center p-2 cursor-grab active:cursor-grabbing transition-colors duration-150 select-none touch-none ${
        isDark ? 'hover:bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[#ececec]'
      }`}
    >
      {/* Circular Icon Container */}
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 overflow-hidden pointer-events-none transition-colors ${
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

      {/* Title */}
      <span
        className={`text-[12px] font-normal truncate w-full text-center px-1 pointer-events-none ${
          isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
        }`}
      >
        {item.title}
      </span>

      {/* 3-dots Menu Button */}
      <div
        className="absolute top-1 right-1"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
          title="Опции"
          aria-label="Опции"
          className={`opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center transition-opacity cursor-pointer ${
            isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#e8eaed] text-[#5f6368]'
          }`}
        >
          <Icon name="more_vert" size={16} />
        </button>

        {/* Context Dropdown Menu */}
        {activeMenuId === item.id && (
          <div
            className={`absolute right-0 top-8 w-44 py-1.5 rounded-lg shadow-xl border z-30 ${
              isDark
                ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                : 'bg-white border-[#dadce0] text-[#202124]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                onEditShortcut({
                  id: item.id,
                  title: item.title,
                  url: item.url,
                  sectionId,
                  favicon: item.favicon,
                });
                setActiveMenuId(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
              }`}
            >
              <Icon name="edit" size={16} />
              <span>Изменить ярлык</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onDeleteShortcut(item.id, sectionId);
                setActiveMenuId(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left text-red-400 cursor-pointer ${
                isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
              }`}
            >
              <Icon name="close" size={16} />
              <span>Удалить</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

GridItemCard.displayName = 'GridItemCard';
