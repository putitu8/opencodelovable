import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAuth } from "./lib/cloudbase";
import Auth from "./components/Auth";
import ProjectList from "./components/ProjectList";

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

function ProjectPage() {
  const id = window.location.pathname.split("/")[2];
  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", padding: "1rem" }}>
      <a href="/projects">&larr; 返回项目列表</a>
      <h1>项目 {id}</h1>
      <p>项目详情页（待实现）</p>
    </div>
  );
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
              <ProjectPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
