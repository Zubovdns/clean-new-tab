import React, { useState, useEffect } from 'react';
import { ChromeSection } from '@app-types';

export interface AddItemModalProps {
  isOpen: boolean;
  isDark: boolean;
  sections: ChromeSection[];
  targetSectionId: string;
  targetFolderId: string | null;
  onClose: () => void;
  onSaveShortcut: (sectionId: string, folderId: string | null, data: { title: string; url: string; favicon?: string }) => void;
  onSaveFolder: (sectionId: string, title: string) => void;
}

export function AddItemModal({
  isOpen,
  isDark,
  sections,
  targetSectionId: initialSectionId,
  targetFolderId,
  onClose,
  onSaveShortcut,
  onSaveFolder,
}: AddItemModalProps) {
  const [modalType, setModalType] = useState<'shortcut' | 'folder'>('shortcut');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [favicon, setFavicon] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setModalType('shortcut');
      setTitle('');
      setUrl('');
      setFavicon('');
      setSelectedSectionId(initialSectionId || sections[0]?.id || '');
    }
  }, [isOpen, initialSectionId, sections]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const secId = selectedSectionId || sections[0]?.id;
    if (!secId) return;

    if (modalType === 'folder' && !targetFolderId) {
      if (!title.trim()) return;
      onSaveFolder(secId, title.trim());
      onClose();
      return;
    }

    if (!url.trim()) return;
    onSaveShortcut(secId, targetFolderId, {
      title: title.trim(),
      url: url.trim(),
      favicon: favicon.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[400px] rounded-2xl p-6 shadow-2xl border transition-all ${
          isDark
            ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
            : 'bg-white border-[#dadce0] text-[#202124]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tab switch: Shortcut vs Folder (only when adding to section root) */}
        {!targetFolderId && (
          <div className="flex rounded-full p-1 mb-5 bg-black/15 select-none">
            <button
              type="button"
              onClick={() => setModalType('shortcut')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all ${
                modalType === 'shortcut'
                  ? isDark
                    ? 'bg-[#3c4043] text-white shadow-xs'
                    : 'bg-white text-black shadow-xs'
                  : 'text-[#9aa0a6]'
              }`}
            >
              Ярлык
            </button>
            <button
              type="button"
              onClick={() => setModalType('folder')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all ${
                modalType === 'folder'
                  ? isDark
                    ? 'bg-[#3c4043] text-white shadow-xs'
                    : 'bg-white text-black shadow-xs'
                  : 'text-[#9aa0a6]'
              }`}
            >
              Папка
            </button>
          </div>
        )}

        <h2 className="text-[16px] font-medium mb-4 select-none">
          {targetFolderId
            ? 'Добавить в папку'
            : modalType === 'folder'
            ? 'Новая папка'
            : 'Добавить ярлык'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Select section if not adding to a folder */}
          {!targetFolderId && sections.length > 1 && (
            <div>
              <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                Секция
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                  isDark
                    ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                    : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                }`}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
              Название
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={modalType === 'folder' ? 'Работа' : 'GitHub'}
              autoFocus
              required={modalType === 'folder'}
              className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                isDark
                  ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                  : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
              }`}
            />
          </div>

          {modalType === 'shortcut' && (
            <>
              <div>
                <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com"
                  required
                  className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                      : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                  Иконка (необязательно, URL или data:)
                </label>
                <input
                  type="text"
                  value={favicon}
                  onChange={(e) => setFavicon(e.target.value)}
                  placeholder="https://.../icon.png"
                  className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                      : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                  }`}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 mt-4 select-none">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                isDark ? 'hover:bg-[#3c4043] text-[#8ab4f8]' : 'hover:bg-[#f1f3f4] text-[#1a73e8]'
              }`}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
                  : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
              }`}
            >
              Готово
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const AddItemModalMemo = React.memo(AddItemModal);
export default AddItemModalMemo;

