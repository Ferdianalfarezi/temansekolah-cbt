import { Routes, Route } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import ExamListPage from "@/pages/ExamListPage";
import ExamPage from "@/pages/ExamPage";
import ResultPage from "@/pages/ResultPage";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/exams" element={<ExamListPage />} />
        <Route path="/exam/:sessionId" element={<ExamPage />} />
        <Route path="/result/:sessionId" element={<ResultPage />} />
      </Routes>
    </div>
  );
}
