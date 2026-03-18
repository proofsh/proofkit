import { Body, Button, Container, Head, Heading, Hr, Html, Img, Section, Text } from "@react-email/components";

export interface GenericEmailProps {
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  footer?: string;
}

export const GenericEmail = ({ title, description, ctaText, ctaHref, footer }: GenericEmailProps) => (
  <Html>
    <Head />
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Img
          alt="ProofKit"
          height="175"
          src="https://proofkit.dev/_astro/proofkit.DNcFg0_B_1JN3Dz.webp"
          style={styles.logo}
          width="238"
        />

        {title ? <Heading style={styles.title}>{title}</Heading> : null}

        {description ? <Text style={styles.description}>{description}</Text> : null}

        {ctaText && ctaHref ? (
          <Section style={styles.ctaSection}>
            <Button href={ctaHref} style={styles.ctaButton}>
              {ctaText}
            </Button>
          </Section>
        ) : null}

        {(title || description || (ctaText && ctaHref)) && <Hr style={styles.hr} />}

        {footer ? <Text style={styles.footer}>{footer}</Text> : null}
      </Container>
    </Body>
  </Html>
);

GenericEmail.PreviewProps = {
  title: "Welcome to ProofKit",
  description: "Thanks for trying ProofKit. This is a sample email template you can customize.",
  ctaText: "Get Started",
  ctaHref: "https://proofkit.dev",
  footer: "You received this email because you signed up for updates.",
} as GenericEmailProps;

export default GenericEmail;

const styles = {
  main: {
    backgroundColor: "#ffffff",
    fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #eee",
    borderRadius: "5px",
    boxShadow: "0 5px 10px rgba(20,50,70,.2)",
    marginTop: "20px",
    maxWidth: "520px",
    margin: "0 auto",
    padding: "48px 32px 36px",
  } as React.CSSProperties,
  logo: {
    margin: "0 auto 12px",
    display: "block",
  } as React.CSSProperties,
  title: {
    color: "#111827",
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: "28px",
    margin: "8px 0 4px",
    textAlign: "center" as const,
  },
  description: {
    color: "#374151",
    fontSize: "15px",
    lineHeight: "22px",
    margin: "8px 0 0",
    textAlign: "center" as const,
  },
  ctaSection: {
    textAlign: "center" as const,
    marginTop: "20px",
  },
  ctaButton: {
    backgroundColor: "#0a85ea",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "20px",
    textDecoration: "none",
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: "6px",
  } as React.CSSProperties,
  hr: {
    borderColor: "#e5e7eb",
    margin: "24px 0 12px",
  },
  footer: {
    color: "#6b7280",
    fontSize: "12px",
    lineHeight: "18px",
    textAlign: "center" as const,
  },
};
