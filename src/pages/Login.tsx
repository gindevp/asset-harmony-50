import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiPost, setStoredToken } from '@/api/http';
import { fetchAndStoreAccountContext } from '@/api/account';
import { hasAnyAuthority } from '@/auth/jwt';
import { toast } from 'sonner';
import { BrandMark } from '@/components/shared/BrandMark';
import { Eye, EyeOff } from 'lucide-react';

type JwtResponse = { id_token: string };

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const goAfterLogin = (token: string) => {
    if (from && (from.startsWith('/admin') || from.startsWith('/employee'))) {
      navigate(from, { replace: true });
      return;
    }
    if (hasAnyAuthority(token, ['ROLE_ADMIN', 'ROLE_ASSET_MANAGER', 'ROLE_GD'])) {
      navigate('/admin', { replace: true });
    } else {
      navigate('/employee/allocation-requests', { replace: true });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiPost<JwtResponse>('/api/authenticate', { username, password, rememberMe });
      const token = res.id_token;
      if (!token) {
        toast.error('Không nhận được token');
        return;
      }
      setStoredToken(token);
      await fetchAndStoreAccountContext();
      toast.success('Đăng nhập thành công');
      goAfterLogin(token);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* Nền: gradient brand + blob mờ + lưới nhẹ */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/[0.06] to-primary/15 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-1000 motion-reduce:animate-none dark:from-background dark:via-primary/10 dark:to-primary/[0.22]" />
        <div className="absolute -top-32 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl motion-safe:animate-login-blob-slow motion-reduce:animate-none dark:bg-primary/30" />
        <div className="absolute -bottom-40 left-[-15%] h-[26rem] w-[26rem] rounded-full bg-primary/15 blur-3xl motion-safe:animate-login-blob-slower motion-reduce:animate-none dark:bg-primary/20" />
        <div className="absolute top-1/2 left-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40 blur-3xl motion-safe:animate-login-blob-mid motion-reduce:animate-none dark:bg-accent/25" />
        <div
          className="absolute inset-0 opacity-[0.45] motion-safe:animate-login-grid-breathe motion-reduce:animate-none dark:opacity-[0.35]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--border) / 0.45) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border) / 0.45) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 75% 65% at 50% 42%, black 20%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 42%, black 20%, transparent 72%)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center -translate-y-8 sm:-translate-y-12 md:-translate-y-14">
        <div className="mb-5 flex w-full flex-col items-center text-center motion-safe:animate-login-fade-up motion-reduce:animate-none">
          <div className="mb-3 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:scale-[1.03]">
            <BrandMark className="h-14 w-14 rounded-xl shadow-sm" />
          </div>
          <h1 className="mb-1.5 px-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hệ thống Quản lý Tài sản Nội bộ
          </h1>
          <p className="max-w-md text-sm text-muted-foreground sm:text-base">
            Quản lý vòng đời tài sản: nhập kho, cấp phát, theo dõi, thu hồi, sửa chữa
          </p>
        </div>

        <Card className="w-full border-border/80 bg-card/95 shadow-xl ring-1 ring-border/50 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 motion-safe:animate-login-fade-up motion-safe:delay-200 motion-reduce:animate-none motion-reduce:opacity-100">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-xl">Đăng nhập</CardTitle>
            <p className="text-sm text-muted-foreground">Nhập tài khoản để tiếp tục (JWT)</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="u">Tài khoản</Label>
                <Input id="u" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p">Mật khẩu</Label>
                <div className="relative">
                  <Input
                    id="p"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                Ghi nhớ đăng nhập
              </label>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
