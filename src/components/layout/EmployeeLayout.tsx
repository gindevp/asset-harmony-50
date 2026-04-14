import { Outlet } from 'react-router-dom';
import { EmployeeSidebar } from './EmployeeSidebar';
import { InAppNotificationsBell } from '@/components/shared/InAppNotificationsBell';

export const EmployeeLayout = () => (
  <div className="flex min-h-screen w-full bg-background">
    <EmployeeSidebar />
    <main className="flex-1 overflow-auto">
      <div className="sticky top-0 z-40 flex justify-end border-b bg-background/80 px-4 py-2 backdrop-blur">
        <InAppNotificationsBell />
      </div>
      <Outlet />
    </main>
  </div>
);
