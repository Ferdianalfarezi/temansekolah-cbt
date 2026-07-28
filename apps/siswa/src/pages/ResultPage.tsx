import { useParams } from "react-router-dom";

export default function ResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">Hasil Ujian</h1>
      <p className="mt-2 text-sm text-gray-600">Session: {sessionId}</p>
    </div>
  );
}
