import React, { createContext, useContext, useEffect } from 'react';
import { cn } from '../../../lib/utils';
import type { ModalProps, ModalContextType } from './types';

const ModalContext = createContext<ModalContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('Modal components must be used within a Modal');
  }
  return context;
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'lg',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  children,
}) => {
  // ESCキーでクローズ
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose, closeOnEscape]);

  // ボディスクロール制御
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalContext.Provider value={{ onClose }}>
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="fixed inset-0" onClick={closeOnOverlayClick ? onClose : undefined} />
        <div
          className={cn(
            'bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden relative',
            size === 'sm'
              ? 'max-w-sm'
              : size === 'md'
                ? 'max-w-md'
                : size === 'lg'
                  ? 'max-w-lg'
                  : size === 'xl'
                    ? 'max-w-7xl min-h-[70vh] w-[80vw]'
                    : size === 'full'
                      ? 'max-w-none w-full h-full'
                      : 'max-w-lg',
            size === 'full' ? 'h-full' : 'max-h-[calc(100vh-2rem)]',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );
};
