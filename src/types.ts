export type SessionStatus = "pending" | "running" | "finished" | "failed";

export type PullRequestStatus = "draft" | "awaiting_review" | "approved" | "queued" | "closed" | "merged";

export interface PullRequest {
  url: string;
  pull_request_number: number;
  title: string | null;
  status: PullRequestStatus | null;
  repository?: string | null;
  github_repository?: string | null;
  merged_at?: string | null;
}

export interface Session {
  id: string;
  title: string | null;
  description: string | null;
  status: SessionStatus;
  working_phase: string | null;
  visibility: "public" | "private" | null;
  model: { id: string; name: string | null; variant: string | null } | null;
  user: { id: string; name: string | null; email: string | null; avatar_url: string | null } | null;
  opening_pull_request: boolean | null;
  pushing: boolean | null;
  has_changes: boolean | null;
  created_at: string;
  finished_at: string | null;
  last_user_message_at: string | null;
  deleted_at: string | null;
  pull_requests: PullRequest[] | null;
  repositories: { id: string; branch: string | null; diff: { additions: number; deletions: number } | null }[] | null;
  branch: string | null;
  base_branch: string | null;
  total_cost: number | null;
  total_tokens: number | null;
  deploy: { active: boolean; url: string | null } | null;
  tags: string[] | null;
  viewer_is_owner: boolean | null;
  workspace: { id: string; name: string; organization: string | null } | null;
}

export interface PageMeta {
  next_cursor: string | null;
  previous_cursor: string | null;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface Repository {
  id: string;
  name: string;
  description: string | null;
  organization: string | null;
  base_branch: string | null;
}

export interface Model {
  id: string;
  name: string;
  description: string | null;
  aliases: string[];
  supported_variants: string[];
  visibility: string;
}

export type MessagePart =
  | { type: "text"; id: string; text: string }
  | { type: "reasoning"; id: string; text: string }
  | {
      type: "tool_call";
      id: string;
      call_id: string;
      name: string;
      status: "running" | "completed" | "error";
      input?: unknown;
      output?: unknown;
      error?: unknown;
    };

export interface Message {
  id: string;
  role: "user" | "assistant";
  created_at: string;
  completed_at?: string | null;
  source?: string;
  synthetic?: boolean;
  parts: MessagePart[];
}
