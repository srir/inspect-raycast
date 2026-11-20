# Inspect for Raycast

A [Raycast](https://raycast.com) extension for [Inspect](https://docs.inspect.com), the background coding agent: browse your sessions, follow along as they run, reply to them, and start new ones without leaving the keyboard.

> Unofficial. Not affiliated with or endorsed by Ramp or Inspect.

## Commands

### Search Sessions

Lists your sessions, with running ones pinned in an **Active** section that refreshes automatically.

- **Preview pane** (⌘D): status, repo, branch, diff size, pull requests, preview deploy, model, cost, plus the original prompt and the latest reply.
- **↵** opens the full transcript, which updates live while the agent works.
- **⌘F** replies inline: the search bar becomes a message box and the side pane shows the conversation. ↵ sends now, ⌘↵ queues until the current turn finishes, ⌘E opens a full editor.
- Filter by title, repo, branch, PR number, tag, or ID. The dropdown switches between your sessions and everyone's, with or without archived ones.

| Action                                  | Shortcut              |
| --------------------------------------- | --------------------- |
| Open in Inspect                         | ⌘↵                    |
| Reply                                   | ⌘F                    |
| Open pull request                       | ⌘⇧G                   |
| Open preview deploy                     | ⌘⇧V                   |
| Copy session URL / PR URL / branch / ID | ⌘⇧C / ⌘⇧U / ⌘⇧B / ⌘⇧I |
| Stop session                            | ⌘⌥S                   |
| Archive session                         | ⌃X                    |
| New session                             | ⌘N                    |
| Toggle preview                          | ⌘D                    |
| Refresh                                 | ⌘R                    |

### New Session

A chat-style composer: type the prompt in the search bar, pick the repository from the dropdown beside it, and press ↵. Inspect's suggested repositories are listed first, and there's an "Auto-detect from prompt" option.

- **⌘M** picks the model and **⌘⇧E** the effort level. Both are remembered, along with the last repository you used.
- **⌘E** opens a full editor for long prompts and less common options (title, base branch, visibility).

You can also type the prompt straight after the command name in Raycast's root search.

## Setup

1. Create a personal API key in Inspect under **Settings → API keys** (keys start with `riu_`). Personal keys that go unused for 21 days are revoked automatically.
2. Install the extension (see below) and paste the key when Raycast asks for it.
3. If your company runs Inspect at its own address (for example `https://yourcompany.inspect.com`), set **Inspect URL** in the extension's preferences. It defaults to `https://app.inspect.com`.

Optionally set **Default Repository** to the repository ID you want preselected for new sessions.

## Install from source

```sh
git clone https://github.com/srir/inspect-raycast.git
cd inspect-raycast
npm install
npm run dev
```

`npm run dev` builds the extension and loads it into Raycast. It stays installed after you stop the dev server.

## Development

```sh
npm run lint   # ESLint + Prettier via the Raycast CLI
npm run build  # production build
```

The extension talks to Inspect's public REST API (`/api/v2`). See the [API docs](https://docs.inspect.com/api).

- `src/api.ts`: API client
- `src/sessions.tsx`: Search Sessions command and inline reply mode
- `src/components/NewSessionComposer.tsx`: New Session command
- `src/components/`: transcript view, actions, and forms

## License

The code is MIT licensed (see [LICENSE](LICENSE)). The Inspect name, mascot, and icons in `assets/` belong to their owners and are not covered by that license.
