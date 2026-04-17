// Recovery page is paused — the readiness/cycle detection UI is preserved in
// page.tsx.disabled. Remove this stub + rename the file back to re-enable.

export default function RecoveryPausedPage() {
  return (
    <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px]">
      <div className="mb-7">
        <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Recovery</h1>
        <p className="text-gray-500 text-[.9rem] mt-1">En pausa mientras rediseñamos</p>
      </div>

      <div className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] p-8 max-w-[560px] text-center">
        <div className="text-[2.5rem] mb-3">🛠️</div>
        <div className="font-bold text-[1.1rem] text-gray-800 mb-2">Rediseño en curso</div>
        <p className="text-gray-500 text-[.9rem] leading-[1.6]">
          Mientras tanto, los datos de fatiga, sueño y energía los podés seguir cargando
          desde el <strong>Diario</strong> — se guardan igual.
        </p>
      </div>
    </main>
  )
}
