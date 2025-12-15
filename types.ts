

export enum ReportType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO'
}

export enum UrgencyLevel {
  HIGH = 'HIGH', // Nguy hiểm cao
  MEDIUM = 'MEDIUM', // Mức trung bình
  LOW = 'LOW' // Mức thấp/Giám sát
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export interface AIAnalysisResult {
  // NEW: Gatekeeper fields
  isSchoolViolence: boolean; // AI xác định đây có phải là bạo lực học đường không
  rejectionReason?: string; // Lý do nếu isSchoolViolence = false

  // Original analysis fields (only present if isSchoolViolence = true)
  urgency?: UrgencyLevel;
  summary?: string;
  category?: string[]; // e.g., ["Physical", "Verbal", "Cyber"]
  confidenceScore?: number; // 0-100
}

export interface StudentInfo {
  fullName: string;
  studentClass: string;
  nationalId?: string; // Optional now
  isAnonymous?: boolean; // New flag for guest mode
}

export interface Report {
  id: string;
  timestamp: number;
  type: ReportType;
  content: string; // User description or transcribed text
  mediaUrl?: string; // Blob URL for display
  mediaMimeType?: string;
  status: ReportStatus;
  aiAnalysis?: AIAnalysisResult;
  location?: string;
  
  // Student Identity Fields
  isAnonymous: boolean;
  studentName?: string;
  studentClass?: string;
  nationalId?: string; // CCCD
  
  // Admin Processing
  processedBy?: string; // Tên tài khoản admin đã xử lý
  processedAt?: number; // Thời gian admin cập nhật trạng thái
}

export interface TabView {
  id: string;
  label: string;
  icon: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// --- NEW TYPES FOR COUNSELING ---
export interface CounselingSession {
  id: string;
  studentName: string; // "Ẩn danh" hoặc tên thật
  studentClass: string;
  startTime: number;
  lastActivity: number;
  riskLevel: UrgencyLevel; // AI đánh giá
  isFlagged: boolean; // True nếu AI phát hiện nguy hiểm
  summary: string; // Tóm tắt ngắn gọn nội dung chat
  messages: ChatMessage[]; // Để hiển thị trong Dashboard (hoặc load sub-collection)
}