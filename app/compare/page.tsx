import TwoChatsLayout from "../components/TwoChatsLayout";

export const metadata = {
  title: "Compare Models",
};

export default function ComparePage() {
  return (
    <>
      <h1 className="mx-auto text-2xl font-semibold text-center">Compare Ollama models side-by-side</h1>
      <main>
        <TwoChatsLayout />
      </main>
    </>
  );
}
