import React, { useState, useEffect } from 'react';

export interface AddSectionModalProps {
  isOpen: boolean;
  isDark: boolean;
  onClose: () => void;
  onCreate: (title: string) => void | Promise<void>;
}

export const AddSectionModal = React.memo(
  ({ isOpen, isDark, onClose, onCreate }: AddSectionModalProps) => {
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
      if (isOpen) {
        setTitle('');
        setIsSubmitting(false);
      }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await onCreate(title);
        onClose();
      } catch (err) {
        console.error('[AddSectionModal] Error creating section:', err);
      } finally {
        setIsSubmitting(false);
      }
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
          <h2 className="text-[16px] font-medium mb-4 select-none">Новая секция</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                Название секции
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, Работа или Учёба"
                autoFocus
                required
                className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                  isDark
                    ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                    : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                }`}
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 select-none">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={`px-4 py-2 text-xs font-medium rounded-full transition-colors ${
                  isSubmitting
                    ? 'opacity-50 cursor-not-allowed text-[#9aa0a6]'
                    : isDark
                      ? 'hover:bg-[#3c4043] text-[#8ab4f8] cursor-pointer'
                      : 'hover:bg-[#f1f3f4] text-[#1a73e8] cursor-pointer'
                }`}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2 text-xs font-medium rounded-full transition-colors ${
                  isSubmitting
                    ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white'
                    : isDark
                      ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124] cursor-pointer'
                      : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white cursor-pointer'
                }`}
              >
                {isSubmitting ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  },
);

AddSectionModal.displayName = 'AddSectionModal';
