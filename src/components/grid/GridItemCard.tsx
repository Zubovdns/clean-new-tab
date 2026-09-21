import React from 'react';

import { ChromeShortcutItem, EditingShortcutData } from '@app-types';
import { DropIndicator } from '@components/common/DropIndicator';
import { FaviconImage } from '@components/common/FaviconImage';
import { Icon } from '@components/common/Icon';

export interface GridItemCardProps {
	item: ChromeShortcutItem;
	itemIndex: number;
	sectionId: string;
	isDark: boolean;
	isDragging: boolean;
	dropIndicatorPosition: 'before' | 'after' | null;
	onItemClick: (item: ChromeShortcutItem, sectionId: string) => void;
	onDragStart: (
		e: React.DragEvent,
		sectionId: string,
		itemIndex: number,
	) => void;
	onDragEnd: () => void;
	onDragOver: (
		e: React.DragEvent,
		sectionId: string,
		itemIndex: number,
		item: ChromeShortcutItem,
		position: 'before' | 'after',
	) => void;
	onDrop: (
		e: React.DragEvent,
		sectionId: string,
		itemIndex: number,
		item: ChromeShortcutItem,
		position: 'before' | 'after',
	) => void;
	onEditShortcut: (data: EditingShortcutData) => void;
	onDeleteShortcut: (id: string, sectionId: string) => void;
	getCachedFavicon: (url: string, favicon?: string) => string;
	activeMenuId: string | null;
	setActiveMenuId: (id: string | null) => void;
}

export const GridItemCard = React.memo(
	({
		item,
		itemIndex,
		sectionId,
		isDark,
		isDragging,
		dropIndicatorPosition,
		onItemClick,
		onDragStart,
		onDragEnd,
		onDragOver,
		onDrop,
		onEditShortcut,
		onDeleteShortcut,
		getCachedFavicon,
		activeMenuId,
		setActiveMenuId,
	}: GridItemCardProps) => {
		const handleDragOver = (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = 'move';

			const rect = e.currentTarget.getBoundingClientRect();
			const relX = e.clientX - rect.left;
			const pos: 'before' | 'after' =
				relX > rect.width / 2 ? 'after' : 'before';

			onDragOver(e, sectionId, itemIndex, item, pos);
		};

		const handleDrop = (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();

			const rect = e.currentTarget.getBoundingClientRect();
			const relX = e.clientX - rect.left;
			const pos: 'before' | 'after' =
				relX > rect.width / 2 ? 'after' : 'before';

			onDrop(e, sectionId, itemIndex, item, pos);
		};

		return (
			<div
				draggable
				onDragStart={(e) => onDragStart(e, sectionId, itemIndex)}
				onDragEnd={onDragEnd}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				onClick={() => onItemClick(item, sectionId)}
				className={`group relative w-28 h-28 rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 ${
					isDragging
						? 'opacity-30 border-2 border-dashed border-[#8ab4f8]'
						: dropIndicatorPosition
							? isDark
								? 'bg-[rgba(255,255,255,0.04)]'
								: 'bg-[#f8f9fa]'
							: isDark
								? 'hover:bg-[rgba(255,255,255,0.08)]'
								: 'hover:bg-[#ececec]'
				}`}
			>
				{/* Drop Indicator (Before or After) */}
				{dropIndicatorPosition && !isDragging && (
					<DropIndicator type='vertical' position={dropIndicatorPosition} />
				)}

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
						className='w-6 h-6 object-contain pointer-events-none'
						letterClassName={
							isDark
								? 'text-[#8ab4f8] text-[18px]'
								: 'text-[#1a73e8] text-[18px]'
						}
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
					className='absolute top-1 right-1'
					onMouseDown={(e) => e.stopPropagation()}
					onClick={(e) => e.stopPropagation()}
				>
					<button
						type='button'
						onClick={() =>
							setActiveMenuId(activeMenuId === item.id ? null : item.id)
						}
						title='Опции'
						aria-label='Опции'
						className={`opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center transition-opacity cursor-pointer ${
							isDark
								? 'hover:bg-[#3c4043] text-[#9aa0a6]'
								: 'hover:bg-[#e8eaed] text-[#5f6368]'
						}`}
					>
						<Icon name='more_vert' size={16} />
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
								type='button'
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
								<Icon name='edit' size={16} />
								<span>Изменить ярлык</span>
							</button>
							<button
								type='button'
								onClick={() => {
									onDeleteShortcut(item.id, sectionId);
									setActiveMenuId(null);
								}}
								className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left text-red-400 cursor-pointer ${
									isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
								}`}
							>
								<Icon name='close' size={16} />
								<span>Удалить</span>
							</button>
						</div>
					)}
				</div>
			</div>
		);
	},
);

GridItemCard.displayName = 'GridItemCard';
