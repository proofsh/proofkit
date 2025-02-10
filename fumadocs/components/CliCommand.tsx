import { Tab, Tabs } from "fumadocs-ui/components/tabs";

interface Props {
  command: string | string[];
  type?: "local" | "execute" | "create";
  // frame?: Parameters<typeof Code>[0]["frame"];
}
export default function CliCommand({ command, type = "local" }: Props) {
  return (
    <Tabs items={["Javascript", "Rust"]}>
      <Tab value="Javascript">Javascript is weird</Tab>
      <Tab value="Rust">Rust is fast</Tab>
    </Tabs>
  );
}
