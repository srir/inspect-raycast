import { Ryu } from "./icons";
import { Color, Detail, Icon, Image, List } from "@raycast/api";
import { Message, PullRequest, Session, SessionStatus } from "./types";

export const STATUS: Record<SessionStatus, { label: string; icon: Image.ImageLike; color: Color }> = {
  pending: {
    label: "Pending",
    icon: { source: Ryu.history, tintColor: Color.SecondaryText },
    color: Color.SecondaryText,
  },
  running: { label: "Running", icon: { source: Ryu.activity, tintColor: Color.Blue }, color: Color.Blue },
  finished: { label: "Finished", icon: { source: Ryu.check, tintColor: Color.Green }, color: Color.Green },
  failed: { label: "Failed", icon: { source: Ryu.alert, tintColor: Color.Red }, color: Color.Red },
};

export function statusInfo(s: Session) {
  return STATUS[s.status] ?? STATUS.pending;
}

export function isActive(s: Session) {
  return s.status === "running" || s.status === "pending";
}

const PR_COLORS: Record<string, Color> = {
  merged: Color.Purple,
  approved: Color.Green,
  awaiting_review: Color.Yellow,
  queued: Color.Orange,
  draft: Color.SecondaryText,
  closed: Color.Red,
};

export function prColor(pr: PullRequest): Color {
  return PR_COLORS[pr.status ?? ""] ?? Color.SecondaryText;
}

export function prLabel(pr: PullRequest): string {
  return `#${pr.pull_request_number} ${(pr.status ?? "open").replace(/_/g, " ")}`;
}

export function sessionTitle(s: Session) {
  return s.title?.trim() || "Untitled session";
}

export function repoName(s: Session) {
  return s.workspace?.name ?? s.repositories?.[0]?.id ?? "";
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "y"],
    [60 * 60 * 24 * 30, "mo"],
    [60 * 60 * 24 * 7, "w"],
    [60 * 60 * 24, "d"],
    [60 * 60, "h"],
    [60, "m"],
  ];
  for (const [secs, label] of units) {
    if (diff >= secs) return `${Math.floor(diff / secs)}${label} ago`;
  }
  return "just now";
}

export function lastActivity(s: Session) {
  return s.finished_at ?? s.last_user_message_at ?? s.created_at;
}

export function formatCost(cost: number | null | undefined) {
  return cost == null ? undefined : `$${cost.toFixed(2)}`;
}

function textOf(m: Message) {
  return m.parts
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("\n\n")
    .trim();
}

export function firstUserPrompt(messages: Message[]) {
  const m = messages.find((x) => x.role === "user" && !x.synthetic);
  return m ? textOf(m) : "";
}

export function lastAssistantText(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      const t = textOf(messages[i]);
      if (t) return t;
    }
  }
  return "";
}

export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

