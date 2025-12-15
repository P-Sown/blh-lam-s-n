
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.warn("Trình duyệt không hỗ trợ thông báo hệ thống.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
};

// Tạo âm thanh còi hú cảnh sát bằng AudioContext (Không cần file mp3 ngoài)
export const playSiren = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 500;
    
    // Hiệu ứng còi hú (Lên xuống tần số)
    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(500, now);
    oscillator.frequency.linearRampToValueAtTime(1000, now + 0.5);
    oscillator.frequency.linearRampToValueAtTime(500, now + 1.0);
    oscillator.frequency.linearRampToValueAtTime(1000, now + 1.5);
    oscillator.frequency.linearRampToValueAtTime(500, now + 2.0);

    // Âm lượng
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2.5);

    oscillator.start(now);
    oscillator.stop(now + 2.5);

    // Rung điện thoại (nếu có hỗ trợ)
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }
  } catch (e) {
    console.error("Không thể phát âm thanh:", e);
  }
};

export const sendSystemNotification = (title: string, body: string) => {
  if (Notification.permission === "granted") {
    // Nếu đang ở trên trang web (visible) thì không cần hiện noti hệ thống để đỡ rối, 
    // trừ khi muốn test. Ở đây ta luôn hiện để đảm bảo admin thấy.
    const notification = new Notification(title, {
      body: body,
      icon: 'https://cdn-icons-png.flaticon.com/512/1033/1033092.png', // Icon cảnh báo
      tag: 'sos-alert', // Gộp các thông báo giống nhau
      requireInteraction: true, // Giữ thông báo trên màn hình đến khi user bấm tắt
      silent: false,
    });

    notification.onclick = function () {
      window.focus();
      this.close();
    };
  }
};