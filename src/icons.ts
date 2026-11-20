// Icons extracted from Inspect's own icon set (Ryu). Each has a `@dark` variant
// that Raycast picks automatically in dark mode; tintColor recolors them.
const icon = (name: string) => `icons/${name}.png`;

export const Ryu = {
  activity: icon("activity"),
  alert: icon("alert-circle"),
  archive: icon("archive"),
  check: icon("check-circle"),
  history: icon("history"),
  code: icon("code"),
  branch: icon("git-branch"),
  merge: icon("git-merge"),
  prClosed: icon("git-draft"),
  github: icon("brand-github"),
  message: icon("message-circle"),
  memo: icon("memo"),
  link: icon("link"),
  globe: icon("globe"),
  pause: icon("pause"),
  play: icon("play"),
  plus: icon("plus"),
  copy: icon("copy"),
  refresh: icon("refresh-cw"),
  table: icon("table"),
  send: icon("arrow-up"),
  app: "inspect.png",
  /** Mascot with transparent padding: Raycast scales empty-view icons to a fixed, large box. */
  appSmall: "inspect-empty.png",
} as const;
