import React, { useState, useEffect } from 'react';
import { ChromeSection, EditingFolderData } from '@app-types';

export interface EditFolderModalProps {
  data: EditingFolderData | null;
  isDark: boolean;
  sections: ChromeSection[];
  onClose: () => void;
  onSave: (data: EditingFolderData) => void;
  onDelete: (id: string, sectionId: string) => void;
}

export function EditFolderModal({
  data,
  isDark,
  sections,
  onClose,
  onSave,
  onDelete,
}: EditFolderModalProps) {
  const [formData, setFormData] = useState<EditingFolderData | null>(null);

  useEffect(() => {
    setFormData(data ? { ...data } : null);
  }, [data]);

  if (!data || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSave(formData);
    onClose();
  };

  const handleDelete = () => {
    onDelete(formData.id, formData.sectionId);
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
        <h2 className="text-[16px] font-medium mb-4 select-none">Изменить папку</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
              Название папки
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              autoFocus
              required
              className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                isDark
                  ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                  : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
              }`}
            />
          </div>

          {/* Move folder to another Section */}
          {sections.length > 1 && (
            <div>
              <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                Секция
              </label>
              <select
                value={formData.sectionId}
                onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
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

          <div className="flex items-center justify-between mt-4 select-none">
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
            >
              Удалить папку
            </button>

            <div className="flex items-center gap-2">
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
          </div>
        </form>
      </div>
    </div>
  );
}

export const EditFolderModalMemo = React.memo(EditFolderModal);
export default EditFolderModalMemo;

