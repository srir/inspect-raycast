import { Ryu } from "../icons";
import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useState } from "react";
import { sendPrompt } from "../api";
import { Session } from "../types";
import { isActive, sessionTitle } from "../utils";

export function FollowUpForm({
  session,
  initialPrompt,
  onSent,
}: {
  session: Session;
  initialPrompt?: string;
  onSent?: () => void;
}) {
  const { pop } = useNavigation();
  const [error, setError] = useState<string>();

  async function submit(values: { prompt: string; delivery: "immediate" | "queued" }) {
    if (!values.prompt.trim()) {
      setError("Prompt is required");
      return;
    }
    const toast = await showToast({ style: Toast.Style.Animated, title: "Sending follow-up…" });
    try {
      const res = await sendPrompt(session.id, { prompt: values.prompt, delivery: values.delivery });
      toast.style = Toast.Style.Success;
      toast.title = res.queued_prompt ? "Follow-up queued" : "Follow-up sent";
      onSent?.();
      pop();
    } catch (e) {
      await toast.hide();
      await showFailureToast(e, { title: "Couldn't send follow-up" });
    }
  }

  return (
    <Form
      navigationTitle={`Follow up · ${sessionTitle(session)}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Follow-Up" icon={Ryu.send} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Session"
        text={`${sessionTitle(session)}${session.deleted_at ? " (archived, will be restored)" : ""}`}
      />
      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="Ask Inspect to keep going…"
        defaultValue={initialPrompt}
        enableMarkdown
        error={error}
        onChange={() => error && setError(undefined)}
      />
      <Form.Dropdown
        id="delivery"
        title="Delivery"
        defaultValue="immediate"
        info="Immediate interrupts the current turn; queued waits until the agent finishes."
      >
        <Form.Dropdown.Item value="immediate" title="Immediate" icon={Ryu.send} />
        <Form.Dropdown.Item
          value="queued"
          title={isActive(session) ? "Queue after current turn" : "Queued"}
          icon={Ryu.history}
        />
      </Form.Dropdown>
    </Form>
  );
}
