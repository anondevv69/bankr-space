const OXWORK_API = 'https://api.0xwork.org';

export type OxWorkTask = {
  id: number;
  chain_task_id: number | null;
  poster_address: string;
  description: string;
  category: string;
  bounty_amount: string;
  status: string;
  created_at: string;
  title: string | null;
  poster_agent_name: string | null;
  application_count: number;
  attempt_count: number;
  hire_type: string;
  require_approval: number;
};

export type OxWorkTasksResponse = {
  tasks: OxWorkTask[];
  total: number;
  posterWallet: string;
  symbol: string;
  spaceUrl: string;
};

function matchesSpace(task: OxWorkTask, symbol: string, tokenAddress: string): boolean {
  const hay = `${task.title || ''} ${task.description}`.toLowerCase();
  const sym = symbol.toLowerCase().replace(/^\$/, '');
  const token = tokenAddress.toLowerCase();
  return (
    hay.includes(sym) ||
    hay.includes(token) ||
    hay.includes(`$${sym}`) ||
    hay.includes(`bankr.space/community/${token}`)
  );
}

async function fetchPosterTasks(
  poster: string,
  options: { status?: string; limit?: number }
): Promise<OxWorkTask[]> {
  const params = new URLSearchParams({
    poster,
    limit: String(options.limit ?? 50),
  });
  if (options.status) params.set('status', options.status);
  try {
    const res = await fetch(`${OXWORK_API}/tasks?${params}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { tasks?: OxWorkTask[] };
    return data.tasks || [];
  } catch {
    return [];
  }
}

export async function fetchOxWorkTasksForSpace(options: {
  posterWallets: string[];
  symbol: string;
  tokenAddress: string;
  /** Verification: include closed/completed tasks for linking. */
  includeAllStatuses?: boolean;
}): Promise<OxWorkTasksResponse> {
  const posters = [
    ...new Set(
      options.posterWallets
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.startsWith('0x') && w.length === 42)
    ),
  ];
  const primaryPoster = posters[0] || '';
  const spaceUrl = `https://bankr.space/community/${options.tokenAddress.toLowerCase()}`;

  const tasksById = new Map<number, OxWorkTask>();

  const statusFilters = options.includeAllStatuses
    ? ['open', 'completed', 'closed', 'cancelled']
    : ['open'];

  for (const poster of posters) {
    for (const status of statusFilters) {
      const batch = await fetchPosterTasks(poster, { status, limit: 50 });
      for (const task of batch) {
        if (
          task.poster_address?.toLowerCase() === poster ||
          matchesSpace(task, options.symbol, options.tokenAddress)
        ) {
          tasksById.set(task.id, task);
        }
      }
    }
  }

  const tasks = [...tasksById.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return {
    tasks,
    total: tasks.length,
    posterWallet: primaryPoster,
    symbol: options.symbol,
    spaceUrl,
  };
}

export function oxWorkTaskUrl(taskId: number): string {
  return `https://0xwork.org/tasks/${taskId}`;
}
