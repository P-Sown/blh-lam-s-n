
import { GoogleGenAI, Type } from "@google/genai";
import { ReportType, AIAnalysisResult, UrgencyLevel, ChatMessage } from "../types";

// Helper to convert Blob/File to Base64
export const fileToGenerativePart = async (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g., "data:image/jpeg;base64,")
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getUrgencyFromText = (text: string): UrgencyLevel => {
  const t = (text || '').toUpperCase();
  if (t.includes('HIGH') || t.includes('CAO') || t.includes('NGUY HIỂM')) return UrgencyLevel.HIGH;
  if (t.includes('MEDIUM') || t.includes('TRUNG BÌNH')) return UrgencyLevel.MEDIUM;
  return UrgencyLevel.LOW;
};

export const analyzeReportContent = async (
  text: string,
  type: ReportType,
  mediaFile?: File | Blob
): Promise<AIAnalysisResult> => {
  
  if (!process.env.API_KEY) {
    console.warn("No API Key found. Returning mock analysis.");
    return {
      isSchoolViolence: true, // Default to true if AI is off to be safe
      urgency: UrgencyLevel.MEDIUM,
      summary: "AI chưa được kích hoạt (Thiếu API Key). Phân tích mô phỏng.",
      category: ["Chưa phân loại"],
      confidenceScore: 75
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelId = "gemini-2.5-flash";

  let prompt = `
    Bạn là một AI an toàn học đường, nhiệm vụ của bạn là phân tích và sàng lọc các báo cáo.

    ĐỊNH NGHĨA BẠO LỰC HỌC ĐƯỜNG (BLHĐ): là hành vi ngược đãi, đánh đập, bạo hành (thể chất); sỉ nhục, lăng mạ, tẩy chay, cô lập (tinh thần); quấy rối, hiếp dâm (tình dục); hoặc mang vũ khí đe dọa.
    CÁC TRƯỜNG HỢP KHÔNG PHẢI BLHĐ: báo mất đồ, hỏi bài tập, than phiền điểm số, mâu thuẫn gia đình không liên quan đến trường học.

    NHIỆM VỤ SỐ 1 (QUAN TRỌNG NHẤT): Phân loại xem nội dung báo cáo có phải là BLHĐ hay không.
    
    Hãy trả về kết quả dưới dạng JSON (không dùng code block markdown).
    
    1. Nếu báo cáo ĐÚNG là BLHĐ, trả về JSON theo cấu trúc sau:
    {
      "isSchoolViolence": true,
      "urgency": "HIGH" | "MEDIUM" | "LOW",
      "summary": "Tóm tắt ngắn gọn sự việc bằng tiếng Việt (dưới 20 từ)",
      "category": ["Danh sách các loại vi phạm, ví dụ: Bạo lực thể chất, Tẩy chay, Quấy rối mạng..."],
      "confidenceScore": số nguyên từ 0 đến 100
    }
    Tiêu chí urgency: HIGH (vũ khí, đánh hội đồng, đe dọa tính mạng), MEDIUM (bắt nạt, đe dọa), LOW (nghi ngờ, mâu thuẫn nhỏ).

    2. Nếu báo cáo KHÔNG phải là BLHĐ, trả về JSON theo cấu trúc sau:
    {
      "isSchoolViolence": false,
      "rejectionReason": "Giải thích ngắn gọn bằng tiếng Việt tại sao đây không phải là BLHĐ (ví dụ: 'Đây là vấn đề về thất lạc tài sản, không phải bạo lực học đường.')"
    }
  `;

  const parts: any[] = [];

  parts.push({ text: `Mô tả của học sinh: ${text || "Không có mô tả văn bản."}` });

  if (mediaFile) {
    try {
      const base64Data = await fileToGenerativePart(mediaFile);
      let mimeType = mediaFile.type;
      
      if (type === ReportType.AUDIO && !mimeType) {
         mimeType = 'audio/webm';
      }

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
      
      if (type === ReportType.IMAGE) {
        prompt += "\n Phân tích hình ảnh đính kèm để tìm dấu hiệu bạo lực, thương tích hoặc vũ khí.";
      } else if (type === ReportType.AUDIO) {
        prompt += "\n Nghe đoạn âm thanh, phân tích giọng điệu (sợ hãi, giận dữ) và nội dung lời nói.";
      }
    } catch (e) {
      console.error("Error processing media for AI", e);
    }
  }

  parts.push({ text: prompt });

  try {
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("AI Analysis timed out")), 25000)
    );

    const generatePromise = ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            temperature: 0.2
        }
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const responseText = (response as any).text;
    console.log("AI Response Raw:", responseText);

    const json = JSON.parse(responseText);

    // Return full analysis object based on AI's classification
    if (json.isSchoolViolence) {
      return {
        isSchoolViolence: true,
        urgency: getUrgencyFromText(json.urgency),
        summary: json.summary || "Đã nhận báo cáo",
        category: json.category || ["Khác"],
        confidenceScore: typeof json.confidenceScore === 'number' ? json.confidenceScore : 80
      };
    } else {
      return {
        isSchoolViolence: false,
        rejectionReason: json.rejectionReason || "Nội dung không được xác định là bạo lực học đường."
      };
    }

  } catch (error) {
    console.error("AI Analysis Failed or Timed Out:", error);
    // SAFETY NET: If AI fails, assume it's a valid report to be safe.
    return {
      isSchoolViolence: true,
      urgency: UrgencyLevel.MEDIUM,
      summary: "Chưa thể phân tích AI (Lỗi/Hết hạn). Vui lòng kiểm tra thủ công.",
      category: ["Chưa phân loại"],
      confidenceScore: 0
    };
  }
};

