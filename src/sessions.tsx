import { Action, ActionPanel, Icon, Keyboard, List, showToast, Toast } from "@raycast/api";
import { showFailureToast, useCachedPromise, useCachedState } from "@raycast/utils";
import { useEffect, useState } from "react";
import { getMessages, listSessions, sendPrompt } from "./api";
import { FollowUpForm } from "./components/FollowUpForm";
import { NewSessionComposer } from "./components/NewSessionComposer";
import { SessionActions } from "./components/SessionActions";
import { useLiveSession } from "./hooks";
import { Ryu } from "./icons";
import { Session } from "./types";
import {
  firstUserPrompt,
  isActive,
  lastActivity,
  lastAssistantText,
  prColor,
  prLabel,
  relativeTime,
  repoName,
  SessionMetadata,
  sessionTitle,
  statusInfo,
  transcriptMarkdown,
  truncate,
} from "./utils";

type Scope = "mine" | "all" | "mine-archived" | "all-archived";

const PAGE_SIZE = 50;
const POLL_MS = 15_000;

export default function Command() {
  const [scope, setScope] = useState<Scope>("mine");
  const [showDetail, setShowDetail] = useCachedState("show-detail", true);
  const [filter, setFilter] = useState("");
  // Reply mode: the search bar becomes a message box for this session.
  const [replyTo, setReplyTo] = useState<Session | null>(null);
  const [draft, setDraft] = useState("");

  const { data, isLoading, pagination, revalidate } = useCachedPromise(
    (scope: Scope) => async (opts: { cursor?: string }) => {
      const res = await listSessions({
        all: scope.startsWith("all"),
        include_archived: scope.endsWith("archived"),
        limit: PAGE_SIZE,
        after: opts.cursor,
      });
      return { data: res.data, hasMore: res.meta.has_next_page, cursor: res.meta.next_cursor ?? undefined };
    },
    [scope],
    { keepPreviousData: true },
  );

  const sessions = data ?? [];
  const active = sessions.filter(isActive);
  const rest = sessions.filter((s) => !isActive(s));

  // Keep running sessions fresh while the list is open.
  useEffect(() => {
    if (!active.length) return;
    const t = setInterval(revalidate, POLL_MS);
    return () => clearInterval(t);
  }, [active.length, revalidate]);

  if (replyTo) {
    return (
      <ReplyMode
        session={replyTo}
        draft={draft}
        setDraft={setDraft}
        onExit={() => {
          setReplyTo(null);
          setDraft("");
        }}
        onSent={revalidate}
      />
    );
  }

  const toggleDetail = (
    <Action
      title={showDetail ? "Hide Preview" : "Show Preview"}
      icon={Ryu.table}
      shortcut={{ modifiers: ["cmd"], key: "d" }}
      onAction={() => setShowDetail(!showDetail)}
    />
  );
  const newSession = (
    <Action.Push
      title="New Session"
      icon={Ryu.plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<NewSessionComposer onCreated={revalidate} />}
    />
  );

  const renderItem = (s: Session) => (
    <SessionItem
      key={s.id}
      session={s}
      showDetail={showDetail}
      showOwner={scope.startsWith("all")}
      actions={
        <SessionActions
          session={s}
          onChange={revalidate}
          onReply={() => setReplyTo(s)}
          extra={
            <>
              {newSession}
              {toggleDetail}
            </>
          }
        />
      }
    />
  );

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={showDetail && sessions.length > 0}
      pagination={pagination}
      searchText={filter}
      onSearchTextChange={setFilter}
      searchBarPlaceholder="Filter by title, repo, branch, PR…  (⌘F to reply)"
      searchBarAccessory={
        <List.Dropdown tooltip="Which sessions" storeValue onChange={(v) => setScope(v as Scope)}>
          <List.Dropdown.Item value="mine" title="My Sessions" icon={Icon.Person} />
          <List.Dropdown.Item value="all" title="Everyone's Sessions" icon={Icon.TwoPeople} />
          <List.Dropdown.Section title="Including Archived">
            <List.Dropdown.Item value="mine-archived" title="My Sessions + Archived" icon={Ryu.archive} />
            <List.Dropdown.Item value="all-archived" title="Everyone's + Archived" icon={Ryu.archive} />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      <List.EmptyView
        icon={Ryu.appSmall}
        title={isLoading ? "Loading sessions…" : "No sessions"}
        description="Press ⌘N to start one."
        actions={<ActionPanel>{newSession}</ActionPanel>}
      />
      <List.Section title="Active" subtitle={active.length ? String(active.length) : undefined}>
        {active.map(renderItem)}
      </List.Section>
      <List.Section title="Recent">{rest.map(renderItem)}</List.Section>
    </List>
  );
}

