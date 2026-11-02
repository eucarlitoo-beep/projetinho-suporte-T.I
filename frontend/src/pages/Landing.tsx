import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Show } from "@clerk/react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, AtSign, Bot, ClipboardList, GraduationCap, Hash, Megaphone, MessageSquareText, Pin, Search, SmilePlus, Sparkles, Wrench, Zap } from "lucide-react";
import { Logo, LogoMark, INTRO_VIDEO, CircuitLines } from "@/components/brand/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ---------------- intro splash (the reference video) ---------------- */
function Intro({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [reveal, setReveal] = useState(false);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    const t = setTimeout(() => setReveal(true), 1200);
    const max = setTimeout(finish, 9000); // never trap the visitor if the video stalls
    return () => {
      clearTimeout(t);
      clearTimeout(max);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#070B14] text-white"
      exit={{ opacity: 0, scale: 1.08, filter: "blur(8px)" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      data-testid="intro-splash"
    >
      <motion.video
        src={INTRO_VIDEO}
        autoPlay
        muted
        playsInline
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress(v.currentTime / v.duration);
        }}
        onEnded={finish}
        className="absolute inset-0 size-full object-cover"
        initial={{ scale: 1.15 }}
        animate={{ scale: 1 }}
        transition={{ duration: 8, ease: "easeOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(7,11,20,0.85)_80%)]" />
      <div className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-[#00E5FF]/10 to-transparent" />
      <AnimatePresence>
        {reveal && (
          <motion.div
            className="relative z-10 flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <LogoMark className="size-16 text-[#00E5FF]" />
            <h1 className="mt-5 type-wordmark text-6xl text-glow sm:text-8xl">
              nexus<span className="text-[#00E5FF]">.</span>
            </h1>
            <p className="mt-4 type-eyebrow tracking-[0.28em] text-cyan-200/80">processando conversas em tempo real</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-6 p-6 sm:p-10">
        <div className="h-px flex-1 overflow-hidden bg-white/10">
          <motion.div className="h-full bg-[#00E5FF] shadow-[0_0_12px_#00E5FF]" style={{ width: `${Math.max(progress, 0.02) * 100}%` }} />
        </div>
        <button
          type="button"
          onClick={finish}
          data-testid="intro-skip-btn"
          className="rounded-full border border-white/20 px-4 py-1.5 type-eyebrow text-white/80 backdrop-blur transition-[color,border-color,background-color] hover:border-[#00E5FF] hover:bg-[#00E5FF]/10 hover:text-white"
        >
          Pular intro
        </button>
      </div>
    </motion.div>
  );
}

/* ---------------- live chat simulator ---------------- */
const SCHOOL = [
  { id: "ti", channel: "suporte-ti", icon: Wrench, title: "Chamados de T.I.", desc: "Professores reportam problemas em segundos; a equipe técnica responde em thread e marca como resolvido." },
  { id: "secretaria", channel: "secretaria", icon: ClipboardList, title: "Secretaria & matrículas", desc: "Documentos, boletins e matrículas circulam com anexos e busca instantânea." },
  { id: "coordenacao", channel: "coordenacao", icon: GraduationCap, title: "Coordenação pedagógica", desc: "Planejamento de aulas, reuniões e decisões resumidas pela IA." },
  { id: "comunicados", channel: "comunicados", icon: Megaphone, title: "Comunicados", desc: "Avisos fixados para todo o corpo docente, com @menções que ninguém perde." },
];
const SIM = [
  { who: "Ana · Secretaria", color: "#F472B6", text: "O sistema de matrículas não abre no PC da recepção 😕", react: "👀 2" },
  { who: "Bruno · T.I.", color: "#34D399", text: "Chamado #142 aberto — acessando remotamente agora ⚡", react: "🙏 3" },
  { who: "Carla · Coordenação", color: "#A78BFA", text: "@bruno o projetor da sala 7B também precisa de ajuda", react: "" },
  { who: "Nexus AI", color: "#00E5FF", text: "Resumo: 2 chamados abertos (matrículas, projetor 7B); 1 em atendimento.", react: "✨ 2", ai: true },
  { who: "Bruno · T.I.", color: "#34D399", text: "Matrículas de volta ✅ Indo pra 7B agora", react: "🎉 5" },
];

function ChatSimulator() {
  const [count, setCount] = useState(1);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const step = (n: number) => {
      setTyping(true);
      t = setTimeout(() => {
        if (cancelled) return;
        setTyping(false);
        const next = n >= SIM.length ? 1 : n + 1;
        setCount(next);
        t = setTimeout(() => step(next), 1600);
      }, 1100);
    };
    t = setTimeout(() => step(1), 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);
  const visible = SIM.slice(0, count);
  return (
    <div className="relative w-full max-w-md rounded-2xl border border-primary/20 bg-card/70 p-4 shadow-[0_30px_80px_-20px_rgba(0,229,255,0.25)] backdrop-blur-xl" data-testid="landing-chat-simulator">
      <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 font-heading text-sm font-[640] tracking-[-0.012em]">
          <Hash className="size-4 text-primary" /> suporte-ti
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex size-2">
            <span className="animate-ring-ping absolute inline-flex size-full rounded-full bg-emerald-400" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          ao vivo
        </span>
      </div>
      <div className="flex h-[272px] flex-col justify-end gap-2.5 overflow-hidden">
        <AnimatePresence initial={false}>
          {visible.slice(-4).map((m) => (
            <motion.div
              key={m.who + m.text}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className={cn("flex gap-2.5 rounded-xl p-2", m.ai && "border border-primary/25 bg-primary/5")}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-[#070B14]" style={{ background: m.color }}>
                {m.ai ? <Bot className="size-4" /> : m.who[0]}
              </span>
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-[640] tracking-[-0.01em]">{m.who}</p>
                <p className="text-sm leading-[1.5] tracking-(--track-text) text-foreground/85">{m.text}</p>
                {m.react && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring", stiffness: 500 }} className="mt-1 inline-block rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px]">
                    {m.react}
                  </motion.span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex h-5 items-center gap-2 text-xs text-muted-foreground">
        {typing && (
          <>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="animate-typing size-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            {SIM[count % SIM.length].who} está digitando…
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- interactive bento tile ---------------- */
function Tile({ className, children, testid }: { className?: string; children: ReactNode; testid: string }) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-6, 6]), { stiffness: 200, damping: 20 });
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    mx.set(x);
    my.set(y);
    setSpot({ x: x * 100, y: y * 100 });
  };
  return (
    <motion.div
      data-testid={testid}
      onMouseMove={onMove}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 120, damping: 20 }}
      className={cn("group relative overflow-hidden rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-sm transition-[border-color] duration-300 hover:border-primary/40", className)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(400px circle at ${spot.x}% ${spot.y}%, color-mix(in oklab, var(--glow) 14%, transparent), transparent 60%)` }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

const FEATURES = ["Canais públicos e privados", "Mensagens diretas", "Threads", "Reações", "Menções @", "Busca global", "Mensagens fixadas", "Arquivos e imagens", "Presença online", "Digitando…", "Nexus AI", "Tema claro e escuro"];

/* ---------------- page ---------------- */
export default function Landing() {
  const [intro, setIntro] = useState(() => sessionStorage.getItem("nexus-intro") !== "seen");
  const heroRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 70, y: 40 });
  const endIntro = () => {
    sessionStorage.setItem("nexus-intro", "seen");
    setIntro(false);
  };

  const cta = (primary: boolean, signedInLabel: string, signedOutLabel: string, to: string, testid: string) => (
    <>
      <Show when="signed-in">
        <Link to="/app" data-testid={`${testid}-app`} className={cn(buttonVariants({ size: "lg", variant: primary ? "default" : "outline" }), "group h-12 rounded-xl px-6 text-[0.9375rem] font-[600] tracking-[-0.01em] transition-[transform,box-shadow] hover:-translate-y-0.5", primary && "shadow-[0_0_30px_-6px_var(--glow)]")}>
          {signedInLabel} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Show>
      <Show when="signed-out">
        <Link to={to} data-testid={testid} className={cn(buttonVariants({ size: "lg", variant: primary ? "default" : "outline" }), "group h-12 rounded-xl px-6 text-[0.9375rem] font-[600] tracking-[-0.01em] transition-[transform,box-shadow] hover:-translate-y-0.5", primary && "shadow-[0_0_30px_-6px_var(--glow)]")}>
          {signedOutLabel} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Show>
    </>
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <AnimatePresence>{intro && <Intro onDone={endIntro} />}</AnimatePresence>

      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo className="text-white" />
          <nav className="flex items-center gap-2">
            <ThemeToggle className="border-white/15 bg-white/5 text-slate-200" />
            <Show when="signed-out">
              <Link to="/sign-in" data-testid="nav-signin-link" className="rounded-xl border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-4 py-2 text-sm font-[600] tracking-[-0.008em] text-white transition-[border-color,background-color,color] hover:border-[#00E5FF] hover:bg-[#00E5FF]/20 hover:text-[#00E5FF]">Entrar</Link>
            </Show>
            <Show when="signed-in">
              <Link to="/app" data-testid="nav-open-app-link" className="rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:text-[#00E5FF]">Abrir app</Link>
            </Show>
          </nav>
        </div>
      </header>

      {/* hero over the chip video */}
      <section
        ref={heroRef}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMouse({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        className="relative isolate min-h-dvh overflow-hidden bg-[#070B14] text-white"
      >
        <video src={INTRO_VIDEO} autoPlay muted loop playsInline className="absolute inset-0 -z-20 size-full object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(7,11,20,0.65)_0%,rgba(7,11,20,0.88)_100%)]" />
        <div className="absolute inset-0 -z-10 transition-[background] duration-300" style={{ background: `radial-gradient(500px circle at ${mouse.x}% ${mouse.y}%, rgba(0,229,255,0.14), transparent 60%)` }} />
        <CircuitLines className="-z-10 text-[#00E5FF] opacity-30" />

        <div className="mx-auto grid min-h-dvh max-w-7xl items-center gap-14 px-5 pt-28 pb-16 sm:px-8 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-3 py-1 type-eyebrow text-[#00E5FF]">
              <Zap className="size-3.5" /> Suporte T.I. · Gestão escolar
            </motion.p>
            <h1 className="type-display" data-testid="hero-title">
              {["Suporte T.I.", "para a gestão", "escolar."].map((line, i) => (
                <motion.span key={line} className={cn("block", i === 2 && "text-[#00E5FF] text-glow")} initial={{ opacity: 0, y: 30, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.3 + i * 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
                  {line}
                </motion.span>
              ))}
            </h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-6 max-w-lg type-lead text-slate-300">
              Secretaria, coordenação, professores e T.I. no mesmo lugar: chamados em tempo real, comunicados, threads e um assistente de IA que resume tudo — para a escola nunca parar.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="mt-10 flex flex-wrap gap-3">
              {cta(true, "Abrir workspace", "Entrar no workspace", "/sign-in", "hero-cta-signin")}
              <Show when="signed-out">
                <Link to="/sign-up" data-testid="hero-cta-signup" className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 text-[0.9375rem] font-[560] tracking-[-0.01em] text-white transition-[border-color,background-color] hover:border-[#00E5FF]/60 hover:bg-white/5">
                  Criar conta grátis
                </Link>
              </Show>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, x: 40, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ delay: 0.6, type: "spring", stiffness: 90, damping: 18 }} className="dark flex justify-center text-foreground lg:justify-end">
            <ChatSimulator />
          </motion.div>
        </div>
      </section>

      {/* marquee */}
      <div className="relative overflow-hidden border-y border-border bg-card/40 py-4">
        <div className="animate-marquee flex w-max gap-10">
          {[...FEATURES, ...FEATURES].map((f, i) => (
            <span key={i} className="flex items-center gap-3 type-eyebrow text-[0.75rem] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" /> {f}
            </span>
          ))}
        </div>
      </div>

      {/* school management */}
      <section className="relative mx-auto max-w-7xl px-5 pt-24 sm:px-8" data-testid="school-section">
        <div className="mb-12 grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-end">
          <div>
            <p className="mb-3 type-eyebrow text-primary">Feito para escolas</p>
            <h2 className="type-section">A escola inteira conectada ao suporte.</h2>
          </div>
          <p className="max-w-xl type-lead text-muted-foreground md:justify-self-end">
            Do laboratório de informática à secretaria: cada setor tem seu canal, cada problema vira uma thread rastreável e ninguém fica esperando resposta.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SCHOOL.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className={cn("group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-[0_20px_60px_-25px_var(--glow)]", i % 2 === 1 && "lg:translate-y-8")}
              data-testid={`school-tile-${s.id}`}
            >
              <span className="font-mono text-xs text-primary/70">#{s.channel}</span>
              <s.icon className="mt-5 size-7 text-primary transition-transform duration-300 group-hover:scale-110" />
              <h3 className="mt-4 type-h3">{s.title}</h3>
              <p className="mt-2 text-sm leading-[1.6] tracking-(--track-text) text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* bento */}
      <section className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mb-14 max-w-2xl">
          <p className="mb-3 type-eyebrow text-primary">Tudo do Slack. Nada do ruído.</p>
          <h2 className="type-section">Um circuito pensado para foco.</h2>
        </div>
        <div className="relative grid gap-4 md:grid-cols-6">
          <Tile testid="feature-tile-realtime" className="md:col-span-4 md:row-span-2 min-h-[280px]">
            <Zap className="size-6 text-primary" />
            <h3 className="mt-4 type-h3-lg">Tempo real de verdade</h3>
            <p className="mt-2 max-w-md type-reading text-muted-foreground">WebSockets entregam mensagens, reações, presença e indicador de digitação instantaneamente para todo o time.</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["online", "digitando…", "nova mensagem", "reação 🎉"].map((c, i) => (
                <motion.span key={c} animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
                  {c}
                </motion.span>
              ))}
            </div>
          </Tile>
          <Tile testid="feature-tile-ai" className="md:col-span-2">
            <Sparkles className="size-6 text-primary" />
            <h3 className="mt-4 type-h3">Nexus AI</h3>
            <p className="mt-2 text-sm leading-[1.6] tracking-(--track-text) text-muted-foreground">Resuma canais e threads ou pergunte o que foi decidido.</p>
          </Tile>
          <Tile testid="feature-tile-threads" className="md:col-span-2">
            <MessageSquareText className="size-6 text-primary" />
            <h3 className="mt-4 type-h3">Threads</h3>
            <p className="mt-2 text-sm leading-[1.6] tracking-(--track-text) text-muted-foreground">Discussões paralelas sem poluir o canal.</p>
          </Tile>
          <Tile testid="feature-tile-search" className="md:col-span-2">
            <Search className="size-6 text-primary" />
            <h3 className="mt-4 type-h3">Busca ⌘K</h3>
            <p className="mt-2 text-sm leading-[1.6] tracking-(--track-text) text-muted-foreground">Mensagens, canais e arquivos num atalho.</p>
          </Tile>
          <Tile testid="feature-tile-mentions" className="md:col-span-2">
            <AtSign className="size-6 text-primary" />
            <h3 className="mt-4 type-h3">Menções & atividade</h3>
            <p className="mt-2 text-sm leading-[1.6] tracking-(--track-text) text-muted-foreground">Nunca perca quando chamarem você.</p>
          </Tile>
          <Tile testid="feature-tile-reactions" className="md:col-span-2">
            <div className="flex gap-3">
              <SmilePlus className="size-6 text-primary" />
              <Pin className="size-6 text-primary" />
            </div>
            <h3 className="mt-4 type-h3">Reações & fixados</h3>
            <p className="mt-2 text-sm leading-[1.6] tracking-(--track-text) text-muted-foreground">Feedback em um clique, o essencial sempre no topo.</p>
          </Tile>
        </div>
      </section>

      {/* closing CTA */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-end">
          <h2 className="max-w-2xl type-section">
            Conecte o time. <span className="text-primary">Agora.</span>
          </h2>
          <div className="flex gap-3">{cta(true, "Ir para o workspace", "Começar agora", "/sign-up", "footer-cta")}</div>
        </div>
        <footer className="mx-auto flex max-w-7xl items-center justify-between px-5 pb-8 text-xs text-muted-foreground sm:px-8">
          <Logo />
          <span>© {new Date().getFullYear()} Nexus</span>
        </footer>
      </section>
    </div>
  );
}
