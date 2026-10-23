import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.js';
import { AppLayout } from './layout.js';
import { DashboardPage } from './pages/dashboard.js';
import { EmployeesPage } from './pages/employees.js';
import { ExceptionsPage } from './pages/exceptions.js';
import { ApiListPage } from './pages/generic.js';
import { ImportsPage } from './pages/imports.js';
import { LoginPage } from './pages/login.js';
import { AttendanceDetailPage, AttendanceSummaryPage } from './pages/attendance.js';

function Protected() {
  const { user } = useAuth();
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/attendance" element={<AttendanceSummaryPage />} />
        <Route path="/attendance/detail" element={<AttendanceDetailPage />} />
        <Route path="/attendance/:id" element={<Navigate to="/attendance" replace />} />
        <Route path="/exceptions" element={<ExceptionsPage />} />
        <Route
          path="/periods"
          element={
            <ApiListPage
              title="Phê duyệt và chốt công"
              description="Workflow có guard lỗi chặn và optimistic version."
              path="/periods"
            />
          }
        />
        <Route
          path="/publications"
          element={
            <ApiListPage
              title="Phát hành bảng công"
              description="Theo dõi artifact và phiên bản phát hành; không gửi thật."
              path="/publications"
            />
          }
        />
        <Route
          path="/me/timesheets"
          element={
            <ApiListPage
              title="Bảng công cá nhân"
              description="Chỉ hiển thị bảng công của tài khoản hiện tại."
              path="/me/timesheets"
            />
          }
        />
        <Route
          path="/shifts"
          element={
            <ApiListPage
              title="Cấu hình ca"
              description="Rule version và hiệu lực; không hồi tố kỳ cũ."
              path="/shifts"
            />
          }
        />
        <Route
          path="/audit"
          element={
            <ApiListPage
              title="Lịch sử điều chỉnh"
              description="Nhật ký import, sửa, tính lại, duyệt và phát hành."
              path="/audit-logs"
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
