import React, { useState, useRef } from 'react';
import { ChromeSection, ChromeFolder, EditingShortcutData } from '@app-types';
import FaviconImage from '@components/common/FaviconImage';

export interface FolderModalProps {
  isOpen: boolean;
  isDark: boolean;
  activeSection: ChromeSection | null;
  activeFolder: ChromeFolder | null;
  onClose: () => void;
  onBookmarkClick: (url: string) => void;
  onOpenAddModal: (sectionId: string, folderId: string) => void;
  onOpenEditModal: (data: EditingShortcutData) => void;
  onDeleteBookmark: (id: string, sectionId: string, folderId: string) => void;
  onReorderBookmarks: (sectionId: string, folderId: string, sourceIndex: number, targetIndex: number) => void;
  getCachedFavicon: (url: string, favicon?: string) => string;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
}

export function FolderModal({
  isOpen,
  isDark,
  activeSection,
  activeFolder,
  onClose,
  onBookmarkClick,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteBookmark,
  onReorderBookmarks,
  getCachedFavicon,
  activeMenuId,
  setActiveMenuId,
}: FolderModalProps) {
  const [draggedFolderItemIndex, setDraggedFolderItemIndex] = useState<number | null>(null);
  const [dragOverFolderItemIndex, setDragOverFolderItemIndex] = useState<number | null>(null);
  const draggedFolderItemIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  if (!isOpen || !activeFolder || !activeSection) return null;

  const handleFolderItemDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    draggedFolderItemIndexRef.current = index;
    setDraggedFolderItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleFolderItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderItemIndex !== index) {
      setDragOverFolderItemIndex(index);
    }
  };

  const handleFolderItemDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIndex = draggedFolderItemIndexRef.current;
    if (sourceIndex !== null && sourceIndex !== targetIndex) {
      onReorderBookmarks(activeSection.id, activeFolder.id, sourceIndex, targetIndex);
    }
    handleFolderItemDragEnd();
  };

  const handleFolderItemDragEnd = () => {
    draggedFolderItemIndexRef.current = null;
    setDraggedFolderItemIndex(null);
    setDragOverFolderItemIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  const handleItemClick = (url: string) => {
    if (isDraggingRef.current) return;
    onBookmarkClick(url);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-40 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[540px] rounded-2xl p-6 shadow-2xl border transition-all ${
          isDark
            ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
            : 'bg-white border-[#dadce0] text-[#202124]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Folder Header */}
        <div className="flex items-center justify-between mb-5 select-none">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#8ab4f8] text-[24px]">
              folder
            </span>
            <h2 className="text-[18px] font-medium">{activeFolder.title}</h2>
            <span className="text-xs text-[#9aa0a6] font-normal">
              ({activeFolder.items.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
              isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#f1f3f4] text-[#5f6368]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Bookmarks Grid inside Folder */}
        <div className="flex flex-wrap gap-2 max-h-[50vh] overflow-y-auto no-scrollbar py-1 select-none">
          {activeFolder.items.map((b, bIdx) => {
            const isDragging = draggedFolderItemIndex === bIdx;
            const isDropTarget = dragOverFolderItemIndex === bIdx && !isDragging;

            return (
              <div
                key={b.id}
                draggable
                onDragStart={(e) => handleFolderItemDragStart(e, bIdx)}
                onDragEnd={handleFolderItemDragEnd}
                onDragOver={(e) => handleFolderItemDragOver(e, bIdx)}
                onDrop={(e) => handleFolderItemDrop(e, bIdx)}
                onClick={() => handleItemClick(b.url)}
                className={`group relative w-[100px] h-[100px] rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 ${
                  isDragging
                    ? 'opacity-30'
                    : isDropTarget
                    ? isDark
                      ? 'bg-[#3c4043] ring-2 ring-[#8ab4f8]'
                      : 'bg-[#e8eaed] ring-2 ring-[#1a73e8]'
                    : isDark
                    ? 'hover:bg-[rgba(255,255,255,0.08)]'
                    : 'hover:bg-[#f1f3f4]'
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 overflow-hidden pointer-events-none transition-colors ${
                    isDark ? 'bg-[#303134]' : 'bg-[#f1f3f4]'
                  }`}
                >
                  <FaviconImage
                    url={b.url}
                    title={b.title}
                    size={48}
                    isDark={isDark}
                    className="w-5 h-5 object-contain pointer-events-none"
                    letterClassName={isDark ? 'text-[#8ab4f8] text-[16px]' : 'text-[#1a73e8] text-[16px]'}
                    customFavicon={b.favicon}
                    cachedFavicon={getCachedFavicon(b.url, b.favicon)}
                  />
                </div>

                {/* Title */}
                <span
                  className={`text-[11px] font-normal truncate w-full text-center px-0.5 pointer-events-none ${
                    isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                  }`}
                >
                  {b.title}
                </span>

                {/* 3-dots Menu Button */}
                <div
                  className="absolute top-1 right-1"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMenuId(activeMenuId === b.id ? null : b.id)
                    }
                    title="Опции"
                    className={`opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center transition-opacity cursor-pointer ${
                      isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#e8eaed] text-[#5f6368]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">more_vert</span>
                  </button>

                  {/* Context Menu inside folder */}
                  {activeMenuId === b.id && (
                    <div
                      className={`absolute right-0 top-7 w-40 py-1.5 rounded-lg shadow-xl border z-50 ${
                        isDark
                          ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                          : 'bg-white border-[#dadce0] text-[#202124]'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onOpenEditModal({
                            id: b.id,
                            title: b.title,
                            url: b.url,
                            sectionId: activeSection.id,
                            folderId: activeFolder.id,
                            favicon: b.favicon,
                          });
                          setActiveMenuId(null);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left cursor-pointer ${
                          isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                        <span>Изменить</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteBookmark(b.id, activeSection.id, activeFolder.id);
                          setActiveMenuId(null);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left text-red-400 cursor-pointer ${
                          isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">close</span>
                        <span>Удалить</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* "+ Добавить в эту папку" Button */}
          <button
            type="button"
            onClick={() => onOpenAddModal(activeSection.id, activeFolder.id)}
            className={`w-[100px] h-[100px] rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 group ${
              isDark ? 'hover:bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[#f1f3f4]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 transition-colors ${
                isDark ? 'bg-[#303134] text-[#e8eaed]' : 'bg-[#f1f3f4] text-[#5f6368]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </div>
            <span
              className={`text-[11px] font-normal truncate w-full text-center px-0.5 ${
                isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
              }`}
            >
              Добавить
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default FolderModal;
