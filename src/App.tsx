import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAuth } from "./lib/cloudbase";
import Auth from "./components/Auth";
import ProjectList from "./components/ProjectList";
import ProjectDetail from "./components/ProjectDetail";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getAuth()
      .getLoginState()
      .then((state) => setAuthed(!!state));
  }, []);

  if (authed === null) return <p>检查登录状态...</p>;
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getAuth()
      .getLoginState()
      .then((state) => setAuthed(!!state));
  }, []);

  if (authed === null) return <p>检查登录状态...</p>;
  if (authed) return <Navigate to="/projects" replace />;
  return <Auth />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectDetail />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
