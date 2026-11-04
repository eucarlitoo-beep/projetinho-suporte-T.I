import { Link } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { motion } from "motion/react";
import { ArrowLeft, Hash, Sparkles, Zap } from "lucide-react";
import { Logo, INTRO_VIDEO, CircuitLines } from "@/components/brand/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";

const STREAM = [
  { icon: Zap, title: "Tempo real", text: "Mensagens, presença e digitação via WebSocket." },
  { icon: Hash, title: "Canais & threads", text: "Organize conversas sem perder o fio." },
  { icon: Sparkles, title: "Nexus AI", text: "Resumos instantâneos de canais e threads." },
];

export default function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* cinematic panel */}
      <aside className="relative hidden overflow-hidden bg-[#070B14] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <video src={INTRO_VIDEO} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,20,0.55)_0%,rgba(7,11,20,0.9)_100%)]" />
        <CircuitLines className="text-[#00E5FF] opacity-40" />
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white" data-testid="auth-back-link">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </div>
        <div className="relative z-10 max-w-md">
          <p className="mb-4 type-eyebrow text-[#00E5FF]">Workspace Nexus</p>
          <h1 className="type-section text-5xl leading-[1.02]">
            Onde o time <span className="text-[#00E5FF] text-glow">pensa junto</span>, ao vivo.
          </h1>
          <div className="mt-10 space-y-3">
            {STREAM.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 160, damping: 20 }}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#00E5FF]/15 text-[#00E5FF]">
                  <s.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-sm text-slate-400">{s.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </aside>

      {/* auth column */}
      <main className="relative flex flex-col bg-background">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <header className="relative z-10 flex items-center justify-between p-5">
          <Link to="/" data-testid="auth-logo-link"><Logo /></Link>
          <ThemeToggle />
        </header>
        <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} data-testid={`clerk-${mode}`}>
            {mode === "sign-in" ? (
              <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp />
            ) : (
              <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
