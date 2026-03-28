import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="text-center">
        <p className="text-7xl font-extrabold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Pagina no encontrada
        </h1>
        <p className="mt-2 text-gray-500">
          La pagina que estas buscando no existe o fue movida.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-white shadow transition-all hover:bg-primary-dark hover:shadow-md"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
