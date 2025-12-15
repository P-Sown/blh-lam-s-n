
import React, { useState, useEffect } from 'react';
import { Key, RefreshCw, CheckCircle, XCircle, Copy, Shield, Search, List, Hash, Loader2 } from 'lucide-react';
import { generateStudentToken, verifyToken } from '../utils/crypto';

export const TokenManager: React.FC = () => {
  const [secretKey, setSecretKey] = useState('');
  const [activeTab, setActiveTab] = useState<'generate' | 'verify' | 'lookup'>('generate');
  
  // --- STATE: Generate ---
  const [studentId, setStudentId] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');

  // --- STATE: Verify (Manual) ---
  const [verifyId, setVerifyId] = useState('');
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<'idle' | 'valid' | 'invalid'>('idle');

  // --- STATE: Reverse Lookup (Scan) ---
  const [lookupToken, setLookupToken] = useState('');
  const [lookupMode, setLookupMode] = useState<'range' | 'list'>('range');
  const [scanPrefix, setScanPrefix] = useState('HS');
  const [scanStart, setScanStart] = useState(1);
  const [scanEnd, setScanEnd] = useState(1000);
  const [scanPadding, setScanPadding] = useState(3); // HS001 -> padding 3
  const [scanList, setScanList] = useState('');
  const [foundStudentId, setFoundStudentId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Load/Save secret key locally
  useEffect(() => {
    const savedKey = localStorage.getItem('school_secret_key');
    if (savedKey) setSecretKey(savedKey);
  }, []);

  const handleSaveKey = () => {
    if (secretKey) {
        localStorage.setItem('school_secret_key', secretKey);
        alert("Đã lưu Khóa Bí Mật vào trình duyệt này.");
    }
  };

  const handleGenerate = async () => {
    if (!secretKey || !studentId) return;
    const token = await generateStudentToken(studentId, secretKey);
    setGeneratedToken(token);
  };

  const handleVerify = async () => {
    if (!secretKey || !verifyId || !verifyTokenInput) return;
    const isValid = await verifyToken(verifyTokenInput, verifyId, secretKey);
    setVerifyResult(isValid ? 'valid' : 'invalid');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedToken);
    alert("Đã sao chép Token!");
  };

  // --- LOGIC: Reverse Lookup ---
  const handleScan = async () => {
    if (!secretKey || !lookupToken) {
      alert("Vui lòng nhập Token và Khóa bí mật.");
      return;
    }

    setIsScanning(true);
    setFoundStudentId(null);
    setScanMessage('Đang quét dữ liệu...');
    
    // Delay nhỏ để UI render trạng thái loading
    await new Promise(r => setTimeout(r, 100));

    try {
      const targetToken = lookupToken.trim().toUpperCase();
      let found = null;

      if (lookupMode === 'range') {
        // Quét theo dải số (VD: HS001 -> HS1000)
        for (let i = scanStart; i <= scanEnd; i++) {
          const id = `${scanPrefix}${String(i).padStart(scanPadding, '0')}`;
          const hash = await generateStudentToken(id, secretKey);
          if (hash === targetToken) {
            found = id;
            break;
          }
        }
      } else {
        // Quét theo danh sách dán vào
        const ids = scanList.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        for (const id of ids) {
          const hash = await generateStudentToken(id, secretKey);
          if (hash === targetToken) {
            found = id;
            break;
          }
        }
      }

      if (found) {
        setFoundStudentId(found);
        setScanMessage(`🎉 Đã tìm thấy! Token này thuộc về học sinh: ${found}`);
      } else {
        setScanMessage('❌ Không tìm thấy kết quả trùng khớp trong phạm vi quét.');
      }
    } catch (e) {
      console.error(e);
      setScanMessage('Lỗi trong quá trình quét.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in">
      <div className="flex items-center gap-2 mb-6 text-indigo-700 dark:text-indigo-400">
        <Shield size={24} />
        <h2 className="text-xl font-bold">Quản lý Định danh Học sinh (Token)</h2>
      </div>

      {/* Secret Key Section */}
      <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
           🔑 Khóa Bí Mật của Trường (School Secret Key)
        </label>
        <div className="flex gap-2">
          <input 
            type="password" 
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="Nhập chuỗi bí mật (VD: LamSon2024@Secure)"
            className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-600 dark:text-white dark:border-gray-500 focus:ring-2 focus:ring-indigo-500"
          />
          <button onClick={handleSaveKey} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            Lưu máy này
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 italic">
          * Khóa này dùng để tạo mã hash. Chỉ Ban Giám Hiệu mới được biết khóa này.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('generate')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'generate' 
            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <RefreshCw size={16} /> Tạo Token
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'verify' 
            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <CheckCircle size={16} /> Kiểm tra (Thủ công)
        </button>
        <button
          onClick={() => setActiveTab('lookup')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'lookup' 
            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Search size={16} /> Tra cứu chủ nhân (Quét)
        </button>
      </div>

      {/* CONTENT: Generate */}
      {activeTab === 'generate' && (
        <div className="space-y-4 max-w-md animate-fade-in">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Mã Học Sinh (VD: HS001)</label>
              <input 
                type="text" 
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full mt-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Nhập mã học sinh..."
              />
            </div>
            <button 
              onClick={handleGenerate}
              disabled={!secretKey || !studentId}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              Tạo Mã Định Danh
            </button>

            {generatedToken && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-center">
                <p className="text-xs text-green-700 dark:text-green-300 uppercase font-semibold mb-1">Token của {studentId}</p>
                <div className="text-2xl font-mono font-bold text-green-800 dark:text-green-200 tracking-wider flex items-center justify-center gap-2">
                    {generatedToken}
                    <button onClick={copyToClipboard} className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded">
                      <Copy size={16} />
                    </button>
                </div>
              </div>
            )}
        </div>
      )}

      {/* CONTENT: Verify (Manual) */}
      {activeTab === 'verify' && (
        <div className="space-y-4 max-w-md animate-fade-in">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Token cần kiểm tra</label>
              <input 
                type="text" 
                value={verifyTokenInput}
                onChange={(e) => {
                    setVerifyTokenInput(e.target.value);
                    setVerifyResult('idle');
                }}
                className="w-full mt-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white font-mono uppercase"
                placeholder="Nhập 8 ký tự Token..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nghi vấn là Mã HS nào?</label>
              <input 
                type="text" 
                value={verifyId}
                onChange={(e) => {
                    setVerifyId(e.target.value);
                    setVerifyResult('idle');
                }}
                className="w-full mt-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Nhập mã HS để đối chiếu..."
              />
            </div>
            <button 
              onClick={handleVerify}
              disabled={!secretKey || !verifyId || !verifyTokenInput}
              className="w-full py-2 bg-gray-800 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-500 font-medium"
            >
              Xác minh
            </button>

            {verifyResult !== 'idle' && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 font-bold ${
                  verifyResult === 'valid' 
                  ? 'bg-green-100 text-green-700 border border-green-300' 
                  : 'bg-red-100 text-red-700 border border-red-300'
              }`}>
                  {verifyResult === 'valid' ? <CheckCircle /> : <XCircle />}
                  {verifyResult === 'valid' 
                      ? `KHỚP! Token này thuộc về ${verifyId}` 
                      : `SAI! Token này KHÔNG phải của ${verifyId}`}
              </div>
            )}
        </div>
      )}

      {/* CONTENT: Reverse Lookup (Scanner) */}
      {activeTab === 'lookup' && (
        <div className="space-y-6 animate-fade-in">
           <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
             <div className="flex items-start gap-2 text-indigo-800 dark:text-indigo-300 text-sm mb-4">
               <Search size={18} className="mt-0.5 shrink-0" />
               <p>
                 Tính năng này cho phép bạn <strong>tìm chủ nhân của Token</strong> bằng cách quét tự động danh sách mã học sinh và đối chiếu.
               </p>
             </div>
             
             <div className="mb-4">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Nhập Token cần tra cứu</label>
                <input 
                  type="text" 
                  value={lookupToken}
                  onChange={(e) => setLookupToken(e.target.value)}
                  className="w-full mt-1 px-4 py-3 border-2 border-indigo-200 dark:border-indigo-700 rounded-lg dark:bg-gray-700 dark:text-white font-mono text-lg uppercase font-bold tracking-widest text-center"
                  placeholder="A1B2C3D4"
                />
             </div>

             {/* Scan Mode Selection */}
             <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                   <input 
                     type="radio" 
                     name="scanMode" 
                     checked={lookupMode === 'range'} 
                     onChange={() => setLookupMode('range')}
                     className="text-indigo-600 focus:ring-indigo-500"
                   />
                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Hash size={14} /> Quét theo dải số (VD: HS001...)
                   </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                   <input 
                     type="radio" 
                     name="scanMode" 
                     checked={lookupMode === 'list'} 
                     onChange={() => setLookupMode('list')}
                     className="text-indigo-600 focus:ring-indigo-500"
                   />
                   <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <List size={14} /> Quét theo danh sách (Copy-Paste)
                   </span>
                </label>
             </div>

             {/* Config for Range */}
             {lookupMode === 'range' && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                   <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Tiền tố (Prefix)</label>
                      <input 
                        type="text" 
                        value={scanPrefix}
                        onChange={(e) => setScanPrefix(e.target.value)}
                        className="w-full border rounded p-1 text-sm dark:bg-gray-700 dark:text-white"
                        placeholder="HS"
                      />
                   </div>
                   <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Từ số</label>
                      <input 
                        type="number" 
                        value={scanStart}
                        onChange={(e) => setScanStart(Number(e.target.value))}
                        className="w-full border rounded p-1 text-sm dark:bg-gray-700 dark:text-white"
                      />
                   </div>
                   <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Đến số</label>
                      <input 
                        type="number" 
                        value={scanEnd}
                        onChange={(e) => setScanEnd(Number(e.target.value))}
                        className="w-full border rounded p-1 text-sm dark:bg-gray-700 dark:text-white"
                      />
                   </div>
                   <div className="col-span-3">
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Độ dài số (Padding)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={scanPadding}
                          onChange={(e) => setScanPadding(Number(e.target.value))}
                          className="w-16 border rounded p-1 text-sm dark:bg-gray-700 dark:text-white"
                        />
                        <span className="text-xs text-gray-400">
                           (VD: 3 số = 001, 002...)
                        </span>
                      </div>
                   </div>
                   <p className="col-span-3 text-xs text-gray-400 italic">
                      Hệ thống sẽ quét: {scanPrefix}{String(scanStart).padStart(scanPadding,'0')} ➔ {scanPrefix}{String(scanEnd).padStart(scanPadding,'0')}
                   </p>
                </div>
             )}

             {/* Config for List */}
             {lookupMode === 'list' && (
                <div>
                   <textarea
                     value={scanList}
                     onChange={(e) => setScanList(e.target.value)}
                     className="w-full h-24 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                     placeholder="Dán danh sách mã học sinh vào đây (mỗi mã một dòng hoặc cách nhau bằng dấu phẩy)..."
                   />
                </div>
             )}

             <button 
                onClick={handleScan}
                disabled={isScanning || !lookupToken}
                className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold shadow-lg flex items-center justify-center gap-2"
             >
                {isScanning ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                {isScanning ? 'Đang quét...' : 'Quét tìm chủ nhân'}
             </button>
           </div>

           {/* Results Area */}
           {scanMessage && (
              <div className={`p-4 rounded-xl border-2 text-center animate-fade-in ${
                  foundStudentId 
                    ? 'bg-green-50 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                    : 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300'
              }`}>
                 {foundStudentId ? (
                    <div>
                        <div className="flex justify-center mb-2">
                            <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                                <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-1">{foundStudentId}</h3>
                        <p className="text-sm opacity-80">là chủ nhân của Token này</p>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center gap-2">
                        {isScanning ? null : <Search size={24} className="opacity-50" />}
                        <p className="font-medium">{scanMessage}</p>
                    </div>
                 )}
              </div>
           )}
        </div>
      )}
    </div>
  );
};