import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: 'loading' | 'success' | 'info';
  autoCloseSeconds?: number;
  closeButtonText?: string;
}

export default function InfoModal({
  isOpen,
  onClose,
  title,
  message,
  icon = 'info',
  autoCloseSeconds = 8,
  closeButtonText = 'OK',
}: InfoModalProps) {
  const [progress, setProgress] = useState(100);

  const handleClose = useCallback(() => {
    setProgress(100);
    onClose();
  }, [onClose]);

  // Auto-close timer with progress bar
  useEffect(() => {
    if (!isOpen || autoCloseSeconds <= 0) return;

    const startTime = Date.now();
    const duration = autoCloseSeconds * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, autoCloseSeconds, handleClose]);

  // Reset progress when modal opens
  useEffect(() => {
    if (isOpen) {
      setProgress(100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const IconComponent = {
    loading: Loader2,
    success: CheckCircle2,
    info: Info,
  }[icon];

  const iconBgClass = {
    loading: 'bg-primary/10 text-primary',
    success: 'bg-green-50 text-green-500',
    info: 'bg-blue-50 text-blue-500',
  }[icon];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xl max-w-md w-full overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', iconBgClass)}>
              <IconComponent className={cn('w-6 h-6', icon === 'loading' && 'animate-spin')} />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm text-slate-500 mb-6">
            {message}
          </p>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="w-full px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
          >
            {closeButtonText}
          </button>
        </div>

        {/* Progress bar */}
        {autoCloseSeconds > 0 && (
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-primary transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
