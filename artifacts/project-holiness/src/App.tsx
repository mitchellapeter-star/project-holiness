import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type Dispatch, type DragEvent, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import {
  ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Circle, ClipboardCheck, Cross, GripVertical, History, Menu, Pencil, Plus, Target, Trash2, X, AlertCircle, Bookmark, Compass, ChevronDown, ChevronUp, ShieldCheck, User, Settings, LogOut,
  Heart, Star, Shield, Key, Bird, Flame, Flower2, Anchor, Sun, Ban
} from "lucide-react";
import { Link, Route, Switch, useLocation } from "wouter";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { loadWorkspace, saveWorkspace, saveWorkspaceOnPageHide, type WorkspaceDeletions } from "@/lib/workspace-sync";
import type { ActionCompletion, ActionItem, ActionStatus, CallingEntry, CallingStatus, Discipline, Frequency, Store, HolinessProblem, Countermeasure } from "@/lib/workspace-types";

import stainedGlassImg from "@/assets/stained-glass.jpg";

const queryClient = new QueryClient();
const today = new Date().toISOString().slice(0, 10);
const productionAuthRedirect = "https://project-holiness-lp13-tawny.vercel.app";

const avatarOptions = [
  { key: "cross", label: "Holy Cross", icon: Cross, bg: "#2D4C3C", fg: "#F5F1E9" },
  { key: "heart", label: "Sacred Heart", icon: Heart, bg: "#8B2E2E", fg: "#FCEAEA" },
  { key: "star", label: "Star of the Sea", icon: Star, bg: "#2C4A6B", fg: "#EAF1FA" },
  { key: "shield", label: "St. Michael", icon: Shield, bg: "#5B5F66", fg: "#F2F3F4" },
  { key: "key", label: "St. Peter", icon: Key, bg: "#8C6D23", fg: "#FFF6DF" },
  { key: "bird", label: "St. Francis", icon: Bird, bg: "#6B7A4A", fg: "#F3F6EC" },
  { key: "flame", label: "Pentecost", icon: Flame, bg: "#B8552E", fg: "#FFF1E6" },
  { key: "flower", label: "St. Thérèse", icon: Flower2, bg: "#B4667F", fg: "#FDEEF2" },
  { key: "anchor", label: "Anchor of Hope", icon: Anchor, bg: "#2B4159", fg: "#E9F0F6" },
  { key: "sun", label: "Divine Mercy", icon: Sun, bg: "#C79A2E", fg: "#FFF9E8" },
];
function avatarFor(key: string | null | undefined) {
  return avatarOptions.find(option => option.key === key);
}

// Public half of this project's VAPID keypair, used when subscribing a browser to push
// notifications. Must match the key the daily-reminders-v2 Supabase Edge Function signs with.
const VAPID_PUBLIC_KEY = "BPZIvPevNJljIOdQT3yoWr6trebbJ9dgl68MhGoZ_5_6nOlnnvWYX78R8UE6a420JMX5Ay0k9r7aj0tkWOQfmPY";
const REMINDER_MESSAGE = "Take a few minutes to record the practices you have completed";
function base64UrlToUint8Array(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
const fixedProjectStatement = "There is a gap between where I am and the holiness I'm called to. Holiness means being set apart for God, growing toward sainthood, and conforming my will to His, the universal call every baptized person shares.\n\nIf married, this call extends to one's marriage as well, since spouses are meant to help sanctify one another.";
const fixedLifeRationale = "Becoming holy leads to heaven, leaves a lasting effect on ourselves and those who come after us, and greatly improves our lives and the lives of those around us. Growth in holiness is growth in love, of God and neighbor, and it bears fruit far beyond ourselves.\n\nIf married, this includes a holy marriage, which shapes not only the spouses but their children as well.";

const blankAction = (): Omit<ActionItem, "id"> => ({
  title: "",
  description: "",
  startDate: today,
  frequency: "one-time",
  dueDate: "",
  endDate: "",
  status: "open",
  active: true,
});

const blankProblem = (): Omit<HolinessProblem, "id"> => ({
  problem: "",
  rootCause: "",
});

const blankCountermeasure = (problemId: string): Omit<Countermeasure, "id"> => ({
  problemId,
  description: "",
});

const seed: Store = {
  a3: {
    projectStatement: fixedProjectStatement,
    lifeRationale: fixedLifeRationale,
    problems: [
      {
        id: "p1",
        problem: "I tend to wait for urgency before I give my attention to the practices that keep me clear.",
        rootCause: "I view spiritual practices as an optional extra rather than the foundation."
      }
    ],
    countermeasures: [
      {
        id: "cm1",
        problemId: "p1",
        description: "Make the next faithful action visible before the day ends."
      },
      {
        id: "cm2",
        problemId: "p1",
        description: "Protect one weekly review."
      }
    ],
    actionItems: [{
      id: "a1",
      title: "Write tomorrow's first faithful action before closing the day",
      description: "Leave the next faithful move visible before the day ends.",
      startDate: today,
      frequency: "daily",
      dueDate: "",
      endDate: "",
      status: "in-progress",
      active: true,
    }],
  },
  completions: [],
  disciplines: [],
  callings: [{
    id: "c1",
    title: "Make room for a slower kind of leadership",
    description: "Explore how patient formation could shape the way I lead the team this year.",
    dateAdded: today,
    nextStep: "Ask what a healthier pace would change for the team.",
    status: "Acting",
  }],
};

const emptyStore: Store = {
  a3: {
    projectStatement: fixedProjectStatement,
    lifeRationale: fixedLifeRationale,
    problems: [],
    countermeasures: [],
    actionItems: [],
  },
  completions: [],
  disciplines: [],
  callings: [],
};

const nav = [
  { href: "/dashboard", label: "Overview", icon: Target },
  { href: "/guide", label: "Guide", icon: Compass },
  { href: "/a3", label: "Formation Plan", icon: ClipboardCheck },
  { href: "/leader-standard-work", label: "Practices", icon: CalendarDays },
  { href: "/calling-log", label: "Calling Log", icon: BookOpen },
];

const frequencyLabels: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  "one-time": "One time",
  other: "Other",
};

function monthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${year}-${String(monthNumber).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
}

function weekStart(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function monthWeekGroups(dates: string[]) {
  return dates.reduce<{ start: string; dates: string[] }[]>((groups, date) => {
    const start = weekStart(date);
    const current = groups[groups.length - 1];
    if (current?.start === start) current.dates.push(date);
    else groups.push({ start, dates: [date] });
    return groups;
  }, []);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
}

function shortDate(dateKey: string) {
  if (!dateKey) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`));
}

function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

function isRecurring(action: ActionItem) {
  return action.frequency === "daily" || action.frequency === "weekly" || action.frequency === "monthly";
}

function hasAnyCompletion(action: ActionItem, completions: ActionCompletion[]) {
  return completions.some(completion => completion.actionItemId === action.id);
}

function isOpenAction(action: ActionItem, completions: ActionCompletion[]) {
  return action.active && (isRecurring(action) || !hasAnyCompletion(action, completions));
}

function periodsForAction(action: ActionItem, month: string) {
  const dates = monthDates(month);
  const monthStart = dates[0];
  const monthEnd = dates[dates.length - 1];
  const withinBounds = (date: string) => date >= (action.startDate || monthStart) && (!action.endDate || date <= action.endDate);
  if (action.frequency === "daily") return dates.filter(withinBounds);
  if (action.frequency === "weekly") {
    return [...new Set(dates.filter(date => {
      const start = weekStart(date);
      const end = new Date(`${start}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      return end.toISOString().slice(0, 10) >= (action.startDate || monthStart) && (!action.endDate || start <= action.endDate);
    }).map(weekStart))];
  }
  if (action.frequency === "monthly") {
    const overlapsMonth = (!action.startDate || action.startDate <= monthEnd) && (!action.endDate || action.endDate >= monthStart);
    return overlapsMonth ? [monthStart] : [];
  }
  if (action.startDate > monthEnd || (action.endDate && action.endDate < monthStart)) return [];
  return [action.startDate < monthStart ? monthStart : action.startDate || monthStart];
}

function completionFor(completions: ActionCompletion[], actionId: string, period: string): ActionCompletion["status"] | undefined {
  return completions.find(completion => completion.actionItemId === actionId && completion.completionPeriod === period)?.status;
}

// Percentage of this month's planned occurrences marked complete. Only meaningful for
// recurring (daily/weekly/monthly) actions; returns null when there's nothing planned this month.
// Canceled occurrences don't count for or against the person, so they're excluded entirely.
function actionMonthCompletion(action: ActionItem, completions: ActionCompletion[], month: string): number | null {
  const periods = periodsForAction(action, month).filter(period => completionFor(completions, action.id, period) !== "canceled");
  if (periods.length === 0) return null;
  const completedCount = periods.filter(period => completionFor(completions, action.id, period) === "completed").length;
  return Math.round((completedCount / periods.length) * 100);
}

// Derives a display status for an action item instead of relying on a manually set field.
// Recurring items (daily/weekly/monthly) are tracked ongoing in Practices, so they read "In practice."
// One-time/other items reflect their single completion record: Open, Complete, Missed, or Canceled.
function derivedActionStatus(action: ActionItem, completions: ActionCompletion[]): { label: string; tone: "green" | "gold" | "neutral" | "red" } {
  if (isRecurring(action)) return { label: "In practice", tone: "gold" };
  const period = action.dueDate || action.startDate || today;
  const status = completionFor(completions, action.id, period);
  if (status === "completed") return { label: "Complete", tone: "green" };
  if (status === "missed") return { label: "Missed", tone: "red" };
  if (status === "canceled") return { label: "Canceled", tone: "neutral" };
  return { label: "Open", tone: "neutral" };
}

// Canceled occurrences are excluded from both planned and actual — they don't count for or
// against the person, as if that occurrence had never been scheduled.
function completionTotals(actions: ActionItem[], completions: ActionCompletion[], month: string) {
  let planned = 0;
  let actual = 0;
  for (const action of actions) {
    for (const period of periodsForAction(action, month)) {
      const status = completionFor(completions, action.id, period);
      if (status === "canceled") continue;
      planned++;
      if (status === "completed") actual++;
    }
  }
  return { planned, actual };
}

// Cycles a practice through four states with each click: unmarked -> completed -> missed ->
// canceled -> unmarked. Canceled occurrences are excluded from planned/actual totals entirely.
function cycleCompletion(setStore: Dispatch<SetStateAction<Store>>, action: ActionItem, period: string) {
  setStore(current => {
    const existingIndex = current.completions.findIndex(item => item.actionItemId === action.id && item.completionPeriod === period);
    const existing = existingIndex >= 0 ? current.completions[existingIndex] : undefined;

    if (!existing) {
      return {
        ...current,
        completions: [...current.completions, {
          id: `completion-${action.id}-${period}`,
          actionItemId: action.id,
          completionPeriod: period,
          status: "completed",
          completedAt: new Date().toISOString(),
        }],
      };
    }
    if (existing.status === "completed") {
      return {
        ...current,
        completions: current.completions.map((item, index) => index === existingIndex ? { ...item, status: "missed", completedAt: new Date().toISOString() } : item),
      };
    }
    if (existing.status === "missed") {
      return {
        ...current,
        completions: current.completions.map((item, index) => index === existingIndex ? { ...item, status: "canceled", completedAt: new Date().toISOString() } : item),
      };
    }
    return { ...current, completions: current.completions.filter((_, index) => index !== existingIndex) };
  });
}

function Mark({ small = false }: { small?: boolean }) {
  return <div className={`flex items-center gap-2.5 ${small ? "text-sm" : ""}`}><span className="grid h-8 w-8 place-items-center rounded-[11px] bg-[#D4AF37] text-[#2D4C3C] shadow-inner"><Cross size={small ? 15 : 17} strokeWidth={2.3} /></span><span className="font-serif font-bold tracking-[-.02em] ornament-border pb-1">Project Holiness</span></div>;
}

