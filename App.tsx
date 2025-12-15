
import React, { useState, useEffect, useRef } from 'react';
import { Home, PlusCircle, LayoutDashboard, BookOpen, User, Lock, LogOut, CloudOff, Cloud, WifiOff, RefreshCw, AlertTriangle, ExternalLink, Moon, Sun, HeartHandshake, Database, Settings, ChevronDown, Camera, KeyRound, Save, X, Upload, Loader2, School } from 'lucide-react';
import { ReportForm } from './components/ReportForm';
import { Dashboard } from './components/Dashboard';
import { Resources } from './components/Resources';
import { Counseling } from './components/Counseling';
import { LoginModal } from './components/LoginModal';
import { Toast, ToastType } from './components/Toast';
import { SOSAlertOverlay } from './components/SOSAlertOverlay';
import { Report, ReportStatus, UrgencyLevel, ReportType, StudentInfo } from './types';
import { loadReports, saveReport } from './services/storage';
import { subscribeToReports, addReportToCloud, isFirebaseEnabled, updateReportStatusInCloud, subscribeToCounselingSessions, verifyAdminPassword, updateAdminPasswordInCloud, uploadMediaToCloud, updateAdminAvatarInCloud, getAdminAvatarFromCloud } from './services/firebase';
import { requestNotificationPermission, playSiren, sendSystemNotification } from './utils/notification';

const APP_NAME = "THCS LAM SƠN";

