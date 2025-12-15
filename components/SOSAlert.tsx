import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Wifi, WifiOff, AlertCircle } from 'lucide-react';

// URL âm thanh cảnh báo (Bạn có thể đổi thành "/sos-alert.mp3" nếu đã có file trong thư mục public)
// Dưới đây là link âm thanh còi báo động mẫu (CDN)
const SOS_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3";

// Hàm lấy URL WebSocket phù hợp với giao thức trang web (ws hoặc wss)
const getWebSocketUrl = () => {
  if (typeof window !== 'undefined') {
    // Nếu trang đang chạy https, bắt buộc dùng wss để tránh lỗi Mixed Content
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//yourserver.com`;
  }
  return "ws://yourserver.com";
};

interface SOSAlertProps {
  onAlert?: (message: string) => void; // Callback khi có báo động để Dashboard xử lý thêm nếu cần
}

export const SOSAlert: React.FC<SOSAlertProps> = ({ onAlert }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isAlerting, setIsAlerting] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Hàm kích hoạt quyền phát âm thanh (Browser Autoplay Policy)
  const enableAudio = () => {
    if (audioRef.current) {
      // Phát thử một đoạn ngắn rồi dừng ngay lập tức để "mở khóa" AudioContext
      audioRef.current.play()
        .then(() => {
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
          setAudioEnabled(true);
        })
        .catch(err => {
          console.error("Không thể kích hoạt âm thanh:", err);
        });
    }
  };

  // Hàm phát cảnh báo
  const triggerAlert = () => {
    setIsAlerting(true);
    if (audioRef.current && audioEnabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Lỗi phát âm thanh:", e));
    }
    if (onAlert) onAlert("Nhận tín hiệu SOS từ WebSocket!");
  };

  // Hàm dừng cảnh báo
  const stopAlert = () => {
    setIsAlerting(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // Kết nối WebSocket
  const connectWebSocket = () => {
    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("SOS WebSocket Connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        console.log("WS Message:", event.data);
        // Giả sử server gửi chuỗi "SOS" hoặc JSON { type: "SOS" }
        try {
            const data = event.data;
            if (data === 'SOS' || data.includes('SOS') || JSON.parse(data).type === 'SOS') {
                triggerAlert();
            }
        } catch (e) {
            // Nếu parse JSON lỗi nhưng chuỗi có chứa SOS
            if (String(event.data).includes("SOS")) {
                triggerAlert();
            }
        }
      };

      ws.onclose = () => {
        console.log("SOS WebSocket Disconnected. Reconnecting...");
        setIsConnected(false);
        // Tự động kết nối lại sau 5 giây
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (err) => {
        console.error("SOS WebSocket Error:", err);
        ws.close();
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Connection failed:", error);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    }
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <audio ref={audioRef} src={SOS_SOUND_URL} loop />
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isConnected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white text-sm">Hệ thống Cảnh báo Âm thanh</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isConnected ? "Đã kết nối máy chủ giám sát" : "Mất kết nối máy chủ (Đang thử lại...)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút Test cho Dev (ẩn đi nếu muốn) */}
          <button 
             onClick={triggerAlert}
             className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500"
          >
            Test Loa
          </button>

          {isAlerting ? (
            <button 
              onClick={stopAlert}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg animate-pulse font-bold text-sm"
            >
              <VolumeX size={18} /> TẮT CÒI BÁO ĐỘNG
            </button>
          ) : !audioEnabled ? (
            <button 
              onClick={enableAudio}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-sm shadow-sm"
            >
              <Volume2 size={18} /> KÍCH HOẠT LOA
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium border border-green-200 dark:border-green-800">
               <AlertCircle size={18} /> Đang trực chiến
            </div>
          )}
        </div>
      </div>
      
      {!audioEnabled && (
         <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            * Cần nhấn "Kích hoạt loa" để trình duyệt cho phép phát âm thanh tự động khi có sự cố.
         </div>
      )}
    </div>
  );
};