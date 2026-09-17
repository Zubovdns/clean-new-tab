import React from 'react';
import {
  ChromeGridItem,
  ChromeSection,
  EditingFolderData,
  EditingShortcutData,
} from '@app-types';
import GridItemCard from '@components/grid/GridItemCard';

export interface SectionCardProps {
  section: ChromeSection;
  sectionIndex: number;
  isDark: boolean;
  isDraggingThisSection: boolean;
  isSectionDropTarget: boolean;
  isSectionItemHover: boolean;
  draggedItemCoords: { sectionId: string; itemIndex: number } | null;
  dragOverItemCoords: { sectionId: string; itemIndex: number } | null;
  dragOverFolderTargetId: string | null;
  onSectionDragStart: (e: React.DragEvent, index: number) => void;
  onSectionDragEnd: () => void;
  onSectionDragOver: (e: React.DragEvent, index: number) => void;
  onSectionDrop: (e: React.DragEvent, index: number) => void;
  onSectionBodyDragOver: (e: React.DragEvent, sectionId: string) => void;
  onSectionBodyDrop: (e: React.DragEvent, sectionId: string) => void;
  onItemClick: (item: ChromeGridItem, sectionId: string) => void;
  onItemDragStart: (e: React.DragEvent, sectionId: string, itemIndex: number) => void;
  onItemDragEnd: () => void;
  onItemDragOver: (e: React.DragEvent, sectionId: string, itemIndex: number, item: ChromeGridItem) => void;
  onItemDrop: (e: React.DragEvent, sectionId: string, itemIndex: number, item: ChromeGridItem) => void;
  onOpenAddModal: (sectionId: string, folderId: string | null) => void;
  onStartEditingSection: (sec: ChromeSection) => void;
  onSaveEditingSection: () => void;
  onDeleteSection: (sectionId: string) => void;
  editingSectionId: string | null;
  editingSectionTitle: string;
  setEditingSectionTitle: (title: string) => void;
  setEditingSectionId: (id: string | null) => void;
  onEditShortcut: (data: EditingShortcutData) => void;
  onDeleteShortcut: (id: string, sectionId: string) => void;
  onEditFolder: (data: EditingFolderData) => void;
  onDeleteFolder: (id: string, sectionId: string) => void;
  getCachedFavicon: (url: string, favicon?: string) => string;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
}

