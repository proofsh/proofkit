import { AuthCodeEmail } from "@/emails/auth-code";
import { render } from "@react-email/render";

import { plunk } from "../services/plunk";

export async function sendEmail({
  to,
  code,
  type,
}: {
  to: string;
  code: string;
  type: "verification" | "password-reset";
}) {
  // this is the HTML body of the email to be send
  const body = await render(
    <AuthCodeEmail validationCode={code} type={type} />
  );
  const subject =
    type === "verification" ? "Verify Your Email" : "Reset Your Password";

  await plunk.emails.send({
    to,
    subject,
    body,
  });
}
