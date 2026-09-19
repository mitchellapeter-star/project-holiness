export type Frequency = "daily" | "weekly" | "monthly" | "one-time" | "other";
export type ActionStatus = "open" | "in-progress" | "done";
export type CallingStatus = "Captured" | "Praying" | "Confirmed" | "Acting" | "Completed";

export type HolinessProblem = {
  id: string;
  problem: string;
  rootCause: string;
};

export type Countermeasure = {
  id: string;
  problemId: string;
  description: string;
};

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  frequency: Frequency;
  dueDate: string;
  endDate: string;
  status: ActionStatus;
  active: boolean;
  sortOrder?: number;
};

export type ActionCompletion = {
  id: string;
  actionItemId: string;
  completionPeriod: string;
  status: "completed" | "missed" | "canceled";
  completedAt: string;
};

export type Discipline = {
  id: string;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  completed: boolean;
  lastCompleted: string;
};

export type CallingEntry = {
  id: string;
  title: string;
  description: string;
  dateAdded: string;
  nextStep: string;
  status: CallingStatus;
};

export type Store = {
  a3: {
    projectStatement: string;
    lifeRationale: string;
    problems: HolinessProblem[];
    countermeasures: Countermeasure[];
    actionItems: ActionItem[];
  };
  completions: ActionCompletion[];
  disciplines: Discipline[];
  callings: CallingEntry[];
};