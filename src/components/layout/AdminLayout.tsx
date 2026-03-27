import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';

export const AdminLayout = () => (
  <div className="flex min-h-screen w-full bg-background">
    <AdminSidebar />
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
  </div>
);
