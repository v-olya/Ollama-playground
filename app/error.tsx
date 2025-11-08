"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">{error.message || "An unexpected error occurred"}</p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Try Again
          </button>
          <Link href="/" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