export function SectionCard({
  section,
  sectionIndex,
  isDark,
  isDraggingThisSection,
  isSectionDropTarget,
  isSectionItemHover,
  draggedItemCoords,
  dragOverItemCoords,
  dragOverFolderTargetId,
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
  onEditFolder,
  onDeleteFolder,
  getCachedFavicon,
  activeMenuId,
  setActiveMenuId,
}: SectionCardProps) {
  const isEditingTitle = editingSectionId === section.id;
  const isSecMenuOpen = activeMenuId === `sec-menu-${section.id}`;

  return (
    <div
      onDragOver={(e) => {
        onSectionDragOver(e, sectionIndex);
        onSectionBodyDragOver(e, section.id);
      }}
      onDrop={(e) => {
        onSectionDrop(e, sectionIndex);
        onSectionBodyDrop(e, section.id);
      }}
      className={`relative rounded-2xl p-5 border transition-all duration-150 group/section ${
        isDraggingThisSection
          ? 'opacity-30 border-dashed border-[#8ab4f8]'
          : isSectionDropTarget
          ? isDark
            ? 'border-[#8ab4f8] ring-2 ring-[#8ab4f8] bg-[#2d3034]'
            : 'border-[#1a73e8] ring-2 ring-[#1a73e8] bg-[#f1f3f4]'
          : isSectionItemHover
          ? isDark
            ? 'border-[#8ab4f8]/60 bg-[#2d3034]'
            : 'border-[#1a73e8]/60 bg-[#f1f3f4]'
          : isDark
          ? 'bg-[#28292c]/50 border-[#3c4043]/50 hover:border-[#3c4043]'
          : 'bg-[#fafafa] border-[#e4e6eb] hover:border-[#d0d3d8]'
      }`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3.5 px-1 select-none">
        <div className="flex items-center gap-2">
          {/* Reorder Grip Handle */}
          <div
            draggable
            onDragStart={(e) => onSectionDragStart(e, sectionIndex)}
            onDragEnd={onSectionDragEnd}
            className={`cursor-grab active:cursor-grabbing p-1 rounded-md transition-colors ${
              isDark
                ? 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]'
                : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed]'
            }`}
            title="Перетащить секцию"
          >
            <span className="material-symbols-outlined text-[20px] leading-none block">
              drag_indicator
            </span>
          </div>

          {/* Section Title (Inline Editable) */}
          {isEditingTitle ? (
            <input
              type="text"
              value={editingSectionTitle}
              onChange={(e) => setEditingSectionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEditingSection();
                if (e.key === 'Escape') setEditingSectionId(null);
              }}
              onBlur={onSaveEditingSection}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              className={`text-[15px] font-medium px-2 py-0.5 rounded outline-none border transition-colors ${
                isDark
                  ? 'bg-[#303134] border-[#8ab4f8] text-[#e8eaed]'
                  : 'bg-white border-[#1a73e8] text-[#202124]'
              }`}
            />
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer group/title"
              onClick={(e) => {
                e.stopPropagation();
                onStartEditingSection(section);
              }}
              title="Кликните, чтобы переименовать"
            >
              <h3 className="text-[15px] font-medium tracking-tight">
                {section.title}
              </h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-normal ${
                  isDark
                    ? 'bg-[#303134] text-[#9aa0a6]'
                    : 'bg-[#e8eaed] text-[#5f6368]'
                }`}
              >
                {section.items.length}
              </span>
              <span
                className={`material-symbols-outlined text-[15px] opacity-0 group-hover/title:opacity-100 transition-opacity ${
                  isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'
                }`}
              >
                edit
              </span>
            </div>
          )}
        </div>

        {/* Section Controls */}
        <div className="flex items-center gap-1">
          {/* Quick Add Button in Header */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAddModal(section.id, null);
            }}
            title="Добавить ярлык или папку в эту секцию"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-[#3c4043] text-[#9aa0a6] hover:text-[#e8eaed]'
                : 'hover:bg-[#e8eaed] text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>

          {/* Section 3-dots Menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveMenuId(isSecMenuOpen ? null : `sec-menu-${section.id}`)}
              title="Опции секции"
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isDark
                  ? 'hover:bg-[#3c4043] text-[#9aa0a6]'
                  : 'hover:bg-[#e8eaed] text-[#5f6368]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">more_vert</span>
            </button>

            {isSecMenuOpen && (
              <div
                className={`absolute right-0 top-8 w-48 py-1.5 rounded-lg shadow-xl border z-30 ${
                  isDark
                    ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                    : 'bg-white border-[#dadce0] text-[#202124]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onStartEditingSection(section)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                    isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Переименовать секцию</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuId(null);
                    onOpenAddModal(section.id, null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                    isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Добавить элемент</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left text-red-400 cursor-pointer ${
                    isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Удалить секцию</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Grid inside Section (Folders and Shortcuts) */}
      <div
        className="flex flex-wrap gap-y-3 gap-x-2 select-none min-h-[112px] items-center"
        onDragOver={(e) => onSectionBodyDragOver(e, section.id)}
        onDrop={(e) => onSectionBodyDrop(e, section.id)}
      >
        {section.items.map((item, itIdx) => {
          const isDragging =
            draggedItemCoords?.sectionId === section.id &&
            draggedItemCoords?.itemIndex === itIdx;
          const isDropTarget =
            dragOverItemCoords?.sectionId === section.id &&
            dragOverItemCoords?.itemIndex === itIdx &&
            !isDragging;
          const isFolderHoverTarget = dragOverFolderTargetId === item.id;

          return (
            <GridItemCard
              key={item.id}
              item={item}
              itemIndex={itIdx}
              sectionId={section.id}
              isDark={isDark}
              isDragging={isDragging}
              isDropTarget={isDropTarget}
              isFolderHoverTarget={isFolderHoverTarget}
              onItemClick={onItemClick}
              onDragStart={onItemDragStart}
              onDragEnd={onItemDragEnd}
              onDragOver={onItemDragOver}
              onDrop={onItemDrop}
              onEditShortcut={onEditShortcut}
              onDeleteShortcut={onDeleteShortcut}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              getCachedFavicon={getCachedFavicon}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
            />
          );
        })}

        {/* "+ Добавить" Tile inside this Section */}
        <button
          type="button"
          onClick={() => onOpenAddModal(section.id, null)}
          className={`w-[112px] h-[112px] rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 group ${
            isDark ? 'hover:bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[#ececec]'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
              isDark ? 'bg-[#303134] text-[#e8eaed]' : 'bg-[#f1f3f4] text-[#5f6368]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
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

export default SectionCard;
