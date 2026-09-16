import React, { useState, useRef, useEffect } from 'react';
import { Popper, ClickAwayListener, Fade } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

/**
 * Custom Material 3 Select Component
 * Renders dropdown menu via Popper in a portal over the modal window
 * Never expands dialog content or causes clipping
 */
export default function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Выберите...',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const buttonWidth = buttonRef.current ? buttonRef.current.offsetWidth : undefined;

  return (
    <ClickAwayListener onClickAway={() => setIsOpen(false)}>
      <div className="relative w-full select-none text-left">
        {label && (
          <label className="block text-xs font-medium text-[#c4c7c5] mb-1.5">
            {label}
          </label>
        )}

        {/* Trigger Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
            isOpen
              ? 'bg-[#20232b] border-[#a8c7fa] ring-1 ring-[#a8c7fa]'
              : 'bg-[#16181f] border-[#44474f] hover:border-[#8e9199]'
          } border text-sm text-[#e2e2e9] outline-none shadow-sm`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2.5 truncate">
            {selectedOption?.icon && (
              <span className="flex-shrink-0 text-[#a8c7fa] flex items-center">
                {selectedOption.icon}
              </span>
            )}
            <span className={selectedOption ? 'text-[#e2e2e9] font-medium truncate' : 'text-[#8e9199]'}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ExpandMoreIcon
            className={`text-[#c4c7c5] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#a8c7fa]' : ''
            }`}
            fontSize="small"
          />
        </button>

        {/* Floating Dropdown Menu rendered via Popper outside the Dialog DOM */}
        <Popper
          open={isOpen}
          anchorEl={buttonRef.current}
          placement="bottom-start"
          transition
          style={{
            zIndex: 1450, // Higher than MUI Dialog (1300) to render above the modal window
            width: buttonWidth,
          }}
          modifiers={[
            {
              name: 'offset',
              options: {
                offset: [0, 6],
              },
            },
            {
              name: 'preventOverflow',
              options: {
                boundary: 'clippingParents',
                padding: 8,
              },
            },
          ]}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={180}>
              <div
                role="listbox"
                className="rounded-2xl bg-[#232731] border border-[#3b3f4c] shadow-[0_12px_36px_rgba(0,0,0,0.6)] p-1.5 max-h-56 overflow-y-auto"
                style={{ width: buttonWidth }}
              >
                {options.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-[#8e9199] text-center">
                    Нет доступных вариантов
                  </div>
                ) : (
                  options.map((option) => {
                    const isSelected = option.value === value;

                    return (
                      <div
                        key={option.value}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(option.value)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer my-0.5 ${
                          isSelected
                            ? 'bg-[#004a77] text-[#c2e7ff] font-medium'
                            : 'text-[#e2e2e9] hover:bg-[#2c313d]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {option.icon && (
                            <span className={`flex-shrink-0 flex items-center ${isSelected ? 'text-[#a8c7fa]' : 'text-[#8e9199]'}`}>
                              {option.icon}
                            </span>
                          )}
                          <span className="truncate">{option.label}</span>
                        </div>

                        {isSelected && (
                          <CheckIcon className="text-[#a8c7fa] ml-2 flex-shrink-0" fontSize="small" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Fade>
          )}
        </Popper>
      </div>
    </ClickAwayListener>
  );
}
