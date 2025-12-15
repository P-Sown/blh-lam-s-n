
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Radio, ShieldAlert, CheckCircle2, Satellite, MessageSquare } from 'lucide-react';

interface ResourcesProps {
  onSOS: (location: { lat: number; lng: number; accuracy: number } | null) => void;
}

const HOTLINE_NUMBER = "084333633868";

export const Resources: React.FC<ResourcesProps> = ({ onSOS }) => {
  const [isActivating, setIsActivating] = useState(false);
  const [step, setStep] = useState(0); // 0: Idle, 1: Locating, 2: Sending, 3: Sent
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'good' | 'weak' | 'error'>('searching');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  
  // Lưu trữ vị trí tốt nhất tìm được (có sai số thấp nhất)
  const bestLocationRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const currentLocationRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);

  // Kích hoạt GPS ngay khi vào màn hình
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsStatus('error');
      return;
    }

    const options = {
      enableHighAccuracy: true, // Bắt buộc dùng chip GPS
      timeout: 15000,
      maximumAge: 0             // Không dùng cache
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const acc = position.coords.accuracy;
        const newLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: acc
        };

        currentLocationRef.current = newLoc;
        setAccuracy(Math.round(acc));

        // Logic tìm vị trí tốt nhất:
        // Nếu chưa có vị trí tốt nhất HOẶC vị trí mới chính xác hơn vị trí cũ
        if (!bestLocationRef.current || acc < bestLocationRef.current.accuracy) {
            bestLocationRef.current = newLoc;
        }

        // Đánh giá tín hiệu
        // Dưới 30m là rất tốt (GPS vệ tinh)
        // 30m - 100m là trung bình
        // Trên 100m thường là Wifi/Cell (kém tin cậy)
        if (acc <= 30) {
           setGpsStatus('good');
        } else {
           setGpsStatus('weak');
        }
      },
      (error) => {
        console.warn("GPS Watch Error:", error);
        if (error.code === error.PERMISSION_DENIED) {
            setGpsStatus('error');
        }
      },
      options
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const getBestAvailableLocation = () => {
      // Ưu tiên lấy vị trí có sai số thấp nhất đã từng ghi nhận được trong phiên này
      if (bestLocationRef.current) return bestLocationRef.current;
      return currentLocationRef.current;
  };

  // Tính năng gửi SMS Offline
  const handleOfflineSMS = () => {
    const loc = getBestAvailableLocation();
    let messageBody = '';
    
    if (loc) {
        // Tạo link Google Maps chính xác
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
        messageBody = `SOS! Con can giup gap. Vi tri chinh xac (sai so ${Math.round(loc.accuracy)}m): ${mapsLink}`;
    } else {
        messageBody = `SOS! Con can giup gap. Dien thoai khong lay duoc GPS, vui long goi lai cho con ngay!`;
    }

    // Tự động điền số hotline
    window.location.href = `sms:${HOTLINE_NUMBER}?body=${encodeURIComponent(messageBody)}`;
  };

  const handleSOSClick = () => {
    if (isActivating) return;

    // --- KIỂM TRA GPS NGHIÊM NGẶT ---
    
    // 1. Trường hợp lỗi quyền hoặc thiết bị không hỗ trợ
    if (gpsStatus === 'error') {
        const confirmSMS = window.confirm("LỖI GPS: Không thể xác định vị trí. Bạn có muốn chuyển sang gửi tin nhắn SMS cho Hotline không?");
        if (confirmSMS) {
            handleOfflineSMS();
        }
        return;
    }

    const loc = getBestAvailableLocation();

    // 2. Trường hợp chưa bắt được vệ tinh
    if (!loc) {
        const confirmSMS = window.confirm("ĐANG DÒ TÍN HIỆU: Chưa có dữ liệu vị trí. Bạn có muốn gửi tin nhắn SMS ngay bây giờ không?");
        if (confirmSMS) {
            handleOfflineSMS();
        }
        return;
    }

    // 3. Trường hợp sai số quá lớn (> 30m)
    if (loc.accuracy > 30) {
        const confirmSMS = window.confirm(`TÍN HIỆU YẾU (Sai số ${Math.round(loc.accuracy)}m). Hệ thống không thể gửi báo cáo GPS chính xác.\n\nBạn có muốn chuyển sang gửi tin nhắn SMS để báo tin nhanh không?`);
        if (confirmSMS) {
            handleOfflineSMS();
        }
        return;
    }

    // --- END KIỂM TRA ---

    setIsActivating(true);
    setStep(1); 

    // Giả lập quy trình gửi
    setTimeout(() => {
        setStep(2);
        
        // Cố gắng lấy vị trí lần cuối (vẫn phải check lại cho chắc)
        const finalLoc = getBestAvailableLocation();
        
        // Safety check cuối cùng trước khi gọi hàm cha
        if (finalLoc && finalLoc.accuracy <= 30) {
             setTimeout(() => {
                setStep(3);
                onSOS(finalLoc);
            }, 1500);
        } else {
             setIsActivating(false);
             setStep(0);
             const confirmSMS = window.confirm("Mất tín hiệu vệ tinh trong quá trình gửi. Bạn có muốn chuyển qua gửi SMS không?");
             if (confirmSMS) handleOfflineSMS();
        }
    }, 1500);
  };

  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => {
        setIsActivating(false);
        setStep(0);
      }, 5000); 
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Helper tính toán style cho nút SOS dựa trên trạng thái GPS
  const isGpsReady = gpsStatus === 'good';

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-6 px-4 pb-24">
      
      {/* Active Overlay Effect */}
      {isActivating && (
        <div className="fixed inset-0 bg-red-600 bg-opacity-95 z-[60] flex flex-col items-center justify-center text-white animate-fade-in px-4">
          <div className="relative">
             <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-ping"></div>
             <div className="bg-white text-red-600 p-6 rounded-full shadow-2xl relative z-10">
                <ShieldAlert size={64} className="animate-pulse" />
             </div>
          </div>
          
          <h2 className="mt-8 text-3xl font-bold tracking-widest uppercase text-center">Đang gửi tín hiệu</h2>
          
          <div className="mt-6 space-y-4 w-full max-w-xs">
             <p className="text-center font-mono animate-pulse">
                {step === 1 ? 'ĐANG CHỐT TỌA ĐỘ VỆ TINH...' : 
                 step === 2 ? 'ĐANG GỬI VỀ MÁY CHỦ...' : 'ĐÃ GỬI THÀNH CÔNG'}
             </p>
          </div>

          {step === 3 && (
            <div className="mt-10 flex flex-col items-center animate-bounce text-center">
              <CheckCircle2 size={48} className="text-white mb-2" />
              <p className="text-xl font-bold">ĐÃ GỬI BÁO CÁO</p>
              <p className="text-sm opacity-80 mt-1">Giữ nguyên vị trí để được hỗ trợ.</p>
            </div>
          )}
        </div>
      )}

      {/* Main SOS Interface */}
      <div className="w-full max-w-md text-center space-y-6">
        <div className="space-y-2">
           <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-wide">SOS Khẩn cấp</h2>
        </div>

        {/* GPS Status Indicator */}
        <div className={`inline-flex flex-col items-center justify-center px-6 py-3 rounded-2xl border-2 transition-all duration-300 w-full ${
            gpsStatus === 'good' 
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' 
                : gpsStatus === 'weak'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
        }`}>
            <div className="flex justify-between items-center w-full mb-1">
                <div className="flex items-center gap-2">
                    {gpsStatus === 'searching' ? <Satellite size={18} className="animate-spin" /> : <MapPin size={18} />}
                    <span className="font-bold text-sm uppercase">Vị trí của bạn</span>
                </div>
                {accuracy ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${accuracy <= 30 ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
                        Sai số ±{accuracy}m
                    </span>
                ) : (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Đang dò...</span>
                )}
            </div>
            
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                {accuracy ? (
                    <div 
                        className={`h-full transition-all duration-1000 ${accuracy <= 30 ? 'bg-green-500 w-full' : accuracy <= 100 ? 'bg-yellow-500 w-2/3' : 'bg-red-500 w-1/3'}`}
                    ></div>
                ) : (
                    <div className="h-full bg-blue-500 w-1/3 animate-sidebar-loading"></div>
                )}
            </div>
            
            <p className="text-[10px] mt-1.5 opacity-80 text-left w-full font-medium">
                {gpsStatus === 'good' ? '✅ Đã bắt được vệ tinh. Vị trí rất chính xác.' : 
                 gpsStatus === 'weak' ? '⚠️ Tín hiệu yếu. (Hệ thống sẽ gợi ý gửi SMS)' : 
                 gpsStatus === 'searching' ? '📡 Đang kết nối vệ tinh...' : '🚫 Không có quyền truy cập GPS.'}
            </p>
        </div>

        {/* SOS BUTTON (Main - Online) */}
        <div className="relative group cursor-pointer flex justify-center py-6" onClick={handleSOSClick}>
          {isGpsReady && (
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-60 md:h-60 bg-red-500 rounded-full opacity-20 group-hover:opacity-30 animate-ping duration-1000"></div>
          )}
          
          <button 
            className={`relative w-48 h-48 md:w-60 md:h-60 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-4 flex flex-col items-center justify-center transition-all duration-300 z-10 ${
                isGpsReady 
                ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-400 shadow-[0_10px_40px_rgba(220,38,38,0.6)] active:scale-95' 
                : 'bg-gray-300 dark:bg-gray-700 border-gray-400 cursor-not-allowed opacity-80 grayscale'
            }`}
          >
            {isGpsReady ? (
                <>
                    <Radio size={48} className="text-white mb-2 animate-pulse" />
                    <span className="text-4xl font-black text-white tracking-widest drop-shadow-md">SOS</span>
                    <span className="text-red-100 text-xs font-semibold mt-1 bg-red-800 bg-opacity-40 px-3 py-1 rounded-full">BÁO NHÀ TRƯỜNG</span>
                </>
            ) : (
                <>
                    <Satellite size={48} className="text-gray-500 dark:text-gray-400 mb-2" />
                    <span className="text-2xl font-bold text-gray-600 dark:text-gray-300">ĐỢI GPS</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-1 px-2">Cần sai số &lt; 30m</span>
                </>
            )}
          </button>
        </div>

        {/* OFFLINE SMS BUTTON */}
        <div className="pt-2">
            <button 
                onClick={handleOfflineSMS}
                className="w-full bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 text-indigo-700 dark:text-indigo-300 p-4 rounded-xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-full">
                        <MessageSquare size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-sm">Gửi tin nhắn SMS</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Gửi tọa độ cho Hotline ({HOTLINE_NUMBER})</p>
                    </div>
                </div>
                <div className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg text-indigo-600 dark:text-indigo-300">
                    Offline Mode
                </div>
            </button>
            <p className="text-[10px] text-gray-400 mt-2 italic">
                *Hệ thống sẽ soạn tin nhắn chứa tọa độ và tự động điền số điện thoại Hotline để bạn gửi.
            </p>
        </div>
      </div>
    </div>
  );
};
