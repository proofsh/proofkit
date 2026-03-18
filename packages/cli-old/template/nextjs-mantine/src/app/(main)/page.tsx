import {
  ActionIcon,
  Anchor,
  AppShellFooter,
  Box,
  Code,
  Container,
  Group,
  Image,
  px,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconBrandGithub, IconExternalLink } from "@tabler/icons-react";

export default function Home() {
  return (
    <>
      <Container mt="5rem">
        <Stack gap="xl" ta="center">
          <Image
            src="https://raw.githubusercontent.com/proofgeist/proofkit/dde6366c529104658dfba67a8fc2910a8644fc64/docs/src/assets/proofkit.png"
            alt="ProofKit"
            style={{
              marginRight: "auto",
              marginLeft: "auto",
            }}
            w={"auto"}
            mah={px("16rem")}
          />
          <Title order={1}>Welcome!</Title>

          <Text style={{ textWrap: "balance" }}>
            This is the base template home page. To add more pages, components,
            or other features, run the ProofKit CLI from within your project.
          </Text>
          <Code block>__PNPM_COMMAND__ proofkit</Code>

          <Text style={{ textWrap: "balance" }}>
            To change this page, open <Code>src/app/(main)/page.tsx</Code>
          </Text>
          <Box>
            <Anchor
              href="https://proofkit.dev"
              target="_blank"
              rel="proofkit-app"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              ProofKit Docs <IconExternalLink size={px("1rem")} />
            </Anchor>
          </Box>
        </Stack>
      </Container>
      <AppShellFooter withBorder={false}>
        <Container h="100%" mb="1rem">
          <Group justify="space-between">
            <Group>
              <Text size="sm" c="dimmed">
                Sponsored by{" "}
                <Anchor
                  href="https://proofgeist.com"
                  target="_blank"
                  rel="proofkit-app"
                >
                  Proof+Geist
                </Anchor>{" "}
                and{" "}
                <Anchor
                  href="https://ottomatic.cloud"
                  target="_blank"
                  rel="proofkit-app"
                >
                  Ottomatic
                </Anchor>
              </Text>
            </Group>
            <Group>
              <a href="https://github.com/proofgeist/proofkit" target="_blank">
                <ActionIcon variant="subtle" color="gray" size="lg">
                  <IconBrandGithub size={px("1.25rem")} />
                </ActionIcon>
              </a>
            </Group>
          </Group>
        </Container>
      </AppShellFooter>
    </>
  );
}
