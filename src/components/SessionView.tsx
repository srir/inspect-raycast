import { Action, Detail, Icon } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useEffect } from "react";
import { useLiveSession } from "../hooks";
import { Session } from "../types";
import { SessionMetadata, sessionTitle, statusInfo, transcriptMarkdown } from "../utils";
import { SessionActions } from "./SessionActions";

/** Full transcript + metadata for one session. Polls while the agent is working. */
export function SessionView({ session: initial, onChange }: { session: Session; onChange?: () => void }) {
  const { session, messages, isLoading, revalidate } = useLiveSession(initial);
  const [newestFirst, setNewestFirst] = useCachedState("transcript-newest-first", true);

  // Let the parent list know when the status changes (e.g. running → finished).
  useEffect(() => {
    if (session.status !== initial.status) onChange?.();
  }, [session.status]);

  const refresh = () => {
    revalidate();
    onChange?.();
  };

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={`${statusInfo(session).label} · ${sessionTitle(session)}`}
      markdown={
        messages
          ? transcriptMarkdown(session, messages, { newestFirst })
          : `# ${sessionTitle(session)}\n\nLoading transcript…`
      }
      metadata={<SessionMetadata session={session} inDetail />}
      actions={
        <SessionActions
          session={session}
          onChange={refresh}
          inSessionView
          extra={
            <Action
              title={newestFirst ? "Show Oldest First" : "Show Newest First"}
              icon={Icon.ArrowUpCircle}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={() => setNewestFirst(!newestFirst)}
            />
          }
        />
      }
    />
  );
}
