import TwoChatsLayout from "../components/TwoChatsLayout";
import { heading1 } from "../helpers/twClasses";

export const metadata = {
  title: "Compare Models",
};

export default function ComparePage() {
  return (
    <>
      <h1 className={`${heading1}`}>Compare Ollama models side-by-side</h1>
      <main>
        <TwoChatsLayout />
      </main>
    </>
  );
}
