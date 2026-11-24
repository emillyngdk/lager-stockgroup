"use client";
import { useEffect, useRef, useState } from "react";

/** Lille bekræftelse nederst på skærmen med valgfri "Fortryd". Bruges imperativt: visToast({ tekst, fortryd }). */
type Toast = { id: number; tekst: string; fortryd?: () => void | Promise<void> };
let setToastGlobal: ((t: Toast | null) => void) | null = null;
let n = 0;
export function visToast(t: Omit<Toast, "id">) { setToastGlobal?.({ ...t, id: ++n }); }

export function ToastHost() {
  const [t, setT] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setToastGlobal = setT; return () => { setToastGlobal = null; }; }, []);
  useEffect(() => { if (!t) return; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), t.fortryd ? 7000 : 3500); return () => { if (timer.current) clearTimeout(timer.current); }; }, [t]);
  if (!t) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] max-w-[92vw]">
      <div className="card !bg-[var(--ink)] text-white px-5 py-3.5 flex items-center gap-4 shadow-2xl text-sm font-semibold">
        <span className="text-[#7ee2a8]">✓</span><span>{t.tekst}</span>
        {t.fortryd && <button onClick={async () => { const f = t.fortryd!; setT(null); await f(); }} className="rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 font-bold">Fortryd</button>}
        <button onClick={() => setT(null)} className="text-white/50 hover:text-white" aria-label="Luk">✕</button>
      </div>
    </div>
  );
}
