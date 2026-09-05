import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 modal-backdrop" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} card rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200 !p-0`}>
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-soft text-ink-muted hover:text-ink transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
