
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, HeartHandshake, Phone, Sparkles, Loader2, Info, Smile } from 'lucide-react';
import { ChatMessage, StudentInfo, UrgencyLevel } from '../types';
import { getCounselingResponse } from '../services/geminiService';
import { createOrUpdateCounselingSession, saveCounselingMessage, isFirebaseEnabled } from '../services/firebase';

interface CounselingProps {
    studentInfo: StudentInfo | null;
}

export const Counseling: React.FC<CounselingProps> = ({ studentInfo }) => {
  const [sessionId] = useState(() => {
     // Create a persistent session ID for this browser session or load from local storage
     const stored = sessionStorage.getItem('counseling_session_id');
     if (stored) return stored;
     const newId = `SESSION-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
     sessionStorage.setItem('counseling_session_id', newId);
     return newId;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Chào em! Mình là trợ lý ảo tâm lý của trường Lam Sơn. Em đang cảm thấy thế nào? Có chuyện gì vui buồn muốn chia sẻ với mình không?',
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Init session on cloud
  useEffect(() => {
      if (isFirebaseEnabled()) {
          createOrUpdateCounselingSession(sessionId, studentInfo);
      }
  }, [sessionId, studentInfo]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!inputText.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Save user message to cloud
    if (isFirebaseEnabled()) {
        saveCounselingMessage(sessionId, userMsg);
    }

    // Call AI
    const response = await getCounselingResponse(messages, userMsg.text);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: response.text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);

    // Save bot message and update session risk
    if (isFirebaseEnabled()) {
        saveCounselingMessage(sessionId, botMsg);
        
        // If high risk, update the session metadata to alert admins
        if (response.flagged) {
            createOrUpdateCounselingSession(sessionId, studentInfo, {
                riskLevel: response.riskLevel,
                isFlagged: true,
                summary: response.summary || "AI phát hiện nội dung cần chú ý."
            });
        } else {
             // Just update last activity and maybe summary
             createOrUpdateCounselingSession(sessionId, studentInfo, {
                 summary: response.summary
             });
        }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      
      {/* Header */}
      <div className="bg-teal-600 p-4 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <HeartHandshake size={24} />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Góc Tâm Lý</h2>
            <p className="text-teal-100 text-xs">Luôn lắng nghe, luôn thấu hiểu</p>
          </div>
        </div>
        <div className="hidden md:flex gap-2 text-xs">
           <span className="bg-teal-700 px-3 py-1 rounded-full flex items-center gap-1">
             <Bot size={12} /> AI Counselor
           </span>
           <span className="bg-teal-700 px-3 py-1 rounded-full flex items-center gap-1">
             <Sparkles size={12} /> Confidential
           </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col relative bg-gray-50 dark:bg-gray-900/50">
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user' 
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300' 
                    : 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3 max-w-[85%]">
                 <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300 flex-shrink-0 flex items-center justify-center">
                    <Bot size={16} />
                 </div>
                 <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 flex items-center gap-1">
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce delay-75"></span>
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce delay-150"></span>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0">
             <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Nhập tin nhắn tâm sự..."
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  disabled={isTyping}
                />
                <button 
                  type="submit"
                  disabled={!inputText.trim() || isTyping}
                  className="bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-teal-200 dark:shadow-none"
                >
                  {isTyping ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
             </form>
             <p className="text-[10px] text-gray-400 text-center mt-2">
               *Cuộc trò chuyện này hoàn toàn ẩn danh. AI có thể mắc lỗi, hãy kiểm chứng thông tin quan trọng.
             </p>
          </div>
        </div>

        {/* Sidebar (Resources) - Hidden on mobile */}
        <div className="hidden md:flex w-72 bg-gray-50 dark:bg-gray-800/50 border-l border-gray-100 dark:border-gray-700 flex-col p-4 space-y-4 overflow-y-auto">
           <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-3 text-sm">
                <Phone size={16} className="text-teal-600" /> Liên hệ Khẩn cấp
              </h3>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Tổng đài Trẻ em</span>
                  <a href="tel:111" className="font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded">111</a>
                </li>
                
                {/* Updated School Counseling Dept */}
                <li className="flex flex-col gap-2">
                   <div className="text-gray-900 dark:text-white font-semibold text-xs uppercase tracking-wide mb-1">
                      Đường dây nóng dẫn tới ban tư vấn tâm lý
                   </div>
                   <div className="flex items-center gap-2 pl-2">
                     <Phone size={14} className="text-teal-600 shrink-0" />
                     <a href="tel:084333633868" className="font-medium text-gray-700 dark:text-gray-300 hover:text-teal-600 hover:underline">084333633868</a>
                   </div>
                   <div className="flex items-center gap-2 pl-2">
                     <Phone size={14} className="text-teal-600 shrink-0" />
                     <a href="tel:084978655379" className="font-medium text-gray-700 dark:text-gray-300 hover:text-teal-600 hover:underline">084978655379</a>
                   </div>
                </li>
              </ul>
           </div>

           {/* Replacement for Scheduling: Stress Relief Tips */}
           <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800">
              <h3 className="font-bold text-green-900 dark:text-green-200 flex items-center gap-2 mb-3 text-sm">
                  <Smile size={16} /> Mẹo giảm stress nhanh
              </h3>
              <ul className="space-y-2">
                  <li className="text-xs text-green-800 dark:text-green-300 flex items-start gap-2">
                      <span className="mt-1 w-1 h-1 bg-green-500 rounded-full shrink-0"></span>
                      <span>Hít vào 4s - Giữ 7s - Thở ra 8s.</span>
                  </li>
                  <li className="text-xs text-green-800 dark:text-green-300 flex items-start gap-2">
                      <span className="mt-1 w-1 h-1 bg-green-500 rounded-full shrink-0"></span>
                      <span>Uống một ngụm nước ấm từ từ.</span>
                  </li>
                  <li className="text-xs text-green-800 dark:text-green-300 flex items-start gap-2">
                      <span className="mt-1 w-1 h-1 bg-green-500 rounded-full shrink-0"></span>
                      <span>Nghe nhạc không lời hoặc tiếng mưa.</span>
                  </li>
                  <li className="text-xs text-green-800 dark:text-green-300 flex items-start gap-2">
                      <span className="mt-1 w-1 h-1 bg-green-500 rounded-full shrink-0"></span>
                      <span>Viết ra 3 điều em cảm thấy biết ơn.</span>
                  </li>
              </ul>
           </div>
           
           <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
             <div className="flex items-start gap-2">
               <Info size={16} className="text-gray-400 shrink-0 mt-0.5" />
               <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                 Đây là không gian an toàn. Mọi chia sẻ của em với AI đều không được lưu trữ lâu dài để bảo mật danh tính.
               </p>
             </div>
           </div>
        </div>
      </div>
      
      {/* Mobile Contact Info (Bottom) */}
      <div className="md:hidden p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-around text-xs font-medium text-gray-600 dark:text-gray-400">
         <a href="tel:111" className="flex items-center gap-1 text-red-600"><Phone size={14} /> Tổng đài 111</a>
         <a href="tel:084333633868" className="flex items-center gap-1"><HeartHandshake size={14} /> Đường dây nóng</a>
      </div>
    </div>
  );
};