function Button({ children, className = "", variant = "primary", onClick, type = "button", disabled = false, testId }: { children: ReactNode; className?: string; variant?: "primary" | "outline" | "quiet" | "danger" | "ghost"; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean; testId?: string }) {
  const styles = {
    primary: "bg-[#2D4C3C] text-[#F5F1E9] hover:bg-[#426553] border border-[#1A3326]/20 shadow-md",
    outline: "border border-[#DDD2C0] bg-white/40 text-[#2D4C3C] hover:border-[#426553] hover:bg-white/60",
    quiet: "text-[#827264] hover:bg-black/5 hover:text-[#31231E]",
    danger: "border border-[#F5A9A9] text-[#DF3B32] hover:bg-[#FFF0F0] hover:border-[#DF3B32]",
    ghost: "text-[#426553] hover:bg-black/5 hover:text-[#2D4C3C]",
  };
  return <button data-testid={testId} disabled={disabled} type={type} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end relative overflow-hidden rounded-3xl p-7 md:p-10 border border-[#DDD2C0] shadow-xl bg-[#F5F1E9]">
    <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ backgroundImage: `url(${stainedGlassImg})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }} />
    <div className="absolute inset-0 bg-gradient-to-t from-[#F5F1E9] via-[#F5F1E9]/80 to-transparent pointer-events-none" />
    <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-5 pointer-events-none hidden md:block">
      <Cross size={180} strokeWidth={0.5} className="text-[#2D4C3C]" />
    </div>
    <div className="relative z-10"><p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#8C6D23] drop-shadow-sm">{eyebrow}</p><h1 className="font-serif text-3xl tracking-[-.035em] text-[#31231E] md:text-[40px] font-bold drop-shadow-sm">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5C4D43]">{description}</p></div>{action && <div className="relative z-10">{action}</div>}
  </div>;
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "green" | "gold" | "neutral" | "red" }) {
  const tones = { green: "bg-[#E6F3ED] border-[#C2E0D1] text-[#2D4C3C]", gold: "bg-[#FFF9E6] border-[#F2D588] text-[#8C6D23]", neutral: "bg-[#F3EFE9] border-[#DDD2C0] text-[#827264]", red: "bg-[#FFF0F0] border-[#F5A9A9] text-[#DF3B32]" };
  return <span className={`inline-flex items-center border rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function ProfileMenu({ email, displayName, avatarKey, onSignOut, onSaveProfile }: { email: string | null; displayName: string | null; avatarKey: string | null; onSignOut: () => void; onSaveProfile: (name: string, avatar: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName ?? "");
  const [avatarDraft, setAvatarDraft] = useState(avatarKey ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const openMenu = () => {
    setNameDraft(displayName ?? "");
    setAvatarDraft(avatarKey ?? "");
    setSaved(false);
    setSaveError("");
    setOpen(true);
  };

  const headerAvatar = avatarFor(avatarKey);
  const HeaderIcon = headerAvatar?.icon ?? User;
  const previewAvatar = avatarFor(avatarDraft) ?? headerAvatar;
  const PreviewIcon = previewAvatar?.icon ?? User;

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    const ok = await onSaveProfile(nameDraft.trim(), avatarDraft);
    setSaving(false);
    if (ok) setSaved(true);
    else setSaveError("Could not save your changes. Try again.");
  };

  return <div className="relative">
    <button onClick={openMenu} aria-label="Account menu" className="grid h-9 w-9 place-items-center rounded-full border border-[#DDD2C0] transition-colors hover:border-[#8C6D23]" style={{ background: headerAvatar?.bg ?? "#EBE3D0", color: headerAvatar?.fg ?? "#2D4C3C" }}>
      <HeaderIcon size={17} />
    </button>
    {open && createPortal(<div className="fixed inset-0 z-50 grid place-items-start justify-items-center overflow-y-auto bg-black/30 backdrop-blur-sm p-4 py-10" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-3xl border border-[#DDD2C0] bg-[#F5F1E9] p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#DDD2C0] pb-4 mb-5">
          <h2 className="font-serif text-xl font-bold text-[#31231E]">Account</h2>
          <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-black/5" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="grid h-16 w-16 place-items-center rounded-2xl shadow-md" style={{ background: previewAvatar?.bg ?? "#2D4C3C", color: previewAvatar?.fg ?? "#F5F1E9" }}><PreviewIcon size={26} /></div>
          {displayName && <p className="font-serif font-bold text-[#31231E] text-base text-center">{displayName}</p>}
          <p className="text-xs text-[#827264] break-all text-center">{email ?? "Signed in"}</p>
        </div>

        <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">Name</label>
        <input value={nameDraft} onChange={event => { setNameDraft(event.target.value); setSaved(false); }} placeholder="Add your name" className="w-full rounded-xl border border-[#DDD2C0] bg-white/60 px-3.5 py-2.5 text-sm text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] transition-all shadow-inner mb-5" />

        <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">Choose an avatar</label>
        <div className="mb-5 grid grid-cols-5 gap-2.5">
          {avatarOptions.map(option => {
            const Icon = option.icon;
            const selected = avatarDraft === option.key;
            return <button key={option.key} type="button" onClick={() => { setAvatarDraft(option.key); setSaved(false); }} title={option.label} aria-label={option.label} aria-pressed={selected} className={`grid aspect-square place-items-center rounded-xl border-2 transition-all ${selected ? "border-[#8C6D23] scale-105 shadow-md" : "border-transparent hover:border-[#DDD2C0]"}`} style={{ background: option.bg, color: option.fg }}>
              <Icon size={18} />
            </button>;
          })}
        </div>
        {previewAvatar && <p className="mb-4 -mt-3 text-xs text-[#827264]">{previewAvatar.label}</p>}

        <Button onClick={handleSave} disabled={saving} className="w-full mb-2">{saving ? "Saving…" : saved ? "Saved" : "Save changes"}</Button>
        {saveError && <p className="mb-3 text-xs text-[#DF3B32]">{saveError}</p>}

        <div className="space-y-1.5 border-t border-[#DDD2C0] pt-4 mt-3">
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#5C4D43] hover:bg-black/5 hover:text-[#31231E] transition-colors"><span className="flex items-center gap-3"><Settings size={17} /> Settings</span><ChevronRight size={15} /></Link>
          <button onClick={() => { setOpen(false); onSignOut(); }} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#DF3B32] hover:bg-[#FFF0F0] transition-colors"><span className="flex items-center gap-3"><LogOut size={17} /> Sign out</span><ChevronRight size={15} /></button>
        </div>
      </div>
    </div>, document.body)}
  </div>;
}

function Shell({ children, onSignOut, userEmail, displayName, avatarKey, onSaveProfile }: { children: ReactNode; onSignOut: () => void; userEmail: string | null; displayName: string | null; avatarKey: string | null; onSaveProfile: (name: string, avatar: string) => Promise<boolean> }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="paper-grain min-h-[100dvh] bg-[#F5F1E9] text-[#31231E] holy-pattern relative">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-[#DDD2C0] bg-[#EBE3D0] px-5 py-7 text-[#31231E] md:flex shadow-xl">
      <Mark />
      <div className="mt-16"><p className="mb-4 px-3 font-mono text-[10px] uppercase tracking-[.22em] text-[#827264] font-semibold">A practical rule of life</p><nav className="space-y-1.5">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${location === href ? "bg-[#2D4C3C] text-[#F5F1E9] shadow-inner border border-[#1A3326]/20" : "text-[#5C4D43] hover:bg-black/5 hover:text-[#31231E]"}`}><Icon size={18} strokeWidth={location === href ? 2 : 1.8} /><span>{label}</span>{location === href && <ChevronRight size={14} className="ml-auto text-[#D4AF37]" />}</Link>)}</nav></div>
      <div className="mt-auto border-t border-[#DDD2C0] pt-5"><div className="mb-4 rounded-xl bg-gradient-to-br from-[#2D4C3C] to-[#1A3326] p-4 shadow-sm border border-[#1A3326]"><p className="font-serif text-sm leading-relaxed text-[#D2E0D9] italic">“Let us not grow weary of doing good.”</p><p className="mt-3 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8FAD9D]">Galatians 6:9</p></div><button onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#5C4D43] hover:bg-black/5 hover:text-[#31231E] transition-colors">Sign out</button></div>
    </aside>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden animate-in fade-in" onClick={() => setMobileOpen(false)}><div className="flex h-full w-[84%] max-w-[320px] flex-col overflow-y-auto bg-[#EBE3D0] p-5 text-[#31231E] shadow-2xl animate-in slide-in-from-left" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><Mark small /><button onClick={() => setMobileOpen(false)} className="rounded-full p-2 hover:bg-black/5" aria-label="Close navigation"><X size={20} /></button></div><nav className="mt-10 space-y-2">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium ${location === href ? "bg-[#2D4C3C] border border-[#1A3326]/20 shadow-inner text-[#F5F1E9]" : "text-[#5C4D43]"}`}><Icon size={18} />{label}</Link>)}</nav><div className="mt-auto border-t border-[#DDD2C0] pt-5"><p className="mb-3 px-3 font-serif text-sm italic leading-relaxed text-[#5C4D43]">“Let us not grow weary of doing good.”</p><button onClick={() => { setMobileOpen(false); onSignOut(); }} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#1A3326] bg-[#2D4C3C] px-4 py-3 text-sm font-semibold text-[#F5F1E9] shadow-sm hover:bg-[#426553]">Sign out</button></div></div></div>}
    <main className="min-h-[100dvh] md:ml-[260px] relative z-10"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#DDD2C0]/60 bg-[#F5F1E9]/80 px-5 backdrop-blur-md md:px-10"><button className="md:hidden p-2 -ml-2 rounded-lg hover:bg-black/5" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div className="ml-auto flex items-center gap-4"><span className="hidden text-xs font-medium text-[#827264] sm:inline">A good day to tend the field.</span><ProfileMenu email={userEmail} displayName={displayName} avatarKey={avatarKey} onSignOut={onSignOut} onSaveProfile={onSaveProfile} /></div></header><div className="mx-auto max-w-[1180px] px-5 py-8 pb-24 md:px-10 md:py-12">{children}</div></main>
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#DDD2C0] bg-[#EBE3D0]/95 px-1 py-2 backdrop-blur-lg md:hidden pb-safe">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex flex-col items-center gap-1.5 py-1.5 text-[10px] font-medium transition-colors ${location === href ? "text-[#2D4C3C]" : "text-[#827264]"}`}><Icon size={18} strokeWidth={location === href ? 2.5 : 2} /><span>{label.split(" ")[0]}</span></Link>)}</nav>
  </div>;
}

function Login({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    if (!supabase) {
      setMessage("Supabase is not configured for this environment yet.");
      setBusy(false);
      return;
    }
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: productionAuthRedirect },
        });
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Check your email to confirm your account.");
    else onAuthed();
    setBusy(false);
  };
  const submitForgotPassword = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    if (!supabase) {
      setMessage("Supabase is not configured for this environment yet.");
      setBusy(false);
      return;
    }
    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: productionAuthRedirect });
    if (result.error) setMessage(result.error.message);
    else setResetSent(true);
    setBusy(false);
  };
  const signInWithGoogle = async () => {
    setMessage("");
    if (!supabase) {
      setMessage("Supabase is not configured for this environment yet.");
      return;
    }
    setBusy(true);
    const result = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: productionAuthRedirect } });
    if (result.error) {
      setMessage(result.error.message);
      setBusy(false);
    }
    // On success the browser is redirected to Google, so no further action here.
  };
  return <div className="paper-grain holy-pattern min-h-[100dvh] overflow-hidden bg-[#F5F1E9] relative"><div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ backgroundImage: `url(${stainedGlassImg})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }} /><div className="absolute inset-0 bg-gradient-to-br from-[#F5F1E9]/95 via-[#F5F1E9]/90 to-[#EBE3D0]/95 pointer-events-none" /><div className="mx-auto flex min-h-[100dvh] max-w-[1320px] flex-col px-6 py-7 md:px-12 relative z-10"><header className="flex items-center justify-between"><Mark /><span className="font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-[#5C4D43] drop-shadow-sm">A practical rule of life</span></header><main className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[1.04fr_.96fr] lg:gap-24"><div className="animate-rise max-w-[600px]"><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#DDD2C0] bg-white/40 backdrop-blur-md px-3 py-1.5 text-[11px] font-semibold text-[#5C4D43] shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-[#8C6D23]" /> The universal call to holiness</div><h1 className="font-serif text-[clamp(3.15rem,7vw,6.4rem)] font-bold leading-[.98] tracking-[-.065em] text-[#31231E] drop-shadow-sm">Project<br /><span className="text-[#8C6D23] ornament-border pb-2">Holiness.</span></h1><h2 className="mt-9 max-w-[520px] font-serif text-2xl leading-9 text-[#5C4D43] drop-shadow-sm">A practical plan for closing the gap to holiness.</h2><p className="mt-5 max-w-[520px] text-base leading-7 text-[#31231E]/80">Honestly assess where you stand, turn what you learn into concrete action, and track it — one faithful step at a time.</p><form onSubmit={submitAuth} className="mt-10 max-w-[460px] rounded-2xl border border-[#DDD2C0] bg-white/60 backdrop-blur-xl p-5 shadow-xl">{forgotMode ? (resetSent ? <div><div className="flex items-center justify-between gap-3 border-b border-[#DDD2C0] pb-4 mb-4"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#8C6D23]">Check your email</p><p className="mt-1.5 text-xs text-[#827264] leading-relaxed">A password reset link is on its way to {email}.</p></div></div><button type="button" onClick={() => { setForgotMode(false); setResetSent(false); setMessage(""); }} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D4C3C] px-4 py-3 text-sm font-bold text-[#F5F1E9] shadow-md hover:bg-[#426553] border border-[#1A3326]/30 transition-all">Back to sign in</button></div> : <><div className="flex items-center justify-between gap-3 border-b border-[#DDD2C0] pb-4 mb-4"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#8C6D23]">Reset your password</p><p className="mt-1.5 text-xs text-[#827264] leading-relaxed">We will email you a link to choose a new password.</p></div></div><input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" className="w-full rounded-xl border border-[#DDD2C0] bg-white/50 px-3.5 py-3 text-sm text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] transition-all shadow-inner placeholder:text-[#827264]" /><button disabled={busy} onClick={submitForgotPassword} type="button" className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D4C3C] px-4 py-3 text-sm font-bold text-[#F5F1E9] shadow-md hover:bg-[#426553] border border-[#1A3326]/30 transition-all disabled:opacity-50">{busy ? "Working…" : "Send reset link"} <ArrowRight size={16} /></button><button type="button" onClick={() => { setForgotMode(false); setMessage(""); }} className="mt-3 w-full text-center text-xs font-semibold text-[#5C4D43] hover:text-[#31231E]">Back to sign in</button>{message && <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FFF0F0] p-3 text-xs text-[#DF3B32] border border-[#F5A9A9]"><AlertCircle size={14} className="shrink-0" /><p role="status">{message}</p></div>}</>) : <><div className="flex items-center justify-between gap-3 border-b border-[#DDD2C0] pb-4 mb-4"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#8C6D23]">{isSupabaseConfigured ? "Private account" : "Supabase setup needed"}</p><p className="mt-1.5 text-xs text-[#827264] leading-relaxed">{isSupabaseConfigured ? "Your workspace follows your Supabase account." : "Add the Supabase environment values to enable sign in."}</p></div><div className="flex rounded-lg bg-black/5 p-1 text-[11px] font-semibold text-[#827264] border border-[#DDD2C0] shadow-inner"><button type="button" onClick={() => setMode("signin")} className={`rounded-md px-3 py-1.5 transition-all ${mode === "signin" ? "bg-white text-[#31231E] shadow-sm border border-[#DDD2C0]" : "hover:text-[#31231E]"}`}>Sign In</button><button type="button" onClick={() => setMode("signup")} className={`rounded-md px-3 py-1.5 transition-all ${mode === "signup" ? "bg-white text-[#31231E] shadow-sm border border-[#DDD2C0]" : "hover:text-[#31231E]"}`}>Create</button></div></div><button type="button" onClick={signInWithGoogle} disabled={busy} className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm font-semibold text-[#31231E] shadow-sm transition-all hover:bg-[#F5F1E9] disabled:opacity-50"><svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" /><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" /><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" /><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" /></svg>Continue with Google</button><div className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-[#A79682]"><span className="h-px flex-1 bg-[#DDD2C0]" />or<span className="h-px flex-1 bg-[#DDD2C0]" /></div><div className="grid gap-3 sm:grid-cols-2"><input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" className="rounded-xl border border-[#DDD2C0] bg-white/50 px-3.5 py-3 text-sm text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] transition-all shadow-inner placeholder:text-[#827264]" /><input required minLength={6} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" className="rounded-xl border border-[#DDD2C0] bg-white/50 px-3.5 py-3 text-sm text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] transition-all shadow-inner placeholder:text-[#827264]" /></div>{mode === "signin" && <button type="button" onClick={() => { setForgotMode(true); setMessage(""); }} className="mt-2.5 text-xs font-semibold text-[#5C4D43] hover:text-[#31231E]">Forgot password?</button>}<button disabled={busy} type="submit" className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D4C3C] px-4 py-3 text-sm font-bold text-[#F5F1E9] shadow-md hover:bg-[#426553] border border-[#1A3326]/30 transition-all disabled:opacity-50">{busy ? "Working…" : mode === "signin" ? "Sign In" : "Create Account"} <ArrowRight size={16} /></button>{message && <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FFF0F0] p-3 text-xs text-[#DF3B32] border border-[#F5A9A9]"><AlertCircle size={14} className="shrink-0" /><p role="status">{message}</p></div>}</>}</form><p className="mt-5 text-xs text-[#827264] flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[#EBE3D0] border border-[#DDD2C0] flex items-center justify-center text-[#5C4D43]"><Check size={10} /></span> Private by default. {isSupabaseConfigured ? "This is your path, no one else's — your data is seen only by you." : "Ready once environment values are added."}</p></div><div className="relative animate-rise [animation-delay:120ms] hidden lg:block"><div className="absolute -inset-12 rounded-full bg-gradient-to-br from-[#8C6D23]/10 to-[#F5F1E9] blur-3xl opacity-60" /><div className="relative rounded-[32px] border border-[#DDD2C0] bg-gradient-to-br from-[#EBE3D0] to-[#F5F1E9] p-6 shadow-2xl md:p-8"><div className="rounded-[24px] border border-[#DDD2C0] bg-white/80 backdrop-blur-sm p-6 md:p-8 shadow-inner relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Cross size={120} strokeWidth={0.5} className="text-[#5C4D43]" /></div><div className="relative z-10"><div className="flex items-center justify-between border-b border-[#DDD2C0] pb-6"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#8C6D23]">A faithful rhythm</p><h2 className="mt-3 font-serif text-2xl font-bold text-[#31231E]">Make room for grace.</h2></div><div className="grid h-12 w-12 place-items-center rounded-full bg-[#EBE3D0] text-[#8C6D23] border border-[#DDD2C0] shadow-sm"><Check size={22} /></div></div><div className="space-y-4 pt-6"><div className="flex items-center gap-4 rounded-2xl bg-[#EBE3D0] p-4 border border-[#DDD2C0] shadow-sm"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2D4C3C] text-[#F5F1E9] shadow-inner"><Check size={16} /></span><div><p className="text-sm font-bold text-[#5C4D43]">Prayer before the phone</p><p className="text-xs text-[#827264] mt-0.5">Daily practice · completed</p></div></div><div className="flex items-center gap-4 rounded-2xl border border-[#DDD2C0] bg-white/30 p-4 shadow-sm"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-[#DDD2C0] bg-white/40" /><div><p className="text-sm font-bold text-[#31231E]">Name the next faithful action</p><p className="text-xs text-[#827264] mt-0.5">Formation Plan · due today</p></div></div></div><div className="mt-8 flex items-center justify-between border-t border-[#DDD2C0] pt-6"><span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#827264]">A life directed toward God</span><span className="text-sm font-bold text-[#5C4D43]">Begin again</span></div></div></div></div></div></main><footer className="flex items-center justify-between border-t border-[#DDD2C0] py-6 text-xs font-medium text-[#827264] relative z-10"><span>Made for ordinary faithfulness.</span><span className="font-mono font-bold tracking-widest text-[#5C4D43]">PH / 01</span></footer></div></div>;
}

function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await supabase?.auth.updateUser({ password });
    if (result?.error) setMessage(result.error.message);
    else onDone();
    setBusy(false);
  };
  return <div className="paper-grain holy-pattern grid min-h-[100dvh] place-items-center bg-[#F5F1E9] px-6 relative"><div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ backgroundImage: `url(${stainedGlassImg})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }} /><div className="absolute inset-0 bg-gradient-to-br from-[#F5F1E9]/95 via-[#F5F1E9]/90 to-[#EBE3D0]/95 pointer-events-none" /><form onSubmit={submit} className="relative z-10 w-full max-w-[420px] rounded-2xl border border-[#DDD2C0] bg-white/70 backdrop-blur-xl p-6 shadow-xl"><Mark /><h1 className="mt-6 font-serif text-2xl font-bold text-[#31231E]">Choose a new password</h1><p className="mt-2 text-sm text-[#5C4D43] leading-relaxed">You are verified. Set a new password to finish resetting your account.</p><div className="mt-6 space-y-3"><input required minLength={6} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="New password" className="w-full rounded-xl border border-[#DDD2C0] bg-white/50 px-3.5 py-3 text-sm text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] transition-all shadow-inner placeholder:text-[#827264]" /><input required minLength={6} type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Confirm new password" className="w-full rounded-xl border border-[#DDD2C0] bg-white/50 px-3.5 py-3 text-sm text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] transition-all shadow-inner placeholder:text-[#827264]" /></div><button disabled={busy} type="submit" className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D4C3C] px-4 py-3 text-sm font-bold text-[#F5F1E9] shadow-md hover:bg-[#426553] border border-[#1A3326]/30 transition-all disabled:opacity-50">{busy ? "Working…" : "Update password"} <ArrowRight size={16} /></button>{message && <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FFF0F0] p-3 text-xs text-[#DF3B32] border border-[#F5A9A9]"><AlertCircle size={14} className="shrink-0" /><p role="status">{message}</p></div>}</form></div>;
}

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("20:00");
  const [channel, setChannel] = useState<"push" | "email">("push");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) { setLoading(false); return; }
      const { data } = await supabase.from("holiness_reminders").select("enabled,channel,time_of_day,timezone").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (data) {
        setEnabled(!!data.enabled);
        setChannel(data.channel === "email" ? "email" : "push");
        setTime(String(data.time_of_day || "20:00").slice(0, 5));
        if (data.timezone) setTimezone(data.timezone);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    if (!supabase) { setStatus({ text: "Supabase is not configured here.", tone: "error" }); setSaving(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus({ text: "You need to be signed in to save this.", tone: "error" }); setSaving(false); return; }

    if (enabled && channel === "push") {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus({ text: "Push notifications are not supported by this browser.", tone: "error" });
        setSaving(false);
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus({ text: "Notification permission was not granted.", tone: "error" });
          setSaving(false);
          return;
        }
        const registration = await navigator.serviceWorker.register("/reminder-sw.js");
        await navigator.serviceWorker.ready;
        // Always resubscribe fresh so an old subscription tied to a previous key can't linger.
        const existing = await registration.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY) });
        const json = subscription.toJSON();
        await supabase.from("holiness_push_subscriptions").upsert(
          { user_id: user.id, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, updated_at: new Date().toISOString() },
          { onConflict: "user_id,endpoint" },
        );
      } catch {
        setStatus({ text: "Could not set up push notifications on this device.", tone: "error" });
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from("holiness_reminders").upsert(
      { user_id: user.id, enabled, channel, time_of_day: `${time}:00`, timezone, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    setStatus(error ? { text: `Could not save: ${error.message}`, tone: "error" } : { text: "Reminder settings saved.", tone: "ok" });
    setSaving(false);
  };

  return <>
    <PageHeader eyebrow="Account" title="Settings" description="Manage your account preferences." />
    {/* Hidden marker: the existing appearance/theme picker (public/theme.js) looks for this
        exact text to mount its panel. Kept so dark mode / color themes keep working. */}
    <div className="rounded-3xl sr-only"><h3>Coming soon</h3></div>

    <section className="rounded-3xl border border-[#DDD2C0] bg-white/70 p-7 shadow-sm md:p-9">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EBE3D0] text-[#8C6D23] text-xl">🔔</div>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Daily rhythm</p>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#31231E]">Daily reminders</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#827264]">Choose whether Project Holiness should remind you to record the practices you completed.</p>
        </div>
      </div>

      {loading ? <p className="mt-7 text-sm text-[#827264]">Loading…</p> : <div className="mt-7 rounded-2xl border border-[#DDD2C0] bg-[#F5F1E9] p-5">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-bold text-[#31231E]">Send me a daily reminder</span>
            <span className="mt-1 block text-xs text-[#827264]">You can turn this off at any time.</span>
          </span>
          <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="h-5 w-5 accent-[#2D4C3C]" />
        </label>

        <div className={`mt-5 grid gap-4 sm:grid-cols-2 transition-opacity ${enabled ? "opacity-100" : "opacity-55 pointer-events-none"}`}>
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">Time of day</span>
            <input type="time" value={time} onChange={event => setTime(event.target.value)} className="w-full rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm text-[#31231E]" />
          </label>
          <label className="block">
            <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">Notification</span>
            <select value={channel} onChange={event => setChannel(event.target.value as "push" | "email")} className="w-full rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm text-[#31231E]">
              <option value="push">Push notification</option>
              <option value="email">Email</option>
            </select>
          </label>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#827264]">
          {channel === "push"
            ? `Push notifications need permission on this device, and will say: "${REMINDER_MESSAGE}"`
            : "Email delivery is not wired up yet in this environment — push notifications work now, email is a future addition."}
        </p>

        <Button onClick={handleSave} disabled={saving} className="mt-5">{saving ? "Saving…" : "Save reminder settings"}</Button>
        {status && <p className={`mt-3 text-xs font-medium ${status.tone === "error" ? "text-[#DF3B32]" : "text-[#2D4C3C]"}`}>{status.text}</p>}
      </div>}
    </section>
  </>;
}

function EmptyState({ title, detail, icon: Icon = Circle, action }: { title: string; detail: string; icon?: any; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#DDD2C0] bg-white/40 py-12 px-6 text-center shadow-sm">
    <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#EBE3D0] text-[#5C4D43]"><Icon size={24} strokeWidth={1.5} /></div>
    <h3 className="font-serif text-lg font-bold text-[#31231E]">{title}</h3>
    <p className="mt-2 text-sm text-[#827264] max-w-sm leading-relaxed">{detail}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>;
}

function DashboardHome({ store }: { store: Store }) {
  const month = today.slice(0, 7);
  const openActions = store.a3.actionItems.filter(action => isOpenAction(action, store.completions));
  const { planned, actual } = completionTotals(openActions, store.completions, month);
  const completion = Math.round((actual / Math.max(planned, 1)) * 100);
  const recentCallings = [...store.callings].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 3);
  const statusTone = (status: CallingStatus): "green" | "gold" | "neutral" | "red" => status === "Completed" ? "green" : status === "Acting" ? "gold" : status === "Praying" ? "neutral" : "red";
  return <><PageHeader eyebrow="Your field notes" title="Welcome back. Keep showing up." description="A clear view of the commitments you are tending, one faithful action at a time." action={<div className="flex items-center gap-2 rounded-xl border border-[#DDD2C0] bg-white/70 px-3 py-2 text-xs font-semibold text-[#5C4D43] shadow-sm"><span className="h-2 w-2 rounded-full bg-[#426553]" /> Private workspace</div>} /><section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#EBE3D0] to-[#F5F1E9] p-7 text-[#31231E] shadow-xl md:p-10 border border-[#DDD2C0]"><div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none"><Cross size={160} strokeWidth={0.5} className="text-[#2D4C3C]" /></div><div className="relative z-10"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Monthly completion</p><h2 className="mt-4 max-w-md font-serif text-3xl font-bold leading-tight">Holiness is built in<br /><span className="text-[#8C6D23] ornament-border pb-1">small, faithful choices.</span></h2></div><div className="rounded-full border border-[#DDD2C0] bg-white/40 p-3.5 text-[#2D4C3C] backdrop-blur-sm"><CheckCircle2 size={24} /></div></div><div className="mt-12 flex items-end justify-between"><div><span className="font-mono text-5xl font-bold text-[#2D4C3C]">{completion}%</span><span className="ml-3 text-sm font-medium text-[#5C4D43]">of planned completions</span></div><span className="font-mono text-xs font-bold text-[#5C4D43] bg-white/50 px-3 py-1.5 rounded-full border border-[#DDD2C0]">{actual} of {planned}</span></div><div className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/5 shadow-inner"><div className="h-full rounded-full bg-gradient-to-r from-[#8C6D23] to-[#D4AF37] relative" style={{ width: `${completion}%` }}><div className="absolute inset-0 bg-white/20" /></div></div></div></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1"><div className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-7 shadow-sm backdrop-blur transition-all hover:bg-white/70"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Active action items</p><div className="mt-5 flex items-end justify-between"><span className="font-serif text-4xl font-bold text-[#2D4C3C]">{openActions.length}</span><Link href="/a3" className="text-sm font-bold text-[#426553] hover:text-[#2D4C3C] flex items-center bg-black/5 px-3 py-1.5 rounded-lg transition-colors">Open plan <ArrowRight size={14} className="ml-1.5" /></Link></div><p className="mt-3 text-sm text-[#827264] leading-relaxed">Practices and faithful actions still open.</p></div><div className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-7 shadow-sm backdrop-blur transition-all hover:bg-white/70"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Practices</p><div className="mt-5 flex items-end justify-between"><span className="font-serif text-4xl font-bold text-[#2D4C3C]">{completion}%</span><Link href="/leader-standard-work" className="text-sm font-bold text-[#426553] hover:text-[#2D4C3C] flex items-center bg-black/5 px-3 py-1.5 rounded-lg transition-colors">Open grid <ArrowRight size={14} className="ml-1.5" /></Link></div><p className="mt-3 text-sm text-[#827264] leading-relaxed">{actual} actual completions this month.</p></div></div></section><section className="mt-10 grid gap-5 lg:grid-cols-[1fr_360px]"><div className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-7 md:p-9 shadow-sm backdrop-blur"><div className="flex items-end justify-between border-b border-[#DDD2C0] pb-5"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Recent Calling Log</p><h2 className="mt-3 font-serif text-2xl font-bold text-[#2D4C3C]">Threads worth returning to</h2></div><Link href="/calling-log" className="text-sm font-bold text-[#426553] hover:text-[#2D4C3C] flex items-center bg-black/5 px-3 py-1.5 rounded-lg transition-colors">View all <ArrowRight size={14} className="ml-1.5" /></Link></div><div className="mt-6 space-y-4">{recentCallings.length === 0 ? <EmptyState title="Your log is open." detail="Keep the first thread that feels worth returning to." icon={Bookmark} /> : recentCallings.map(entry => <Link key={entry.id} href="/calling-log" className="block rounded-2xl border border-[#DDD2C0] bg-[#F5F1E9] p-5 hover:border-[#8C6D23] hover:shadow-md transition-all group"><div className="flex items-start justify-between gap-4"><div><h3 className="font-serif text-lg font-bold text-[#2D4C3C] group-hover:text-[#426553] transition-colors">{entry.title}</h3><p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#5C4D43]">{entry.description}</p></div><Pill tone={statusTone(entry.status)}>{entry.status}</Pill></div><p className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-[#827264]"><CalendarDays size={14} /> Added {shortDate(entry.dateAdded)}</p></Link>)}</div></div><div className="rounded-3xl border border-[#DDD2C0] bg-gradient-to-br from-[#EBE3D0] to-[#F5F1E9] p-7 md:p-9 shadow-sm"><div className="flex items-center gap-2.5 text-[#8C6D23]"><Target size={18} strokeWidth={2.5} /><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em]">This month's intention</p></div><p className="mt-6 font-serif text-2xl font-bold leading-9 text-[#31231E] italic">“Conform my will to His.”</p><p className="mt-5 text-sm leading-relaxed text-[#5C4D43]">Practices is generated from the active actions in your Formation Plan. Make sure to keep them up to date.</p><Link href="/a3" className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#2D4C3C] border border-[#DDD2C0] shadow-sm hover:bg-[#F5F1E9] transition-colors">Open your plan <ArrowRight size={16} /></Link></div></section></>;
}

function GuidePage() {
  const a3Groups = [
    {
      section: "I. Foundation",
      steps: [
        { label: "Project Statement", detail: "The call you are answering" },
        { label: "Life Rationale", detail: "Why this matters" },
      ],
    },
    {
      section: "II. Assessment & Strategy",
      steps: [
        { label: "Problem", detail: "The gap in your current life" },
        { label: "Root Cause", detail: "What is driving the gap" },
        { label: "Countermeasures", detail: "How you will address the cause" },
      ],
    },
    {
      section: "III. Execution",
      steps: [
        { label: "Action Items", detail: "Specific practices and commitments" },
        { label: "Practices", detail: "The rhythm you track over time" },
      ],
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Formation Guide"
        title="The Project Holiness Method"
        description="Background, why, and how to use this website. Read this to orient your practice."
      />
      <div className="w-full space-y-12">
                <section className="ph-guide-intro rounded-3xl border border-[#CDBD9D] bg-gradient-to-br from-[#EBE3D0] via-[#F5F1E9] to-white/70 p-6 shadow-md md:p-10">
          <div className="space-y-7">
            <div className="ph-guide-intro-item">
              <p className="ph-guide-kicker">Background</p>
              <h2 className="ph-guide-title">One page, one plan</h2>
              <p className="ph-guide-copy">
                This site borrows a simple method engineers use called an A3: one page, one plan, one problem at a time. Your <strong>Formation Plan</strong> works the same way.
              </p>
            </div>
            <div className="ph-guide-intro-item">
              <p className="ph-guide-kicker">Why</p>
              <h2 className="ph-guide-title">A place to grow in holiness</h2>
              <p className="ph-guide-copy">
                See where you fall short. Come up with real ways to change. Turn them into action items you can actually track on your <strong>Practices</strong> page.
              </p>
            </div>
            <div className="ph-guide-intro-item">
              <p className="ph-guide-kicker">How</p>
              <h2 className="ph-guide-title">Three simple steps</h2>
              <ul className="ph-guide-how-list">
                <li><span>I. Foundation</span><p>Why this matters — the same for everyone.</p></li>
                <li><span>II. Assessment & Strategy</span><p>Name your problems and plan your response.</p></li>
                <li><span>III. Execution</span><p>Turn your plan into daily action.</p></li>
              </ul>
              <p className="mt-4 text-xs font-medium text-[#827264]">See below for a breakdown of these steps.</p>
            </div>
          </div>
        </section>

                <section className="ph-guide-overview rounded-3xl border border-[#DDD2C0] bg-white/40 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="ph-guide-overview-heading">
            <div>
              <p className="ph-guide-overview-label font-mono font-bold uppercase tracking-[.2em]">At a glance</p>
              <p className="ph-guide-overview-subtitle">The seven-part path from your calling to the practices you live.</p>
            </div>
          </div>

          <div className="ph-guide-stage-grid" aria-label="Formation Plan overview">
            {a3Groups.map((group, groupIndex) => {
              const stepsBefore = a3Groups.slice(0, groupIndex).reduce((sum, g) => sum + g.steps.length, 0);
              return (
                <article key={group.section} className="ph-guide-stage">
                  <header className="ph-guide-stage-header">
                    <span className="ph-guide-stage-number">{group.section}</span>
                  </header>
                  <ol className="ph-guide-stage-list">
                    {group.steps.map((step, stepIndex) => (
                      <li key={step.label} className="ph-guide-stage-item">
                        <span className="ph-guide-stage-step-number">Step {stepsBefore + stepIndex + 1}</span>
                        <div className="ph-guide-stage-content">
                          <h3>{step.label}</h3>
                          <p>{step.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-8 md:p-10 shadow-sm backdrop-blur relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Compass size={120} strokeWidth={0.5} className="text-[#2D4C3C]" />
          </div>
          <div className="relative z-10">
            <h2 className="font-serif text-2xl font-bold text-[#31231E] mb-4">I. Foundation</h2>
            <p className="text-[#5C4D43] leading-relaxed">
              You're called to be holy — plain and simple. This part is fixed, because it's true for everyone. If you're married, that includes helping your spouse and kids grow in holiness too.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-8 md:p-10 shadow-sm backdrop-blur">
          <h2 className="font-serif text-2xl font-bold text-[#31231E] mb-4">II. Assessment & Strategy</h2>
          <p className="text-[#5C4D43] leading-relaxed mb-6">
            Be honest with yourself. What's the <strong>problem</strong>? Why does it keep happening (the <strong>root cause</strong>)? What will you actually do about it (a <strong>countermeasure</strong>)?
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-[#F5F1E9] border border-[#DDD2C0] p-6">
              <h3 className="font-bold text-[#2D4C3C] mb-3 text-sm flex items-center gap-2"><AlertCircle size={16}/> Example: Problem & Root Cause</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#8C6D23] mb-1">The Problem</p>
                  <p className="text-sm text-[#5C4D43] leading-relaxed">I scroll my phone for hours every evening instead of praying or being with my family.</p>
                </div>
                <div>
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#8C6D23] mb-1">The Root Cause</p>
                  <p className="text-sm text-[#5C4D43] leading-relaxed">I'm exhausted by evening, so I reach for numbing comfort instead of rest — and my phone is always within reach.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-[#F5F1E9] border border-[#DDD2C0] p-6">
              <h3 className="font-bold text-[#2D4C3C] mb-3 text-sm flex items-center gap-2"><Target size={16}/> Example Countermeasures</h3>
              <ul className="list-disc list-inside text-sm text-[#5C4D43] leading-relaxed space-y-2 ml-2">
                <li>No phones after 8 PM.</li>
                <li>Charge it in the kitchen, not the bedroom.</li>
                <li>Keep a good book on the nightstand instead.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-8 md:p-10 shadow-sm backdrop-blur">
          <h2 className="font-serif text-2xl font-bold text-[#31231E] mb-4">III. Execution</h2>
          <p className="text-[#5C4D43] leading-relaxed mb-6">
            Turn each countermeasure into a real action, daily, weekly, monthly, one time, or other, and it shows up in your <strong>Practices</strong> tab. Recurring actions read <strong>In practice</strong>. One-time and other actions start <strong>Open</strong>, then become <strong>Complete</strong> or <strong>Missed</strong> once you check them off there.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#F5F1E9] border border-[#DDD2C0] p-5">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#8C6D23] mb-2">Example: One-time Action</p>
              <p className="text-sm text-[#5C4D43] font-medium mb-2">Buy an alarm clock for the bedroom.</p>
              <p className="text-xs text-[#827264]">Starts as <strong>Open</strong>, until you mark it Complete or Missed in Practices.</p>
            </div>
            <div className="rounded-2xl bg-[#F5F1E9] border border-[#DDD2C0] p-5">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#8C6D23] mb-2">Example: Daily Action</p>
              <p className="text-sm text-[#5C4D43] font-medium mb-2">Plug phone into kitchen charger at 8 PM.</p>
              <p className="text-xs text-[#827264]">Shows as <strong>In practice</strong> — check it off each day in Practices.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-gradient-to-br from-[#2D4C3C] to-[#1A3326] p-8 md:p-10 shadow-xl text-[#F5F1E9]">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#D4AF37]">An ongoing project</p>
          <p className="leading-relaxed text-[#D2E0D9]">
            Keep reassessing as time goes on. Add new actions, drop what isn't working, and stay accountable with <Link href="/leader-standard-work" className="font-bold text-[#D4AF37] underline decoration-[#D4AF37]/50 underline-offset-2 hover:text-[#F0D56A]">Practices</Link>. Little by little, you'll close the gap to holiness.
          </p>
        </section>

        <section className="rounded-3xl border border-[#DDD2C0] bg-[#EBE3D0] p-8 md:p-10 shadow-xl text-[#31231E] relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <BookOpen size={120} strokeWidth={0.5} className="text-[#2D4C3C]" />
          </div>
          <div className="relative z-10">
            <h2 className="font-serif text-2xl font-bold mb-4 text-[#8C6D23]">Also on this site: The Calling Log</h2>
            <p className="text-[#5C4D43] leading-relaxed">
              A separate space for nudges you sense from God: a vocation, a change, a prompt to pray about something. Write it down, then track it from <strong>Captured</strong> to <strong>Praying</strong>, and on to <strong>Confirmed</strong>, <strong>Acting</strong>, or <strong>Completed</strong> — so it isn't lost in the noise of daily life.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function TextBlock({ label, value, onChange, fixed = false, hint }: { label: string; value: string; onChange?: (value: string) => void; fixed?: boolean; hint?: string }) {
  return <div><div className="mb-2.5 flex items-center justify-between"><label className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#8C6D23]">{label}</label>{fixed && <span className="text-[10px] font-medium text-[#827264]">fixed statement</span>}</div>{fixed ? <div className="whitespace-pre-line rounded-2xl border border-[#DDD2C0] bg-[#F5F1E9] px-5 py-4 text-sm leading-relaxed text-[#5C4D43] shadow-inner">{value}</div> : <textarea value={value} onChange={event => onChange?.(event.target.value)} className="min-h-[128px] w-full resize-y rounded-2xl border border-[#DDD2C0] bg-white px-5 py-4 text-sm leading-relaxed text-[#31231E] outline-none placeholder:text-[#827264] focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] shadow-sm transition-all" placeholder={hint} />}</div>;
}

function Field({ label, value, onChange, type = "text", placeholder, area = false, testId }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; area?: boolean; testId?: string }) {
  return <div><label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">{label}</label>{area ? <textarea data-testid={testId} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="min-h-[100px] w-full resize-y rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] shadow-sm transition-all" /> : <input data-testid={testId} type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] shadow-sm transition-all" />}</div>;
}

function ActionForm({ value, onChange, onSubmit, onCancel, editing }: { value: Omit<ActionItem, "id">; onChange: Dispatch<SetStateAction<Omit<ActionItem, "id">>>; onSubmit: (event: FormEvent) => void; onCancel: () => void; editing: boolean }) {
  const update = (key: keyof Omit<ActionItem, "id">, next: string | boolean) => onChange(current => ({ ...current, [key]: next }));
  return <form onSubmit={onSubmit} className="mt-5 rounded-3xl border border-[#DDD2C0] bg-gradient-to-br from-[#EBE3D0] to-[#F5F1E9] p-6 md:p-8 shadow-md"><div className="grid gap-5 md:grid-cols-2"><Field label="Title" value={value.title} onChange={next => update("title", next)} placeholder="Name the faithful action" testId="input-action-title" /><Field label="Start date" type="date" value={value.startDate} onChange={next => update("startDate", next)} testId="input-action-start-date" /><div className="md:col-span-2"><Field label="Description or notes" value={value.description} onChange={next => update("description", next)} area placeholder="What will this practice look like?" testId="textarea-action-description" /></div><div><label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">Frequency</label><select value={value.frequency} onChange={event => update("frequency", event.target.value)} className="w-full rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm font-medium text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] shadow-sm transition-all"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="one-time">One time</option><option value="other">Other</option></select></div><Field label="Due date (optional)" type="date" value={value.dueDate} onChange={next => update("dueDate", next)} testId="input-action-due-date" /><Field label="End date (optional)" type="date" value={value.endDate} onChange={next => update("endDate", next)} testId="input-action-end-date" /><div className="md:col-span-2 pt-2"><label className="flex items-center gap-3 rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm font-bold text-[#31231E] shadow-sm cursor-pointer hover:bg-black/5 transition-colors"><input type="checkbox" checked={value.active} onChange={event => update("active", event.target.checked)} className="h-4 w-4 rounded border-[#DDD2C0] text-[#2D4C3C] focus:ring-[#2D4C3C]" /> Active action (appears in Practices)</label></div></div><div className="mt-8 flex justify-end gap-3"><Button variant="quiet" onClick={onCancel}>Cancel</Button><Button type="submit">{editing ? "Save action" : "Add action"}</Button></div></form>;
}

function A3Page({ store, setStore }: { store: Store; setStore: Dispatch<SetStateAction<Store>> }) {
  const [showActionForm, setShowActionForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionDraft, setActionDraft] = useState<Omit<ActionItem, "id">>(blankAction());
  const [openFrequencyGroups, setOpenFrequencyGroups] = useState<Partial<Record<Frequency, boolean>>>({});

  const [showProblemForm, setShowProblemForm] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [problemDraft, setProblemDraft] = useState<Omit<HolinessProblem, "id">>(blankProblem());

  const [editingCmId, setEditingCmId] = useState<string | null>(null);
  const [cmProblemId, setCmProblemId] = useState<string | null>(null);
  const [cmDraft, setCmDraft] = useState<Omit<Countermeasure, "id">>(blankCountermeasure(""));

  const openAddAction = () => { setEditingId(null); setActionDraft(blankAction()); setShowActionForm(true); };
  const openEditAction = (action: ActionItem) => { setEditingId(action.id); setActionDraft({ ...action }); setShowActionForm(true); };

  const saveAction = (event: FormEvent) => {
    event.preventDefault();
    if (!actionDraft.title.trim()) return;
    setStore(current => ({ ...current, a3: { ...current.a3, actionItems: editingId ? current.a3.actionItems.map(item => item.id === editingId ? { ...actionDraft, id: editingId, title: actionDraft.title.trim() } : item) : [...current.a3.actionItems, { ...actionDraft, id: `action-${Date.now()}`, title: actionDraft.title.trim() }] } }));
    setShowActionForm(false);
  };

  const removeAction = (id: string) => setStore(current => ({ ...current, a3: { ...current.a3, actionItems: current.a3.actionItems.filter(item => item.id !== id) }, completions: current.completions.filter(item => item.actionItemId !== id) }));
  const hasHistory = (id: string) => store.completions.some(completion => completion.actionItemId === id);

  const openAddProblem = () => { setEditingProblemId(null); setProblemDraft(blankProblem()); setShowProblemForm(true); };
  const openEditProblem = (problem: HolinessProblem) => { setEditingProblemId(problem.id); setProblemDraft({ ...problem }); setShowProblemForm(true); };
  const saveProblem = (event: FormEvent) => {
    event.preventDefault();
    if (!problemDraft.problem.trim()) return;
    setStore(current => {
      const isNew = editingProblemId === null;
      const newId = isNew ? `prob-${Date.now()}` : editingProblemId;
      const problems = isNew
        ? [...current.a3.problems, { ...problemDraft, id: newId }]
        : current.a3.problems.map(p => p.id === editingProblemId ? { ...problemDraft, id: editingProblemId } : p);
      return { ...current, a3: { ...current.a3, problems } };
    });
    setEditingProblemId(null);
    setShowProblemForm(false);
  };
  const removeProblem = (id: string) => {
    setStore(current => ({
      ...current,
      a3: {
        ...current.a3,
        problems: current.a3.problems.filter(p => p.id !== id),
        countermeasures: current.a3.countermeasures.filter(c => c.problemId !== id)
      }
    }));
  };

  const openAddCm = (problemId: string) => { setEditingCmId(null); setCmProblemId(problemId); setCmDraft(blankCountermeasure(problemId)); };
  const openEditCm = (cm: Countermeasure) => { setEditingCmId(cm.id); setCmProblemId(cm.problemId); setCmDraft({ ...cm }); };
  const saveCm = (event: FormEvent) => {
    event.preventDefault();
    if (!cmDraft.description.trim() || !cmProblemId) return;
    setStore(current => {
      const isNew = editingCmId === null;
      const newId = isNew ? `cm-${Date.now()}` : editingCmId;
      const countermeasures = isNew
        ? [...current.a3.countermeasures, { ...cmDraft, id: newId, problemId: cmProblemId }]
        : current.a3.countermeasures.map(c => c.id === editingCmId ? { ...cmDraft, id: editingCmId, problemId: cmProblemId } : c);
      return { ...current, a3: { ...current.a3, countermeasures } };
    });
    setEditingCmId(null);
    setCmProblemId(null);
  };
  const removeCm = (id: string) => {
    setStore(current => ({ ...current, a3: { ...current.a3, countermeasures: current.a3.countermeasures.filter(c => c.id !== id) } }));
  };

  return <>
    <PageHeader eyebrow="Plan" title="Formation Plan" description="The overarching plan for your spiritual life. Grounded in the universal call, tailored to your particular struggles and resolutions." />

    <div className="space-y-8">
      <section className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-7 md:p-9 shadow-sm backdrop-blur">
        <div className="mb-6 flex items-center justify-between border-b border-[#DDD2C0] pb-4">
          <h2 className="font-serif text-2xl font-bold text-[#31231E]">I. Foundation</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <TextBlock label="Project Statement" fixed value={store.a3.projectStatement} />
          <TextBlock label="Life Rationale" fixed value={store.a3.lifeRationale} />
        </div>
      </section>

      <section className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-7 md:p-9 shadow-sm backdrop-blur">
        <div className="mb-6 flex items-center justify-between border-b border-[#DDD2C0] pb-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#31231E]">II. Assessment & Strategy</h2>
            <p className="mt-1 text-sm text-[#827264]">Identify the gap, root causes, and countermeasures to close it.</p>
          </div>
          <Button variant="outline" onClick={openAddProblem}><Plus size={15} /> Add Problem</Button>
        </div>

        {showProblemForm ? (
          <form onSubmit={saveProblem} className="mb-8 rounded-2xl border border-[#DDD2C0] bg-[#F5F1E9] p-6 shadow-sm">
            <h3 className="font-serif font-bold text-[#31231E] mb-4 text-lg">{editingProblemId ? "Edit Problem" : "New Problem"}</h3>
            <div className="space-y-4">
              <Field label="The Problem (The Gap)" value={problemDraft.problem} onChange={val => setProblemDraft(p => ({ ...p, problem: val }))} area placeholder="What is the reality of your current struggle?" />
              <Field label="Root Cause" value={problemDraft.rootCause} onChange={val => setProblemDraft(p => ({ ...p, rootCause: val }))} area placeholder="Why is this happening? Look beneath the surface." />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="quiet" onClick={() => { setEditingProblemId(null); setShowProblemForm(false); }}>Cancel</Button>
              <Button type="submit">Save Problem</Button>
            </div>
          </form>
        ) : null}

        <div className="space-y-8">
          {store.a3.problems.length === 0 && !showProblemForm ? (
            <EmptyState title="No problems identified yet." detail="Honest assessment is the first step toward growth. Define a problem to begin." action={<Button onClick={openAddProblem}>Add Problem</Button>} />
          ) : (
            store.a3.problems.map(problem => (
              <div key={problem.id} className="rounded-2xl border border-[#DDD2C0] bg-white shadow-sm overflow-hidden">
                <div className="bg-[#F5F1E9] p-5 border-b border-[#DDD2C0]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8C6D23] mb-1">Problem</p>
                        <p className="text-[15px] font-medium text-[#31231E] leading-relaxed">{problem.problem}</p>
                      </div>
                      <div className="pl-4 border-l-2 border-[#DDD2C0]">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8C6D23] mb-1">Root Cause</p>
                        <p className="text-[14px] text-[#5C4D43] leading-relaxed">{problem.rootCause}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditProblem(problem)} className="p-1.5 text-[#827264] hover:text-[#31231E] rounded-md hover:bg-black/5"><Pencil size={15} /></button>
                      <button onClick={() => { if (confirm("Remove this problem and all its countermeasures?")) removeProblem(problem.id); }} className="p-1.5 text-[#827264] hover:text-[#DF3B32] rounded-md hover:bg-[#FFF0F0]"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-[#827264] uppercase tracking-widest font-mono">Countermeasures</p>
                    {cmProblemId !== problem.id && <button onClick={() => openAddCm(problem.id)} className="text-xs font-bold text-[#2D4C3C] hover:text-[#426553] flex items-center gap-1"><Plus size={13}/> Add</button>}
                  </div>

                  {cmProblemId === problem.id && (
                    <form onSubmit={saveCm} className="mb-4 rounded-xl border border-[#DDD2C0] bg-[#F5F1E9] p-4 shadow-sm">
                      <Field label="Countermeasure" value={cmDraft.description} onChange={val => setCmDraft(c => ({ ...c, description: val }))} placeholder="How will you attack the root cause?" />
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="quiet" onClick={() => setCmProblemId(null)}>Cancel</Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </form>
                  )}

                  <ul className="space-y-2">
                    {store.a3.countermeasures.filter(c => c.problemId === problem.id).length === 0 ? (
                      <li className="text-sm text-[#827264] italic">No countermeasures yet.</li>
                    ) : (
                      store.a3.countermeasures.filter(c => c.problemId === problem.id).map(cm => (
                        <li key={cm.id} className="flex items-start gap-3 group">
                          <span className="mt-1 text-[#8C6D23]"><Target size={14} /></span>
                          <span className="text-sm text-[#5C4D43] leading-relaxed flex-1">{cm.description}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditCm(cm)} className="p-1 text-[#827264] hover:text-[#31231E]"><Pencil size={13} /></button>
                            <button onClick={() => removeCm(cm.id)} className="p-1 text-[#827264] hover:text-[#DF3B32]"><Trash2 size={13} /></button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[#DDD2C0] bg-white/40 p-7 md:p-9 shadow-sm backdrop-blur">
        <div className="mb-6 flex items-center justify-between border-b border-[#DDD2C0] pb-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#31231E]">III. Execution</h2>
            <p className="mt-1 text-sm text-[#827264]">Specific actions to implement the countermeasures. Active recurring items form your Practices.</p>
          </div>
          {!showActionForm && <Button onClick={openAddAction}><Plus size={15} /> Add Action</Button>}
        </div>
        {showActionForm && <ActionForm value={actionDraft} onChange={setActionDraft} onSubmit={saveAction} onCancel={() => setShowActionForm(false)} editing={!!editingId} />}
        {!showActionForm && store.a3.actionItems.length === 0 && <div className="mt-6"><EmptyState title="No action items yet." detail="Translate your countermeasures into specific, scheduled practices." action={<Button onClick={openAddAction}>Add Action</Button>} /></div>}
        {!showActionForm && store.a3.actionItems.length > 0 && (
          <div className="mt-6 space-y-3">
            {(["daily", "weekly", "monthly", "one-time", "other"] as Frequency[]).map(frequency => {
              const items = store.a3.actionItems.filter(action => action.frequency === frequency);
              if (items.length === 0) return null;
              const isOpen = openFrequencyGroups[frequency] ?? false;
              return (
                <div key={frequency} className="rounded-2xl border border-[#DDD2C0] bg-white/60 overflow-hidden">
                  <button
                    onClick={() => setOpenFrequencyGroups(current => ({ ...current, [frequency]: !isOpen }))}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-black/5"
                  >
                    <span className="flex items-center gap-2.5">
                      <History size={15} className="text-[#8C6D23]" />
                      <span className="font-serif text-base font-bold text-[#31231E]">{frequencyLabels[frequency]}</span>
                      <span className="rounded-full bg-[#EBE3D0] px-2 py-0.5 font-mono text-[10px] font-bold text-[#8C6D23]">{items.length}</span>
                    </span>
                    <ChevronDown size={18} className={`shrink-0 text-[#827264] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <div className="grid gap-4 border-t border-[#DDD2C0] p-5 md:grid-cols-2 lg:grid-cols-3">{items.map(action => <div key={action.id} className={`flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${action.active ? "border-[#DDD2C0] bg-white" : "border-[#EBE3D0] bg-[#F5F1E9] opacity-75"}`}><div className="mb-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h3 className={`font-serif text-[17px] font-bold leading-snug ${action.active ? "text-[#2D4C3C]" : "text-[#827264]"}`}>{action.title}</h3>
                      {!action.active && <span className="shrink-0 rounded bg-[#DDD2C0] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#827264]">Inactive</span>}
                    </div>
                    {action.description && <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-[#827264]">{action.description}</p>}
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-2 text-[11px] font-medium text-[#5C4D43]"><CalendarDays size={13} className="text-[#8C6D23]" /> Starts {shortDate(action.startDate)}</p>
                      <p className="flex items-center gap-2 text-[11px] font-medium text-[#5C4D43]"><History size={13} className="text-[#8C6D23]" /> {frequencyLabels[action.frequency]}</p>
                    </div>
                  </div><div className="flex items-center justify-between border-t border-[#EBE3D0] pt-4"><div className="flex items-center gap-1.5 flex-wrap">{(() => { const derived = derivedActionStatus(action, store.completions); return <Pill tone={derived.tone}>{derived.label}</Pill>; })()}{isRecurring(action) && (() => { const pct = actionMonthCompletion(action, store.completions, today.slice(0, 7)); return pct === null ? null : <span className="rounded-full bg-[#EBE3D0] border border-[#DDD2C0] px-2 py-0.5 font-mono text-[10px] font-bold text-[#8C6D23]">{pct}% this month</span>; })()}</div><div className="flex gap-1.5"><button onClick={() => openEditAction(action)} className="rounded-lg p-2 text-[#827264] hover:bg-black/5 hover:text-[#31231E] transition-colors"><Pencil size={15} /></button><button onClick={() => { if (!hasHistory(action.id) || confirm("This action has completion history. Deleting it will remove that history. Continue?")) removeAction(action.id); }} className="rounded-lg p-2 text-[#827264] hover:bg-[#FFF0F0] hover:text-[#DF3B32] transition-colors"><Trash2 size={15} /></button></div></div></div>)}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  </>;
}

function StandardWorkPage({ store, setStore }: { store: Store; setStore: Dispatch<SetStateAction<Store>> }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const pendingScrollLeft = useRef<number | null>(null);
  const dates = monthDates(month);
  const weekGroups = monthWeekGroups(dates);
  const orderActions = (items: ActionItem[]) => [...items].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
  const actions = orderActions(store.a3.actionItems.filter(item => item.active && isRecurring(item)));
  const oneTimeActions = store.a3.actionItems.filter(item => item.active && item.frequency === "one-time");
  const otherActions = store.a3.actionItems.filter(item => item.active && item.frequency === "other");
  const { planned, actual } = completionTotals(actions, store.completions, month);
  const completion = Math.round((actual / Math.max(planned, 1)) * 100);

  useLayoutEffect(() => {
    const left = pendingScrollLeft.current;
    if (left === null) return;
    pendingScrollLeft.current = null;
    if (calendarRef.current) calendarRef.current.scrollLeft = left;
    const frame = requestAnimationFrame(() => {
      if (calendarRef.current) calendarRef.current.scrollLeft = left;
    });
    return () => cancelAnimationFrame(frame);
  }, [store.completions]);

  const rememberCalendarScroll = () => {
    pendingScrollLeft.current = calendarRef.current?.scrollLeft ?? pendingScrollLeft.current ?? 0;
  };

  const toggleCalendarCompletion = (action: ActionItem, period: string) => {
    rememberCalendarScroll();
    cycleCompletion(setStore, action, period);
  };

  const reorderWithinFrequency = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setStore(current => {
      const source = current.a3.actionItems.find(item => item.id === sourceId);
      const target = current.a3.actionItems.find(item => item.id === targetId);
      if (!source || !target || source.frequency !== target.frequency) return current;
      const bucket = orderActions(current.a3.actionItems.filter(item => item.frequency === source.frequency));
      const from = bucket.findIndex(item => item.id === sourceId);
      const to = bucket.findIndex(item => item.id === targetId);
      const [moved] = bucket.splice(from, 1);
      bucket.splice(to, 0, moved);
      const positions = new Map(bucket.map((item, index) => [item.id, index]));
      return {
        ...current,
        a3: {
          ...current.a3,
          actionItems: current.a3.actionItems.map(item =>
            item.frequency === source.frequency ? { ...item, sortOrder: positions.get(item.id) ?? item.sortOrder } : item
          ),
        },
      };
    });
  };

  const moveAction = (action: ActionItem, direction: -1 | 1) => {
    const visibleBucket = orderActions(store.a3.actionItems.filter(item => item.active && item.frequency === action.frequency));
    const index = visibleBucket.findIndex(item => item.id === action.id);
    const target = visibleBucket[index + direction];
    if (target) reorderWithinFrequency(action.id, target.id);
  };

  const dragProps = (action: ActionItem) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLTableRowElement>) => {
      setDraggedId(action.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", action.id);
    },
    onDragOver: (event: DragEvent<HTMLTableRowElement>) => {
      if (draggedId && draggedId !== action.id) event.preventDefault();
    },
    onDrop: (event: DragEvent<HTMLTableRowElement>) => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
      if (sourceId) reorderWithinFrequency(sourceId, action.id);
      setDraggedId(null);
    },
    onDragEnd: () => setDraggedId(null),
  });

  const practiceCell = (action: ActionItem) => (
    <td className="w-[240px] min-w-[240px] px-4 py-3 font-medium text-[#31231E]">
      <div className="flex items-center gap-2">
        <GripVertical size={16} className="shrink-0 cursor-grab text-[#A79682]" aria-hidden="true" />
        <span className="min-w-0 flex-1">{action.title}</span>
        <div className="flex shrink-0 md:hidden">
          <button type="button" onClick={() => moveAction(action, -1)} className="rounded-md p-1 text-[#827264] hover:bg-black/5 hover:text-[#31231E]" aria-label={`Move ${action.title} up`}><ChevronUp size={15} /></button>
          <button type="button" onClick={() => moveAction(action, 1)} className="rounded-md p-1 text-[#827264] hover:bg-black/5 hover:text-[#31231E]" aria-label={`Move ${action.title} down`}><ChevronDown size={15} /></button>
        </div>
      </div>
    </td>
  );

  const oneOffSection = (title: string, frequency: "one-time" | "other", items: ActionItem[]) => {
    const sorted = orderActions(items).sort((a, b) => Number(hasAnyCompletion(a, store.completions)) - Number(hasAnyCompletion(b, store.completions)));
    return (
      <section className="rounded-3xl border border-[#DDD2C0] bg-white/70 p-6 shadow-sm md:p-8">
        <div className="mb-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">{frequency === "one-time" ? "Single commitments" : "Flexible commitments"}</p>
          <h2 className="mt-2 font-serif text-2xl font-bold text-[#31231E]">{title}</h2>
        </div>
        {sorted.length === 0 ? <p className="rounded-2xl border border-dashed border-[#DDD2C0] bg-[#F5F1E9] px-5 py-6 text-sm text-[#827264]">No active {title.toLowerCase()}.</p> : (
          <div className="space-y-2">
            {sorted.map(action => {
              const period = action.dueDate || action.startDate || today;
              const status = completionFor(store.completions, action.id, period);
              return (
                <div
                  key={action.id}
                  draggable
                  onDragStart={event => { setDraggedId(action.id); event.dataTransfer.setData("text/plain", action.id); }}
                  onDragOver={event => { if (draggedId && draggedId !== action.id) event.preventDefault(); }}
                  onDrop={event => { event.preventDefault(); reorderWithinFrequency(event.dataTransfer.getData("text/plain") || draggedId || "", action.id); setDraggedId(null); }}
                  onDragEnd={() => setDraggedId(null)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${draggedId === action.id ? "border-[#8C6D23] bg-[#EBE3D0] opacity-60" : "border-[#DDD2C0] bg-[#F5F1E9]"}`}
                >
                  <GripVertical size={17} className="shrink-0 cursor-grab text-[#A79682]" />
                  <button
                    onClick={() => cycleCompletion(setStore, action, period)}
                    aria-label={`${status === "completed" ? "Mark as missed" : status === "missed" ? "Mark as canceled" : status === "canceled" ? "Clear status for" : "Mark complete"} ${action.title}`}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-all check-pop ${status === "completed" ? "border-[#2D4C3C] bg-[#2D4C3C] text-[#F5F1E9]" : status === "missed" ? "border-[#DF3B32] bg-[#DF3B32] text-[#FFF0F0]" : status === "canceled" ? "border-[#31231E] bg-[#31231E] text-[#F5F1E9]" : "border-[#CDBD9D] bg-white text-transparent hover:border-[#827264]"}`}
                  >
                    {status === "missed" ? <X size={14} strokeWidth={3} /> : status === "canceled" ? <Ban size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium text-[#31231E] ${status === "completed" ? "line-through opacity-55" : ""} ${status === "canceled" ? "opacity-55" : ""}`}>{action.title}</p>
                    {(action.dueDate || action.description) && <p className="mt-1 text-xs text-[#827264]">{action.dueDate ? `Due ${shortDate(action.dueDate)}` : action.description}</p>}
                  </div>
                  <div className="flex shrink-0 md:hidden">
                    <button type="button" onClick={() => moveAction(action, -1)} className="rounded-md p-1 text-[#827264] hover:bg-black/5 hover:text-[#31231E]" aria-label={`Move ${action.title} up`}><ChevronUp size={16} /></button>
                    <button type="button" onClick={() => moveAction(action, 1)} className="rounded-md p-1 text-[#827264] hover:bg-black/5 hover:text-[#31231E]" aria-label={`Move ${action.title} down`}><ChevronDown size={16} /></button>
                  </div>
                  {status === "completed" && <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#426553]">Completed</span>}
                  {status === "missed" && <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#DF3B32]">Missed</span>}
                  {status === "canceled" && <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#827264]">Canceled</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return <>
    <PageHeader eyebrow="Practices" title="The daily field." description="A generated view of your commitments based on your Formation Plan." action={<div className="flex items-center justify-between gap-4 rounded-xl border border-[#DDD2C0] bg-white/70 p-1.5 shadow-sm"><Button variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></Button><span className="min-w-[120px] text-center font-mono text-[11px] font-bold uppercase tracking-widest text-[#5C4D43]">{monthLabel(month)}</span><Button variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></Button></div>} />
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-[#DDD2C0] bg-white/60 px-4 py-3 text-xs text-[#5C4D43] backdrop-blur">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8C6D23]">How to mark a practice</span>
      <span className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-md border border-[#DDD2C0] bg-[#F5F1E9]" /> Not marked (default)</span>
      <ArrowRight size={12} className="text-[#827264]" />
      <span className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-md border border-[#2D4C3C] bg-[#2D4C3C] text-[#F5F1E9]"><Check size={12} strokeWidth={3} /></span> Done</span>
      <ArrowRight size={12} className="text-[#827264]" />
      <span className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-md border border-[#DF3B32] bg-[#DF3B32] text-[#FFF0F0]"><X size={12} strokeWidth={3} /></span> Missed</span>
      <ArrowRight size={12} className="text-[#827264]" />
      <span className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-md border border-[#31231E] bg-[#31231E] text-[#F5F1E9]"><Ban size={12} strokeWidth={3} /></span> Canceled — doesn't count for or against you</span>
      <ArrowRight size={12} className="text-[#827264]" />
      <span>back to not marked</span>
    </div>
    <div className="mb-6 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2"><span className="font-serif text-3xl font-bold text-[#31231E]">{completion}%</span><span className="text-xs font-medium text-[#827264]">completion</span></div>
      <div className="flex items-center gap-2"><span className="font-serif text-3xl font-bold text-[#31231E]">{planned}</span><span className="text-xs font-medium text-[#827264]">planned events</span></div>
      <div className="flex items-center gap-2"><span className="font-serif text-3xl font-bold text-[#31231E]">{actual}</span><span className="text-xs font-medium text-[#827264]">actual completions</span></div>
      <span className="text-xs text-[#827264]">Drag practices by the handle to reorder within a section.</span>
    </div>
    <div ref={calendarRef} onPointerDown={rememberCalendarScroll} className="overflow-x-auto rounded-3xl border border-[#DDD2C0] bg-white/80 shadow-sm backdrop-blur">
      <div className="min-w-[800px]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#DDD2C0] bg-[#F5F1E9]">
            <tr className="border-b border-[#DDD2C0] font-mono text-[9px] font-bold uppercase tracking-wider text-[#8C6D23]">
              <th className="w-[240px] min-w-[240px] px-5 py-2 text-left font-medium">Calendar week</th>
              {weekGroups.map((week, index) => <th key={week.start} colSpan={week.dates.length} className="border-l border-[#DDD2C0] px-1 py-2 text-center font-medium"><span>Week {index + 1}</span><span className="ml-1.5 text-[#827264]">· {shortDate(week.dates[0])}–{shortDate(week.dates[week.dates.length - 1])}</span></th>)}
            </tr>
            <tr className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">
              <th className="w-[240px] min-w-[240px] px-5 py-4 font-medium">Practice</th>
              {dates.map(date => <th key={date} className={`w-10 min-w-10 py-4 text-center font-medium ${weekGroups.some(week => week.dates[0] === date) ? "border-l border-[#DDD2C0]" : ""}`}><div className="flex flex-col items-center gap-1"><span className="text-[9px] opacity-70">{new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</span><span>{date.slice(8)}</span></div></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDD2C0] bg-white">
            <tr className="bg-black/5"><td colSpan={dates.length + 1} className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Daily</td></tr>
            {actions.filter(action => action.frequency === "daily").map(action => <tr key={action.id} {...dragProps(action)} className={`transition-colors hover:bg-black/5 ${draggedId === action.id ? "bg-[#EBE3D0] opacity-60" : ""}`}>{practiceCell(action)}{dates.map(date => {
              const isPlanned = periodsForAction(action, month).includes(date);
              const status = completionFor(store.completions, action.id, date);
              return <td key={date} className="px-1 py-3 text-center">{isPlanned ? <button onClick={() => toggleCalendarCompletion(action, date)} aria-label={`${status === "completed" ? "Mark as missed" : status === "missed" ? "Mark as canceled" : status === "canceled" ? "Clear status for" : "Mark complete"} ${action.title} on ${shortDate(date)}`} className={`mx-auto grid h-7 w-7 place-items-center rounded-lg border transition-all check-pop ${status === "completed" ? "border-[#2D4C3C] bg-[#2D4C3C] text-[#F5F1E9] shadow-sm" : status === "missed" ? "border-[#DF3B32] bg-[#DF3B32] text-[#FFF0F0] shadow-sm" : status === "canceled" ? "border-[#31231E] bg-[#31231E] text-[#F5F1E9] shadow-sm" : "border-[#DDD2C0] bg-[#F5F1E9] text-transparent hover:border-[#827264]"}`}>{status === "missed" ? <X size={14} strokeWidth={3} /> : status === "canceled" ? <Ban size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}</button> : <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-[#DDD2C0]" />}</td>;
            })}</tr>)}
            <tr className="bg-black/5"><td colSpan={dates.length + 1} className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Weekly · one check per calendar week</td></tr>
            {actions.filter(action => action.frequency === "weekly").map(action => <tr key={action.id} {...dragProps(action)} className={`transition-colors hover:bg-black/5 ${draggedId === action.id ? "bg-[#EBE3D0] opacity-60" : ""}`}>{practiceCell(action)}{weekGroups.map(week => {
              const isPlanned = periodsForAction(action, month).includes(week.start);
              const status = completionFor(store.completions, action.id, week.start);
              return <td key={week.start} colSpan={week.dates.length} className="border-l border-[#DDD2C0] px-1 py-3 text-center">{isPlanned ? <button onClick={() => toggleCalendarCompletion(action, week.start)} aria-label={`${status === "completed" ? "Mark as missed for" : status === "missed" ? "Mark as canceled for" : status === "canceled" ? "Clear status for" : "Mark complete for"} ${action.title} for the week of ${shortDate(week.dates[0])}`} className={`mx-auto grid h-7 w-7 place-items-center rounded-lg border transition-all check-pop ${status === "completed" ? "border-[#2D4C3C] bg-[#2D4C3C] text-[#F5F1E9] shadow-sm" : status === "missed" ? "border-[#DF3B32] bg-[#DF3B32] text-[#FFF0F0] shadow-sm" : status === "canceled" ? "border-[#31231E] bg-[#31231E] text-[#F5F1E9] shadow-sm" : "border-[#DDD2C0] bg-[#F5F1E9] text-transparent hover:border-[#827264]"}`}>{status === "missed" ? <X size={14} strokeWidth={3} /> : status === "canceled" ? <Ban size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}</button> : <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-transparent" />}</td>;
            })}</tr>)}
            <tr className="bg-black/5"><td colSpan={dates.length + 1} className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#8C6D23]">Monthly · one check for the month</td></tr>
            {actions.filter(action => action.frequency === "monthly").map(action => {
              const period = periodsForAction(action, month)[0];
              const status = period ? completionFor(store.completions, action.id, period) : undefined;
              return <tr key={action.id} {...dragProps(action)} className={`transition-colors hover:bg-black/5 ${draggedId === action.id ? "bg-[#EBE3D0] opacity-60" : ""}`}>{practiceCell(action)}<td colSpan={dates.length} className="border-l border-[#DDD2C0] px-3 py-3 text-center">{period ? <button onClick={() => toggleCalendarCompletion(action, period)} aria-label={`${status === "completed" ? "Mark as missed for" : status === "missed" ? "Mark as canceled for" : status === "canceled" ? "Clear status for" : "Mark complete for"} ${action.title} for ${monthLabel(month)}`} className={`mx-auto grid h-8 w-8 place-items-center rounded-lg border transition-all check-pop ${status === "completed" ? "border-[#2D4C3C] bg-[#2D4C3C] text-[#F5F1E9] shadow-sm" : status === "missed" ? "border-[#DF3B32] bg-[#DF3B32] text-[#FFF0F0] shadow-sm" : status === "canceled" ? "border-[#31231E] bg-[#31231E] text-[#F5F1E9] shadow-sm" : "border-[#CDBD9D] bg-[#F5F1E9] text-transparent hover:border-[#827264]"}`}>{status === "missed" ? <X size={15} strokeWidth={3} /> : status === "canceled" ? <Ban size={15} strokeWidth={3} /> : <Check size={15} strokeWidth={3} />}</button> : <span className="text-xs text-[#827264]">Not active this month</span>}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      {oneOffSection("One-time action items", "one-time", oneTimeActions)}
      {oneOffSection("Other action items", "other", otherActions)}
    </div>
  </>;
}

function CallingLogPage({ store, setStore }: { store: Store; setStore: Dispatch<SetStateAction<Store>> }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<CallingEntry, "id">>({ title: "", description: "", dateAdded: today, nextStep: "", status: "Captured" });
  const openAdd = () => { setEditingId(null); setDraft({ title: "", description: "", dateAdded: today, nextStep: "", status: "Captured" }); setShowForm(true); };
  const openEdit = (entry: CallingEntry) => { setEditingId(entry.id); setDraft({ ...entry }); setShowForm(true); };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setStore(current => ({ ...current, callings: editingId ? current.callings.map(item => item.id === editingId ? { ...draft, id: editingId, title: draft.title.trim() } : item) : [{ ...draft, id: `calling-${Date.now()}`, title: draft.title.trim() }, ...current.callings] }));
    setShowForm(false);
  };
  const remove = (id: string) => setStore(current => ({ ...current, callings: current.callings.filter(item => item.id !== id) }));
  const statusTone = (status: CallingStatus): "green" | "gold" | "neutral" | "red" => status === "Completed" ? "green" : status === "Acting" ? "gold" : status === "Praying" ? "neutral" : "red";
  return <><PageHeader eyebrow="Calling Log" title="Threads of grace." description="A place to capture nudges, intuitions, and perceived calls from God for later discernment." action={!showForm ? <Button onClick={openAdd}><Plus size={15} /> Capture Calling</Button> : undefined} />{showForm && <form onSubmit={save} className="mb-8 rounded-3xl border border-[#DDD2C0] bg-gradient-to-br from-[#EBE3D0] to-[#F5F1E9] p-6 md:p-8 shadow-md"><div className="grid gap-5 md:grid-cols-2"><Field label="Calling or Nudge" value={draft.title} onChange={title => setDraft(current => ({ ...current, title }))} placeholder="E.g., Make room for a slower kind of leadership" /><Field label="Date captured" type="date" value={draft.dateAdded} onChange={dateAdded => setDraft(current => ({ ...current, dateAdded }))} /><div className="md:col-span-2"><Field label="Description or Context" value={draft.description} onChange={description => setDraft(current => ({ ...current, description }))} area placeholder="What sparked this? What does it feel like?" /></div><div className="md:col-span-2"><Field label="Next Step (if any)" value={draft.nextStep} onChange={nextStep => setDraft(current => ({ ...current, nextStep }))} placeholder="E.g., Bring this to prayer next Tuesday" /></div><div><label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#827264]">Status</label><select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as CallingStatus }))} className="w-full rounded-xl border border-[#DDD2C0] bg-white px-4 py-3 text-sm font-medium text-[#31231E] outline-none focus:border-[#426553] focus:ring-2 focus:ring-[#EBE3D0] shadow-sm transition-all"><option value="Captured">Captured</option><option value="Praying">Praying</option><option value="Confirmed">Confirmed</option><option value="Acting">Acting</option><option value="Completed">Completed</option></select></div></div><div className="mt-8 flex justify-end gap-3"><Button variant="quiet" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit">{editingId ? "Save changes" : "Save calling"}</Button></div></form>}{!showForm && store.callings.length === 0 && <EmptyState title="The log is empty." detail="When you sense a nudge or an invitation to grow, capture it here." action={<Button onClick={openAdd}>Capture Calling</Button>} icon={BookOpen} />}{!showForm && store.callings.length > 0 && <div className="space-y-4">{store.callings.map(entry => <div key={entry.id} className="flex flex-col gap-4 rounded-3xl border border-[#DDD2C0] bg-white/70 p-6 shadow-sm backdrop-blur transition-all hover:shadow-md md:flex-row md:items-start md:justify-between md:p-8"><div><div className="mb-3 flex items-center gap-3"><Pill tone={statusTone(entry.status)}>{entry.status}</Pill><span className="text-[11px] font-medium text-[#827264]">{shortDate(entry.dateAdded)}</span></div><h3 className="font-serif text-xl font-bold text-[#31231E]">{entry.title}</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#827264]">{entry.description}</p>{entry.nextStep && <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F5F1E9] px-3 py-2 text-[13px] text-[#5C4D43] border border-[#DDD2C0] shadow-sm"><ArrowRight size={13} className="text-[#8C6D23]" /> <span className="font-medium">Next:</span> {entry.nextStep}</div>}</div><div className="flex gap-2 border-t border-[#DDD2C0] pt-4 md:border-0 md:pt-0"><Button variant="outline" onClick={() => openEdit(entry)}><Pencil size={14} /> Edit</Button><Button variant="danger" onClick={() => { if (confirm("Remove this entry permanently?")) remove(entry.id); }}><Trash2 size={14} /> Delete</Button></div></div>)}</div>}</>;
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [authUserName, setAuthUserName] = useState<string | null>(null);
  const [authUserAvatar, setAuthUserAvatar] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrationReady, setHydrationReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const hydrationGeneration = useRef(0);
  const mutationRevision = useRef(0);
  const savedRevision = useRef(0);
  const pendingDeletes = useRef({
    actionItems: new Set<string>(),
    completions: new Set<string>(),
    disciplines: new Set<string>(),
    callings: new Set<string>(),
  });
  const workspaceRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveBlocked = useRef(false);
  const authAccessToken = useRef("");
  const [saveIssue, setSaveIssue] = useState<string | null>(null);

  const enqueueSave = useCallback((
    workspace: Store,
    deletions: Required<WorkspaceDeletions>,
    revision: number,
    userId: string,
    generation: number,
  ) => {
    saveQueue.current = saveQueue.current.then(async () => {
      if (saveBlocked.current) return;
      let attempt = 0;
      while (generation === hydrationGeneration.current && !saveBlocked.current) {
        try {
          const nextRevision = await saveWorkspace(workspace, deletions, workspaceRevision.current, userId);
          if (generation !== hydrationGeneration.current) return;
          workspaceRevision.current = nextRevision;
          Object.entries(deletions).forEach(([collection, ids]) => {
            const pending = pendingDeletes.current[collection as keyof Required<WorkspaceDeletions>];
            ids.forEach(id => pending.delete(id));
          });
          savedRevision.current = Math.max(savedRevision.current, revision);
          setSaveIssue(null);
          return;
        } catch (error) {
          const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
          const message = error instanceof Error ? error.message : String(error);
          if (code === "40001" || code === "PT409" || message.includes("workspace_conflict")) {
            saveBlocked.current = true;
            setSaveIssue("This workspace changed in another browser or device. Saving has been paused to protect the newer data. Reload before making more changes.");
            return;
          }
          if (code.startsWith("23")) {
            saveBlocked.current = true;
            setSaveIssue("Saving was stopped because the server rejected inconsistent workspace data. Reload the protected workspace before continuing.");
            return;
          }
          if (message.includes("signed-in account changed")) return;
          attempt += 1;
          const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
          const transient = error instanceof TypeError
            || status === 408
            || status === 429
            || status >= 500
            || code.startsWith("08")
            || code === "53300"
            || code === "57P01";
          if (!transient || attempt >= 3) {
            saveBlocked.current = true;
            setSaveIssue("Saving failed and has been paused to protect your changes. Stay signed in and reload the protected workspace after checking your connection.");
            return;
          }
          await new Promise(resolve => setTimeout(resolve, Math.min(30_000, 1000 * (2 ** Math.min(attempt, 5)))));
        }
      }
    });
    return saveQueue.current;
  }, []);

  const currentDeletions = useCallback((): Required<WorkspaceDeletions> => ({
    actionItems: [...pendingDeletes.current.actionItems],
    completions: [...pendingDeletes.current.completions],
    disciplines: [...pendingDeletes.current.disciplines],
    callings: [...pendingDeletes.current.callings],
  }), []);

  const updateStore = useCallback<Dispatch<SetStateAction<Store>>>((update) => {
    if (saveBlocked.current) return;
    mutationRevision.current += 1;
    setStore(current => {
      if (!current) return current;
      const next = typeof update === "function" ? update(current) : update;
      const collectRemoved = <T extends { id: string }>(before: T[], after: T[], target: Set<string>) => {
        const retained = new Set(after.map(item => item.id));
        before.forEach(item => {
          if (!retained.has(item.id)) target.add(item.id);
        });
      };
      collectRemoved(current.a3.actionItems, next.a3.actionItems, pendingDeletes.current.actionItems);
      collectRemoved(current.completions, next.completions, pendingDeletes.current.completions);
      collectRemoved(current.disciplines, next.disciplines, pendingDeletes.current.disciplines);
      collectRemoved(current.callings, next.callings, pendingDeletes.current.callings);
      return next;
    });
  }, []);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
      setAuthUserId(session?.user.id ?? null);
      setAuthUserEmail(session?.user.email ?? null);
      setAuthUserName(session?.user.user_metadata?.display_name ?? null);
      setAuthUserAvatar(session?.user.user_metadata?.avatar_key ?? null);
      authAccessToken.current = session?.access_token ?? "";
    });
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((event, session) => {
      setAuthed(!!session);
      setAuthUserId(session?.user.id ?? null);
      setAuthUserEmail(session?.user.email ?? null);
      setAuthUserName(session?.user.user_metadata?.display_name ?? null);
      setAuthUserAvatar(session?.user.user_metadata?.avatar_key ?? null);
      authAccessToken.current = session?.access_token ?? "";
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    }) ?? { data: { subscription: { unsubscribe: () => { } } } };
    return () => subscription.unsubscribe();
  }, []);

  const saveProfile = async (name: string, avatar: string) => {
    const result = await supabase?.auth.updateUser({ data: { display_name: name || null, avatar_key: avatar || null } });
    if (!result || result.error) return false;
    setAuthUserName(name || null);
    setAuthUserAvatar(avatar || null);
    return true;
  };

  useEffect(() => {
    if (authed) {
      const generation = ++hydrationGeneration.current;
      saveQueue.current = Promise.resolve();
      mutationRevision.current = 0;
      savedRevision.current = 0;
      workspaceRevision.current = 0;
      saveBlocked.current = false;
      setSaveIssue(null);
      Object.values(pendingDeletes.current).forEach(ids => ids.clear());
      setLoading(true);
      setHydrationReady(false);
      setWorkspaceError(null);
      loadWorkspace().then(data => {
        if (generation !== hydrationGeneration.current) return;
        workspaceRevision.current = data?.revision ?? 0;
        setStore(data?.workspace || emptyStore);
        setHydrationReady(true);
        setLoading(false);
      }).catch(err => {
        if (generation !== hydrationGeneration.current) return;
        console.error("Workspace load error:", err);
        setStore(null);
        setWorkspaceError("Your saved workspace could not be loaded. Nothing has been overwritten. Please retry when the connection is available.");
        setLoading(false);
      });
    } else if (authed === false) {
      hydrationGeneration.current += 1;
      saveQueue.current = Promise.resolve();
      mutationRevision.current = 0;
      savedRevision.current = 0;
      workspaceRevision.current = 0;
      saveBlocked.current = false;
      setSaveIssue(null);
      Object.values(pendingDeletes.current).forEach(ids => ids.clear());
      setStore(seed);
      setHydrationReady(false);
      setWorkspaceError(null);
      setLoading(false);
    }
  }, [authed, authUserId]);

  useEffect(() => {
    if (!loading && store && authed && hydrationReady) {
      const revision = mutationRevision.current;
      if (revision === savedRevision.current) return undefined;
      const deletions = currentDeletions();
      if (authUserId) enqueueSave(store, deletions, revision, authUserId, hydrationGeneration.current);
    }
    return undefined;
  }, [store, authed, authUserId, loading, hydrationReady, enqueueSave, currentDeletions]);

  const handleSignOut = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (store && authUserId && mutationRevision.current !== savedRevision.current && !saveBlocked.current) {
      const revision = mutationRevision.current;
      await enqueueSave(store, currentDeletions(), revision, authUserId, hydrationGeneration.current);
      if (saveBlocked.current || savedRevision.current < revision) {
        setSaveIssue("Sign out was stopped because your latest changes have not been saved. Reload the protected workspace before trying again.");
        return;
      }
    }
    if (saveBlocked.current) {
      setSaveIssue(current => current || "Sign out was stopped because your latest changes have not been saved.");
      return;
    }
    await supabase?.auth.signOut();
  }, [authUserId, currentDeletions, enqueueSave, store]);

  useEffect(() => {
    const warnBeforeClosing = (event: BeforeUnloadEvent) => {
      if (mutationRevision.current === savedRevision.current) return;
      event.preventDefault();
    };
    const saveBeforeClosing = () => {
      if (!store || !authUserId || !authAccessToken.current || saveBlocked.current) return;
      if (mutationRevision.current === savedRevision.current) return;
      saveWorkspaceOnPageHide(
        store,
        currentDeletions(),
        workspaceRevision.current,
        authUserId,
        authAccessToken.current,
      );
    };
    window.addEventListener("beforeunload", warnBeforeClosing);
    window.addEventListener("pagehide", saveBeforeClosing);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeClosing);
      window.removeEventListener("pagehide", saveBeforeClosing);
    };
  }, [authUserId, currentDeletions, store]);

  if (workspaceError) return <div className="grid min-h-[100dvh] place-items-center bg-[#F5F1E9] px-6 text-[#31231E] holy-pattern"><div className="max-w-md rounded-3xl border border-[#DDD2C0] bg-white/80 p-8 text-center shadow-xl"><Mark /><h1 className="mt-7 font-serif text-2xl font-bold">Workspace temporarily unavailable</h1><p className="mt-3 text-sm leading-relaxed text-[#5C4D43]">{workspaceError}</p><Button onClick={() => window.location.reload()} className="mt-6">Retry loading</Button></div></div>;
  if (authed === null || loading || !store) return <div className="grid min-h-[100dvh] place-items-center bg-[#F5F1E9] text-[#31231E] holy-pattern"><div className="flex flex-col items-center gap-4"><Mark /><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#827264] animate-pulse">Preparing workspace</p></div></div>;
  if (!authed) return <QueryClientProvider client={queryClient}><TooltipProvider><Login onAuthed={() => setAuthed(true)} /><Toaster /></TooltipProvider></QueryClientProvider>;
  if (recoveryMode) return <QueryClientProvider client={queryClient}><TooltipProvider><ResetPasswordPage onDone={() => setRecoveryMode(false)} /><Toaster /></TooltipProvider></QueryClientProvider>;
  if (saveIssue) return <QueryClientProvider client={queryClient}><TooltipProvider><Shell onSignOut={handleSignOut} userEmail={authUserEmail} displayName={authUserName} avatarKey={authUserAvatar} onSaveProfile={saveProfile}><div className="grid min-h-[60vh] place-items-center px-6"><div role="alert" className="max-w-lg rounded-3xl border border-[#CDBD9D] bg-[#FFF9E8] p-8 text-center shadow-xl"><ShieldCheck className="mx-auto text-[#8C6D23]" size={32} /><h1 className="mt-5 font-serif text-2xl font-bold text-[#31231E]">Saving paused to protect your data</h1><p className="mt-3 text-sm leading-relaxed text-[#5C4D43]">{saveIssue}</p><Button onClick={() => window.location.reload()} className="mt-6">Reload protected workspace</Button></div></div></Shell><Toaster /></TooltipProvider></QueryClientProvider>;

  return <QueryClientProvider client={queryClient}><TooltipProvider><Shell onSignOut={handleSignOut} userEmail={authUserEmail} displayName={authUserName} avatarKey={authUserAvatar} onSaveProfile={saveProfile}><Switch><Route path="/"><DashboardHome store={store} /></Route><Route path="/dashboard"><DashboardHome store={store} /></Route><Route path="/guide"><GuidePage /></Route><Route path="/a3"><A3Page store={store} setStore={updateStore} /></Route><Route path="/leader-standard-work"><StandardWorkPage store={store} setStore={updateStore} /></Route><Route path="/calling-log"><CallingLogPage store={store} setStore={updateStore} /></Route><Route path="/settings"><SettingsPage /></Route><Route><div className="py-20 text-center"><h2 className="font-serif text-2xl font-bold text-[#31231E]">Page not found</h2><p className="mt-2 text-[#5C4D43]">The path you are looking for does not exist.</p><Link href="/dashboard" className="mt-6 inline-flex text-sm font-bold text-[#426553] hover:text-[#2D4C3C]">Return to dashboard</Link></div></Route></Switch></Shell><Toaster /></TooltipProvider></QueryClientProvider>;
}