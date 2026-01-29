import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const ToolHome = lazy(() => import("@/pages/ToolHome"));
const AddTextPage = lazy(() => import("@/pages/AddText"));
const MergePage = lazy(() => import("@/pages/Merge"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#e2e8f0_60%,_#d1d5db_100%)]">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10">
            <div className="h-24 rounded-2xl bg-white/70 shadow-sm" />
            <div className="h-64 rounded-2xl bg-white/60 shadow-sm" />
          </div>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<ToolHome />} />
        <Route path="/add-text" element={<AddTextPage />} />
        <Route path="/merge" element={<MergePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