/** Chat-style reply: search bar is the composer, the detail pane shows the latest messages live. */
function ReplyMode({
  session: initial,
  draft,
  setDraft,
  onExit,
  onSent,
}: {
  session: Session;
  draft: string;
  setDraft: (v: string) => void;
  onExit: () => void;
  onSent: () => void;
}) {
  const { session, messages, isLoading, revalidate } = useLiveSession(initial);
  const [sending, setSending] = useState(false);

  async function send(delivery: "immediate" | "queued") {
    const prompt = draft.trim();
    if (!prompt || sending) return;
    setSending(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Sending…" });
    try {
      const res = await sendPrompt(session.id, { prompt, delivery });
      toast.style = Toast.Style.Success;
      toast.title = res.queued_prompt ? "Queued" : "Sent";
      setDraft("");
      revalidate();
      onSent();
    } catch (e) {
      await toast.hide();
      await showFailureToast(e, { title: "Couldn't send message" });
    } finally {
      setSending(false);
    }
  }

  const st = statusInfo(session);
  // Only the tail of the conversation fits nicely in the side pane.
  const recent = messages ? messages.slice(-8) : undefined;
  const markdown = recent
    ? transcriptMarkdown(session, recent) +
      (isActive(session) ? "" : "\n\n---\n\n_Type below to continue the session._")
    : `# ${sessionTitle(session)}\n\n_Loading…_`;

  return (
    <List
      navigationTitle={`Reply · ${sessionTitle(session)}`}
      isLoading={isLoading || sending}
      isShowingDetail
      filtering={false}
      searchText={draft}
      onSearchTextChange={setDraft}
      searchBarPlaceholder={`Message “${truncate(sessionTitle(session), 40)}”…`}
    >
      <List.Item
        id={session.id}
        icon={{ value: st.icon, tooltip: st.label }}
        title={draft.trim() ? draft.trim() : sessionTitle(session)}
        subtitle={draft.trim() ? undefined : st.label}
        detail={<List.Item.Detail markdown={markdown} />}
        actions={
          <ActionPanel title={sessionTitle(session)}>
            {draft.trim() ? (
              <>
                <Action title="Send" icon={Ryu.send} onAction={() => send("immediate")} />
                <Action title="Queue After Current Turn" icon={Ryu.history} onAction={() => send("queued")} />
              </>
            ) : null}
            <Action
              title="Back to Sessions"
              icon={Icon.ArrowLeft}
              shortcut={{ modifiers: ["cmd"], key: "f" }}
              onAction={onExit}
            />
            <Action.Push
              title="Open Full Editor"
              icon={Ryu.memo}
              shortcut={Keyboard.Shortcut.Common.Edit}
              target={<FollowUpForm session={session} initialPrompt={draft} onSent={onSent} />}
            />
            <Action
              title="Refresh"
              icon={Ryu.refresh}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={revalidate}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}

function SessionItem({
  session: s,
  showDetail,
  showOwner,
  actions,
}: {
  session: Session;
  showDetail: boolean;
  showOwner: boolean;
  actions: React.ReactNode;
}) {
  const st = statusInfo(s);
  const pr = s.pull_requests?.[0];
  const accessories: List.Item.Accessory[] = [];
  if (!showDetail) {
    if (s.working_phase && isActive(s)) accessories.push({ text: s.working_phase });
    if (pr) accessories.push({ tag: { value: prLabel(pr), color: prColor(pr) }, tooltip: pr.title ?? undefined });
    if (showOwner && s.user?.avatar_url) accessories.push({ icon: s.user.avatar_url, tooltip: s.user.name ?? "" });
  } else if (pr) {
    accessories.push({
      icon: { source: pr.status === "closed" ? Ryu.prClosed : Ryu.merge, tintColor: prColor(pr) },
      tooltip: prLabel(pr),
    });
  }
  accessories.push({ text: relativeTime(lastActivity(s)), tooltip: new Date(lastActivity(s)).toLocaleString() });

  return (
    <List.Item
      id={s.id}
      icon={{ value: st.icon, tooltip: st.label }}
      title={sessionTitle(s)}
      subtitle={showDetail ? undefined : repoName(s)}
      keywords={[
        s.id,
        repoName(s),
        s.branch ?? "",
        s.status,
        ...(s.tags ?? []),
        ...(s.pull_requests ?? []).map((p) => `#${p.pull_request_number}`),
        s.user?.name ?? "",
      ].filter(Boolean)}
      accessories={accessories}
      detail={showDetail ? <SessionPreview session={s} /> : undefined}
      actions={actions}
    />
  );
}

/** Rendered only for the selected row, so messages are fetched lazily. */
function SessionPreview({ session: s }: { session: Session }) {
  const { data: messages, isLoading } = useCachedPromise(getMessages, [s.id], {
    keepPreviousData: false,
    onError: () => undefined,
  });

  const lines: string[] = [`## ${sessionTitle(s)}`];
  if (s.description) lines.push(`_${s.description}_`);
  if (messages) {
    const prompt = firstUserPrompt(messages);
    const reply = lastAssistantText(messages);
    if (prompt)
      lines.push(
        `**Prompt**\n\n${truncate(prompt, 600)
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")}`,
      );
    if (reply) lines.push(`**${isActive(s) ? "Latest update" : "Result"}**\n\n${truncate(reply, 2500)}`);
    else if (isActive(s)) lines.push("_Inspect is working…_");
  } else if (isLoading) {
    lines.push("_Loading…_");
  }

  return (
    <List.Item.Detail isLoading={isLoading} markdown={lines.join("\n\n")} metadata={<SessionMetadata session={s} />} />
  );
}
