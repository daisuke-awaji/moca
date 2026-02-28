import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { generateDownloadUrl } from '../api/storage';

interface S3FileLinkProps {
  path: string;
  children: React.ReactNode;
}

export const S3FileLink: React.FC<S3FileLinkProps> = ({ path, children }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const downloadUrl = await generateDownloadUrl(path);

      // Use <a> tag click pattern instead of window.open to avoid iOS Safari popup blockers
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 100);
    } catch (err) {
      console.error('Failed to generate download URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setIsLoading(false);
    }
  };

  // Extract filename from path
  const fileName = path.split('/').pop() || path;

  // Determine file icon based on extension
  const getFileIcon = () => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'pdf':
        return '📄';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return '🖼️';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'zip':
      case 'tar':
      case 'gz':
        return '📦';
      case 'mp4':
      case 'mov':
      case 'avi':
        return '🎬';
      case 'mp3':
      case 'wav':
        return '🎵';
      case 'txt':
      case 'md':
        return '📃';
      default:
        return '📎';
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={path}
        onClick={handleClick}
        className={`
          inline-flex items-center gap-1
          text-action-primary hover:text-action-primary 
          underline decoration-blue-300 hover:decoration-blue-500
          transition-colors cursor-pointer
          ${isLoading ? 'opacity-50 cursor-wait' : ''}
          ${error ? 'text-feedback-error' : ''}
        `}
        title={error || (isLoading ? 'Loading...' : `Download: ${fileName}`)}
      >
        <span className="text-base leading-none">{getFileIcon()}</span>
        <span>{children}</span>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
      </a>
      {error && (
        <span className="text-xs text-feedback-error ml-1">({t('storage.failedToLoad')})</span>
      )}
    </span>
  );
};
