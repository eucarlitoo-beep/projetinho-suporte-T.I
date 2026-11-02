import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CalendarRange, CheckCircle2, CircleDot, Clock3, LifeBuoy, ListChecks, MapPin, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPatch, apiPost, errorMessage } from "@/lib/api";
import type { TicketCategory, TicketCreate, TicketOut, TicketPriority, TicketStats, TicketStatus, TicketUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/chat/Avatar";
import { useWorkspace } from "@/components/chat/hooks";
import { Panel, ViewShell, localTz, relTime } from "./ViewShell";

export const PRIORITY: Record<TicketPriority, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: "#F43F5E" },
  alta: { label: "Alta", color: "#F59E0B" },
  media: { label: "Média", color: "#00E5FF" },
  baixa: { label: "Baixa", color: "#34D399" },
};
export const STATUS: Record<TicketStatus, { label: string; color: string; icon: typeof CircleDot }> = {
  aberto: { label: "Aberto", color: "#F59E0B", icon: CircleDot },
  em_atendimento: { label: "Em atendimento", color: "#3B82F6", icon: Clock3 },
  resolvido: { label: "Resolvido", color: "#34D399", icon: CheckCircle2 },
};

const useCategories = () => useQuery({ queryKey: ["ticket-categories"], queryFn: () => apiGet<TicketCategory[]>("/tickets/categories"), staleTime: 5 * 60_000 });

function Pill({ color, children, testid }: { color: string; children: React.ReactNode; testid?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color, borderColor: `${color}55`, background: `${color}14` }} data-testid={testid}>
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

/* ---------------- charts ---------------- */
const tooltipStyle = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
  itemStyle: { padding: 0 },
};
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const shiftDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const PRESETS = [
  { id: "7", label: "7 dias", days: 7 },
  { id: "30", label: "30 dias", days: 30 },
  { id: "90", label: "90 dias", days: 90 },
];

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
      <div>
        <BarChart3 className="mx-auto mb-2 size-7 opacity-50" />
        {label}
      </div>
    </div>
  );
}

