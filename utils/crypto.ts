
// Sử dụng Web Crypto API để tạo mã Hash an toàn
// HMAC-SHA256: Hash dựa trên Key, đảm bảo chỉ người có Key mới tạo được Token đúng.

export const generateStudentToken = async (studentId: string, secretKey: string): Promise<string> => {
  if (!studentId || !secretKey) return '';

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(studentId.toUpperCase().trim()); // Chuẩn hóa ID

  // Import key
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign (Hash)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    msgData
  );

  // Convert to Hex String
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Lấy 8 ký tự đầu để làm Short Token (dễ nhập) + 4 ký tự cuối để check sum
  // Định dạng: 8 ký tự đầu
  return hashHex.substring(0, 8).toUpperCase();
};

export const verifyToken = async (inputToken: string, studentId: string, secretKey: string): Promise<boolean> => {
  const generated = await generateStudentToken(studentId, secretKey);
  return generated === inputToken.toUpperCase().trim();
};