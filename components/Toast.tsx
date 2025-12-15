import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle className="text-green-500" size={20} />,
    error: <AlertTriangle className="text-red-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />
  };

  const styles = {
    success: 'bg-green-50 border-green-100 text-green-900',
    error: 'bg-red-50 border-red-100 text-red-900',
    info: 'bg-blue-50 border-blue-100 text-blue-900'
  };

  return (
    <div className={`fixed top-4 right-4 left-4 md:left-auto z-[70] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg slide-in ${styles[type]} md:max-w-sm`}>
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <p className="text-sm font-medium flex-1 leading-snug">{message}</p>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
        <X size={16} />
      </button>
    </div>
  );
};