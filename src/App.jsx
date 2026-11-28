import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Scan from './pages/customer/Scan';
import Track from './pages/customer/Track';
import StaffLogin from './pages/staff/StaffLogin';
import StaffBoard from './pages/staff/StaffBoard';

// Only lets staff in when they are signed in, otherwise sends them to the staff login
function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/staff/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* customers: no login, no app */}
      <Route path="/t/:token" element={<Scan />} />
      <Route path="/track/:token" element={<Track />} />
      {/* staff */}
      <Route path="/staff/login" element={<StaffLogin />} />
      <Route
        path="/staff"
        element={
          <Protected>
            <StaffBoard />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/staff" replace />} />
    </Routes>
  );
}