import { Routes, Route, Navigate } from "react-router-dom";
import ToolHome from "@/pages/ToolHome";
import AddTextPage from "@/pages/AddText";
import MergePage from "@/pages/Merge";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ToolHome />} />
      <Route path="/add-text" element={<AddTextPage />} />
      <Route path="/merge" element={<MergePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