// Modal hướng dẫn cấu hình Firebase khi gặp lỗi
const SetupGuideModal = ({ isOpen, onClose, errorType }: { isOpen: boolean; onClose: () => void; errorType: string }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[80] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <AlertTriangle size={32} />
          <h3 className="text-xl font-bold">Lỗi đồng bộ dữ liệu</h3>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
          Ứng dụng không thể kết nối với Cloud. Nguyên nhân: <strong>{errorType}</strong>
        </p>

        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-sm space-y-3 mb-6">
          <p className="font-semibold text-gray-800 dark:text-gray-200">Vui lòng thực hiện 2 bước sau trên Firebase Console:</p>
          
          <div className="flex gap-2 items-start">
            <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs mt-0.5">1</span>
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-200">Bật Authentication</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Build → Authentication → Sign-in method → Bật <strong>Anonymous</strong></p>
            </div>
          </div>

          <div className="flex gap-2 items-start">
            <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs mt-0.5">2</span>
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-200">Mở khóa Database</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Build → Firestore Database → Rules → Sửa thành:</p>
              <code className="block bg-gray-800 text-green-400 p-2 rounded mt-1 text-[10px]">
                allow read, write: if true;
              </code>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-200">
            Đóng & Dùng Offline
          </button>
          <a 
            href="https://console.firebase.google.com/" 
            target="_blank" 
            rel="noreferrer"
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium text-white flex items-center justify-center gap-2"
          >
            Mở Console <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

// Admin Profile & Settings Modal
const AdminProfileModal = ({ 
    isOpen, 
    onClose, 
    currentUser, 
    currentAvatar,
    onUpdateAvatar,
    initialTab = 'general'
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    currentUser: string;
    currentAvatar: string | null;
    onUpdateAvatar: (url: string) => void;
    initialTab?: 'general' | 'password';
}) => {
    const [tab, setTab] = useState<'general' | 'password'>('general');
    
    // Avatar State
    const [avatarUrl, setAvatarUrl] = useState(currentAvatar || '');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Password State
    const [oldPass, setOldPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    useEffect(() => {
        if (isOpen) {
            setAvatarUrl(currentAvatar || '');
            setOldPass('');
            setNewPass('');
            setConfirmPass('');
            setMessage(null);
            setTab(initialTab); // Set tab based on prop
            setIsUploading(false);
        }
    }, [isOpen, currentAvatar, initialTab]);

    if (!isOpen) return null;

    const handleSaveAvatar = async () => {
        if (!avatarUrl.trim()) {
            setMessage({ type: 'error', text: 'Vui lòng nhập URL ảnh.' });
            return;
        }
        
        // 1. Save to LocalStorage (Instant)
        localStorage.setItem(`admin_avatar_${currentUser}`, avatarUrl);
        
        // 2. Save to Cloud (Sync)
        if (isFirebaseEnabled()) {
             await updateAdminAvatarInCloud(currentUser, avatarUrl);
        }

        onUpdateAvatar(avatarUrl);
        setMessage({ type: 'success', text: 'Đã cập nhật Avatar thành công.' });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setMessage(null);

        try {
            let uploadedUrl = '';
            // Ưu tiên upload lên Cloud nếu có mạng
            if (isFirebaseEnabled() && navigator.onLine) {
                try {
                    uploadedUrl = await uploadMediaToCloud(file);
                } catch (err) {
                    console.warn("Cloud upload failed, falling back to base64", err);
                }
            }

            // Nếu Cloud fail hoặc offline, dùng Base64
            if (!uploadedUrl) {
                const reader = new FileReader();
                uploadedUrl = await new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
            }

            setAvatarUrl(uploadedUrl);
            setMessage({ type: 'success', text: 'Đã tải ảnh lên. Hãy nhấn Lưu.' });
        } catch (error) {
            console.error("Upload error", error);
            setMessage({ type: 'error', text: 'Lỗi khi tải ảnh. Vui lòng thử lại.' });
        } finally {
            setIsUploading(false);
            // Reset input để chọn lại cùng file nếu muốn
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (newPass.length < 6) {
            setMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
            return;
        }
        if (newPass !== confirmPass) {
            setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        setIsLoading(true);
        try {
            // 1. Verify old password
            const verifyRes = await verifyAdminPassword(currentUser, oldPass);
            if (verifyRes.status !== 200) {
                setMessage({ type: 'error', text: 'Mật khẩu cũ không chính xác.' });
                setIsLoading(false);
                return;
            }

            // 2. Update new password
            if (isFirebaseEnabled()) {
                await updateAdminPasswordInCloud(currentUser, newPass);
                setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
                setOldPass('');
                setNewPass('');
                setConfirmPass('');
            } else {
                 setMessage({ type: 'error', text: 'Không có kết nối mạng. Không thể đổi mật khẩu.' });
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                        <Settings size={20} className="text-indigo-600" /> Cài đặt tài khoản
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="flex border-b border-gray-100 dark:border-gray-700">
                    <button 
                        onClick={() => { setTab('general'); setMessage(null); }}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                            tab === 'general' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        <User size={16} /> Thông tin chung
                    </button>
                    <button 
                        onClick={() => { setTab('password'); setMessage(null); }}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                            tab === 'password' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        <KeyRound size={16} /> Đổi mật khẩu
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {message && (
                        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {message.type === 'success' ? <Cloud size={16} /> : <AlertTriangle size={16} />}
                            {message.text}
                        </div>
                    )}

                    {tab === 'general' && (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 rounded-full bg-indigo-100 border-4 border-white dark:border-gray-700 shadow-lg overflow-hidden mb-3 relative group">
                                    <img 
                                        src={avatarUrl || `https://ui-avatars.com/api/?name=${currentUser}&background=4f46e5&color=fff&size=128&bold=true`} 
                                        alt="Avatar" 
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${currentUser}&background=4f46e5&color=fff&size=128&bold=true`; }}
                                    />
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <Loader2 className="animate-spin text-white" />
                                        </div>
                                    )}
                                </div>
                                <h4 className="font-bold text-xl text-gray-900 dark:text-white">{currentUser}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Quản trị viên</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Avatar URL (Link ảnh)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input 
                                            type="text" 
                                            value={avatarUrl}
                                            onChange={(e) => setAvatarUrl(e.target.value)}
                                            placeholder="https://example.com/photo.jpg"
                                            className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        />
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileUpload} 
                                            className="hidden" 
                                            accept="image/*"
                                        />
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                                            title="Tải ảnh từ máy tính"
                                        >
                                            <Upload size={16} />
                                        </button>
                                    </div>
                                    <button 
                                        onClick={handleSaveAvatar}
                                        className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                                        title="Lưu Avatar"
                                    >
                                        <Save size={20} />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    * Nhấn vào biểu tượng <Upload size={10} className="inline"/> để tải ảnh từ thiết bị.
                                </p>
                            </div>
                        </div>
                    )}

                    {tab === 'password' && (
                        <form onSubmit={handleChangePassword} className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu hiện tại</label>
                                <input 
                                    type="password" 
                                    value={oldPass}
                                    onChange={(e) => setOldPass(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    required
                                />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu mới</label>
                                <input 
                                    type="password" 
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    placeholder="Tối thiểu 6 ký tự"
                                    required
                                />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Xác nhận mật khẩu mới</label>
                                <input 
                                    type="password" 
                                    value={confirmPass}
                                    onChange={(e) => setConfirmPass(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    required
                                />
                             </div>

                             <button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                             >
                                {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                Lưu mật khẩu
                             </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

function App() {
  const [currentView, setCurrentView] = useState<'home' | 'report' | 'dashboard' | 'resources' | 'counseling'>('home');
  const [reports, setReports] = useState<Report[]>([]);
  
  // Auth States
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Admin Profile Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'general' | 'password'>('general'); 
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);

  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [logoError, setLogoError] = useState(false);

  // Notification States
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [unreadHighRisk, setUnreadHighRisk] = useState(false);
  
  // Sync Status
  const [isOnline, setIsOnline] = useState(isFirebaseEnabled());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Track the TIMESTAMP of the last high risk report we notified about.
  const lastHighRiskTimestampRef = useRef<number>(0);

  // NEW: Track which session is currently being monitored by Admin to avoid spam alerts
  const monitoringIdRef = useRef<string | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Apply Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Load avatar on login (Local + Cloud Sync)
  useEffect(() => {
      const fetchAvatar = async () => {
          if (isAdmin && adminUsername) {
              // 1. Try Local first (fastest)
              const localAvatar = localStorage.getItem(`admin_avatar_${adminUsername}`);
              if (localAvatar) {
                  setAdminAvatar(localAvatar);
              } else {
                  setAdminAvatar(null);
              }

              // 2. Try Cloud (background update)
              if (isFirebaseEnabled() && navigator.onLine) {
                  const cloudAvatar = await getAdminAvatarFromCloud(adminUsername);
                  if (cloudAvatar && cloudAvatar !== localAvatar) {
                      setAdminAvatar(cloudAvatar);
                      localStorage.setItem(`admin_avatar_${adminUsername}`, cloudAvatar);
                  }
              }
          }
      };
      
      fetchAvatar();
  }, [isAdmin, adminUsername]);

  // Data Loading Logic
  useEffect(() => {
    const cleanup = startSync();
    
    // Subscribe to counseling alerts separately
    const cleanupCounseling = subscribeToCounselingSessions((sessions) => {
        const flaggedSessions = sessions.filter(s => 
            s.isFlagged && 
            s.lastActivity > lastHighRiskTimestampRef.current &&
            // QUAN TRỌNG: Nếu Admin đang xem phiên chat này (monitoringIdRef trùng khớp), thì KHÔNG báo động nữa
            s.id !== monitoringIdRef.current
        );

        if (flaggedSessions.length > 0) {
            setUnreadHighRisk(true);
            playSiren();
            sendSystemNotification(
                "CẢNH BÁO TÂM LÝ!",
                "Có học sinh đang cần tư vấn khẩn cấp (Nguy cơ cao)."
            );
            // Update ref to avoid spamming for same timestamp
            lastHighRiskTimestampRef.current = Math.max(...flaggedSessions.map(s => s.lastActivity));
        }
    });

    const interval = setInterval(() => {
      if (!isOnline && isFirebaseEnabled()) {
        console.log("Auto-retrying sync...");
        handleRetrySync();
      }
    }, 10000);

    return () => {
      cleanup();
      cleanupCounseling();
      clearInterval(interval);
    }; 
  }, [isOnline]);

  const startSync = () => {
    setIsSyncing(true);
    let unsubscribe: () => void = () => {};

    const loadLocalData = async () => {
      try {
        console.log("Loading local data (IndexedDB)...");
        const data = await loadReports();
        setReports(data);
        checkHighRiskAndNotify(data);
        setIsSyncing(false);
      } catch (e) {
        console.error("Failed to load local reports", e);
        setIsSyncing(false);
      }
    };

    if (isFirebaseEnabled()) {
      console.log("Attempting Firebase connection...");
      unsubscribe = subscribeToReports(
        async (cloudData) => {
          try {
            const localData = await loadReports();
            const cloudIds = new Set(cloudData.map(r => r.id));
            const localOnlyReports = localData.filter(r => !cloudIds.has(r.id));
            const mergedReports = [...cloudData, ...localOnlyReports];
            mergedReports.sort((a, b) => b.timestamp - a.timestamp);
            setReports(mergedReports);
            setIsOnline(true);
            setIsSyncing(false);
            setSyncError(null);
            checkHighRiskAndNotify(mergedReports);
            
            localOnlyReports.forEach(async (report) => {
                if (isOnline) {
                    try {
                        await addReportToCloud(report);
                        console.log("Synced local report to cloud:", report.id);
                    } catch (e) {
                        console.warn("Failed to background sync report:", report.id);
                    }
                }
            });
            
          } catch (e) {
            console.error("Error merging data", e);
            setReports(cloudData);
            checkHighRiskAndNotify(cloudData);
            setIsOnline(true);
            setIsSyncing(false);
          }
        },
        (error) => {
          console.warn("Firebase sync failed:", error.code);
          setIsOnline(false);
          loadLocalData();
          
          if (error.code === 'permission-denied') {
            setSyncError("Thiếu quyền truy cập (Permission Denied)");
          } else if (error.code === 'auth/configuration-not-found' || error.code === 'auth/internal-error') {
            setSyncError("Chưa bật Anonymous Auth");
          } else if (error.code === 'auth/unauthorized-domain') {
            setSyncError("Tên miền chưa được cấp phép trong Firebase Auth (Unauthorized Domain)");
          }
        }
      );
    } else {
      loadLocalData();
    }
    
    return unsubscribe;
  };

  const checkHighRiskAndNotify = (currentReports: Report[]) => {
    const highRiskReports = currentReports.filter(
      r => r.aiAnalysis?.urgency === UrgencyLevel.HIGH && r.status === ReportStatus.PENDING
    );

    if (highRiskReports.length > 0) {
       const latestHighRisk = highRiskReports[0];
       if (latestHighRisk.timestamp > lastHighRiskTimestampRef.current) {
          lastHighRiskTimestampRef.current = latestHighRisk.timestamp;
          setUnreadHighRisk(true);
          playSiren();
          sendSystemNotification(
             "CẢNH BÁO SOS KHẨN CẤP!", 
             `Có báo cáo mức độ CAO mới: ${latestHighRisk.aiAnalysis?.summary || 'Nội dung chi tiết trong ứng dụng'}`
          );
       }
    } 
  };

  const handleRetrySync = () => {
    startSync();
  };

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  // Hàm mới: Bắt đầu báo cáo Ẩn danh ngay lập tức, bỏ qua form xác minh
  const handleStartReporting = () => {
    setStudentInfo({
        fullName: 'Ẩn danh',
        studentClass: 'N/A',
        nationalId: '',
        isAnonymous: true
    });
    setCurrentView('report');
  };

  const handleReportSubmit = async (newReportData: Omit<Report, 'id' | 'timestamp' | 'status' | 'isAnonymous' | 'studentName' | 'studentClass' | 'nationalId'>) => {
    // --- RATE LIMIT CHECK ---
    const RATE_LIMIT_KEY = 'rpt_rate_limit_ts';
    const BAN_KEY = 'rpt_ban_until';
    const MAX_REPORTS = 5;
    const TIME_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    const BAN_DURATION_MS = 1 * 60 * 1000; // 1 minute
    const now = Date.now();

    const banUntil = parseInt(localStorage.getItem(BAN_KEY) || '0', 10);
    if (now < banUntil) {
       const remainingSeconds = Math.ceil((banUntil - now) / 1000);
       showToast(`Bạn gửi quá nhanh! Vui lòng thử lại sau ${remainingSeconds} giây.`, "error");
       return;
    }

    const rawHistory = localStorage.getItem(RATE_LIMIT_KEY);
    let history: number[] = rawHistory ? JSON.parse(rawHistory) : [];
    history = history.filter(ts => now - ts < TIME_WINDOW_MS);

    if (history.length >= MAX_REPORTS) {
       const newBanTime = now + BAN_DURATION_MS;
       localStorage.setItem(BAN_KEY, newBanTime.toString());
       showToast("Hệ thống phát hiện Spam. Bạn bị tạm cấm gửi trong 1 phút.", "error");
       return; 
    }
    // --- END RATE LIMIT CHECK ---

    if (!studentInfo) {
      // Fallback nếu chưa có studentInfo (không nên xảy ra nếu đi từ nút home)
      setStudentInfo({
          fullName: 'Ẩn danh',
          studentClass: 'N/A',
          nationalId: '',
          isAnonymous: true
      });
    }

    const currentInfo = studentInfo || {
        fullName: 'Ẩn danh',
        studentClass: 'N/A',
        nationalId: '',
        isAnonymous: true
    };

    const newReport: Report = {
      id: `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 
      timestamp: Date.now(),
      status: ReportStatus.PENDING,
      isAnonymous: currentInfo.isAnonymous || false,
      studentName: currentInfo.fullName,
      studentClass: currentInfo.studentClass,
      nationalId: currentInfo.nationalId,
      ...newReportData,
    };
    
    // --- QUAN TRỌNG: THỬ LƯU VÀO MÁY (INDEXED DB) TRƯỚC ---
    try {
        await saveReport(newReport); // Hàm này giờ sẽ throw lỗi nếu không lưu được
    } catch (err) {
        console.error("Save Report Failed:", err);
        showToast("Lỗi nghiêm trọng: Không thể lưu báo cáo vào thiết bị. Vui lòng kiểm tra dung lượng bộ nhớ.", "error");
        return; // Dừng lại, không giả vờ thành công
    }
    
    // Nếu lưu Local thành công thì mới update State và thử gửi Cloud
    history.push(now);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(history));

    setReports(prevReports => [newReport, ...prevReports]);
    
    let savedToCloud = false;
    if (isOnline && isFirebaseEnabled()) {
      try {
        await addReportToCloud(newReport);
        savedToCloud = true;
      } catch (e) {
        console.warn("Cloud save failed, keeping in local only.", e);
        savedToCloud = false;
      }
    }
    
    if (newReport.aiAnalysis?.urgency === UrgencyLevel.HIGH) {
      lastHighRiskTimestampRef.current = newReport.timestamp; 
      setUnreadHighRisk(true);
      showToast("Báo cáo đã được gửi. Hệ thống đã gửi CẢNH BÁO KHẨN CẤP tới Ban Giám Hiệu!", "error");
    } else {
      // Phân biệt rõ thông báo Online/Offline
      if (savedToCloud) {
          showToast("Báo cáo đã gửi thành công (Đã đồng bộ Cloud).", "success");
      } else {
          showToast("Đã lưu báo cáo vào bộ nhớ thiết bị (Chế độ Offline).", "info");
      }
    }

    setCurrentView('home'); 
    setStudentInfo(null);
  };

  const handleSOS = async (location: { lat: number; lng: number; accuracy: number } | null): Promise<void> => {
    let locationString = "Không thể xác định vị trí (Lỗi GPS hoặc người dùng từ chối).";
    let mapsLink = "";

    if (location) {
      locationString = `[${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}] (Bán kính sai số: ~${Math.round(location.accuracy)}m)`;
      mapsLink = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    }

    const sosReport: Report = {
      id: `SOS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      type: ReportType.TEXT,
      content: `🚨 TÍN HIỆU SOS KHẨN CẤP!\n\nNgười dùng đã kích hoạt nút khẩn cấp. Yêu cầu đội bảo vệ và Ban Giám Hiệu can thiệp ngay lập tức.\n\n📍 Vị trí GPS: ${locationString}\n${mapsLink ? `🔗 Mở bản đồ (Chính xác): ${mapsLink}` : ""}\n\nTình trạng: Đang gặp nguy hiểm.`,
      status: ReportStatus.PENDING,
      isAnonymous: true,
      aiAnalysis: {
        isSchoolViolence: true, // SOS is always considered valid
        urgency: UrgencyLevel.HIGH,
        summary: "SOS: YÊU CẦU CỨU HỘ NGAY LẬP TỨC",
        category: ["KHẨN CẤP", "NGUY HIỂM TÍNH MẠNG"],
        confidenceScore: 100
      }
    };

    // --- QUAN TRỌNG: THỬ LƯU VÀO MÁY (INDEXED DB) TRƯỚC ---
    try {
        await saveReport(sosReport);
    } catch (e) {
        console.error("Local save failed", e);
        throw new Error("Lỗi lưu trữ cục bộ: Không thể ghi dữ liệu SOS vào máy.");
    }
    
    setReports(prev => [sosReport, ...prev]);

    // 3. Cloud Sync (The "Code 200" part)
    if (isOnline && isFirebaseEnabled()) {
        try {
            await addReportToCloud(sosReport);
        } catch (e) {
           console.error("SOS Cloud upload failed", e);
           throw new Error("Lỗi kết nối máy chủ");
        }
    } else {
        console.warn("SOS saved locally (Offline mode)");
    }

    // Trigger local alerts
    lastHighRiskTimestampRef.current = sosReport.timestamp;
    setUnreadHighRisk(true);
  };

  const handleStatusUpdate = async (id: string, status: ReportStatus) => {
    const updatedReports = reports.map(r => {
      if (r.id === id) {
        const updatedReport = { 
            ...r, 
            status,
            processedBy: adminUsername || 'Ban Giám Hiệu', // Lưu tên người xử lý
            processedAt: Date.now() // Record time
        };
        saveReport(updatedReport);
        if (isOnline && isFirebaseEnabled()) {
           addReportToCloud(updatedReport);
        }
        return updatedReport;
      }
      return r;
    });
    
    setReports(updatedReports);
    showToast("Đã cập nhật trạng thái báo cáo.", "info");
  };

  const handleLoginSuccess = async (success: boolean, username?: string) => {
    if (success) {
      setIsAdmin(true);
      setAdminUsername(username || null);
      setCurrentView('dashboard');
      showToast(`Xin chào ${username || 'Admin'}, đăng nhập thành công.`, "success");
      
      const granted = await requestNotificationPermission();
      if (!granted) {
          showToast("Vui lòng cấp quyền Thông báo để nhận cảnh báo SOS!", "error");
      }
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setAdminUsername(null);
    setAdminAvatar(null);
    if (currentView === 'dashboard') {
      setCurrentView('home');
    }
    showToast("Đã đăng xuất.", "info");
  };

  const handleAdminAccess = () => {
    if (isAdmin) {
      setCurrentView('dashboard');
      setUnreadHighRisk(false);
    } else {
      setShowLoginModal(true);
    }
  };

  const NavItem = ({ 
    view, 
    icon: Icon, 
    label, 
    isActive,
    onClick,
    hasNotification = false
  }: { 
    view: string, 
    icon: any, 
    label: string, 
    isActive: boolean,
    onClick: () => void,
    hasNotification?: boolean
  }) => (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-full py-2 space-y-1 ${
        isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
      }`}
    >
      <div className="relative">
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
        {hasNotification && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col font-sans transition-colors duration-200">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <SOSAlertOverlay 
        isVisible={isAdmin && unreadHighRisk} 
        onDismiss={() => {
            setUnreadHighRisk(false);
            setCurrentView('dashboard');
        }} 
      />

      <SetupGuideModal 
        isOpen={!!syncError} 
        errorType={syncError || ""} 
        onClose={() => setSyncError(null)} 
      />

      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
        onLogin={handleLoginSuccess}
      />
      
      <AdminProfileModal 
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={adminUsername || 'Admin'}
        currentAvatar={adminAvatar}
        onUpdateAvatar={setAdminAvatar}
        initialTab={profileModalTab}
      />

      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40 transition-colors duration-200 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('home')}>
             <div className="w-14 h-14 flex items-center justify-center overflow-hidden rounded-full bg-white/50 dark:bg-gray-700/50">
               {!logoError ? (
                  <img 
                    src="https://thcslamsonq6.hcm.edu.vn/uploads/32202/logo/logo_thcs_lam_son_1.png"
                    alt="Logo THCS Lam Sơn" 
                    className="w-full h-full object-contain"
                    onError={() => {
                      setLogoError(true);
                    }}
                    referrerPolicy="no-referrer"
                  />
               ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                    <School size={24} />
                  </div>
               )}
             </div>
             <div className="flex flex-col">
                <h1 className="text-lg font-bold text-indigo-900 dark:text-indigo-300 tracking-tight leading-none">{APP_NAME}</h1>
                
                <button 
                  onClick={handleRetrySync}
                  disabled={isOnline || isSyncing}
                  className={`text-[10px] flex items-center gap-1 mt-0.5 text-left transition-colors ${
                    isOnline ? 'text-green-600 dark:text-green-400 cursor-default' : 'text-amber-600 dark:text-amber-400 hover:text-amber-800 cursor-pointer underline decoration-dotted'
                  }`}
                >
                  {isSyncing ? (
                    <>
                       <RefreshCw size={10} className="animate-spin" />
                       <span>Đang đồng bộ...</span>
                    </>
                  ) : isOnline ? (
                    <>
                      <Cloud size={10} />
                      <span>Đã đồng bộ</span>
                    </>
                  ) : (
                    <>
                      <WifiOff size={10} />
                      <span className="flex items-center gap-1">
                          Offline 
                          {reports.length > 0 && <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded-full">({reports.length})</span>}
                      </span>
                    </>
                  )}
                </button>
             </div>
          </div>
          <div className="flex items-center space-x-3">
             <button
               onClick={toggleTheme}
               className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
               aria-label="Toggle Dark Mode"
             >
               {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
             </button>

             {isAdmin && (
                <div className="relative group z-50">
                    <button className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 pl-3 pr-2 py-1.5 rounded-full transition-colors border border-gray-100 dark:border-gray-600 focus:outline-none">
                        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300 hidden md:block max-w-[100px] truncate">
                            {adminUsername || 'Admin'}
                        </span>
                        
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 overflow-hidden">
                            {adminAvatar ? (
                                <img src={adminAvatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User size={16} />
                            )}
                        </div>
                        <ChevronDown size={14} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-transform group-hover:rotate-180" />
                    </button>

                    {/* Dropdown Menu - Hover Trigger */}
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right duration-200">
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700 md:hidden">
                            <p className="text-xs text-gray-400">Đang đăng nhập:</p>
                            <p className="font-bold text-gray-800 dark:text-white truncate">{adminUsername || 'Quản trị viên'}</p>
                        </div>
                        <div className="py-2">
                             <button 
                                onClick={() => {
                                    setProfileModalTab('general');
                                    setShowProfileModal(true);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                             >
                                <Camera size={16} /> Cập nhật Avatar
                             </button>
                             <button 
                                onClick={() => {
                                    setProfileModalTab('password');
                                    setShowProfileModal(true);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                             >
                                <KeyRound size={16} /> Đổi mật khẩu
                             </button>
                             <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2"></div>
                             <button 
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                             >
                                <LogOut size={16} /> Đăng xuất
                             </button>
                        </div>
                    </div>
                </div>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 pb-36">
        {currentView === 'home' && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center py-10">
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
                Trường học An toàn<br/><span className="text-indigo-600 dark:text-indigo-400">Không Bạo lực</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto mb-8">
                Bạn không đơn độc. Hãy lên tiếng để bảo vệ bản thân và bạn bè. Chúng tôi luôn lắng nghe và bảo vệ danh tính của bạn.
              </p>
              <button 
                onClick={handleStartReporting}
                className="bg-indigo-600 text-white px-8 py-4 rounded-full text-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-indigo-900 hover:bg-indigo-700 hover:scale-105 transition-all transform"
              >
                Gửi báo cáo ngay
              </button>
              
              {!isOnline && (
                 <div className="mt-4 flex flex-col items-center gap-2">
                   <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-900 flex items-center gap-1">
                     <WifiOff size={10} /> Chế độ Offline. Báo cáo sẽ được lưu trên thiết bị.
                   </p>
                   {reports.length > 0 && (
                       <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                           <Database size={10} /> Đang lưu trữ {reports.length} báo cáo trong máy.
                       </p>
                   )}
                   {syncError && (
                      <button onClick={() => setSyncError("Lỗi kết nối (Bấm để xem hướng dẫn)")} className="text-xs text-red-500 hover:underline font-semibold">
                        Sửa lỗi kết nối ngay &rarr;
                      </button>
                   )}
                 </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {[
                 { title: 'Bảo mật thông tin', desc: 'Chỉ Ban Giám Hiệu nhà trường mới biết danh tính của bạn.', icon: '🔒' },
                 { title: 'Đa phương tiện', desc: 'Gửi ảnh, video, ghi âm để làm bằng chứng xác thực.', icon: '📸' },
                 { title: 'Xử lý nhanh AI', desc: 'Hệ thống AI phân loại và cảnh báo nguy hiểm ngay lập tức.', icon: '🤖' },
               ].map((feature, idx) => (
                 <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-colors">
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{feature.desc}</p>
                 </div>
               ))}
            </div>
          </div>
        )}

        {currentView === 'report' && (
          <div className="animate-fade-in">
             <button onClick={() => setCurrentView('home')} className="mb-4 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center">
               ← Quay lại Trang chủ
             </button>
             <ReportForm onSubmit={handleReportSubmit} />
          </div>
        )}

        {currentView === 'counseling' && (
          // Pass studentInfo so session can be linked to identity (or kept anonymous if guest)
          <Counseling studentInfo={studentInfo} />
        )}

        {currentView === 'dashboard' && isAdmin && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
               Bảng điều khiển Nhà trường
               {isOnline ? (
                  <span className="text-xs font-normal bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Cloud size={10} /> Live Sync
                  </span>
               ) : (
                  <button onClick={handleRetrySync} className="text-xs font-normal bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-amber-200 transition-colors">
                    <RefreshCw size={10} /> Offline (Thử lại)
                  </button>
               )}
            </h2>
            <Dashboard 
                reports={reports} 
                onUpdateStatus={handleStatusUpdate} 
                onMonitoringChange={(id) => { monitoringIdRef.current = id; }}
            />
          </div>
        )}
        
        {currentView === 'dashboard' && !isAdmin && (
           <div className="text-center py-20">
              <Lock size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300">Quyền truy cập bị từ chối</h2>
              <p className="text-gray-500 dark:text-gray-500 mt-2">Vui lòng đăng nhập tài khoản quản trị viên.</p>
              <button onClick={() => setShowLoginModal(true)} className="mt-4 text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                Đăng nhập ngay
              </button>
           </div>
        )}

        {currentView === 'resources' && (
          <div className="animate-fade-in">
            <Resources onSOS={handleSOS} />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-5px_10px_rgba(0,0,0,0.05)] z-50 pb-[env(safe-area-inset-bottom)] transition-colors duration-200">
        <div className="max-w-4xl mx-auto flex justify-between px-2 sm:px-6 pt-2 pb-2">
          <NavItem 
            view="home" 
            icon={Home} 
            label="Trang chủ" 
            isActive={currentView === 'home'} 
            onClick={() => setCurrentView('home')} 
          />
          <NavItem 
            view="counseling" 
            icon={HeartHandshake} 
            label="Tâm lý" 
            isActive={currentView === 'counseling'}
            onClick={() => setCurrentView('counseling')}
          />
          
          <div className="relative -top-8 px-2">
            <button
              onClick={handleStartReporting}
              className="bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-300 dark:shadow-indigo-900 hover:bg-indigo-700 transition-colors transform hover:scale-105 active:scale-95"
            >
              <PlusCircle size={28} />
            </button>
          </div>

          <NavItem 
            view="resources" 
            icon={BookOpen} 
            label="SOS" 
            isActive={currentView === 'resources'}
            onClick={() => setCurrentView('resources')}
          />
          <NavItem 
            view="dashboard" 
            icon={isAdmin ? LayoutDashboard : Lock} 
            label={isAdmin ? "Quản lý" : "Admin"} 
            isActive={currentView === 'dashboard' || showLoginModal}
            onClick={handleAdminAccess}
            hasNotification={unreadHighRisk && !isAdmin} 
          />
        </div>
      </nav>
    </div>
  );
}

export default App;
