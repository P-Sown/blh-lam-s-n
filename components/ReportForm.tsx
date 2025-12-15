

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Type, Video, X, Loader2, Send, FileUp, StopCircle } from 'lucide-react';
import { ReportType, Report, ReportStatus, AIAnalysisResult } from '../types';
import { analyzeReportContent } from '../services/geminiService';
import { isFirebaseEnabled, uploadMediaToCloud } from '../services/firebase';

interface ReportFormProps {
  onSubmit: (report: Omit<Report, 'id' | 'timestamp' | 'status' | 'isAnonymous' | 'studentName' | 'studentClass' | 'nationalId'>) => Promise<void> | void;
}

// Helper convert File to Base64 Data URL for persistent display (Local Mode)
const fileToDataUrl = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const ReportForm: React.FC<ReportFormProps> = ({ onSubmit }) => {
  const [activeTab, setActiveTab] = useState<ReportType>(ReportType.TEXT);
  const [description, setDescription] = useState('');
  const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  const handleTabChange = (type: ReportType) => {
    if (isRecording) return;
    
    if (activeTab !== type) {
      setMediaFile(null);
      setMediaPreview(null);
      setActiveTab(type);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: ReportType) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const objectUrl = URL.createObjectURL(file);
      setMediaPreview(objectUrl);
      if (activeTab !== type) setActiveTab(type);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setMediaFile(audioBlob);
        const objectUrl = URL.createObjectURL(audioBlob);
        setMediaPreview(objectUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const resetForm = () => {
    setDescription('');
    setMediaFile(null);
    setMediaPreview(null); 
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const handleSubmit = async () => {
    if (!description && !mediaFile) {
      alert("Vui lòng nhập nội dung hoặc đính kèm bằng chứng.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Phân tích & Sàng lọc với Gemini
      const analysis: AIAnalysisResult = await analyzeReportContent(description, activeTab, mediaFile || undefined);

      // 2. KIỂM TRA KẾT QUẢ SÀNG LỌC
      if (!analysis.isSchoolViolence) {
        // Nếu không phải BLHĐ -> Thông báo cho HS và dừng lại
        alert("Nội dung báo cáo của em không phải là bạo lực học đường, nên nếu em muốn ý kiến về nội dung này thì hãy tìm cô chủ nhiệm của lớp em để báo cáo.");
        resetForm(); // Xóa form để người dùng báo cáo lại nếu muốn
        setIsSubmitting(false);
        return; // Dừng hàm tại đây
      }

      // 3. Nếu là BLHĐ -> Tiếp tục upload media
      let mediaUrl = undefined;
      let mimeType = mediaFile?.type;

      if (mediaFile) {
        if (activeTab === ReportType.AUDIO && (!mimeType || mimeType === '')) {
          mimeType = 'audio/webm';
        }

        if (isFirebaseEnabled()) {
           try {
             mediaUrl = await uploadMediaToCloud(mediaFile);
           } catch (e) {
             console.warn("Upload failed, falling back to local base64", e);
             mediaUrl = await fileToDataUrl(mediaFile);
           }
        } else {
           mediaUrl = await fileToDataUrl(mediaFile);
        }
      }

      // 4. Gửi báo cáo hợp lệ đi
      await onSubmit({
        type: activeTab,
        content: description,
        mediaUrl,
        mediaMimeType: mimeType,
        aiAnalysis: analysis,
      });
      
      resetForm();
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Có lỗi xảy ra khi gửi báo cáo. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden animate-fade-in border border-indigo-50 dark:border-gray-700">
      {/* Header Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-1">
        <button
          onClick={() => handleTabChange(ReportType.TEXT)}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all rounded-xl ${
            activeTab === ReportType.TEXT 
              ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Type size={18} /> Văn bản
        </button>
        <button
          onClick={() => handleTabChange(ReportType.IMAGE)}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all rounded-xl ${
            activeTab === ReportType.IMAGE 
              ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Camera size={18} /> Ảnh
        </button>
        <button
          onClick={() => handleTabChange(ReportType.VIDEO)}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all rounded-xl ${
            activeTab === ReportType.VIDEO 
              ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Video size={18} /> Video
        </button>
        <button
          onClick={() => handleTabChange(ReportType.AUDIO)}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all rounded-xl ${
            activeTab === ReportType.AUDIO 
              ? 'bg-white dark:bg-gray-600 text-pink-600 dark:text-pink-300 shadow-sm' 
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Mic size={18} /> Ghi âm
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Media Preview Area */}
        {activeTab !== ReportType.TEXT && (
          <div className="bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center min-h-[200px] relative group transition-colors hover:border-indigo-200 dark:hover:border-indigo-500">
            {mediaPreview ? (
              <div className="relative w-full flex justify-center">
                {activeTab === ReportType.IMAGE && (
                  <img src={mediaPreview} alt="Preview" className="max-h-64 rounded-lg shadow-md object-contain" />
                )}
                {activeTab === ReportType.VIDEO && (
                  <video src={mediaPreview} controls className="max-h-64 rounded-lg shadow-md w-full" />
                )}
                {activeTab === ReportType.AUDIO && (
                  <div className="w-full bg-white dark:bg-gray-600 p-4 rounded-lg shadow-sm flex items-center gap-3">
                    <div className="bg-pink-100 dark:bg-pink-900/50 p-2 rounded-full"><Mic className="text-pink-600 dark:text-pink-300" /></div>
                    <audio src={mediaPreview} controls className="w-full" />
                  </div>
                )}
                
                <button 
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                  className="absolute -top-3 -right-3 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-transform hover:scale-110"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="text-center w-full">
                {activeTab === ReportType.AUDIO ? (
                  <div className="flex flex-col items-center">
                    {isRecording ? (
                      <div className="animate-pulse flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                            <Mic size={32} className="text-red-600 dark:text-red-400" />
                        </div>
                        <p className="text-red-600 dark:text-red-400 font-bold text-lg mb-2">{formatDuration(recordingDuration)}</p>
                        <button 
                          onClick={stopRecording}
                          className="px-6 py-2 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 flex items-center gap-2 shadow-lg"
                        >
                          <StopCircle size={18} /> Dừng ghi âm
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={startRecording}
                        className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                      >
                        <div className="w-16 h-16 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                           <Mic size={32} />
                        </div>
                        <span className="font-medium">Nhấn để bắt đầu ghi âm</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <input 
                      type="file" 
                      accept={activeTab === ReportType.IMAGE ? "image/*" : "video/*"}
                      className="hidden" 
                      ref={activeTab === ReportType.IMAGE ? imageInputRef : videoInputRef}
                      onChange={(e) => handleFileChange(e, activeTab)}
                    />
                    <button 
                      onClick={() => activeTab === ReportType.IMAGE ? imageInputRef.current?.click() : videoInputRef.current?.click()}
                      className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-full"
                    >
                      <div className="w-16 h-16 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <FileUp size={32} />
                      </div>
                      <span className="font-medium">
                        {activeTab === ReportType.IMAGE ? 'Tải ảnh lên' : 'Tải video lên'}
                      </span>
                      <span className="text-xs text-gray-400">Hỗ trợ JPG, PNG, MP4 (Max 50MB)</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Text Input */}
        <div>
          <textarea
            className="w-full p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white dark:focus:bg-gray-600 transition-all text-gray-700 dark:text-white placeholder-gray-400 resize-none"
            rows={8}
            placeholder={
                activeTab === ReportType.TEXT 
                ? "Mô tả chi tiết sự việc(Bị vấn đề gì, khi nào, ở đâu, tình trạng hiện tại)" 
                : "Thêm ghi chú cho bằng chứng này..."
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        
        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isRecording}
          className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform flex items-center justify-center gap-2 ${
            isSubmitting || isRecording
              ? 'bg-indigo-300 dark:bg-indigo-500/50 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] shadow-indigo-200 dark:shadow-none'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Đang phân tích & Gửi...
            </>
          ) : (
            <>
              <Send size={20} />
              Gửi báo cáo
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-2">
          Dữ liệu được AI phân tích trước khi gửi đến Nhà trường.
        </p>
      </div>
    </div>
  );
};