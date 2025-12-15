
import "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import "firebase/storage";
import "firebase/analytics";
import { Report, ReportStatus, CounselingSession, ChatMessage, UrgencyLevel, StudentInfo } from "../types";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB1qN3_LX0RZJPrKZl_HclDWmTYeIy5oD4",
  authDomain: "bao-cao-an-danh-blhd-lam-son.firebaseapp.com",
  projectId: "bao-cao-an-danh-blhd-lam-son",
  storageBucket: "bao-cao-an-danh-blhd-lam-son.firebasestorage.app",
  messagingSenderId: "1079740853458",
  appId: "1:1079740853458:web:6b4829612c8610dc7c510b",
  measurementId: "G-X3WWT3E2SM"
};

// Access the global firebase object provided by the compat scripts
const firebase = (window as any).firebase;

if (!firebase) {
    console.warn("Firebase scripts not loaded. Application will run in offline mode.");
}

// Initialize variables
let app;
let db: any;
let storage: any;
let auth: any;
let analytics: any;

// Kiểm tra xem người dùng đã cấu hình chưa (Dựa vào apiKey mẫu)
const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isConfigured && firebase) {
  try {
    // Check for existing apps to prevent double initialization
    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.app();
    }

    db = firebase.firestore();
    storage = firebase.storage();
    auth = firebase.auth();
    
    // Tự động đăng nhập ẩn danh
    auth.onAuthStateChanged((user: any) => {
      if (user) {
        console.log("Firebase Auth: Logged in as", user.uid);
      } else {
        // Chỉ thử đăng nhập nếu browser đang online để tránh lỗi rác
        if (navigator.onLine) {
            auth.signInAnonymously().catch((error: any) => {
              if (error.code === 'auth/configuration-not-found') {
                 console.warn("⚠️ CHƯA BẬT ĐĂNG NHẬP ẨN DANH: Vào Firebase Console -> Authentication -> Sign-in method -> Bật Anonymous.");
              } else if (error.code === 'auth/network-request-failed') {
                 console.warn("Firebase Auth: Network disconnected. Switching to offline mode.");
              } else {
                 console.error("Firebase Auth Error:", error);
              }
            });
        }
      }
    });
    
    // Analytics is optional and environment dependent
    if (typeof window !== 'undefined') {
        try {
            analytics = firebase.analytics();
        } catch (err) {
            // Ignore analytics errors
        }
    }
    
    console.log("Firebase initialized");
  } catch (e) {
    console.error("Firebase init error:", e);
  }
}

export const isFirebaseEnabled = () => isConfigured && !!db;

// Helper: Chờ đăng nhập xong mới làm việc khác (Fix lỗi permission-denied)
const waitForAuth = () => {
  return new Promise<void>((resolve) => {
    if (!auth || auth.currentUser) {
      resolve();
      return;
    }

    // Nếu trình duyệt báo offline thì skip chờ đợi luôn
    if (!navigator.onLine) {
        console.log("Browser offline, skipping Auth wait.");
        resolve();
        return;
    }
    
    console.log("Waiting for Firebase Auth...");
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (user) {
        unsubscribe();
        resolve();
      }
    });

    // Timeout giảm xuống 8s để app đỡ bị treo lâu
    setTimeout(() => { 
        unsubscribe();
        resolve(); 
    }, 8000);
  });
};

// Helper: Safe sanitize object (removes undefined, handles circular refs)
const safeSanitize = (obj: any, seen = new WeakSet()): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (seen.has(obj)) {
    return null; // Break circular reference
  }
  
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => safeSanitize(item, seen)).filter(item => item !== undefined);
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = safeSanitize(obj[key], seen);
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result;
};

