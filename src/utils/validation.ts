/**
 * Kiểm tra email đủ điều kiện gửi lên API (tránh 400 từ @Email trên AdminUserDTO).
 */
export function isValidEmail(email: string): boolean {
  const s = email.trim();
  if (s.length < 5 || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}
