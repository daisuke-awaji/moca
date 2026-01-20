/**
 * Download Progress Modal
 * フォルダダウンロードの進捗を表示するモーダル
 */

import React from 'react';
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from './Modal/Modal';
import { useTranslation } from 'react-i18next';

interface DownloadProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: {
    current: number;
    total: number;
    percentage: number;
    currentFile: string;
  };
  status: 'downloading' | 'success' | 'error' | 'cancelled';
  errorMessage?: string;
  onCancel?: () => void;
}

export const DownloadProgressModal: React.FC<DownloadProgressModalProps> = ({
  isOpen,
  onClose,
  progress,
  status,
  errorMessage,
  onCancel,
}) => {
  const { t } = useTranslation();

  const canClose = status === 'success' || status === 'error' || status === 'cancelled';

  return (
    <Modal isOpen={isOpen} onClose={canClose ? onClose : () => {}}>
      <div className="w-full max-w-md min-w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {status === 'downloading' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
            {status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {status === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
            {status === 'cancelled' && <XCircle className="w-5 h-5 text-gray-600" />}
            <h2 className="text-xl font-semibold text-gray-900">
              {status === 'downloading' && t('storage.downloadProgress.downloading')}
              {status === 'success' && t('storage.downloadProgress.success')}
              {status === 'error' && t('storage.downloadProgress.error')}
              {status === 'cancelled' && t('storage.downloadProgress.cancelled')}
            </h2>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 min-h-[200px]">
          {/* Progress Bar */}
          {(status === 'downloading' || status === 'success') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  {progress.current} / {progress.total} {t('storage.downloadProgress.files')}
                </span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    status === 'success' ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Current File */}
          {status === 'downloading' && (
            <div className="space-y-1 min-h-[52px]">
              <p className="text-sm text-gray-500">{t('storage.downloadProgress.currentFile')}</p>
              <p
                className="text-sm text-gray-900 font-mono truncate max-w-full overflow-hidden"
                title={progress.currentFile}
              >
                {progress.currentFile}
              </p>
            </div>
          )}

          {/* Success Message */}
          {status === 'success' && (
            <div className="text-sm text-gray-600">
              <p>{t('storage.downloadProgress.successMessage')}</p>
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}

          {/* Cancelled Message */}
          {status === 'cancelled' && (
            <div className="text-sm text-gray-600">
              <p>{t('storage.downloadProgress.cancelledMessage')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          {status === 'downloading' && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          )}
          {canClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('common.close')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