// 1. Tải ảnh/video lên Cloud (Thay vì lưu base64 nặng máy)
export const uploadMediaToCloud = async (file: File | Blob): Promise<string> => {
  if (!isFirebaseEnabled()) throw new Error("Firebase chưa được cấu hình");
  
  await waitForAuth();
  
  // Đảm bảo user đã đăng nhập trước khi upload
  if (!auth.currentUser) {
     throw new Error("Auth timeout: Không thể đăng nhập để upload.");
  }
  
  const fileName = `reports/${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const storageRef = storage.ref(fileName);
  
  // Tạo Promise Upload
  const uploadTaskPromise = storageRef.put(file).then(() => storageRef.getDownloadURL());

  // Tạo Promise Timeout (45s - Tăng thêm cho mạng yếu)
  const timeoutPromise = new Promise<string>((_, reject) => 
     setTimeout(() => reject(new Error("Upload timed out (45s)")), 45000)
  );
  
  // Race
  return Promise.race([uploadTaskPromise, timeoutPromise]);
};

// 2. Gửi báo cáo lên Firestore (Cloud DB)
export const addReportToCloud = async (report: Report) => {
  if (!isFirebaseEnabled()) return;
  
  await waitForAuth();

  // Tăng timeout lên 30s để tránh lỗi Firestore write timed out trên mạng chậm
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Firestore write timed out")), 30000)
  );

  try {
    // Sanitize report safely
    const sanitizedReport = safeSanitize(report);

    // Sử dụng .doc(id).set() để đảm bảo ID thống nhất
    await Promise.race([
      db.collection("reports").doc(report.id).set(sanitizedReport),
      timeoutPromise
    ]);
  } catch (e) {
    // This will catch network errors and let the app fallback to offline mode
    console.error("Error adding doc to cloud (Network may be down):", e);
    throw e; // Throw để App bắt được và lưu offline
  }
};

// 3. Lắng nghe dữ liệu thay đổi theo thời gian thực (Real-time)
export const subscribeToReports = (
  onData: (reports: Report[]) => void, 
  onError?: (error: any) => void
) => {
  if (!isFirebaseEnabled()) return () => {};

  let unsubscribeSnapshot: (() => void) | null = null;
  let isSubscribed = true;

  // Chờ Auth xong mới bắt đầu lắng nghe
  waitForAuth().then(() => {
    if (!isSubscribed) return;
    
    // Nếu vẫn chưa đăng nhập được thì báo lỗi timeout
    if (!auth.currentUser) {
        if (onError) onError({ code: 'auth/timeout', message: 'Auth timed out - Could not login anonymously' });
        return;
    }

    try {
        unsubscribeSnapshot = db.collection("reports")
          .orderBy("timestamp", "desc")
          .onSnapshot((querySnapshot: any) => {
            const reports: Report[] = [];
            querySnapshot.forEach((doc: any) => {
              const data = doc.data() as Report;
              reports.push(data);
            });
            onData(reports);
          }, (error: any) => {
            console.error("Firebase Sync Error:", error.code);
            if (onError) onError(error);
          });
    } catch (err) {
        if (onError) onError(err);
    }
  });

  return () => {
    isSubscribed = false;
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
};

// 4. Cập nhật trạng thái báo cáo
export const updateReportStatusInCloud = async (reportId: string, status: ReportStatus) => {
  if (!isFirebaseEnabled()) return;
  await waitForAuth();
  
  try {
    // Ưu tiên cập nhật trực tiếp qua ID Document
    await db.collection("reports").doc(reportId).update({ status: status });
  } catch (e) {
    console.warn("Direct update failed (Old ID format?), trying query fallback...", e);
    // Fallback cho các báo cáo cũ (nơi Document ID != Report ID)
    try {
        const snapshot = await db.collection("reports").where("id", "==", reportId).get();
        snapshot.forEach((doc: any) => {
          doc.ref.update({ status: status });
        });
    } catch (err) {
        console.error("Fallback update also failed:", err);
    }
  }
};

// --- COUNSELING STORAGE (NEW) ---

export const createOrUpdateCounselingSession = async (
    sessionId: string, 
    studentInfo: StudentInfo | null,
    updateData?: Partial<CounselingSession>
) => {
    if (!isFirebaseEnabled()) return;
    await waitForAuth();

    const sessionRef = db.collection("counseling_sessions").doc(sessionId);
    
    try {
        const doc = await sessionRef.get();
        if (!doc.exists) {
            // Create new
            const newSession: CounselingSession = {
                id: sessionId,
                studentName: studentInfo?.fullName || "Ẩn danh",
                studentClass: studentInfo?.studentClass || "N/A",
                startTime: Date.now(),
                lastActivity: Date.now(),
                riskLevel: UrgencyLevel.LOW,
                isFlagged: false,
                summary: "Bắt đầu cuộc trò chuyện...",
                messages: [] // subcollection used mainly, this is for preview or recent
            };
            await sessionRef.set(newSession);
        } else {
            // Update existing
            await sessionRef.update({
                lastActivity: Date.now(),
                ...updateData
            });
        }
    } catch (e) {
        console.error("Error updating counseling session:", e);
    }
};

export const saveCounselingMessage = async (sessionId: string, message: ChatMessage) => {
    if (!isFirebaseEnabled()) return;
    await waitForAuth();
    
    // Save to subcollection 'messages'
    try {
        await db.collection("counseling_sessions")
            .doc(sessionId)
            .collection("messages")
            .doc(message.id)
            .set(message);
            
        // Update last activity on parent doc
        await db.collection("counseling_sessions").doc(sessionId).update({
            lastActivity: Date.now(),
            // Optionally update summary or snippet here if needed
        });
    } catch (e) {
        console.error("Error saving message:", e);
    }
};

export const subscribeToCounselingSessions = (
    onData: (sessions: CounselingSession[]) => void,
    onError?: (error: any) => void
) => {
    if (!isFirebaseEnabled()) return () => {};
    
    let unsubscribe: (() => void) | null = null;
    let isSubscribed = true;

    waitForAuth().then(() => {
        if (!isSubscribed) return;

        try {
            unsubscribe = db.collection("counseling_sessions")
                .orderBy("lastActivity", "desc")
                .limit(50)
                .onSnapshot((snapshot: any) => {
                    const sessions: CounselingSession[] = [];
                    snapshot.forEach((doc: any) => {
                        sessions.push(doc.data() as CounselingSession);
                    });
                    onData(sessions);
                }, (error: any) => {
                    console.warn("Counseling Sync Error:", error.code);
                    if (onError) onError(error);
                });
        } catch (err) {
            if (onError) onError(err);
        }
    });

    return () => {
        isSubscribed = false;
        if (unsubscribe) unsubscribe();
    };
};

export const subscribeToSessionMessages = (
    sessionId: string, 
    onData: (msgs: ChatMessage[]) => void,
    onError?: (error: any) => void
) => {
    if (!isFirebaseEnabled()) return () => {};

    let unsubscribe: (() => void) | null = null;
    let isSubscribed = true;

    waitForAuth().then(() => {
        if (!isSubscribed) return;

        try {
             unsubscribe = db.collection("counseling_sessions")
                .doc(sessionId)
                .collection("messages")
                .orderBy("timestamp", "asc")
                .onSnapshot((snapshot: any) => {
                    const msgs: ChatMessage[] = [];
                    snapshot.forEach((doc: any) => {
                        msgs.push(doc.data() as ChatMessage);
                    });
                    onData(msgs);
                }, (error: any) => {
                    console.warn("Messages Sync Error:", error.code);
                    if (onError) onError(error);
                });
        } catch (err) {
            if (onError) onError(err);
        }
    });

    return () => {
        isSubscribed = false;
        if (unsubscribe) unsubscribe();
    };
};


// --- MULTI-USER ADMIN CONFIG ---

// Danh sách Admin hợp lệ
export const VALID_ADMINS = [
    'Trần Thu Trà',
    'Lê Thị Huyền',
    'Chu Thị Thanh Trang',
    'Phạm Thị Tám',
    'Lê Thị Phương',
    'Trần Thị Quỳnh',
    'Nguyễn Thanh Minh',
    'Nguyễn Trung Ánh',
    'caolan'
];

const DEFAULT_ADMIN_PASS = "111111";

// 7. [NEW] Cập nhật mật khẩu Admin theo User lên Cloud
export const updateAdminPasswordInCloud = async (username: string, newPassword: string): Promise<void> => {
    if (!isFirebaseEnabled()) throw new Error("Không có kết nối Cloud");
    if (!VALID_ADMINS.includes(username)) throw new Error("Tài khoản không hợp lệ");
    
    await waitForAuth();

    try {
        // Sử dụng cấu trúc map để lưu user: { "username": "password" }
        // Dùng set với merge: true để không ghi đè các user khác
        await db.collection("settings").doc("admin_config").set({
            users: {
                [username]: newPassword
            },
            updatedAt: Date.now()
        }, { merge: true });
        
        console.log(`Password for ${username} updated in cloud`);
    } catch (error) {
        console.error("Error updating admin password:", error);
        throw error;
    }
};

// 8. [SECURITY UPDATE] API Verifier - Trả về status code chuẩn
interface AuthResponse {
    status: 200 | 400 | 401 | 500;
    message: string;
}

export const verifyAdminPassword = async (username: string, inputPassword: string): Promise<AuthResponse> => {
    if (!username || !inputPassword) {
        return { status: 400, message: "Vui lòng nhập tên tài khoản và mật khẩu." };
    }

    // 1. Check if username is allowed
    // Note: We trim input to handle accidental spaces
    const cleanUsername = username.trim();
    if (!VALID_ADMINS.includes(cleanUsername)) {
        return { status: 401, message: "Tên tài khoản không tồn tại." };
    }

    try {
        let currentPassword = DEFAULT_ADMIN_PASS; // Mặc định là 111111
        
        // 2. Thử lấy custom password từ Cloud
        if (isFirebaseEnabled()) {
             await waitForAuth();
             const doc = await db.collection("settings").doc("admin_config").get();
             if (doc.exists) {
                 const data = doc.data();
                 if (data.users && data.users[cleanUsername]) {
                     currentPassword = data.users[cleanUsername];
                 }
             }
        }

        // 3. So sánh mật khẩu
        if (inputPassword === currentPassword) {
            return { status: 200, message: "Đăng nhập thành công." };
        } else {
            return { status: 401, message: "Mật khẩu không chính xác." };
        }

    } catch (error) {
        console.error("Auth API Error:", error);
        // Fallback offline: Nếu lỗi mạng, chỉ cho phép đăng nhập nếu pass là mặc định
        if (inputPassword === DEFAULT_ADMIN_PASS) {
             return { status: 200, message: "Đăng nhập Offline (Mặc định)." };
        }
        return { status: 500, message: "Lỗi hệ thống xác thực." };
    }
};

// 9. [NEW] Avatar Cloud Sync
export const updateAdminAvatarInCloud = async (username: string, avatarUrl: string) => {
    if (!isFirebaseEnabled()) return; 
    await waitForAuth();
    
    try {
        await db.collection("settings").doc("admin_config").set({
            avatars: {
                [username]: avatarUrl
            },
            updatedAt: Date.now()
        }, { merge: true });
    } catch (error) {
        console.error("Error saving avatar to cloud:", error);
    }
};

export const getAdminAvatarFromCloud = async (username: string): Promise<string | null> => {
    if (!isFirebaseEnabled()) return null;
    await waitForAuth();
    
    try {
        const doc = await db.collection("settings").doc("admin_config").get();
        if (doc.exists) {
            const data = doc.data();
            return data.avatars?.[username] || null;
        }
    } catch (error) {
        console.error("Error fetching avatar:", error);
    }
    return null;
};
