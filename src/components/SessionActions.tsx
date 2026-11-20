import { Ryu } from "../icons";
import { Action, ActionPanel, Alert, confirmAlert, Keyboard, showToast, Toast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { ReactNode } from "react";
import { archiveSession, sessionUrl, stopSession } from "../api";
import { Session } from "../types";
import { isActive, sessionTitle } from "../utils";
import { FollowUpForm } from "./FollowUpForm";
import { SessionView } from "./SessionView";

interface Props {
  session: Session;
  onChange?: () => void;
  /** Hide "Show Transcript" when already on the transcript view. */
  inSessionView?: boolean;
  extra?: ReactNode;
  /** When given, "Reply" switches the list into inline reply mode instead of opening a form. */
  onReply?: () => void;
}

export function SessionActions({ session: s, onChange, inSessionView, extra, onReply }: Props) {
  const url = sessionUrl(s.id);
  const prs = s.pull_requests ?? [];

  async function stop() {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Stopping session…" });
    try {
      await stopSession(s.id);
      toast.style = Toast.Style.Success;
      toast.title = "Session stopped";
      onChange?.();
    } catch (e) {
      await toast.hide();
      await showFailureToast(e, { title: "Couldn't stop session" });
    }
  }

  async function archive(closePullRequest: boolean) {
    const ok = await confirmAlert({
      title: `Archive "${sessionTitle(s)}"?`,
      message:
        closePullRequest && prs.length
          ? "This stops the agent and closes the session's open pull request."
          : "This stops the agent. Sending a follow-up later restores it.",
      icon: Ryu.archive,
      primaryAction: { title: "Archive", style: Alert.ActionStyle.Destructive },
    });
    if (!ok) return;
    const toast = await showToast({ style: Toast.Style.Animated, title: "Archiving…" });
    try {
      await archiveSession(s.id, closePullRequest);
      toast.style = Toast.Style.Success;
      toast.title = "Session archived";
      onChange?.();
    } catch (e) {
      await toast.hide();
      await showFailureToast(e, { title: "Couldn't archive session" });
    }
  }

  return (
    <ActionPanel title={sessionTitle(s)}>
      <ActionPanel.Section>
        {inSessionView ? null : (
          <Action.Push
            title="Show Transcript"
            icon={Ryu.memo}
            target={<SessionView session={s} onChange={onChange} />}
          />
        )}
        <Action.OpenInBrowser title="Open in Inspect" icon={Ryu.link} url={url} />
        {onReply ? (
          <Action title="Reply" icon={Ryu.message} shortcut={{ modifiers: ["cmd"], key: "f" }} onAction={onReply} />
        ) : (
          <Action.Push
            title="Send Follow-Up"
            icon={Ryu.message}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
            target={<FollowUpForm session={s} onSent={onChange} />}
          />
        )}
        {extra}
      </ActionPanel.Section>
      {prs.length || s.deploy?.url ? (
        <ActionPanel.Section title="Links">
          {prs.map((pr, i) => (
            <Action.OpenInBrowser
              key={pr.url}
              title={`Open Pull Request #${pr.pull_request_number}`}
              icon={Ryu.github}
              url={pr.url}
              shortcut={i === 0 ? { modifiers: ["cmd", "shift"], key: "g" } : undefined}
            />
          ))}
          {s.deploy?.url ? (
            <Action.OpenInBrowser
              title="Open Preview Deploy"
              icon={Ryu.globe}
              url={s.deploy.url}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            />
          ) : null}
        </ActionPanel.Section>
      ) : null}
      <ActionPanel.Section title="Copy">
        <Action.CopyToClipboard
          icon={Ryu.copy}
          title="Copy Session URL"
          content={url}
          shortcut={Keyboard.Shortcut.Common.Copy}
        />
        {prs[0] ? (
          <Action.CopyToClipboard
            icon={Ryu.copy}
            title="Copy Pull Request URL"
            content={prs[0].url}
            shortcut={{ modifiers: ["cmd", "shift"], key: "u" }}
          />
        ) : null}
        {s.branch ? (
          <Action.CopyToClipboard
            icon={Ryu.copy}
            title="Copy Branch Name"
            content={s.branch}
            shortcut={{ modifiers: ["cmd", "shift"], key: "b" }}
          />
        ) : null}
        <Action.CopyToClipboard
          icon={Ryu.copy}
          title="Copy Session ID"
          content={s.id}
          shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
        />
      </ActionPanel.Section>
      <ActionPanel.Section title="Manage">
        {isActive(s) ? (
          <Action
            title="Stop Session"
            icon={Ryu.pause}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd", "opt"], key: "s" }}
            onAction={stop}
          />
        ) : null}
        {s.deleted_at ? null : (
          <Action
            title="Archive Session"
            icon={Ryu.archive}
            style={Action.Style.Destructive}
            shortcut={Keyboard.Shortcut.Common.Remove}
            onAction={() => archive(true)}
          />
        )}
        {!s.deleted_at && prs.length ? (
          <Action
            title="Archive Session (Keep PR Open)"
            icon={Ryu.archive}
            style={Action.Style.Destructive}
            onAction={() => archive(false)}
          />
        ) : null}
        {onChange ? (
          <Action title="Refresh" icon={Ryu.refresh} shortcut={Keyboard.Shortcut.Common.Refresh} onAction={onChange} />
        ) : null}
      </ActionPanel.Section>
    </ActionPanel>
  );
}
