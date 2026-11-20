import { getPreferenceValues } from "@raycast/api";
import { Message, Model, PageMeta, Repository, Session } from "./types";

interface Prefs {
  apiKey: string;
  baseUrl?: string;
  defaultRepository?: string;
}

export function prefs(): Prefs {
  return getPreferenceValues<Prefs>();
}

export function baseUrl(): string {
  return (prefs().baseUrl?.trim() || "https://app.inspect.com").replace(/\/+$/, "");
}

export function sessionUrl(id: string): string {
  return `${baseUrl()}/sessions/${id}`;
}

export class InspectError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "InspectError";
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const url = new URL(`${baseUrl()}/api/v2${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${prefs().apiKey}`,
      Accept: "application/json",
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    const err = json as { message?: string; code?: string } | undefined;
    throw new InspectError(err?.message ?? `${res.status} ${res.statusText}`, res.status, err?.code);
  }
  return json as T;
}

export interface ListSessionsParams {
  all?: boolean;
  include_archived?: boolean;
  repository?: string;
  limit?: number;
  after?: string;
}

export function listSessions(params: ListSessionsParams) {
  return request<{ data: Session[]; meta: PageMeta }>("GET", "/sessions", { query: { ...params } });
}

export async function getSession(id: string) {
  return (await request<{ data: Session }>("GET", `/sessions/${id}`)).data;
}

export async function getMessages(id: string): Promise<Message[]> {
  const out: Message[] = [];
  let after: string | undefined;
  // Transcripts are usually a single page; cap pages defensively.
  for (let i = 0; i < 10; i++) {
    const page = await request<{ data: Message[]; meta: PageMeta }>("GET", `/sessions/${id}/messages`, {
      query: { after },
    });
    out.push(...page.data);
    if (!page.meta?.has_next_page || !page.meta.next_cursor) break;
    after = page.meta.next_cursor;
  }
  return out;
}

export interface CreateSessionBody {
  repository: string;
  prompt: string;
  title?: string;
  model?: string;
  variant?: string;
  base_branch?: string;
  branch?: string;
  visibility?: "public" | "private";
}

export async function createSession(body: CreateSessionBody) {
  return (await request<{ data: Session }>("POST", "/sessions", { body })).data;
}

export async function sendPrompt(
  id: string,
  body: { prompt: string; delivery?: "immediate" | "queued"; model?: string; variant?: string },
) {
  return request<{ data: Session; queued_prompt: { id: string; created_at: string } | null }>(
    "POST",
    `/sessions/${id}/prompt`,
    { body },
  );
}

export async function stopSession(id: string) {
  return (await request<{ data: Session }>("POST", `/sessions/${id}/stop`)).data;
}

export async function archiveSession(id: string, closePullRequest: boolean) {
  await request<void>("DELETE", `/sessions/${id}`, { query: { close_pull_request: closePullRequest } });
}

export async function listRepositories() {
  return request<{ data: Repository[]; meta: PageMeta & { suggested?: string[] } }>("GET", "/repositories");
}

export async function listModels() {
  return (await request<{ data: Model[] }>("GET", "/models")).data;
}
