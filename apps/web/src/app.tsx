import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './auth.js';
import { AppLayout } from './layout.js';
import { DashboardPage } from './pages/dashboard.js';
import { EmployeesPage } from './pages/employees.js';
import { ExceptionsPage } from './pages/exceptions.js';
import { ApiListPage } from './pages/generic.js';
import { ImportsPage } from './pages/imports.js';
import { LoginPage } from './pages/login.js';

function Protected() {
  const { user } = useAuth();
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

function EmployeeAttendance() {
  const { id } = useParams();
  return (
    <ApiListPage
      title="Chi tiết bảng công"
      description="Ngày ca, timestamp, mức công và lịch sử."
      path={`/attendance/employee/${id ?? ''}`}
    />
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route
          path="/attendance"
          element={
            <ApiListPage
              title="Bảng công tổng hợp"
              description="Tổng hợp theo nhân viên và kỳ công."
              path="/attendance"
            />
          }
        />
        <Route
          path="/attendance/detail"
          element={
            <ApiListPage
              title="Chi tiết bảng công"
              description="Chọn nhân viên từ bảng công tổng hợp để xem ngày ca, timestamp và mức công."
              path="/attendance"
            />
          }
        />
        <Route path="/attendance/:id" element={<EmployeeAttendance />} />
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
