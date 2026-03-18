import { AuthCodeEmail } from "@/emails/auth-code";

import { resend } from "../services/resend";

export async function sendEmail({
  to,
  code,
  type,
}: {
  to: string;
  code: string;
  type: "verification" | "password-reset";
}) {
  const subject =
    type === "verification" ? "Verify Your Email" : "Reset Your Password";

  await resend.emails.send({
    // TODO: Change this to our own email after verifying your domain with Resend
    from: "ProofKit <onboarding@resend.dev>",
    to,
    subject,
    react: <AuthCodeEmail validationCode={code} type={type} />,
  });
}