function quote(s: string) {
  return s
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

/**
 * Render a transcript as markdown: user prompts quoted, assistant text inline, tool calls summarized.
 * Messages are grouped into exchanges (a prompt plus Inspect's reply). With `newestFirst`, the most
 * recent exchange comes first, since Raycast can't open a detail view scrolled to the bottom.
 */
export function transcriptMarkdown(s: Session, messages: Message[], opts: { newestFirst?: boolean } = {}): string {
  const header: string[] = [`# ${sessionTitle(s)}`];
  if (s.description) header.push(`_${s.description}_`);

  const turns: string[][] = [];
  const current = () => {
    if (!turns.length) turns.push([]);
    return turns[turns.length - 1];
  };
  for (const m of messages) {
    if (m.role === "user") {
      const t = textOf(m);
      if (!t || m.synthetic) continue;
      const who = m.source && m.source !== "web" ? `You (${m.source})` : "You";
      turns.push([`**🧑 ${who}** · ${relativeTime(m.created_at)}\n\n${quote(t)}`]);
      continue;
    }
    const chunks: string[] = [];
    let tools: string[] = [];
    const flush = () => {
      if (!tools.length) return;
      const uniq = [...new Set(tools)];
      const names = uniq.slice(0, 6).join(", ") + (uniq.length > 6 ? ", …" : "");
      chunks.push(`\`🔧 ${tools.length} tool call${tools.length > 1 ? "s" : ""}: ${names}\``);
      tools = [];
    };
    for (const p of m.parts) {
      if (p.type === "tool_call") tools.push(p.name);
      else if (p.type === "text" && p.text.trim()) {
        flush();
        chunks.push(p.text.trim());
      }
    }
    flush();
    if (!m.completed_at && isActive(s)) chunks.push("_…working_");
    if (chunks.length) current().push(`**🤖 Inspect**\n\n${chunks.join("\n\n")}`);
  }

  const ordered = opts.newestFirst ? [...turns].reverse() : turns;
  const body = ordered.map((t) => t.join("\n\n")).join("\n\n---\n\n");
  if (opts.newestFirst && turns.length > 1) header.push("_Newest first · ⌘T to flip_");
  const md = [...header, body || "_No messages yet._"].join("\n\n");

  // Keep the most recent part of very long transcripts so Raycast stays snappy.
  const MAX = 40_000;
  if (md.length <= MAX) return md;
  const note = "_…transcript truncated, open in Inspect for the full history_";
  return opts.newestFirst ? `${md.slice(0, MAX)}\n\n${note}` : `${note}\n\n${md.slice(-MAX)}`;
}

export function SessionMetadata({ session: s, inDetail }: { session: Session; inDetail?: boolean }) {
  const st = statusInfo(s);
  const diff = s.repositories?.find((r) => r.diff)?.diff;
  const cost = formatCost(s.total_cost);
  // Detail.Metadata and List.Item.Detail.Metadata share the same shape.
  const M = (inDetail ? Detail.Metadata : List.Item.Detail.Metadata) as typeof List.Item.Detail.Metadata;
  return (
    <M>
      <M.TagList title="Status">
        <M.TagList.Item text={st.label} color={st.color} />
        {s.working_phase ? <M.TagList.Item text={s.working_phase} /> : null}
        {s.deleted_at ? <M.TagList.Item text="Archived" color={Color.SecondaryText} /> : null}
      </M.TagList>
      {repoName(s) ? <M.Label title="Repository" text={repoName(s)} icon={Ryu.code} /> : null}
      {s.branch ? (
        <M.Label title="Branch" text={s.base_branch ? `${s.branch} → ${s.base_branch}` : s.branch} icon={Ryu.branch} />
      ) : null}
      {diff ? <M.Label title="Diff" text={`+${diff.additions} −${diff.deletions}`} /> : null}
      {(s.pull_requests ?? []).map((pr) => (
        <M.Link
          key={pr.url}
          title={`PR #${pr.pull_request_number} · ${(pr.status ?? "").replace(/_/g, " ")}`}
          text={pr.title ?? pr.url}
          target={pr.url}
        />
      ))}
      {s.deploy?.url ? <M.Link title="Preview" text={s.deploy.url} target={s.deploy.url} /> : null}
      <M.Separator />
      {s.model ? (
        <M.Label title="Model" text={[s.model.name ?? s.model.id, s.model.variant].filter(Boolean).join(" · ")} />
      ) : null}
      {s.user && (s.user.name || s.user.email) ? (
        <M.Label
          title="Owner"
          text={s.user.name ?? s.user.email ?? ""}
          icon={s.user.avatar_url ? { source: s.user.avatar_url, mask: Image.Mask.Circle } : Icon.Person}
        />
      ) : null}
      <M.Label title="Created" text={new Date(s.created_at).toLocaleString()} />
      {s.finished_at ? <M.Label title="Finished" text={new Date(s.finished_at).toLocaleString()} /> : null}
      {cost ? <M.Label title="Cost" text={cost} /> : null}
      {s.tags?.length ? (
        <M.TagList title="Tags">
          {s.tags.map((t) => (
            <M.TagList.Item key={t} text={t} />
          ))}
        </M.TagList>
      ) : null}
      <M.Label title="ID" text={s.id} />
    </M>
  );
}
