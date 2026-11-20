import { LaunchProps } from "@raycast/api";
import { NewSessionComposer } from "./components/NewSessionComposer";

export default function Command(props: LaunchProps<{ arguments: { prompt?: string } }>) {
  return <NewSessionComposer initialPrompt={props.arguments.prompt || props.fallbackText || undefined} />;
}
