import { supabase } from "./supabase";
import type { ActionCompletion, ActionItem, CallingEntry, Countermeasure, Discipline, Frequency, HolinessProblem, Store } from "./workspace-types";

export type WorkspaceDeletions = {
  actionItems?: string[];
  completions?: string[];
  disciplines?: string[];
  callings?: string[];
};

export type WorkspaceSnapshot = {
  workspace: Store;
  revision: number;
};

const fixedProjectStatement = "There is a gap between where I am and the holiness I'm called to. Holiness means being set apart for God, growing toward sainthood, and conforming my will to His, the universal call every baptized person shares.\n\nIf married, this call extends to one's marriage as well, since spouses are meant to help sanctify one another.";
const fixedLifeRationale = "Becoming holy leads to heaven, leaves a lasting effect on ourselves and those who come after us, and greatly improves our lives and the lives of those around us. Growth in holiness is growth in love, of God and neighbor, and it bears fruit far beyond ourselves.\n\nIf married, this includes a holy marriage, which shapes not only the spouses but their children as well.";

const isFrequency = (value: unknown): value is Frequency =>
  value === "daily" || value === "weekly" || value === "monthly" || value === "one-time" || value === "other";

const normalizeAction = (item: Record<string, unknown>, index = 0): ActionItem => ({
  id: String(item.id),
  title: String(item.title || item.task || ""),
  description: String(item.description || ""),
  startDate: String(item.start_date || item.due_date || new Date().toISOString().slice(0, 10)),
  frequency: isFrequency(item.frequency) ? item.frequency : "one-time",
  dueDate: String(item.due_date || ""),
  endDate: String(item.end_date || ""),
  status: item.status === "in-progress" || item.status === "done" ? item.status : "open",
  active: item.active !== false,
  sortOrder: typeof item.sort_order === "number" ? item.sort_order : index,
});

function parseProblems(raw: string | null | undefined): HolinessProblem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    return [{
      id: "legacy-problem",
      problem: String(raw),
      rootCause: "Unidentified root cause"
    }];
  }
  return [];
}

function parseCountermeasures(raw: string | null | undefined): Countermeasure[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    return [{
      id: "legacy-cm",
      problemId: "legacy-problem",
      description: String(raw)
    }];
  }
  return [];
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("load_holiness_workspace");
  if (error) throw error;
  const payload = (data ?? {}) as Record<string, unknown>;
  const a3 = payload.a3 && typeof payload.a3 === "object" ? payload.a3 as Record<string, unknown> : null;
  const actions = Array.isArray(payload.action_items) ? payload.action_items as Record<string, unknown>[] : [];
  const completions = Array.isArray(payload.completions) ? payload.completions as Record<string, unknown>[] : [];
  const disciplines = Array.isArray(payload.disciplines) ? payload.disciplines as Record<string, unknown>[] : [];
  const callings = Array.isArray(payload.callings) ? payload.callings as Record<string, unknown>[] : [];

  return {
    revision: Number(payload.revision ?? 0),
    workspace: {
      a3: {
        projectStatement: fixedProjectStatement,
        lifeRationale: fixedLifeRationale,
        problems: parseProblems(String(a3?.problem_assessment ?? "")),
        countermeasures: parseCountermeasures(String(a3?.countermeasures ?? "")),
        actionItems: actions.map((item, index) => normalizeAction(item, index)),
      },
      completions: completions.map(item => ({
        id: String(item.id),
        actionItemId: String(item.action_item_id),
        completionPeriod: String(item.completion_period),
        status: item.status === "missed" ? "missed" : item.status === "canceled" ? "canceled" : "completed",
        completedAt: String(item.completed_at),
      })),
      disciplines: disciplines.map(item => ({
        id: String(item.id),
        name: String(item.name),
        cadence: item.cadence === "weekly" || item.cadence === "monthly" ? item.cadence : "daily",
        completed: item.completed === true,
        lastCompleted: String(item.last_completed ?? ""),
      })),
      callings: callings.map(item => ({
        id: String(item.id),
        title: String(item.title),
        description: String(item.description ?? ""),
        dateAdded: String(item.date_added),
        nextStep: String(item.next_step ?? ""),
        status: item.status === "Praying" || item.status === "Confirmed" || item.status === "Acting" || item.status === "Completed" ? item.status : "Captured",
      })),
    },
  };
}

function workspaceSaveCommand(workspace: Store, deletions: WorkspaceDeletions, expectedRevision: number, userId: string) {
  const actionRows = workspace.a3.actionItems.map((item, index) => ({
    id: item.id,
    title: item.title,
    task: item.title,
    description: item.description,
    start_date: item.startDate,
    frequency: item.frequency,
    due_date: item.dueDate || null,
    end_date: item.endDate || null,
    status: item.status,
    active: item.active,
    sort_order: item.sortOrder ?? index,
    completed: item.status === "done",
  }));
  const completionRows = workspace.completions.map(item => ({
    id: item.id,
    action_item_id: item.actionItemId,
    completion_period: item.completionPeriod,
    status: item.status,
    completed_at: item.completedAt,
  }));
  const disciplineRows = workspace.disciplines.map(item => ({
    id: item.id,
    name: item.name,
    cadence: item.cadence,
    completed: item.completed,
    last_completed: item.lastCompleted || null,
  }));
  const callingRows = workspace.callings.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description,
    date_added: item.dateAdded,
    next_step: item.nextStep,
    status: item.status,
  }));

  return {
    user_id: userId,
    payload: {
      expected_revision: expectedRevision,
      project_statement: workspace.a3.projectStatement,
      life_rationale: workspace.a3.lifeRationale,
      problem_assessment: JSON.stringify(workspace.a3.problems),
      countermeasures: JSON.stringify(workspace.a3.countermeasures),
      action_items: actionRows,
      completions: completionRows,
      disciplines: disciplineRows,
      callings: callingRows,
      deleted_action_item_ids: deletions.actionItems ?? [],
      deleted_completion_ids: deletions.completions ?? [],
      deleted_discipline_ids: deletions.disciplines ?? [],
      deleted_calling_ids: deletions.callings ?? [],
    },
  };
}

export async function saveWorkspace(workspace: Store, deletions: WorkspaceDeletions = {}, expectedRevision = 0, expectedUserId?: string): Promise<number> {
  if (!supabase) throw new Error("Supabase is not configured.");
  let userId = expectedUserId;
  if (!userId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error("Authentication is required to save this workspace.");
    userId = userData.user.id;
  }

  const { data, error } = await supabase
    .from("holiness_workspace_save_commands")
    .insert(workspaceSaveCommand(workspace, deletions, expectedRevision, userId))
    .select("revision")
    .single();
  if (error) throw error;
  const revision = Number(data?.revision);
  if (!Number.isFinite(revision)) throw new Error("Workspace save did not return a valid revision.");
  return revision;
}

export function saveWorkspaceOnPageHide(
  workspace: Store,
  deletions: WorkspaceDeletions,
  expectedRevision: number,
  userId: string,
  accessToken: string,
) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey || !accessToken) return;

  void fetch(`${supabaseUrl}/rest/v1/holiness_workspace_save_commands`, {
    method: "POST",
    keepalive: true,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(workspaceSaveCommand(workspace, deletions, expectedRevision, userId)),
  });
}