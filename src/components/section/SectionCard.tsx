import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';

import { useNewtabContext } from '@/context/NewtabContext';
import { ChromeSection } from '@app-types';
import { Icon } from '@components/common/Icon';
import { GridItemCard } from '@components/grid/GridItemCard';

export interface SectionCardProps {
  section: ChromeSection;
  sectionIndex: number;
  totalSections: number;
}

export const SectionCard = React.memo(({ section }: SectionCardProps) => {
  const {
    isDark,
    activeMenuId,
    setActiveMenuId,
    editingSectionId,
    editingSectionTitle,
    setEditingSectionId,
    setEditingSectionTitle,
    onStartEditingSection,
    onSaveEditingSection,
    onDeleteSection,
    onOpenAddModal,
  } = useNewtabContext();

  const {
    attributes: sectionAttributes,
    listeners: sectionListeners,
    setNodeRef: setSectionNodeRef,
    transform: sectionTransform,
    transition: sectionTransition,
    isDragging: isSectionDragging,
  } = useSortable({
    id: section.id,
    data: {
      type: 'section',
      section,
    },
  });

  const sectionStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sectionTransform),
    transition: sectionTransition,
  };

  const isEditingTitle = editingSectionId === section.id;
  const isSecMenuOpen = activeMenuId === `sec-menu-${section.id}`;

  return (
    <div
      ref={setSectionNodeRef}
      style={sectionStyle}
      className={`relative rounded-2xl p-5 border transition-all duration-150 group/section ${
        isSectionDragging
          ? 'opacity-30 border-2 border-dashed border-[#8ab4f8]'
          : isDark
            ? 'bg-[#28292c]/50 border-[#3c4043]/50 hover:border-[#3c4043]'
            : 'bg-[#fafafa] border-[#e4e6eb] hover:border-[#d0d3d8]'
      }`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3.5 px-1 select-none">
        <div className="flex items-center gap-2">
          {/* Section Drag Handle */}
          <div
            {...sectionAttributes}
            {...sectionListeners}
            title="Перетащить секцию"
            className="cursor-grab active:cursor-grabbing text-[#9aa0a6] hover:text-[#e8eaed] transition-colors p-0.5 rounded touch-none"
          >
            <Icon name="drag_indicator" size={18} />
          </div>

          {/* Section Title or Inline Edit Input */}
          {isEditingTitle ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
              <span className="text-[11px] text-[#9aa0a6]">{section.items.length}</span>
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
      <div className="flex flex-wrap gap-y-3 gap-x-2 select-none min-h-28 items-center">
        <SortableContext
          items={section.items.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          {section.items.map((item, itIdx) => (
            <GridItemCard key={item.id} item={item} itemIndex={itIdx} sectionId={section.id} />
          ))}
        </SortableContext>

        {/* "+ Добавить" Tile inside this Section */}
        <button
          type="button"
          onClick={() => onOpenAddModal(section.id)}
          className={`relative w-28 h-28 rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 group ${
            isDark ? 'hover:bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[#ececec]'
          }`}
        >
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
});

SectionCard.displayName = 'SectionCard';
