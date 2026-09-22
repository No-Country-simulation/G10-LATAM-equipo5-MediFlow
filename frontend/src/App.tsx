import { Stethoscope, CheckCircle2 } from "lucide-react";

const App = () => {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <Stethoscope className="w-6 h-6" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            MediFlow
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Triaje Clínico y Derivación Hospitalaria
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Interfaz visual iniciada</span>
        </div>
      </div>
    </main>
  );
};

export default App;