function Dashboard() {
  const [preset, setPreset] = useState("30");
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const tz = localTz();
  const qs = range ? `tz=${encodeURIComponent(tz)}&start=${range.start}&end=${range.end}` : `tz=${encodeURIComponent(tz)}`;
  const stats = useQuery({ queryKey: ["ticket-stats", qs], queryFn: () => apiGet<TicketStats>(`/tickets/stats?${qs}`) });
  const s = stats.data;
  // "today" comes from the server (stats.end with no explicit range), never from browser date math
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    if (!range && s) setToday(s.end);
  }, [range, s]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p || !today) return setRange(null);
    setRange({ start: shiftDays(today, -(p.days - 1)), end: today });
  };
  const priorityTotal = s?.priority.reduce((n, p) => n + p.count, 0) ?? 0;
  const categories = useMemo(() => (s?.category ?? []).filter((c) => c.count > 0), [s]);

  const kpis = [
    { id: "total", label: "Abertos no período", value: s?.total, icon: ListChecks, color: "#00E5FF" },
    { id: "open", label: "Aguardando agora", value: s?.open_now, icon: CircleDot, color: "#F59E0B" },
    { id: "progress", label: "Em atendimento", value: s?.in_progress_now, icon: Clock3, color: "#3B82F6" },
    { id: "resolved", label: "Resolvidos no período", value: s?.resolved_in_period, icon: CheckCircle2, color: "#34D399" },
  ];

  return (
    <div className="space-y-4" data-testid="tickets-dashboard">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/40 p-2" data-testid="dashboard-filters">
        <CalendarRange className="ml-1 size-4 text-primary" />
        {PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => applyPreset(p.id)} data-testid={`dashboard-preset-${p.id}`} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,color]", preset === p.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            De
            <Input type="date" value={range?.start ?? s?.start ?? ""} max={range?.end ?? s?.end} onChange={(e) => { if (!e.target.value) return; setPreset("custom"); setRange({ start: e.target.value, end: range?.end ?? s?.end ?? e.target.value }); }} className="h-8 w-[150px]" data-testid="dashboard-start-date" />
          </label>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            até
            <Input type="date" value={range?.end ?? s?.end ?? ""} min={range?.start ?? s?.start} onChange={(e) => { if (!e.target.value) return; setPreset("custom"); setRange({ start: range?.start ?? s?.start ?? e.target.value, end: e.target.value }); }} className="h-8 w-[150px]" data-testid="dashboard-end-date" />
          </label>
        </div>
      </div>
      {stats.isError && <p className="text-sm text-destructive" data-testid="dashboard-error">{errorMessage(stats.error)}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur" data-testid={`kpi-${k.id}`}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {k.label}
              <k.icon className="size-4" style={{ color: k.color }} />
            </div>
            <p className="mt-2 type-kpi" data-testid={`kpi-${k.id}-value`}>{k.value ?? "—"}</p>
          </motion.div>
        ))}
      </div>

      <Panel title="Chamados por período" subtitle={s ? `${fmtDay(s.start)} – ${fmtDay(s.end)} · abertos x resolvidos por dia` : "Carregando…"} testid="chart-period">
        <div className="h-72">
          {s && s.period.some((p) => p.abertos || p.resolvidos) ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={s.period} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-open" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDay(String(d))} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="abertos" name="Abertos" stroke="#00E5FF" strokeWidth={2.5} fill="url(#g-open)" dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="resolvidos" name="Resolvidos" stroke="#34D399" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label={s ? "Nenhum chamado neste período" : "Carregando…"} />
          )}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="Chamados por prioridade" subtitle="Quantidade e percentual no período" testid="chart-priority">
          {s && priorityTotal > 0 ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={s.priority.filter((p) => p.count > 0)} dataKey="count" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={3} stroke="none" cornerRadius={6}>
                      {s.priority.filter((p) => p.count > 0).map((p) => <Cell key={p.key} fill={p.color} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v) => [`${v} (${Math.round((Number(v) / priorityTotal) * 100)}%)`, "Chamados"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="type-kpi" data-testid="priority-total">{priorityTotal}</p>
                    <p className="text-[11px] text-muted-foreground">chamados</p>
                  </div>
                </div>
              </div>
              <ul className="w-full space-y-2" data-testid="priority-legend">
                {s.priority.map((p) => (
                  <li key={p.key} className="flex items-center gap-2 text-sm" data-testid={`priority-legend-${p.key}`}>
                    <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="flex-1">{p.label}</span>
                    <span className="font-mono font-semibold">{p.count}</span>
                    <span className="w-12 text-right font-mono text-xs text-muted-foreground">{Math.round((p.count / priorityTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="h-56"><EmptyChart label={s ? "Sem dados de prioridade" : "Carregando…"} /></div>
          )}
        </Panel>

        <Panel title="Chamados por categoria" subtitle="Categorias cadastradas, no período" testid="chart-category">
          {categories.length ? (
            <div style={{ height: Math.max(200, categories.length * 42) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }} barCategoryGap={10}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: "var(--foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.4 }} formatter={(v) => [v, "Chamados"]} />
                  <Bar dataKey="count" name="Chamados" radius={[0, 8, 8, 0]} label={{ position: "right", fontSize: 11, fill: "var(--muted-foreground)" }}>
                    {categories.map((c) => <Cell key={c.key} fill={c.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56"><EmptyChart label={s ? "Sem chamados por categoria no período" : "Carregando…"} /></div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- ticket list ---------------- */
function NewTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const cats = useCategories();
  const [form, setForm] = useState<TicketCreate>({ title: "", description: "", category_id: "", priority: "media", location: "" });
  const [newCat, setNewCat] = useState("");
  const catName = Object.fromEntries((cats.data ?? []).map((c) => [c.id, c.name]));

  const create = useMutation({
    mutationFn: () => apiPost<TicketOut>("/tickets", form),
    onSuccess: (t) => {
      toast.success(`Chamado #${t.number} aberto`);
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket-stats"] });
      setForm({ title: "", description: "", category_id: "", priority: "media", location: "" });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addCat = useMutation({
    mutationFn: () => apiPost<TicketCategory>("/tickets/categories", { name: newCat.trim() }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["ticket-categories"] });
      setForm((f) => ({ ...f, category_id: c.id }));
      setNewCat("");
      toast.success("Categoria cadastrada");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const valid = form.title.trim().length >= 3 && !!form.category_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="new-ticket-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Abrir chamado de T.I.</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Título</Label>
            <Input id="t-title" value={form.title} maxLength={140} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Projetor da sala 7B não liga" data-testid="ticket-title-input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v: string) => setForm({ ...form, category_id: v })}>
                <SelectTrigger className="w-full" data-testid="ticket-category-select"><SelectValue>{(v) => (v ? catName[v as string] : "Escolha…")}</SelectValue></SelectTrigger>
                <SelectContent>
                  {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id} data-testid={`ticket-category-option-${c.id}`}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v: string) => setForm({ ...form, priority: v as TicketPriority })}>
                <SelectTrigger className="w-full" data-testid="ticket-priority-select"><SelectValue>{(v) => PRIORITY[v as TicketPriority]?.label}</SelectValue></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY) as TicketPriority[]).map((p) => <SelectItem key={p} value={p} data-testid={`ticket-priority-option-${p}`}>{PRIORITY[p].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Input value={newCat} maxLength={40} onChange={(e) => setNewCat(e.target.value)} placeholder="Cadastrar nova categoria (opcional)" className="h-8 text-xs" data-testid="new-category-input" />
            <Button type="button" size="sm" variant="outline" disabled={newCat.trim().length < 2 || addCat.isPending} onClick={() => addCat.mutate()} data-testid="new-category-btn"><Plus className="size-3.5" /> Categoria</Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-loc">Local / setor</Label>
            <Input id="t-loc" value={form.location} maxLength={80} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex.: Sala 7B, Secretaria, Laboratório" data-testid="ticket-location-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Descrição</Label>
            <Textarea id="t-desc" value={form.description} maxLength={4000} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva o problema, quando começou e o que já foi tentado." data-testid="ticket-description-input" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!valid || create.isPending} data-testid="ticket-submit-btn">Abrir chamado</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TicketRow({ t, cats }: { t: TicketOut; cats: Record<string, TicketCategory> }) {
  const qc = useQueryClient();
  const { users } = useWorkspace();
  const update = useMutation({
    mutationFn: (body: TicketUpdate) => apiPatch<TicketOut>(`/tickets/${t.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket-stats"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cat = cats[t.category_id];
  const requester = users[t.requester_id];
  const staff = Object.values(users).filter((u) => !u.bot);
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition-[border-color] hover:border-primary/30" data-testid={`ticket-row-${t.number}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="font-mono text-xs text-primary">#{t.number}</span>
        <div className="min-w-0 flex-1">
          <p className="type-h4" data-testid="ticket-row-title">{t.title}</p>
          {t.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {cat && <Pill color={cat.color} testid="ticket-row-category">{cat.name}</Pill>}
            <Pill color={PRIORITY[t.priority].color} testid="ticket-row-priority">{PRIORITY[t.priority].label}</Pill>
            {t.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {t.location}</span>}
            {requester && <span className="flex items-center gap-1.5"><UserAvatar user={requester} size="xs" /> {requester.name}</span>}
            <span>· {relTime(t.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={t.assignee_id ?? "none"} onValueChange={(v: string) => update.mutate({ assignee_id: v === "none" ? null : v })}>
            <SelectTrigger size="sm" className="min-w-[150px]" data-testid={`ticket-assignee-select-${t.number}`}><SelectValue>{(v) => (v === "none" ? "Sem responsável" : users[v as string]?.name ?? "—")}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem responsável</SelectItem>
              {staff.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={t.status} onValueChange={(v: string) => update.mutate({ status: v as TicketStatus })}>
            <SelectTrigger size="sm" className="min-w-[160px]" style={{ color: STATUS[t.status].color }} data-testid={`ticket-status-select-${t.number}`}><SelectValue>{(v) => STATUS[v as TicketStatus]?.label}</SelectValue></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS) as TicketStatus[]).map((s) => <SelectItem key={s} value={s} data-testid={`ticket-status-option-${s}`}>{STATUS[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </motion.li>
  );
}

function TicketList({ onNew }: { onNew: () => void }) {
  const [status, setStatus] = useState<TicketStatus | "todos">("todos");
  const [q, setQ] = useState("");
  const cats = useCategories();
  const catMap = Object.fromEntries((cats.data ?? []).map((c) => [c.id, c]));
  const qs = new URLSearchParams();
  if (status !== "todos") qs.set("status", status);
  if (q.trim()) qs.set("q", q.trim());
  const tickets = useQuery({ queryKey: ["tickets", qs.toString()], queryFn: () => apiGet<TicketOut[]>(`/tickets?${qs.toString()}`) });

  return (
    <div className="space-y-3" data-testid="tickets-list">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-1 rounded-xl border border-border bg-card/40 p-1">
          {(["todos", "aberto", "em_atendimento", "resolvido"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} data-testid={`tickets-filter-${s}`} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,color]", status === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {s === "todos" ? "Todos" : STATUS[s].label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 focus-within:border-primary/50">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} placeholder="Buscar chamados…" className="h-9 w-full bg-transparent text-sm outline-none" data-testid="tickets-search-input" />
        </div>
      </div>
      {tickets.isError ? (
        <p className="text-sm text-destructive">{errorMessage(tickets.error)}</p>
      ) : tickets.isPending ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : tickets.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center" data-testid="tickets-empty">
          <LifeBuoy className="mx-auto size-8 text-primary" />
          <p className="mt-3 type-h3">Nenhum chamado {status !== "todos" ? `com status “${STATUS[status].label}”` : "ainda"}</p>
          <p className="text-sm text-muted-foreground">Abra um chamado sempre que algo de T.I. precisar de atenção.</p>
          <Button className="mt-4" onClick={onNew} data-testid="tickets-empty-new-btn"><Plus className="size-4" /> Abrir chamado</Button>
        </div>
      ) : (
        <ul className="space-y-2">{tickets.data.map((t) => <TicketRow key={t.id} t={t} cats={catMap} />)}</ul>
      )}
    </div>
  );
}

export function TicketsView({ onOpenNav }: { onOpenNav: () => void }) {
  const [tab, setTab] = useState<"painel" | "lista">("painel");
  const [newOpen, setNewOpen] = useState(false);
  return (
    <ViewShell
      icon={LifeBuoy}
      title="Chamados de T.I."
      subtitle="Painel e acompanhamento de suporte"
      onOpenNav={onOpenNav}
      testid="tickets-view"
      actions={<Button size="sm" onClick={() => setNewOpen(true)} data-testid="new-ticket-btn"><Plus className="size-4" /> <span className="hidden sm:inline">Novo chamado</span></Button>}
    >
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-4 flex gap-1 border-b border-border">
          {([["painel", "Painel", BarChart3], ["lista", "Chamados", ListChecks]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} data-testid={`tickets-tab-${id}`} className={cn("relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors", tab === id ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-4" /> {label}
              {tab === id && <motion.span layoutId="tickets-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary shadow-[0_0_12px_var(--glow)]" />}
            </button>
          ))}
        </div>
        {tab === "painel" ? <Dashboard /> : <TicketList onNew={() => setNewOpen(true)} />}
      </div>
      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} />
    </ViewShell>
  );
}
