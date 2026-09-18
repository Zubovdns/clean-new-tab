import React from 'react';
import {
  ChromeShortcutItem,
  ChromeSection,
  EditingShortcutData,
} from '@app-types';
import GridItemCard from '@components/grid/GridItemCard';
import Icon from '@components/common/Icon';
import DropIndicator from '@components/common/DropIndicator';

export interface SectionCardProps {
  section: ChromeSection;
  sectionIndex: number;
  isDark: boolean;
  isDraggingThisSection: boolean;
  draggedSectionIndex: number | null;
  showSectionDropIndicatorBefore: boolean;
  showSectionDropIndicatorAfter: boolean;
  draggedItemCoords: { sectionId: string; itemIndex: number } | null;
  dragOverItemInfo: { sectionId: string; itemIndex: number; position: 'before' | 'after' } | null;
  dragOverSectionEndId: string | null;
  onSectionDragStart: (e: React.DragEvent, index: number) => void;
  onSectionDragEnd: () => void;
  onSectionDragOver: (e: React.DragEvent, sectionIndex: number, isBottom: boolean) => void;
  onSectionDrop: (e: React.DragEvent, sectionIndex: number, isBottom: boolean) => void;
  onSectionBodyDragOver: (e: React.DragEvent, sectionId: string) => void;
  onSectionBodyDrop: (e: React.DragEvent, sectionId: string) => void;
  onItemClick: (item: ChromeShortcutItem, sectionId: string) => void;
  onItemDragStart: (e: React.DragEvent, sectionId: string, itemIndex: number) => void;
  onItemDragEnd: () => void;
  onItemDragOver: (
    e: React.DragEvent,
    sectionId: string,
    itemIndex: number,
    item: ChromeShortcutItem,
    position: 'before' | 'after'
  ) => void;
  onItemDrop: (
    e: React.DragEvent,
    sectionId: string,
    itemIndex: number,
    item: ChromeShortcutItem,
    position: 'before' | 'after'
  ) => void;
  onOpenAddModal: (sectionId: string) => void;
  onStartEditingSection: (sec: ChromeSection) => void;
  onSaveEditingSection: () => void;
  onDeleteSection: (sectionId: string) => void;
  editingSectionId: string | null;
  editingSectionTitle: string;
  setEditingSectionTitle: (title: string) => void;
  setEditingSectionId: (id: string | null) => void;
  onEditShortcut: (data: EditingShortcutData) => void;
  onDeleteShortcut: (id: string, sectionId: string) => void;
  getCachedFavicon: (url: string, favicon?: string) => string;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
}

