import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Mailbox from './pages/Mailbox.jsx';
import Guide from './pages/Guide.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-full grid place-items-center text-gray-500">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/guide" element={<Guide />} />
      <Route path="/*" element={user ? <Mailbox /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
