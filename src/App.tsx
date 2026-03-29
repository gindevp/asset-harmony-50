import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./components/layout/AdminLayout";
import { EmployeeLayout } from "./components/layout/EmployeeLayout";
import Dashboard from "./pages/admin/Dashboard";
import AssetCategories from "./pages/admin/AssetCategories";
import AssetList from "./pages/admin/AssetList";
import Suppliers from "./pages/admin/Suppliers";
import StockIn from "./pages/admin/StockIn";
import StockOut from "./pages/admin/StockOut";
import AssetTracking from "./pages/admin/AssetTracking";
import AllocationRequests from "./pages/admin/AllocationRequests";
import RepairRequests from "./pages/admin/RepairRequests";
import ReturnRequests from "./pages/admin/ReturnRequests";
import Users from "./pages/admin/Users";
import Roles from "./pages/admin/Roles";
import SystemLogs from "./pages/admin/SystemLogs";
import Reports from "./pages/admin/Reports";
import Inventory from "./pages/admin/Inventory";
import EmployeeRequests from "./pages/employee/EmployeeRequests";
import MyAssets from "./pages/employee/MyAssets";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />

          {/* Admin routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="asset-categories" element={<AssetCategories />} />
            <Route path="assets" element={<AssetList />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="stock-in" element={<StockIn />} />
            <Route path="stock-out" element={<StockOut />} />
            <Route path="asset-tracking" element={<AssetTracking />} />
            <Route path="allocation-requests" element={<AllocationRequests />} />
            <Route path="repair-requests" element={<RepairRequests />} />
            <Route path="return-requests" element={<ReturnRequests />} />
            <Route path="users" element={<Users />} />
            <Route path="roles" element={<Roles />} />
            <Route path="system-logs" element={<SystemLogs />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          {/* Employee routes */}
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route path="allocation-requests" element={<EmployeeRequests />} />
            <Route path="repair-requests" element={<EmployeeRequests />} />
            <Route path="return-requests" element={<EmployeeRequests />} />
            <Route path="my-assets" element={<MyAssets />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
