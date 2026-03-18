import { AuthCodeEmail } from "@/emails/auth-code";
import { render } from "@react-email/render";

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

  // TODO: Customize this function to actually send the email to your users
  // Learn more: https://proofkit.dev/auth/fm-addon
  console.warn("TODO: Customize this function to actually send to your users");
  console.log(`To ${to}: Your ${type} code is ${code}`);
}
