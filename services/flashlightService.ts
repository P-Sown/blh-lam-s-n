
// Service điều khiển đèn Flash (Torch) thông qua Camera API
// Lưu ý: Chỉ hoạt động trên Android Chrome và một số trình duyệt hỗ trợ ImageCapture.
// iOS Safari hiện chưa cho phép web điều khiển đèn Flash.

let trackRef: MediaStreamTrack | null = null;
let intervalRef: number | null = null;
let isFlashOn = false;

export const initFlashlight = async (): Promise<boolean> => {
  if (trackRef) return true; // Đã khởi tạo

  try {
    // Yêu cầu quyền truy cập Camera sau (Environment)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment'
      }
    });

    const track = stream.getVideoTracks()[0];
    
    // Kiểm tra xem thiết bị có hỗ trợ torch không
    const capabilities = track.getCapabilities();
    // @ts-ignore - TS chưa cập nhật đủ type cho ImageCapture
    if (!capabilities.torch) {
      console.warn("Thiết bị này không hỗ trợ điều khiển đèn Flash qua Web.");
      track.stop();
      return false;
    }

    trackRef = track;
    return true;
  } catch (error) {
    console.error("Không thể truy cập Camera để bật Flash:", error);
    return false;
  }
};

export const startStrobeFlash = async () => {
  // Đảm bảo đã khởi tạo
  if (!trackRef) {
    const success = await initFlashlight();
    if (!success) return;
  }

  if (intervalRef) return; // Đang chạy rồi

  // Tạo vòng lặp nhấp nháy
  intervalRef = window.setInterval(async () => {
    if (!trackRef) return;
    
    isFlashOn = !isFlashOn;
    
    try {
      // @ts-ignore
      await trackRef.applyConstraints({
        advanced: [{ torch: isFlashOn } as any]
      });
    } catch (e) {
      console.error("Lỗi khi điều khiển Flash:", e);
      stopStrobeFlash();
    }
  }, 500); // Nháy mỗi 500ms
};

export const stopStrobeFlash = async () => {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }

  if (trackRef) {
    try {
      // Tắt đèn trước khi dừng
      // @ts-ignore
      await trackRef.applyConstraints({
        advanced: [{ torch: false } as any]
      });
    } catch (e) {
        // Ignore error on stop
    }
    // Không stop track hoàn toàn để có thể tái sử dụng nhanh, 
    // hoặc stop luôn để tiết kiệm pin tùy chiến lược. 
    // Ở đây ta giữ lại track nếu đang trong chế độ trực ban.
  }
};

export const releaseFlashlight = () => {
  stopStrobeFlash();
  if (trackRef) {
    trackRef.stop();
    trackRef = null;
  }
};