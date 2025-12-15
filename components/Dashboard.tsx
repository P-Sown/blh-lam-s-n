
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Report, ReportStatus, UrgencyLevel, ReportType, CounselingSession, ChatMessage } from '../types';
import { subscribeToCounselingSessions, subscribeToSessionMessages } from '../services/firebase';
import * as XLSX from 'xlsx';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Sector 
} from 'recharts';
import { 
  AlertTriangle, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  Search,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Brain,
  X,
  CheckCircle,
  Maximize2,
  Eye,
  User,
  ShieldQuestion,
  UserCheck,
  HeartHandshake,
  MessageCircle,
  Radio,
  Calendar,
  Filter,
  Download,
  RotateCcw
} from 'lucide-react';

interface DashboardProps {
  reports: Report[];
  onUpdateStatus: (id: string, status: ReportStatus) => void;
  // New prop to inform parent App about monitoring status
  onMonitoringChange?: (sessionId: string | null) => void; 
}

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#6366F1']; // Red, Amber, Emerald, Indigo

// --- Sub-component: Live Chat Monitor ---
const ChatMonitor: React.FC<{ session: CounselingSession, onClose: () => void }> = ({ session, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = subscribeToSessionMessages(session.id, (msgs) => {
            setMessages(msgs);
            // Scroll to bottom on new message
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsubscribe();
    }, [session.id]);

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 bg-teal-600 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">
                            <Radio size={16} className="animate-pulse" /> Giám sát trực tiếp
                        </h3>
                        <p className="text-xs text-teal-100 mt-1">
                            {session.studentName} - {session.studentClass}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
                    {messages.length === 0 && <p className="text-center text-gray-400 text-sm italic">Chưa có tin nhắn nào.</p>}
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                             <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                                msg.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
                             }`}>
                                {msg.role === 'user' ? 'HS' : 'AI'}
                             </div>
                             <div className={`p-3 rounded-2xl text-sm ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-tl-none'
                             }`}>
                                {msg.text}
                                <div className="text-[10px] opacity-70 mt-1 text-right">
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </div>
                             </div>
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>

                <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500">
                    Đang xem ở chế độ chỉ đọc (Read-only).
                </div>
            </div>
        </div>
    );
};

// --- Custom Active Shape for Pie Chart (3D Pop-out Effect) ---
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;

  return (
    <g>
      <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill={fill} className="font-bold text-lg dark:fill-white">
        {payload.name}
      </text>
      <text x={cx} y={cy + 10} dy={8} textAnchor="middle" fill="#999" className="text-sm">
        {`${value} báo cáo`}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10} // Expand radius to pop out
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0px 6px 6px rgba(0,0,0,0.3))' }} // Add shadow for 3D effect
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 14}
        fill={fill}
      />
    </g>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ reports, onUpdateStatus, onMonitoringChange }) => {
  // View State
  const [activeTab, setActiveTab] = useState<'reports' | 'counseling'>('reports');

  // Chart Interaction State
  const [activePieIndex, setActivePieIndex] = useState<number | undefined>(undefined);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Reports Filter State
  const [filterUrgency, setFilterUrgency] = useState<UrgencyLevel | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<ReportStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Calculate default academic year (e.g., if today is Oct 2024 -> 2024-2025)
  const getCurrentAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11. Month 8 is September.
    // If before September, we are in the second half of the previous academic year
    if (month < 8) {
        return `${year - 1}-${year}`;
    }
    return `${year}-${year + 1}`;
  };

  // Helper to get today YYYY-MM-DD
  const getTodayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Time Filter State - Academic Year
  const [academicYear, setAcademicYear] = useState<string>(getCurrentAcademicYear());
  
  // Time Filter State - Specific Dates (Default to TODAY)
  const todayStr = getTodayStr();
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  
  // Counseling State
  const [sessions, setSessions] = useState<CounselingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<CounselingSession | null>(null);

  // Subscribe to counseling sessions
  useEffect(() => {
      const unsubscribe = subscribeToCounselingSessions((data) => {
          setSessions(data);
      });
      return () => unsubscribe();
  }, []);

  const handleOpenMonitor = (session: CounselingSession) => {
      setSelectedSession(session);
      onMonitoringChange?.(session.id); // Thông báo cho App biết đang xem session này
  };

  const handleCloseMonitor = () => {
      setSelectedSession(null);
      onMonitoringChange?.(null); // Thông báo đã dừng xem
  };

  const handleAcademicYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setAcademicYear(e.target.value);
      // Clear custom dates when year is selected to avoid confusion
      setStartDate('');
      setEndDate('');
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
      if (type === 'start') setStartDate(value);
      else setEndDate(value);
  };

  const clearDateFilter = () => {
      setStartDate('');
      setEndDate('');
  };

  // --- REPORT FILTERING ---
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
        // 1. Time Filter (Priority: Custom Date > Academic Year)
        let matchTime = true;
        
        if (startDate && endDate) {
            // Custom Date Range Logic
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            const end = new Date(endDate);
            end.setHours(23,59,59,999);
            const rTime = new Date(r.timestamp);
            matchTime = rTime >= start && rTime <= end;
        } else if (academicYear !== 'ALL') {
            // Academic Year Logic
            const [startYearStr, endYearStr] = academicYear.split('-');
            const startYear = parseInt(startYearStr);
            const endYear = parseInt(endYearStr);
            
            // Academic year: From Sept 1st of Start Year to Aug 31st of End Year
            const startLimit = new Date(startYear, 8, 1).getTime(); // Sept 1st
            const endLimit = new Date(endYear, 7, 31, 23, 59, 59).getTime(); // Aug 31st

            matchTime = r.timestamp >= startLimit && r.timestamp <= endLimit;
        }

        // 2. Attribute Filter
        const matchUrgency = filterUrgency === 'ALL' || r.aiAnalysis?.urgency === filterUrgency;
        const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
        const searchLower = searchTerm.toLowerCase();
        const matchSearch = 
            (r.content?.toLowerCase() || '').includes(searchLower) ||
            (r.aiAnalysis?.summary?.toLowerCase() || '').includes(searchLower) ||
            (r.id?.toLowerCase() || '').includes(searchLower) ||
            (r.studentName?.toLowerCase() || '').includes(searchLower) ||
            (r.studentClass?.toLowerCase() || '').includes(searchLower) ||
            (r.nationalId?.toLowerCase() || '').includes(searchLower);
        
        return matchUrgency && matchStatus && matchSearch && matchTime;
    });
  }, [reports, filterUrgency, filterStatus, searchTerm, academicYear, startDate, endDate]);

  // --- EXPORT FUNCTIONALITY (NEW) ---
  const handleCardExport = (type: 'total' | 'pending' | 'high_risk' | 'counseling') => {
    const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
    let dataToExport: any[] = [];
    let fileName = '';
    let sheetName = 'Data';

    if (type === 'counseling') {
        if (sessions.length === 0) {
            alert("Không có dữ liệu tư vấn để xuất.");
            return;
        }
        dataToExport = sessions.map((s, index) => ({
            "STT": index + 1,
            "Mã Phiên": s.id,
            "Học Sinh": s.studentName,
            "Lớp": s.studentClass,
            "Mức độ rủi ro": s.riskLevel === UrgencyLevel.HIGH ? "CAO" : s.riskLevel === UrgencyLevel.MEDIUM ? "Trung bình" : "Thấp",
            "Cần chú ý": s.isFlagged ? "Có" : "Không",
            "Hoạt động cuối": new Date(s.lastActivity).toLocaleString('vi-VN'),
            "Tóm tắt": s.summary
        }));
        fileName = `DS_TuVanTamLy_${dateStr}.xlsx`;
        sheetName = "TuVanTamLy";
    } else {
        // Logic for reports based on current filter context
        let sourceData: Report[] = [];
        let label = "";

        if (type === 'total') {
            sourceData = filteredReports;
            label = "TongHop";
        } else if (type === 'pending') {
            sourceData = filteredReports.filter(r => r.status === ReportStatus.PENDING);
            label = "ChoXuLy";
        } else if (type === 'high_risk') {
            sourceData = filteredReports.filter(r => r.aiAnalysis?.urgency === UrgencyLevel.HIGH);
            label = "NguyHiemCao";
        }

        if (sourceData.length === 0) {
            alert("Không có báo cáo nào trong mục này để xuất.");
            return;
        }

        dataToExport = sourceData.map((r, index) => ({
            "STT": index + 1,
            "Mã Báo Cáo": r.id,
            "Thời Gian Gửi": new Date(r.timestamp).toLocaleString('vi-VN'),
            "Mức Độ": r.aiAnalysis?.urgency === UrgencyLevel.HIGH ? "Nguy hiểm" : 
                    r.aiAnalysis?.urgency === UrgencyLevel.MEDIUM ? "Trung bình" : "Thấp",
            "Trạng Thái": r.status === ReportStatus.PENDING ? "Chờ xử lý" : 
                        r.status === ReportStatus.REVIEWING ? "Đang xem" : "Đã xong",
            "Họ Tên HS": r.isAnonymous ? "Ẩn danh" : r.studentName,
            "Lớp": r.isAnonymous ? "N/A" : r.studentClass,
            "CCCD/Mã HS": r.isAnonymous ? "N/A" : r.nationalId,
            "Loại Báo Cáo": r.type,
            "Tóm Tắt AI": r.aiAnalysis?.summary || "",
            "Nội Dung Chi Tiết": r.content || "",
            "Người Xử Lý": r.processedBy || "",
            "Thời Gian Xử Lý": r.processedAt ? new Date(r.processedAt).toLocaleString('vi-VN') : "",
        }));
        fileName = `BaoCao_${label}_${dateStr}.xlsx`;
        sheetName = label;
    }

    // Export Process
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Auto-width for columns (simple approximation)
    if (dataToExport.length > 0) {
        const wscols = Object.keys(dataToExport[0]).map(() => ({ wch: 20 }));
        worksheet['!cols'] = wscols;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
  };

  // --- EXPORT TO EXCEL (TOOLBAR BUTTON) ---
  const handleExportExcel = () => {
    handleCardExport('total');
  };

  // --- REPORT STATISTICS ---
  const stats = useMemo(() => {
    const total = filteredReports.length;
    const pending = filteredReports.filter(r => r.status === ReportStatus.PENDING).length;
    const highRisk = filteredReports.filter(r => r.aiAnalysis?.urgency === UrgencyLevel.HIGH).length;
    const resolved = filteredReports.filter(r => r.status === ReportStatus.RESOLVED).length;
    
    return { total, pending, highRisk, resolved };
  }, [filteredReports]);

  // --- CHARTS DATA PREPARATION ---
  const urgencyData = useMemo(() => [
    { name: 'Nguy hiểm', value: filteredReports.filter(r => r.aiAnalysis?.urgency === UrgencyLevel.HIGH).length },
    { name: 'Trung bình', value: filteredReports.filter(r => r.aiAnalysis?.urgency === UrgencyLevel.MEDIUM).length },
    { name: 'Thấp', value: filteredReports.filter(r => r.aiAnalysis?.urgency === UrgencyLevel.LOW).length },
  ], [filteredReports]);

  const statusData = useMemo(() => [
    { name: 'Chờ xử lý', value: filteredReports.filter(r => r.status === ReportStatus.PENDING).length },
    { name: 'Đang xem', value: filteredReports.filter(r => r.status === ReportStatus.REVIEWING).length },
    { name: 'Đã xong', value: filteredReports.filter(r => r.status === ReportStatus.RESOLVED).length },
  ], [filteredReports]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterUrgency, filterStatus, searchTerm, academicYear, startDate, endDate, itemsPerPage]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- HELPERS ---
  const getUrgencyColor = (level?: UrgencyLevel) => {
    switch (level) {
      case UrgencyLevel.HIGH: return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200';
      case UrgencyLevel.MEDIUM: return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200';
      case UrgencyLevel.LOW: return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 border-gray-200';
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case ReportStatus.PENDING: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Chờ xử lý</span>;
      case ReportStatus.REVIEWING: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">Đang xem</span>;
      case ReportStatus.RESOLVED: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300">Đã giải quyết</span>;
      default: return null;
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString('vi-VN');

  return (
    <div className="space-y-6 pb-10">
      {selectedSession && (
          <ChatMonitor session={selectedSession} onClose={handleCloseMonitor} />
      )}

      {/* --- TIME FILTER SECTION (ACADEMIC YEAR OR DATE) --- */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
              <Calendar size={20} />
              <span>Thống kê theo thời gian:</span>
          </div>
          
          <div className="flex flex-col md:flex-row flex-wrap items-center gap-4 w-full xl:w-auto">
              
              {/* Option 1: Academic Year */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Năm học:</span>
                <select 
                   value={academicYear}
                   onChange={handleAcademicYearChange}
                   className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-40"
                   disabled={!!startDate || !!endDate}
                >
                    <option value="2023-2024">2023 - 2024</option>
                    <option value="2024-2025">2024 - 2025</option>
                    <option value="2025-2026">2025 - 2026</option>
                    <option value="ALL">Tất cả</option>
                </select>
              </div>

              <div className="hidden md:block h-6 w-px bg-gray-200 dark:bg-gray-600 mx-2"></div>

              {/* Option 2: Custom Date Range */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                 <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Hoặc ngày:</span>
                 <div className={`flex items-center gap-2 ${(startDate || endDate) ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800 p-1 rounded-lg' : ''}`}>
                    <input 
                       type="date" 
                       value={startDate}
                       onChange={(e) => handleDateChange('start', e.target.value)}
                       className="px-2 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                       type="date" 
                       value={endDate}
                       onChange={(e) => handleDateChange('end', e.target.value)}
                       className="px-2 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {(startDate || endDate) && (
                        <button 
                            onClick={clearDateFilter}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-500"
                            title="Xóa lọc ngày"
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}
                 </div>
              </div>

          </div>
      </div>

      {/* --- STATS CARDS (UPDATED WITH CLICK TO EXPORT) --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Tổng báo cáo - Indigo Theme */}
        <div 
            onClick={() => handleCardExport('total')}
            title="Nhấn để tải Excel (Tổng hợp)"
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:border-transparent transition-all duration-300 ease-in-out cursor-pointer transform hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-indigo-100 transition-colors font-medium">Tổng báo cáo</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-white transition-colors">{stats.total}</h3>
            </div>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:bg-white group-hover:text-indigo-600 transition-all">
              <FileText size={20} />
            </div>
          </div>
        </div>

        {/* Card 2: Chờ xử lý - Amber Theme */}
        <div 
            onClick={() => handleCardExport('pending')}
            title="Nhấn để tải Excel (Chờ xử lý)"
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:bg-amber-500 dark:hover:bg-amber-600 hover:border-transparent transition-all duration-300 ease-in-out cursor-pointer transform hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-amber-100 transition-colors font-medium">Chờ xử lý</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 group-hover:text-white transition-colors">{stats.pending}</h3>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 group-hover:bg-white group-hover:text-amber-600 transition-all">
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* Card 3: Nguy hiểm cao - Red Theme */}
        <div 
            onClick={() => handleCardExport('high_risk')}
            title="Nhấn để tải Excel (Nguy hiểm cao)"
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:bg-red-600 dark:hover:bg-red-600 hover:border-transparent transition-all duration-300 ease-in-out cursor-pointer transform hover:-translate-y-1 hover:shadow-lg"
        >
          {stats.highRisk > 0 && (
             <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping m-2 group-hover:bg-white/50"></div>
          )}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-red-100 transition-colors font-medium">Nguy hiểm cao</p>
              <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 group-hover:text-white transition-colors">{stats.highRisk}</h3>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 group-hover:bg-white group-hover:text-red-600 transition-all">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>

        {/* Card 4: Cuộc tư vấn - Teal Theme */}
        <div 
            onClick={() => handleCardExport('counseling')}
            title="Nhấn để tải Excel (Danh sách tư vấn)"
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:bg-teal-600 dark:hover:bg-teal-600 hover:border-transparent transition-all duration-300 ease-in-out cursor-pointer transform hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-teal-100 transition-colors font-medium">Cuộc tư vấn</p>
              <h3 className="text-2xl font-bold text-teal-600 dark:text-teal-400 group-hover:text-white transition-colors">{sessions.length}</h3>
            </div>
            <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400 group-hover:bg-white group-hover:text-teal-600 transition-all">
              <HeartHandshake size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* --- CHARTS SECTION --- */}
      {activeTab === 'reports' && stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 1. Urgency Distribution (Pie Chart) - With 3D Pop Effect */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Phân loại Mức độ</h3>
                  <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                activeIndex={activePieIndex}
                                activeShape={renderActiveShape}
                                data={urgencyData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                onMouseEnter={(_, index) => setActivePieIndex(index)}
                                onMouseLeave={() => setActivePieIndex(undefined)}
                              >
                                {urgencyData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                ))}
                              </Pie>
                              <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* 2. Status Distribution (Vertical Column Chart) - With 3D Shadow Effect */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Trạng thái xử lý</h3>
                  <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={statusData} 
                            margin={{top: 10, right: 10, left: -20, bottom: 0}}
                          >
                              <defs>
                                <filter id="barShadow" height="130%">
                                  <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                                  <feOffset dx="0" dy="3" result="offsetblur"/>
                                  <feComponentTransfer>
                                    <feFuncA type="linear" slope="0.5"/>
                                  </feComponentTransfer>
                                  <feMerge> 
                                    <feMergeNode/>
                                    <feMergeNode in="SourceGraphic"/> 
                                  </feMerge>
                                </filter>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                              <XAxis 
                                dataKey="name" 
                                tick={{fontSize: 11, fill: '#6B7280'}} 
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis 
                                allowDecimals={false}
                                tick={{fontSize: 11, fill: '#6B7280'}} 
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip cursor={{fill: 'transparent'}} />
                              <Bar 
                                dataKey="value" 
                                name="Số lượng" 
                                radius={[4, 4, 0, 0]} 
                                barSize={50}
                                onMouseEnter={(_, index) => setActiveBarIndex(index)}
                                onMouseLeave={() => setActiveBarIndex(null)}
                              >
                                {statusData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={index === 0 ? '#9CA3AF' : index === 1 ? '#3B82F6' : '#10B981'}
                                        style={{
                                            filter: activeBarIndex === index ? 'url(#barShadow)' : 'none',
                                            opacity: activeBarIndex === index ? 1 : (activeBarIndex === null ? 1 : 0.6),
                                            transition: 'opacity 0.3s ease'
                                        }}
                                    />
                                ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {/* Main Content Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
         <div className="flex border-b border-gray-100 dark:border-gray-700">
            <button
               onClick={() => setActiveTab('reports')}
               className={`px-6 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'reports' 
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
               }`}
            >
               <FileText size={16} /> Báo cáo Vi phạm
            </button>
            <button
               onClick={() => setActiveTab('counseling')}
               className={`px-6 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'counseling' 
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
               }`}
            >
               <HeartHandshake size={16} /> Tư vấn Tâm lý
            </button>
         </div>
         
         {/* TAB 1: REPORTS */}
         {activeTab === 'reports' && (
             <>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50 dark:bg-gray-800">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Tìm theo tên, lớp, CCCD..." 
                                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-1 text-gray-500 text-xs px-2">
                            <Filter size={14} /> Lọc:
                        </div>
                        <select 
                            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none"
                            value={filterUrgency}
                            onChange={(e) => setFilterUrgency(e.target.value as any)}
                        >
                            <option value="ALL">Mọi mức độ</option>
                            <option value={UrgencyLevel.HIGH}>Nguy hiểm cao</option>
                            <option value={UrgencyLevel.MEDIUM}>Trung bình</option>
                            <option value={UrgencyLevel.LOW}>Thấp</option>
                        </select>

                        <select 
                            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:outline-none"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                        >
                            <option value="ALL">Mọi trạng thái</option>
                            <option value={ReportStatus.PENDING}>Chờ xử lý</option>
                            <option value={ReportStatus.REVIEWING}>Đang xem</option>
                            <option value={ReportStatus.RESOLVED}>Đã xong</option>
                        </select>

                        <button 
                            onClick={handleExportExcel}
                            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 font-medium shadow-sm transition-colors"
                        >
                            <Download size={16} /> Xuất Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                        <th className="px-6 py-3 w-16 text-center">STT</th>
                        <th className="px-6 py-3">Mức độ</th>
                        <th className="px-6 py-3">Thời gian</th>
                        <th className="px-6 py-3">Danh tính</th>
                        <th className="px-6 py-3">Nội dung</th>
                        <th className="px-6 py-3">Trạng thái</th>
                        <th className="px-6 py-3">Thời gian xử lý</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {paginatedReports.length > 0 ? (
                        paginatedReports.map((report, index) => (
                        <tr 
                            key={report.id} 
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                                report.aiAnalysis?.urgency === UrgencyLevel.HIGH && report.status === ReportStatus.PENDING 
                                ? 'bg-red-50 dark:bg-red-900/10' 
                                : ''
                            }`}
                            onClick={() => setSelectedReport(report)}
                        >
                            <td className="px-6 py-4 text-center font-medium text-gray-500 dark:text-gray-400">
                                {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getUrgencyColor(report.aiAnalysis?.urgency)}`}>
                                {report.aiAnalysis?.urgency === UrgencyLevel.HIGH ? 'CAO' : 
                                report.aiAnalysis?.urgency === UrgencyLevel.MEDIUM ? 'Trung bình' : 'Thấp'}
                            </span>
                            </td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                            {formatTime(report.timestamp)}
                            </td>
                            <td className="px-6 py-4">
                                {report.isAnonymous ? (
                                    <span className="text-gray-400 text-xs italic flex items-center gap-1"><ShieldQuestion size={12}/> Ẩn danh</span>
                                ) : (
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{report.studentName}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Lớp: {report.studentClass}</p>
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4" onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReport(report);
                            }}>
                            <div className="flex items-center gap-2 group cursor-pointer" title="Nhấn để xem chi tiết">
                                {report.type === ReportType.IMAGE && <ImageIcon size={14} className="text-blue-500 shrink-0" />}
                                {report.type === ReportType.VIDEO && <Video size={14} className="text-purple-500 shrink-0" />}
                                {report.type === ReportType.AUDIO && <Mic size={14} className="text-pink-500 shrink-0" />}
                                <span className="truncate max-w-[200px] font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:underline transition-colors">
                                    {report.aiAnalysis?.summary || report.content || "Không có nội dung"}
                                </span>
                            </div>
                            </td>
                            <td className="px-6 py-4">
                            {getStatusBadge(report.status)}
                            </td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                {report.processedAt ? new Date(report.processedAt).toLocaleString('vi-VN') : '-'}
                            </td>
                        </tr>
                        ))
                    ) : (
                        <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                            Không tìm thấy báo cáo nào trong khoảng thời gian này.
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </>
         )}

         {/* TAB 2: COUNSELING */}
         {activeTab === 'counseling' && (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                        <th className="px-6 py-3 w-16 text-center">STT</th>
                        <th className="px-6 py-3">Mức độ Rủi ro</th>
                        <th className="px-6 py-3">Học sinh</th>
                        <th className="px-6 py-3">Hoạt động cuối</th>
                        <th className="px-6 py-3">Tóm tắt</th>
                        <th className="px-6 py-3 text-right">Giám sát</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {sessions.length > 0 ? (
                            sessions.map((session, index) => (
                                <tr 
                                    key={session.id} 
                                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                                        session.isFlagged ? 'bg-red-50 dark:bg-red-900/10' : ''
                                    }`}
                                >
                                    <td className="px-6 py-4 text-center font-medium text-gray-500 dark:text-gray-400">
                                        {index + 1}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getUrgencyColor(session.riskLevel)}`}>
                                            {session.riskLevel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-gray-200">{session.studentName}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{session.studentClass}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                        {new Date(session.lastActivity).toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate text-gray-700 dark:text-gray-300">
                                        {session.summary}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleOpenMonitor(session)}
                                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold flex items-center gap-1 ml-auto"
                                        >
                                            <MessageCircle size={14} /> Theo dõi
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                    Chưa có cuộc trò chuyện nào.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
         )}

        {/* Pagination Controls (Shared for Reports) */}
        {activeTab === 'reports' && filteredReports.length > 0 && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                        Hiển thị {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredReports.length)} trong số {filteredReports.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <span>Số lượng:</span>
                        <select 
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className={`p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start sticky top-0 z-10 bg-white dark:bg-gray-800 ${
                selectedReport.aiAnalysis?.urgency === UrgencyLevel.HIGH ? 'bg-red-50 dark:bg-red-900/20' : ''
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                   <h2 className="text-xl font-bold text-gray-900 dark:text-white">Chi tiết Báo cáo</h2>
                   <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getUrgencyColor(selectedReport.aiAnalysis?.urgency)}`}>
                        {selectedReport.aiAnalysis?.urgency === UrgencyLevel.HIGH ? 'KHẨN CẤP' : 
                         selectedReport.aiAnalysis?.urgency === UrgencyLevel.MEDIUM ? 'CẢNH BÁO' : 'THÔNG TIN'}
                   </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                   <Clock size={12} /> {formatTime(selectedReport.timestamp)}
                   <span className="text-gray-300">|</span>
                   <span>Mã: {selectedReport.id}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-1">
              
              {/* Media Preview */}
              {selectedReport.mediaUrl && (
                <div className="rounded-xl overflow-hidden bg-black/5 dark:bg-black/40 border border-gray-200 dark:border-gray-600 flex justify-center">
                    {selectedReport.type === ReportType.IMAGE && (
                        <div className="relative group w-full">
                            <img src={selectedReport.mediaUrl} alt="Evidence" className="max-h-[400px] w-full object-contain mx-auto" />
                            <a href={selectedReport.mediaUrl} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 p-2 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                <Maximize2 size={16} />
                            </a>
                        </div>
                    )}
                    {selectedReport.type === ReportType.VIDEO && (
                        <video src={selectedReport.mediaUrl} controls className="max-h-[400px] w-full" />
                    )}
                    {selectedReport.type === ReportType.AUDIO && (
                        <div className="w-full p-6 flex items-center gap-4 bg-white dark:bg-gray-700">
                            <div className="bg-pink-100 dark:bg-pink-900/50 p-3 rounded-full">
                                <Mic size={24} className="text-pink-600 dark:text-pink-400" />
                            </div>
                            <audio src={selectedReport.mediaUrl} controls className="w-full" />
                        </div>
                    )}
                </div>
              )}

              {/* Processing Info (Admin Info) */}
              {selectedReport.processedBy && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center gap-2">
                     <UserCheck size={16} className="text-blue-600 dark:text-blue-400" />
                     <div className="text-sm">
                        <p className="text-blue-800 dark:text-blue-200">
                            {selectedReport.status === ReportStatus.RESOLVED 
                                ? <strong>{selectedReport.processedBy}</strong> 
                                : selectedReport.status === ReportStatus.REVIEWING 
                                    ? <strong>{selectedReport.processedBy}</strong> 
                                    : <strong>{selectedReport.processedBy}</strong>
                            }
                            <span>
                                {selectedReport.status === ReportStatus.RESOLVED 
                                    ? ' đã xử lý hoàn tất báo cáo này.' 
                                    : ' đã tiếp nhận xử lý.'}
                            </span>
                        </p>
                        {selectedReport.processedAt && (
                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                Thời gian: {new Date(selectedReport.processedAt).toLocaleString('vi-VN')}
                            </p>
                        )}
                     </div>
                  </div>
              )}

              {/* Student Identity */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-2 uppercase tracking-wide flex items-center gap-2">
                        <User size={14}/> Thông tin người báo cáo
                    </h4>
                    {selectedReport.isAnonymous ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">Báo cáo này được gửi ẩn danh.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <p className="font-semibold text-gray-600 dark:text-gray-400">Họ và Tên:</p>
                                <p className="text-gray-800 dark:text-gray-200 font-medium">{selectedReport.studentName}</p>
                            </div>
                             <div>
                                <p className="font-semibold text-gray-600 dark:text-gray-400">Lớp:</p>
                                <p className="text-gray-800 dark:text-gray-200 font-medium">{selectedReport.studentClass}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="font-semibold text-gray-600 dark:text-gray-400">Mã định danh/CCCD:</p>
                                <p className="text-gray-800 dark:text-gray-200 font-medium font-mono">{selectedReport.nationalId}</p>
                            </div>
                        </div>
                    )}
                </div>

              {/* Content Description */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Nội dung báo cáo</h4>
                <p className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                    {selectedReport.content || "Không có mô tả văn bản."}
                </p>
              </div>

              {/* AI Analysis Box */}
              {selectedReport.aiAnalysis && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-2 mb-3">
                        <Brain className="text-indigo-600 dark:text-indigo-400" size={18} />
                        <h4 className="font-bold text-indigo-900 dark:text-indigo-200">Phân tích AI</h4>
                        <span className="text-xs bg-white dark:bg-gray-700 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300">
                            Độ tin cậy: {selectedReport.aiAnalysis.confidenceScore}%
                        </span>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex gap-2">
                            <span className="font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]">Tóm tắt:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium">{selectedReport.aiAnalysis.summary}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]">Phân loại:</span>
                            <div className="flex flex-wrap gap-1">
                                {selectedReport.aiAnalysis.category.map((cat, idx) => (
                                    <span key={idx} className="bg-white dark:bg-gray-700 px-2 py-0.5 rounded text-xs border border-indigo-100 dark:border-gray-600 text-indigo-700 dark:text-indigo-300">
                                        {cat}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 flex justify-end items-center gap-3">
               <button 
                 onClick={() => setSelectedReport(null)}
                 className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-medium"
               >
                 Đóng
               </button>

               {selectedReport.status !== ReportStatus.RESOLVED && (
                  <button 
                    onClick={() => {
                        onUpdateStatus(selectedReport.id, ReportStatus.RESOLVED);
                        setSelectedReport(prev => prev ? {...prev, status: ReportStatus.RESOLVED, processedAt: Date.now(), processedBy: 'Tôi (Admin)'} : null);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm font-medium flex items-center gap-2"
                  >
                     <CheckCircle size={18} /> Đánh dấu đã xong
                  </button>
               )}
               {selectedReport.status === ReportStatus.PENDING && (
                  <button 
                    onClick={() => {
                        onUpdateStatus(selectedReport.id, ReportStatus.REVIEWING);
                        setSelectedReport(prev => prev ? {...prev, status: ReportStatus.REVIEWING, processedAt: Date.now(), processedBy: 'Tôi (Admin)'} : null);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm font-medium"
                  >
                     Tiếp nhận xử lý
                  </button>
               )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
