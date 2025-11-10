import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-50 to-gray-100">
      <div className="text-center px-6">
        <h1 className="text-9xl font-bold text-gray-800">404</h1>
        <h2 className="mt-4 text-3xl font-semibold text-gray-700">Page Not Found</h2>
        <p className="mt-4 text-lg text-gray-600">Sorry, we couldn&apos;t find the page you&apos;re looking for.</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
