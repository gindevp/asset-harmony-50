import { Outlet } from 'react-router-dom';
import { EmployeeSidebar } from './EmployeeSidebar';

export const EmployeeLayout = () => (
  <div className="flex min-h-screen w-full bg-background">
    <EmployeeSidebar />
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
  </div>
);
