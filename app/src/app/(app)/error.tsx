"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-light">
          <svg
            className="h-8 w-8 text-danger"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Algo salio mal</h1>
        <p className="mt-2 text-gray-500">
          Ocurrio un error inesperado en esta seccion.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-white shadow transition-all hover:bg-primary-dark hover:shadow-md cursor-pointer"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-sm border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow transition-all hover:bg-gray-50 hover:shadow-md"
          >
            Ir al dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
