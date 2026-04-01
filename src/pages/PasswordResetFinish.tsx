import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiPost, getApiErrorMessage } from '@/api/http';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

/**
 * Trang khớp link trong email JHipster: /account/reset/finish?key=...
 * Gọi POST /api/account/reset-password/finish với key + mật khẩu mới.
 */
const PasswordResetFinish = () => {
  const [searchParams] = useSearchParams();
  const key = useMemo(() => searchParams.get('key')?.trim() ?? '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key) {
      toast.error('Thiếu mã khóa (key) trong đường dẫn. Mở lại link từ email.');
      return;
    }
    if (password.length < 4) {
      toast.error('Mật khẩu tối thiểu 4 ký tự');
      return;
    }
    if (password !== confirm) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    try {
      await apiPost('/api/account/reset-password/finish', { key, newPassword: password });
      toast.success('Đã đặt mật khẩu. Bạn có thể đăng nhập.');
      setPassword('');
      setConfirm('');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-background via-primary/[0.06] to-primary/15" aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Đặt mật khẩu tài khoản</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dùng khi admin vừa tạo tài khoản hoặc quên mật khẩu</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mật khẩu mới</CardTitle>
            <CardDescription>
              {key ? 'Nhập mật khẩu bạn muốn dùng để đăng nhập.' : 'Link không hợp lệ — thiếu tham số key.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => void submit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">Mật khẩu mới</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={!key || loading}
                  minLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Xác nhận mật khẩu</Label>
                <Input
                  id="pw2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  disabled={!key || loading}
                  minLength={4}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!key || loading}>
                {loading ? 'Đang lưu…' : 'Lưu mật khẩu'}
              </Button>
              <p className="text-center text-sm">
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                  Về trang đăng nhập
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PasswordResetFinish;
