
import React, { useState, useRef, useEffect } from 'react';
import { X, Lock, Eye, EyeOff, LogIn, Mail, ArrowLeft, Send, KeyRound, Check, ShieldCheck, Loader2, AlertTriangle, User } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { verifyAdminPassword, updateAdminPasswordInCloud, isFirebaseEnabled, VALID_ADMINS } from '../services/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (success: boolean, username?: string) => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60 * 1000; // 60 giây

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [view, setView] = useState<'login' | 'forgot'>('login');
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Security State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  
  // Forgot Password Flow State
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1); // 1: User check, 2: OTP, 3: New Pass
  const [resetUsername, setResetUsername] = useState('');
  const [otpInputs, setOtpInputs] = useState<string[]>(new Array(6).fill(''));
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // General
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Refs for OTP inputs
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // --- INIT SECURITY STATE ---
  useEffect(() => {
    // Khôi phục trạng thái khóa từ LocalStorage khi mở modal
    const storedAttempts = localStorage.getItem('login_failed_attempts');
    const storedLockout = localStorage.getItem('login_lockout_until');

    if (storedAttempts) setFailedAttempts(parseInt(storedAttempts, 10));
    if (storedLockout) {
        const lockoutTime = parseInt(storedLockout, 10);
        if (lockoutTime > Date.now()) {
            setLockoutUntil(lockoutTime);
        } else {
            // Đã hết thời gian khóa, reset
            localStorage.removeItem('login_lockout_until');
            localStorage.setItem('login_failed_attempts', '0');
            setFailedAttempts(0);
            setLockoutUntil(0);
        }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper: Kiểm tra SQL Injection & XSS (TC-14, TC-15)
  const containsMaliciousChars = (str: string) => {
    const dangerousPattern = /['";<>]|(--)/;
    return dangerousPattern.test(str);
  };

  const handleLoginFailed = () => {
     const newAttempts = failedAttempts + 1;
     setFailedAttempts(newAttempts);
     localStorage.setItem('login_failed_attempts', newAttempts.toString());

     if (newAttempts >= MAX_FAILED_ATTEMPTS) {
         const unlockTime = Date.now() + LOCKOUT_DURATION;
         setLockoutUntil(unlockTime);
         localStorage.setItem('login_lockout_until', unlockTime.toString());
         setError(`Bạn đã nhập sai quá ${MAX_FAILED_ATTEMPTS} lần. Tài khoản bị tạm khóa trong 60 giây.`);
     } else {
         setError(`Mật khẩu không chính xác. (Còn ${MAX_FAILED_ATTEMPTS - newAttempts} lần thử)`);
     }
  };

  // --- LOGIC ĐĂNG NHẬP ---
  const handleLoginSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (lockoutUntil > 0 && Date.now() < lockoutUntil) {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        setError(`Tài khoản đang bị tạm khóa. Vui lòng thử lại sau ${remaining} giây.`);
        return;
    }

    if (isLoading) return;

    const trimmedUsername = username.trim();

    if (containsMaliciousChars(trimmedUsername) || containsMaliciousChars(password)) {
        setError('Phát hiện ký tự không hợp lệ.');
        return;
    }

    if (!trimmedUsername) {
        setError('Vui lòng nhập tên đăng nhập.');
        return;
    }

    if (!password) {
        setError('Vui lòng nhập mật khẩu.');
        return;
    }

    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));

    try {
        const response = await verifyAdminPassword(trimmedUsername, password);
        
        if (response.status === 200) {
            localStorage.setItem('login_failed_attempts', '0');
            localStorage.removeItem('login_lockout_until');
            // Truyền username thành công về App
            onLogin(true, trimmedUsername);
            resetState();
            onClose();
        } else if (response.status === 401) {
            handleLoginFailed();
            if (response.message.includes("không tồn tại")) {
                 setError("Tên tài khoản không tồn tại.");
            }
        } else {
            setError(response.message || 'Lỗi hệ thống.');
        }

    } catch (err) {
        console.error(err);
        setError('Lỗi kết nối máy chủ. Vui lòng thử lại.');
    } finally {
        setIsLoading(false);
    }
  };

  // --- LOGIC QUÊN MẬT KHẨU ---
  
  // Bước 1: Kiểm tra User và Gửi mã OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedUser = resetUsername.trim();

    if (!trimmedUser) {
      setError('Vui lòng nhập tên tài khoản.');
      return;
    }

    // 1. Kiểm tra tài khoản có trong danh sách 8 admin không
    if (!VALID_ADMINS.includes(trimmedUser)) {
      setError('Tên tài khoản không tồn tại trong hệ thống.');
      return;
    }

    setIsLoading(true);
    
    // Tạo mã OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);

    // Email nhận OTP (Hardcoded cho prototype/demo vì hệ thống chưa có email từng user)
    const TARGET_EMAIL = 'kieuphuson7@gmail.com'; 

    const SERVICE_ID = "service_513hcyb"; 
    const TEMPLATE_ID  = "template_r56zup6";
    const PUBLIC_KEY = "DLQfBvWHcshKDaRhs"; 

    try {
      await emailjs.send(
        SERVICE_ID, 
        TEMPLATE_ID, 
        {
            to_email: TARGET_EMAIL, 
            otp_code: code,
            username: trimmedUser,
            reply_to: 'admin@thcslamson.edu.vn'
        }, 
        PUBLIC_KEY
      );
      
      setSuccessMsg(`Đã gửi mã xác nhận tới email quản trị của ${trimmedUser}.`);
      setResetStep(2);
      
    } catch (err) {
      console.log("Lỗi gửi EmailJS:", err);
      // Fallback giả lập nếu lỗi quota
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert(`[MÔ PHỎNG EMAIL]\nMã OTP cho ${trimmedUser} là: ${code}`);
      setSuccessMsg('Đã gửi mã (Chế độ mô phỏng).');
      setResetStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  // Bước 2: Xác nhận OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = otpInputs.join('');
    
    if (enteredCode.length < 6) {
      setError('Vui lòng nhập đủ 6 số.');
      return;
    }

    if (enteredCode === generatedOtp) {
      setResetStep(3);
      setError('');
      setSuccessMsg('');
    } else {
      setError('Mã xác nhận không đúng.');
      setOtpInputs(new Array(6).fill('')); 
      otpRefs.current[0]?.focus();
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0]; 
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpInputs];
    newOtp[index] = value;
    setOtpInputs(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpInputs[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Bước 3: Đổi mật khẩu
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newPassword || newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsLoading(true);

    try {
        if (isFirebaseEnabled()) {
            await updateAdminPasswordInCloud(resetUsername, newPassword);
        }
        
        setFailedAttempts(0);
        setLockoutUntil(0);
        localStorage.removeItem('login_failed_attempts');
        localStorage.removeItem('login_lockout_until');

        setIsLoading(false);
        setSuccessMsg('Đổi mật khẩu thành công! Hãy đăng nhập lại.');
        
        setTimeout(() => {
            resetState();
        }, 2000);

    } catch (err) {
        console.error("Lỗi lưu pass:", err);
        setError("Lỗi kết nối: Không thể cập nhật mật khẩu. Vui lòng thử lại.");
        setIsLoading(false);
    }
  };

  const resetState = () => {
    setUsername('');
    setPassword('');
    setResetUsername('');
    setOtpInputs(new Array(6).fill(''));
    setGeneratedOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMsg('');
    setView('login');
    setResetStep(1);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transition-all duration-300">
        
        {/* Header */}
        <div className={`p-6 text-white flex justify-between items-start transition-colors ${
            lockoutUntil > Date.now() ? 'bg-red-600' : 'bg-indigo-600'
        }`}>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {lockoutUntil > Date.now() ? <AlertTriangle size={20} /> : view === 'login' ? <Lock size={20} /> : <ShieldCheck size={20} />}
              {lockoutUntil > Date.now() ? 'Tạm khóa tài khoản' : view === 'login' ? 'Đăng nhập Quản trị' : 'Khôi phục mật khẩu'}
            </h2>
            <p className="text-indigo-100 text-sm mt-1">
              {lockoutUntil > Date.now() ? 'Phát hiện truy cập bất thường' :
               view === 'login' ? 'Dành cho 8 thành viên Ban Giám Hiệu' : 
               resetStep === 1 ? 'Bước 1: Nhập tên tài khoản' :
               resetStep === 2 ? 'Bước 2: Nhập mã OTP' : 'Bước 3: Đặt lại mật khẩu'}
            </p>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 rounded-full p-1 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* Messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg border border-red-100 dark:border-red-800 flex items-start gap-2">
               <span>⚠️</span> <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 text-sm p-3 rounded-lg border border-green-100 dark:border-green-800 flex items-start gap-2">
               <span>✅</span> <span>{successMsg}</span>
            </div>
          )}

          {/* === VIEW: LOGIN === */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên tài khoản</label>
                <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      autoFocus
                      disabled={lockoutUntil > Date.now()}
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-10 dark:bg-gray-700 dark:text-white"
                    disabled={lockoutUntil > Date.now()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={lockoutUntil > Date.now()}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                
                <div className="flex justify-end mt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      resetState();
                      setView('forgot');
                    }}
                    disabled={lockoutUntil > Date.now()}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium disabled:opacity-50"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || lockoutUntil > Date.now()}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : lockoutUntil > Date.now() ? <Lock size={18} /> : <LogIn size={18} />}
                {isLoading ? 'Đang kiểm tra...' : lockoutUntil > Date.now() ? 'Đang bị khóa' : 'Đăng nhập'}
              </button>
            </form>
          )}

          {/* === VIEW: FORGOT PASSWORD === */}
          {view === 'forgot' && (
             <div className="space-y-4">
                
                {/* STEP 1: USERNAME */}
                {resetStep === 1 && (
                  <form onSubmit={handleSendOtp} className="space-y-4 animate-fade-in">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Nhập tên tài khoản Admin của bạn. Mã OTP sẽ được gửi về email quản trị đã đăng ký.
                    </p>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên tài khoản</label>
                       <div className="relative">
                          <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={resetUsername}
                            onChange={(e) => setResetUsername(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                            autoFocus
                          />
                       </div>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                        <button
                         type="button"
                         onClick={() => setView('login')}
                         className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                       >
                          <ArrowLeft size={16} />
                       </button>
                       <button
                         type="submit"
                         disabled={isLoading}
                         className="flex-1 bg-indigo-600 text-white rounded-lg font-semibold shadow-md flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-70"
                       >
                          {isLoading ? 'Đang xử lý...' : <>Lấy mã OTP <Send size={16} /></>}
                       </button>
                    </div>
                  </form>
                )}

                {/* STEP 2: OTP */}
                {resetStep === 2 && (
                  <form onSubmit={handleVerifyOtp} className="space-y-6 animate-fade-in">
                    <div className="text-center">
                       <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                         Hãy nhập mã 6 số vừa được gửi tới email quản trị.
                       </p>
                       <div className="flex justify-center gap-2">
                          {otpInputs.map((digit, idx) => (
                             <input
                               key={idx}
                               ref={(el) => { otpRefs.current[idx] = el; }}
                               type="text"
                               inputMode="numeric"
                               maxLength={1}
                               value={digit}
                               onChange={(e) => handleOtpChange(idx, e.target.value)}
                               onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                               className="w-10 h-12 text-center text-xl font-bold border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                             />
                          ))}
                       </div>
                    </div>

                    <button
                       type="submit"
                       className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold shadow-md hover:bg-indigo-700"
                    >
                       Xác thực mã
                    </button>
                  </form>
                )}

                {/* STEP 3: NEW PASSWORD */}
                {resetStep === 3 && (
                   <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg text-sm text-indigo-700 dark:text-indigo-300 mb-2">
                        Đang đặt lại mật khẩu cho: <strong>{resetUsername}</strong>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu mới</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-10 dark:bg-gray-700 dark:text-white"
                            placeholder="Ít nhất 6 ký tự"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Xác nhận mật khẩu</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                          placeholder="Nhập lại mật khẩu mới"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold shadow-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
                      >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
                        {isLoading ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
                      </button>
                   </form>
                )}

             </div>
          )}

        </div>
      </div>
    </div>
  );
};