// --- COUNSELING SERVICE ---

interface CounselingResponse {
    text: string;
    riskLevel: UrgencyLevel;
    flagged: boolean;
    summary?: string;
}

export const getCounselingResponse = async (history: ChatMessage[], newMessage: string): Promise<CounselingResponse> => {
  if (!process.env.API_KEY) {
    // Trả về tin nhắn hướng dẫn khi không có API Key
    return {
        text: "Chào em, hiện tại hệ thống AI đang bảo trì. Em đừng lo lắng, nếu có chuyện khẩn cấp hãy gọi ngay hotline 084333633868 để được các thầy cô hỗ trợ trực tiếp nhé!",
        riskLevel: UrgencyLevel.LOW,
        flagged: false,
        summary: "Hệ thống bảo trì (No API Key)"
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-2.5-flash";

  const systemInstruction = `
    Bạn là "Người bạn đồng hành" - chuyên gia tâm lý học đường tại trường THCS Lam Sơn.
    
    NHIỆM VỤ KÉP:
    1. Trả lời học sinh: Thấu hiểu, không phán xét, ngắn gọn (dưới 150 từ), đưa ra lời khuyên.
    2. GIÁM SÁT RỦI RO (QUAN TRỌNG): Phân tích tin nhắn của học sinh xem có dấu hiệu:
       - Tự tử, tự làm hại bản thân -> Mức độ HIGH
       - Bị bạo lực, bị xâm hại, trầm cảm nặng -> Mức độ HIGH
       - Rối loạn lo âu, mâu thuẫn bạn bè -> Mức độ MEDIUM
       - Chuyện phiếm, hỏi thăm -> Mức độ LOW

    OUTPUT FORMAT: Hãy trả về JSON (không dùng code block markdown) theo mẫu:
    {
      "reply": "Câu trả lời của bạn dành cho học sinh...",
      "riskLevel": "HIGH" | "MEDIUM" | "LOW",
      "flagged": true/false (true nếu riskLevel là HIGH hoặc MEDIUM),
      "summary": "Tóm tắt ngắn gọn vấn đề của học sinh (dưới 10 từ)"
    }
  `;

  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    })),
    {
      role: 'user',
      parts: [{ text: newMessage }]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text;
    const json = JSON.parse(responseText);

    return {
        text: json.reply || "Xin lỗi, mình chưa hiểu ý em. Em nói rõ hơn được không?",
        riskLevel: getUrgencyFromText(json.riskLevel),
        flagged: json.flagged || false,
        summary: json.summary
    };

  } catch (error) {
    console.error("Counseling AI Error:", error);
    return {
        text: "Hiện tại mình không thể phản hồi do lỗi kết nối. Em hãy hít thở sâu và gọi hotline 084333633868 nếu cần giúp gấp nhé.",
        riskLevel: UrgencyLevel.LOW,
        flagged: false
    };
  }
};
