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

export async function fetchOxWorkTasksForSpace(options: {
  posterWallet: string;
  symbol: string;
  tokenAddress: string;
  includeGlobalPoster?: boolean;
}): Promise<OxWorkTasksResponse> {
  const poster = options.posterWallet.toLowerCase();
  const spaceUrl = `https://bankr.space/community/${options.tokenAddress.toLowerCase()}`;

  let tasks: OxWorkTask[] = [];
  try {
    const res = await fetch(
      `${OXWORK_API}/tasks?poster=${encodeURIComponent(poster)}&status=open&limit=50`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) {
      const data = (await res.json()) as { tasks?: OxWorkTask[] };
      tasks = data.tasks || [];
    }
  } catch {
    tasks = [];
  }

  if (options.includeGlobalPoster !== false) {
    // Keep tasks posted by fee recipient; also allow symbol/space mention filter for shared pools
    const filtered = tasks.filter(
      (t) =>
        t.poster_address?.toLowerCase() === poster ||
        matchesSpace(t, options.symbol, options.tokenAddress)
    );
    tasks = filtered;
  }

  return {
    tasks,
    total: tasks.length,
    posterWallet: poster,
    symbol: options.symbol,
    spaceUrl,
  };
}

export function oxWorkTaskUrl(taskId: number): string {
  return `https://0xwork.org/tasks/${taskId}`;
}
