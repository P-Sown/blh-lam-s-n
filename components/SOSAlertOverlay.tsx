import React, { useEffect } from 'react';
import { ShieldAlert, Bell, ArrowRight } from 'lucide-react';

interface SOSAlertOverlayProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export const SOSAlertOverlay: React.FC<SOSAlertOverlayProps> = ({ isVisible, onDismiss }) => {
  // Trigger vibration when alert shows up
  useEffect(() => {
    if (isVisible && typeof navigator !== 'undefined' && navigator.vibrate) {
      // Vibrate pattern: 500ms on, 200ms off, 500ms on...
      const interval = setInterval(() => {
         try {
            navigator.vibrate([500, 200, 500]);
         } catch (e) {
            // Ignore vibration errors
         }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 animate-fade-in">
      {/* Background layers */}
      <div className="absolute inset-0 bg-red-600 opacity-95"></div>
      <div className="absolute inset-0 bg-red-700 animate-pulse mix-blend-multiply"></div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-lg">
        <div className="relative">
             <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-30"></div>
             <div className="bg-white text-red-600 p-8 rounded-full shadow-2xl relative transform hover:scale-105 transition-transform duration-300">
                <ShieldAlert size={80} className="animate-pulse" />
             </div>
        </div>
        
        <div className="space-y-4 text-white">
           <h1 className="text-5xl font-black uppercase tracking-widest drop-shadow-md">CẢNH BÁO SOS</h1>
           <p className="text-xl font-medium opacity-90">
             Hệ thống phát hiện báo cáo khẩn cấp hoặc tín hiệu cầu cứu từ học sinh.
           </p>
        </div>

        <button 
          onClick={onDismiss}
          className="group bg-white text-red-600 px-10 py-4 rounded-full text-xl font-bold shadow-2xl hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-3 animate-bounce"
        >
          <Bell className="group-hover:rotate-12 transition-transform" />
          <span>XỬ LÝ NGAY</span>
          <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};