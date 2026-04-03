import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ApiError, getStoredToken } from "@/api/http";
import { fetchAndStoreAccountContext } from "@/api/account";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import PasswordResetFinish from "./pages/PasswordResetFinish";
import { AdminLayout } from "./components/layout/AdminLayout";
import { EmployeeLayout } from "./components/layout/EmployeeLayout";
import Dashboard from "./pages/admin/Dashboard";
import AssetCategories from "./pages/admin/AssetCategories";
import AssetList from "./pages/admin/AssetList";
import Suppliers from "./pages/admin/Suppliers";
import Locations from "./pages/admin/Locations";
import StockIn from "./pages/admin/StockIn";
import StockInNew from "./pages/admin/StockInNew";
import StockOut from "./pages/admin/StockOut";
import StockOutNew from "./pages/admin/StockOutNew";
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
import RequestNew from "./pages/shared/RequestNew";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
        return failureCount < 2;
      },
    },
  },
});

const ADMIN_ROLES = ["ROLE_ADMIN", "ROLE_ASSET_MANAGER", "ROLE_GD"];
const EMPLOYEE_ROLES = [
  "ROLE_ADMIN",
  "ROLE_ASSET_MANAGER",
  "ROLE_GD",
  "ROLE_EMPLOYEE",
  "ROLE_DEPARTMENT_COORDINATOR",
];

const App = () => {
  useEffect(() => {
    if (getStoredToken()) {
      void fetchAndStoreAccountContext();
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account/reset/finish" element={<PasswordResetFinish />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute anyAuthority={ADMIN_ROLES}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="asset-categories" element={<AssetCategories />} />
            <Route path="assets" element={<AssetList />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="locations" element={<Locations />} />
            <Route path="stock-in" element={<StockIn />} />
            <Route path="stock-in/new" element={<StockInNew />} />
            <Route path="stock-out" element={<StockOut />} />
            <Route path="stock-out/new" element={<StockOutNew />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="asset-tracking" element={<AssetTracking />} />
            <Route path="allocation-requests" element={<AllocationRequests />} />
            <Route path="repair-requests" element={<RepairRequests />} />
            <Route path="return-requests" element={<ReturnRequests />} />
            <Route path="request-create" element={<EmployeeRequests />} />
            <Route path="my-assets" element={<MyAssets />} />
            <Route path="request-new" element={<RequestNew />} />
            <Route path="users" element={<Users />} />
            <Route path="roles" element={<Roles />} />
            <Route path="system-logs" element={<SystemLogs />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          <Route
            path="/employee"
            element={
              <ProtectedRoute anyAuthority={EMPLOYEE_ROLES}>
                <EmployeeLayout />
              </ProtectedRoute>
            }
          >
            <Route path="allocation-requests" element={<EmployeeRequests />} />
            <Route path="repair-requests" element={<EmployeeRequests />} />
            <Route path="return-requests" element={<EmployeeRequests />} />
            <Route path="my-assets" element={<MyAssets />} />
            <Route path="request-new" element={<RequestNew />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