export function SectionCard({
  section,
  sectionIndex,
  isDark,
  isDraggingThisSection,
  draggedSectionIndex,
  showSectionDropIndicatorBefore,
  showSectionDropIndicatorAfter,
  draggedItemCoords,
  dragOverItemInfo,
  dragOverSectionEndId,
  onSectionDragStart,
  onSectionDragEnd,
  onSectionDragOver,
  onSectionDrop,
  onSectionBodyDragOver,
  onSectionBodyDrop,
  onItemClick,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onItemDrop,
  onOpenAddModal,
  onStartEditingSection,
  onSaveEditingSection,
  onDeleteSection,
  editingSectionId,
  editingSectionTitle,
  setEditingSectionTitle,
  setEditingSectionId,
  onEditShortcut,
  onDeleteShortcut,
  getCachedFavicon,
  activeMenuId,
  setActiveMenuId,
}: SectionCardProps) {
  const isEditingTitle = editingSectionId === section.id;
  const isSecMenuOpen = activeMenuId === `sec-menu-${section.id}`;
  const isDraggingSection = draggedSectionIndex !== null;
  const isDropTargetAtEnd = dragOverSectionEndId === section.id && draggedItemCoords !== null;

  return (
    <div
      onDragOver={(e) => {
        if (isDraggingSection) {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const isBottom = e.clientY - rect.top > rect.height / 2;
          onSectionDragOver(e, sectionIndex, isBottom);
        } else {
          onSectionBodyDragOver(e, section.id);
        }
      }}
      onDrop={(e) => {
        if (isDraggingSection) {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const isBottom = e.clientY - rect.top > rect.height / 2;
          onSectionDrop(e, sectionIndex, isBottom);
        } else {
          onSectionBodyDrop(e, section.id);
        }
      }}
      className={`relative rounded-2xl p-5 border transition-all duration-150 group/section ${
        isDraggingThisSection
          ? 'opacity-30 border-dashed border-[#8ab4f8]'
          : isDark
          ? 'bg-[#28292c]/50 border-[#3c4043]/50 hover:border-[#3c4043]'
          : 'bg-[#fafafa] border-[#e4e6eb] hover:border-[#d0d3d8]'
      }`}
    >
      {/* Section Drop Indicator (Before / Top) */}
      {showSectionDropIndicatorBefore && (
        <DropIndicator type="horizontal" position="before" />
      )}

      {/* Section Drop Indicator (After / Bottom) */}
      {showSectionDropIndicatorAfter && (
        <DropIndicator type="horizontal" position="after" />
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between mb-3.5 px-1 select-none">
        <div className="flex items-center gap-2">
          {/* Section Drag Handle */}
          <div
            draggable
            onDragStart={(e) => onSectionDragStart(e, sectionIndex)}
            onDragEnd={onSectionDragEnd}
            title="Перетащить секцию"
            className="cursor-grab active:cursor-grabbing text-[#9aa0a6] hover:text-[#e8eaed] transition-colors p-0.5 rounded"
          >
            <Icon name="drag_indicator" size={18} />
          </div>

          {/* Section Title or Inline Edit Input */}
          {isEditingTitle ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={editingSectionTitle}
                onChange={(e) => setEditingSectionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEditingSection();
                  if (e.key === 'Escape') setEditingSectionId(null);
                }}
                autoFocus
                className={`text-sm font-semibold px-2 py-0.5 rounded outline-none border transition-colors ${
                  isDark
                    ? 'bg-[#303134] border-[#8ab4f8] text-[#e8eaed]'
                    : 'bg-white border-[#1a73e8] text-[#202124]'
                }`}
              />
              <button
                type="button"
                onClick={onSaveEditingSection}
                className="text-xs px-2.5 py-1 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3
                onDoubleClick={() => onStartEditingSection(section)}
                className={`text-sm font-semibold tracking-wide cursor-pointer ${
                  isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                }`}
                title="Дважды кликните, чтобы изменить название"
              >
                {section.title}
              </h3>
              <span className="text-[11px] text-[#9aa0a6]">
                {section.items.length}
              </span>
            </div>
          )}
        </div>

        {/* Section Options Button */}
        <div
          className="relative"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setActiveMenuId(isSecMenuOpen ? null : `sec-menu-${section.id}`)}
            title="Опции секции"
            aria-label="Опции секции"
            className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
              isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#e8eaed] text-[#5f6368]'
            }`}
          >
            <Icon name="more_vert" size={16} />
          </button>

          {/* Section Dropdown Menu */}
          {isSecMenuOpen && (
            <div
              className={`absolute right-0 top-8 w-48 py-1.5 rounded-lg shadow-xl border z-30 ${
                isDark
                  ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                  : 'bg-white border-[#dadce0] text-[#202124]'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onStartEditingSection(section)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                  isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                }`}
              >
                <Icon name="edit" size={16} />
                <span>Переименовать секцию</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMenuId(null);
                  onOpenAddModal(section.id);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                  isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                }`}
              >
                <Icon name="add" size={16} />
                <span>Добавить ярлык</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left text-red-400 cursor-pointer ${
                  isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                }`}
              >
                <Icon name="delete" size={16} />
                <span>Удалить секцию</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Items Grid inside Section */}
      <div
        className="flex flex-wrap gap-y-3 gap-x-2 select-none min-h-[112px] items-center"
        onDragOver={(e) => onSectionBodyDragOver(e, section.id)}
        onDrop={(e) => onSectionBodyDrop(e, section.id)}
      >
        {section.items.map((item, itIdx) => {
          const isDragging =
            draggedItemCoords?.sectionId === section.id &&
            draggedItemCoords?.itemIndex === itIdx;
          const isTarget =
            dragOverItemInfo?.sectionId === section.id &&
            dragOverItemInfo?.itemIndex === itIdx &&
            !isDragging;
          const dropIndicatorPosition = isTarget ? dragOverItemInfo.position : null;

          return (
            <GridItemCard
              key={item.id}
              item={item}
              itemIndex={itIdx}
              sectionId={section.id}
              isDark={isDark}
              isDragging={isDragging}
              dropIndicatorPosition={dropIndicatorPosition}
              onItemClick={onItemClick}
              onDragStart={onItemDragStart}
              onDragEnd={onItemDragEnd}
              onDragOver={onItemDragOver}
              onDrop={onItemDrop}
              onEditShortcut={onEditShortcut}
              onDeleteShortcut={onDeleteShortcut}
              getCachedFavicon={getCachedFavicon}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
            />
          );
        })}

        {/* Empty Section Drop Target placeholder when dragging an item */}
        {isDropTargetAtEnd && section.items.length === 0 && (
          <div className="w-[112px] h-[112px] rounded-lg border-2 border-dashed border-[#1a73e8] dark:border-[#8ab4f8] bg-[#1a73e8]/10 dark:bg-[#8ab4f8]/10 flex flex-col items-center justify-center pointer-events-none animate-pulse">
            <Icon
              name="drive_file_move"
              size={24}
              className={isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}
            />
            <span
              className={`text-[11px] font-medium mt-1 ${
                isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'
              }`}
            >
              Сюда
            </span>
          </div>
        )}

        {/* "+ Добавить" Tile inside this Section */}
        <button
          type="button"
          onClick={() => onOpenAddModal(section.id)}
          onDragOver={(e) => {
            if (draggedItemCoords) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              onSectionBodyDragOver(e, section.id);
            }
          }}
          onDrop={(e) => {
            if (draggedItemCoords) {
              e.preventDefault();
              e.stopPropagation();
              onSectionBodyDrop(e, section.id);
            }
          }}
          className={`relative w-[112px] h-[112px] rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 group ${
            isDark ? 'hover:bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[#ececec]'
          }`}
        >
          {/* Drop Indicator before Add button (meaning: at the end of the items list) */}
          {isDropTargetAtEnd && section.items.length > 0 && (
            <DropIndicator type="vertical" position="before" />
          )}

          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
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
        </button>
      </div>
    </div>
  );
}

export default React.memo(SectionCard);
