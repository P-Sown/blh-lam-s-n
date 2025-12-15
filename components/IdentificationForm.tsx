
import React, { useState } from 'react';
import { User, GraduationCap, Shield, ArrowRight, ArrowLeft, Info, UserX, ShieldQuestion } from 'lucide-react';
import { StudentInfo } from '../types';

interface IdentificationFormProps {
  onBack: () => void;
  onSubmit: (info: StudentInfo) => void;
}

export const IdentificationForm: React.FC<IdentificationFormProps> = ({ onBack, onSubmit }) => {
  const [fullName, setFullName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Chỉ yêu cầu Họ tên và Lớp
    if (!fullName.trim() || !studentClass.trim()) {
      setError('Vui lòng điền đầy đủ Họ và Tên và Lớp.');
      return;
    }
    
    // Simple validation for name
    if (fullName.trim().length < 5) {
        setError('Họ và tên không hợp lệ.');
        return;
    }

    onSubmit({
      fullName: fullName.trim(),
      studentClass: studentClass.trim().toUpperCase(),
      nationalId: '', // Đã bỏ trường nhập liệu, để trống
      isAnonymous: false
    });
  };

  const handleGuestSubmit = () => {
    // Chế độ khách: Bỏ qua xác minh, đánh dấu là ẩn danh
    onSubmit({
        fullName: 'Khách (Ẩn danh)',
        studentClass: 'N/A',
        nationalId: '',
        isAnonymous: true
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden animate-fade-in border border-indigo-50 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <button onClick={onBack} className="mb-4 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center">
               <ArrowLeft size={14} className="mr-1"/> Quay lại Trang chủ
            </button>
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-indigo-600 dark:text-indigo-300">
                   <User size={24} />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-gray-800 dark:text-white">Xác minh danh tính</h2>
                   <p className="text-sm text-gray-500 dark:text-gray-400">Chọn hình thức báo cáo phù hợp.</p>
                </div>
            </div>
        </div>

        <div className="p-6 space-y-6">
            {/* Disclaimer */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border-l-4 border-yellow-400 dark:border-yellow-600 flex items-start gap-3">
                <Shield size={24} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-yellow-800 dark:text-yellow-200">Cam kết Bảo mật</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        Dù bạn chọn hình thức nào, thông tin của bạn đều được bảo vệ. <strong>Chỉ Ban Giám Hiệu</strong> mới có quyền truy cập dữ liệu này.
                    </p>
                </div>
            </div>
            
            {error && (
                <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
                    <Info size={16} /> {error}
                </div>
            )}

            {/* Form Fields - Option 1: Verified */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-semibold text-gray-800 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2 mb-4">
                    Cách 1: Điền thông tin (Khuyên dùng)
                </h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Họ và Tên <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Nguyễn Văn A"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lớp <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            value={studentClass}
                            onChange={(e) => setStudentClass(e.target.value)}
                            placeholder="Ví dụ: 9A1"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                    Tiếp tục báo cáo <ArrowRight size={18} />
                </button>
            </form>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-600"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">Hoặc</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-600"></div>
            </div>

            {/* Guest Button - Option 2: Anonymous */}
            <div>
                 <button 
                    onClick={handleGuestSubmit}
                    className="w-full py-3 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-500 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
                 >
                    <ShieldQuestion size={18} className="text-gray-500 dark:text-gray-400" />
                    Báo cáo Ẩn danh (Khách)
                 </button>
                 <p className="text-xs text-center text-gray-400 mt-2">
                    * Chọn cách này nếu bạn muốn giấu tên hoàn toàn.
                 </p>
            </div>
        </div>
    </div>
  );
};
