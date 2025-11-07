import TwoChatsLayout from "../components/TwoChatsLayout";

export const metadata = {
  title: "Compare Models",
};

export default function ComparePage() {
  return (
    <main className="min-h-screen py-12">
      <h1 className="mx-auto max-w-6xl px-6 text-2xl font-semibold text-center">Compare Ollama models side-by-side</h1>
      <TwoChatsLayout />
    </main>
  );
}
