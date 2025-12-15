
import { Report } from '../types';

const DB_NAME = 'SafeSpeakDB';
const STORE_NAME = 'reports';
const DB_VERSION = 1;

// Mở kết nối tới Database của trình duyệt (IndexedDB)
// Lưu ý: Dữ liệu nằm trong tab Application -> IndexedDB -> SafeSpeakDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        reject(new Error("Trình duyệt không hỗ trợ IndexedDB"));
        return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
        console.error("IndexedDB Open Error:", request.error);
        reject(request.error);
    };
  });
};

// Lưu hoặc cập nhật một báo cáo
export const saveReport = async (report: Report): Promise<void> => {
  // Trả về Promise để App.tsx có thể await và catch lỗi
  return new Promise(async (resolve, reject) => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const request = store.put(report); // put = thêm mới hoặc ghi đè

        request.onsuccess = () => {
            console.log(
                `%c✅ [Offline Storage] Đã lưu báo cáo ${report.id} thành công!`, 
                "color: #10B981; font-weight: bold; font-size: 12px;"
            );
            console.log(`%c👉 Kiểm tra tại: F12 > Application > IndexedDB > SafeSpeakDB > reports`, "color: #6366F1; font-style: italic;");
            resolve();
        };

        request.onerror = () => {
            console.error("❌ [Offline Storage] Lỗi khi ghi dữ liệu:", request.error);
            reject(request.error);
        };

        tx.oncomplete = () => {
            db.close();
        };
      } catch (error) {
        console.error("❌ [Offline Storage] Lỗi kết nối DB:", error);
        reject(error);
      }
  });
};

// Lấy toàn bộ báo cáo
export const loadReports = async (): Promise<Report[]> => {
  return new Promise(async (resolve, reject) => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
          const results = request.result as Report[];
          results.sort((a, b) => b.timestamp - a.timestamp);
          console.log(`📂 [Offline Storage] Đã tải ${results.length} báo cáo từ IndexedDB.`);
          resolve(results);
        };

        request.onerror = () => reject(request.error);
      } catch (error) {
        // Nếu lỗi mở DB (VD: chưa tạo), trả về mảng rỗng thay vì crash app
        console.warn("⚠️ Không thể tải báo cáo local (có thể do chưa có dữ liệu):", error);
        resolve([]);
      }
  });
};
