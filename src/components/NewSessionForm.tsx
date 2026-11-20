import { Action, ActionPanel, Form, Icon, open, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast, useCachedState } from "@raycast/utils";
import { useEffect, useState } from "react";
import { createSession, CreateSessionBody, prefs, sessionUrl } from "../api";
import { DEFAULT_VARIANTS, repoLabel, useModels, useRepositories } from "../hooks";
import { Ryu } from "../icons";
import { Repository } from "../types";
import { SessionView } from "./SessionView";

interface Values {
  prompt: string;
  title: string;
  baseBranch: string;
  variant: string;
  visibility: string;
}

interface Props {
  initialPrompt?: string;
  initialRepository?: string;
  initialModel?: string;
  initialVariant?: string;
  onCreated?: () => void;
}

/** Full editor for long prompts and the less common options (title, base branch, visibility). */
export function NewSessionForm({ initialPrompt, initialRepository, initialModel, initialVariant, onCreated }: Props) {
  const { push } = useNavigation();
  const [lastRepo, setLastRepo] = useCachedState<string>("last-repository", "");
  const [repo, setRepo] = useState<string>(initialRepository || prefs().defaultRepository?.trim() || lastRepo);
  const [model, setModel] = useState(initialModel ?? "");
  const [promptError, setPromptError] = useState<string>();

  const repos = useRepositories();
  const { models, isLoading: modelsLoading } = useModels();

  useEffect(() => {
    if (!repos.loaded) return;
    if (!repo || (repo !== "auto" && !repos.all.some((r) => r.id === repo))) {
      setRepo(repos.suggested[0]?.id ?? repos.all[0]?.id ?? "auto");
    }
  }, [repos.loaded]);

  const selectedModel = models.find((m) => m.id === model);
  const variants = selectedModel?.supported_variants?.length ? selectedModel.supported_variants : DEFAULT_VARIANTS;
  const selectedRepo = repos.all.find((r) => r.id === repo);

  async function submit(v: Values) {
    if (!v.prompt.trim()) {
      setPromptError("Tell Inspect what to do");
      return;
    }
    const body: CreateSessionBody = {
      repository: repo || "auto",
      prompt: v.prompt,
      ...(v.title.trim() ? { title: v.title.trim() } : {}),
      ...(v.baseBranch.trim() ? { base_branch: v.baseBranch.trim() } : {}),
      ...(model ? { model } : {}),
      ...(v.variant ? { variant: v.variant } : {}),
      ...(v.visibility ? { visibility: v.visibility as "public" | "private" } : {}),
    };
    const toast = await showToast({ style: Toast.Style.Animated, title: "Starting session…" });
    try {
      const session = await createSession(body);
      if (repo && repo !== "auto") setLastRepo(repo);
      toast.style = Toast.Style.Success;
      toast.title = "Session started";
      toast.message = session.title ?? undefined;
      toast.primaryAction = {
        title: "Open in Inspect",
        shortcut: { modifiers: ["cmd", "shift"], key: "o" },
        onAction: () => open(sessionUrl(session.id)),
      };
      onCreated?.();
      push(<SessionView session={session} onChange={onCreated} />);
    } catch (e) {
      await toast.hide();
      await showFailureToast(e, { title: "Couldn't start session" });
    }
  }

  return (
    <Form
      isLoading={repos.isLoading || modelsLoading}
      navigationTitle="New Inspect Session"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Start Session" icon={Ryu.play} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="repository" title="Repository" value={repo} onChange={setRepo} filtering throttle={false}>
        {repos.suggested.length ? (
          <Form.Dropdown.Section title="Suggested">
            {repos.suggested.map((r) => (
              <RepoItem key={r.id} repo={r} />
            ))}
          </Form.Dropdown.Section>
        ) : null}
        <Form.Dropdown.Section title={repos.suggested.length ? "All Repositories" : undefined}>
          {repos.others.map((r) => (
            <RepoItem key={r.id} repo={r} />
          ))}
        </Form.Dropdown.Section>
        <Form.Dropdown.Section>
          <Form.Dropdown.Item value="auto" title="Auto-detect from prompt" icon={Icon.Wand} />
        </Form.Dropdown.Section>
      </Form.Dropdown>
      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="Fix the flaky checkout test and open a PR…"
        defaultValue={initialPrompt}
        enableMarkdown
        error={promptError}
        onChange={() => promptError && setPromptError(undefined)}
      />
      <Form.Separator />
      <Form.TextField id="title" title="Title" placeholder="Generated if left blank" />
      <Form.TextField
        id="baseBranch"
        title="Base Branch"
        placeholder={selectedRepo?.base_branch ?? "Repository default"}
      />
      <Form.Dropdown id="model" title="Model" value={model} onChange={setModel}>
        <Form.Dropdown.Item value="" title="Default" icon={Icon.Stars} />
        {models.map((m) => (
          <Form.Dropdown.Item key={m.id} value={m.id} title={m.name} keywords={[m.id, ...(m.aliases ?? [])]} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="variant" title="Effort" defaultValue={initialVariant ?? ""}>
        <Form.Dropdown.Item value="" title="Default" />
        {variants.map((v) => (
          <Form.Dropdown.Item key={v} value={v} title={v} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="visibility" title="Visibility" defaultValue="">
        <Form.Dropdown.Item value="" title="Default" />
        <Form.Dropdown.Item value="public" title="Public (org can view)" icon={Ryu.globe} />
        <Form.Dropdown.Item value="private" title="Private" icon={Icon.Lock} />
      </Form.Dropdown>
    </Form>
  );
}

function RepoItem({ repo }: { repo: Repository }) {
  return <Form.Dropdown.Item value={repo.id} title={repoLabel(repo)} icon={Ryu.code} keywords={[repo.id, repo.name]} />;
}
