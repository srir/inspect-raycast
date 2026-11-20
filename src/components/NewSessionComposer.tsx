import { Action, ActionPanel, Icon, Keyboard, List, open, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast, useCachedState } from "@raycast/utils";
import { useEffect, useState } from "react";
import { createSession, prefs, sessionUrl } from "../api";
import { DEFAULT_VARIANTS, repoLabel, useModels, useRepositories } from "../hooks";
import { Ryu } from "../icons";
import { NewSessionForm } from "./NewSessionForm";
import { SessionView } from "./SessionView";

/**
 * Chat-style composer: the search bar is the prompt, the dropdown next to it picks the
 * repository, and model/effort live in the action panel (shown as chips on the row).
 */
export function NewSessionComposer({ initialPrompt, onCreated }: { initialPrompt?: string; onCreated?: () => void }) {
  const { push } = useNavigation();
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [lastRepo, setLastRepo] = useCachedState<string>("last-repository", "");
  const [repo, setRepo] = useState<string>(prefs().defaultRepository?.trim() || lastRepo);
  const [model, setModel] = useCachedState<string>("last-model", "");
  const [variant, setVariant] = useCachedState<string>("last-variant", "");
  const [submitting, setSubmitting] = useState(false);

  const repos = useRepositories();
  const { models, isLoading: modelsLoading } = useModels();

  // Fall back to Inspect's first suggestion when nothing valid is selected.
  useEffect(() => {
    if (!repos.loaded) return;
    if (!repo || (repo !== "auto" && !repos.all.some((r) => r.id === repo))) {
      setRepo(repos.suggested[0]?.id ?? repos.all[0]?.id ?? "auto");
    }
  }, [repos.loaded]);

  const selectedModel = models.find((m) => m.id === model);
  const variants = selectedModel?.supported_variants?.length ? selectedModel.supported_variants : DEFAULT_VARIANTS;
  const selectedRepo = repos.all.find((r) => r.id === repo);
  const repoText = repo === "auto" ? "Auto-detect repo" : selectedRepo ? repoLabel(selectedRepo) : "Repository";
  const modelText = selectedModel?.name ?? "Default model";

  async function start() {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Starting session…" });
    try {
      const session = await createSession({
        repository: repo || "auto",
        prompt: prompt.trim(),
        ...(model ? { model } : {}),
        ...(variant ? { variant } : {}),
      });
      if (repo && repo !== "auto") setLastRepo(repo);
      toast.style = Toast.Style.Success;
      toast.title = "Session started";
      toast.message = session.title ?? undefined;
      toast.primaryAction = {
        title: "Open in Inspect",
        shortcut: { modifiers: ["cmd", "shift"], key: "o" },
        onAction: () => open(sessionUrl(session.id)),
      };
      setPrompt("");
      onCreated?.();
      push(<SessionView session={session} onChange={onCreated} />);
    } catch (e) {
      await toast.hide();
      await showFailureToast(e, { title: "Couldn't start session" });
    } finally {
      setSubmitting(false);
    }
  }

  const actions = (
    <ActionPanel>
      {prompt.trim() ? <Action title="Start Session" icon={Ryu.send} onAction={start} /> : null}
      <ActionPanel.Submenu title="Model" icon={Icon.Stars} shortcut={{ modifiers: ["cmd"], key: "m" }}>
        <Action title="Default" icon={model === "" ? Icon.Checkmark : undefined} onAction={() => setModel("")} />
        {models.map((m) => (
          <Action
            key={m.id}
            title={m.name}
            icon={model === m.id ? Icon.Checkmark : undefined}
            onAction={() => {
              setModel(m.id);
              if (variant && !m.supported_variants.includes(variant)) setVariant("");
            }}
          />
        ))}
      </ActionPanel.Submenu>
      <ActionPanel.Submenu title="Effort" icon={Ryu.activity} shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}>
        <Action title="Default" icon={variant === "" ? Icon.Checkmark : undefined} onAction={() => setVariant("")} />
        {variants.map((v) => (
          <Action key={v} title={v} icon={variant === v ? Icon.Checkmark : undefined} onAction={() => setVariant(v)} />
        ))}
      </ActionPanel.Submenu>
      <Action.Push
        title="Open Full Editor"
        icon={Ryu.memo}
        shortcut={Keyboard.Shortcut.Common.Edit}
        target={
          <NewSessionForm
            initialPrompt={prompt}
            initialRepository={repo}
            initialModel={model}
            initialVariant={variant}
            onCreated={onCreated}
          />
        }
      />
    </ActionPanel>
  );

  const chips: List.Item.Accessory[] = [
    { tag: modelText, icon: Icon.Stars, tooltip: "Model (⌘M)" },
    ...(variant ? [{ tag: variant, tooltip: "Effort (⌘⇧E)" }] : []),
  ];

  return (
    <List
      navigationTitle="New Inspect Session"
      isLoading={repos.isLoading || modelsLoading || submitting}
      filtering={false}
      searchText={prompt}
      onSearchTextChange={setPrompt}
      searchBarPlaceholder="What should Inspect work on?"
      searchBarAccessory={
        <List.Dropdown tooltip="Repository" value={repo || undefined} onChange={setRepo}>
          {repos.suggested.length ? (
            <List.Dropdown.Section title="Suggested">
              {repos.suggested.map((r) => (
                <List.Dropdown.Item key={r.id} value={r.id} title={repoLabel(r)} icon={Ryu.code} keywords={[r.id]} />
              ))}
            </List.Dropdown.Section>
          ) : null}
          <List.Dropdown.Section title={repos.suggested.length ? "All Repositories" : undefined}>
            {repos.others.map((r) => (
              <List.Dropdown.Item key={r.id} value={r.id} title={repoLabel(r)} icon={Ryu.code} keywords={[r.id]} />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section>
            <List.Dropdown.Item value="auto" title="Auto-detect from prompt" icon={Icon.Wand} />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {prompt.trim() ? (
        <List.Item icon={Ryu.send} title={prompt.trim()} subtitle={repoText} accessories={chips} actions={actions} />
      ) : (
        <List.EmptyView
          icon={Ryu.appSmall}
          title={`${repoText} · ${modelText}${variant ? ` · ${variant}` : ""}`}
          description="Type a prompt, then ↵ to start  ·  ⌘M model  ·  ⌘E full editor"
          actions={actions}
        />
      )}
    </List>
  );
}
