import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-white text-slate-900">
      <header className="text-center mb-8 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">Play with Ollama models</h1>
        <p className="text-lg text-slate-600 mb-1">
          Compare models against the same prompt or explore AI-to-AI interactions.
        </p>
        <p className="text-sm text-slate-500">
          You may choose{" "}
          <span className="inline-block">
            🤝 <strong>Collaborative</strong>
          </span>{" "}
          or{" "}
          <span className="inline-block">
            ⚔️ <strong>Competitive</strong>
          </span>{" "}
          mode
        </p>
      </header>

      <section className="grid gap-4 w-full max-w-3xl grid-cols-1 sm:grid-cols-2" aria-label="Primary features">
        <article className="bg-slate-50 border border-slate-100 p-5 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-sky-300">
          <h2 className="text-lg font-semibold mb-2">
            <Link
              href="/compare"
              className="inline-flex items-center gap-3 text-sky-600 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-sky-300 rounded"
            >
              <svg
                className="w-5 h-5 text-sky-600"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
                focusable="false"
              >
                <rect x="2" y="4" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <rect x="10" y="10" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span>Compare</span>
              <span aria-hidden className="text-sky-600">
                →
              </span>
            </Link>
          </h2>
          <div className="text-slate-600 leading-relaxed text-sm">
            <p>
              <b>Find the model that fits your needs</b> by running the same prompt against two Ollama models at once.
            </p>
            <p className="mt-2">
              <b>Query both models</b> synchronously, then continue the conversation with either model independently —
              each chat keeps its own history, context, and state.
            </p>
            <p className="mt-2">
              <b>Edit system and user prompts</b>, restart sessions, and iterate quickly to compare correctness, style,
              and response speed.
            </p>
          </div>
        </article>

        <article className="bg-slate-50 border border-slate-100 p-5 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-sky-300">
          <h2 className="text-lg font-semibold mb-2">
            <Link
              href="/clash"
              className="inline-flex items-center gap-3 text-sky-600 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-sky-300 rounded"
            >
              <svg
                className="w-5 h-5 text-sky-600"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
                focusable="false"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" fill="currentColor" />
              </svg>
              <span>Clash</span>
              <span aria-hidden className="text-sky-600">
                →
              </span>
            </Link>
          </h2>
          <div className="text-slate-600 leading-relaxed text-sm">
            <p>
              Why it’s essential for AI to know that it is competing with <strong>other AI</strong>? Chat GPT’s
              thoughts:
            </p>
            <p className="mt-3">
              <strong>If Model A thinks it’s talking to a human, it might:</strong>
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Use overly explanatory or simplified language</li>
              <li>Avoid challenging ideas too strongly</li>
              <li>Misjudge rhetorical cues (e.g., sarcasm, irony)</li>
            </ul>

            <p className="mt-3">
              <strong>If Model A knows it’s talking to another AI, it can:</strong>
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Use more technical or abstract reasoning</li>
              <li>Engage in deeper philosophical or logical debate</li>
              <li>Mirror or contrast the competitor’s style effectively</li>
            </ul>
          </div>
        </article>
      </section>

      <footer className="mt-10 text-slate-500 text-sm">
        Built with Next.js · React · TypeScript · Tailwind CSS · Ollama
      </footer>
    </main>
  );
}
