import React from 'react';
import { Modal } from './index';
import type { ConfirmModalProps } from './types';

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '確認',
  cancelText = 'キャンセル',
  variant = 'default',
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header>
        <Modal.Title>{title}</Modal.Title>
        <Modal.CloseButton />
      </Modal.Header>

      <Modal.Content>
        <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{message}</p>
      </Modal.Content>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 dark:text-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={handleConfirm}
          className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
            variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {confirmText}
        </button>
      </Modal.Footer>
    </Modal>
  );
};
