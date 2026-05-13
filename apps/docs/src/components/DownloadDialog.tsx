"use client";

import { Check, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trackDownloadRequest } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value: string) => emailPattern.test(value);

type Platform = "mac" | "win";

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform;
}

export function DownloadDialog({ open, onOpenChange, platform }: DownloadDialogProps) {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      await trackDownloadRequest({
        email,
        platform,
      });

      setSubmittedEmail(email);
      setEmail("");
    } catch {
      // Keep dialog open and preserve the email when tracking fails.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSubmittedEmail("");
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        {submittedEmail ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
              <Check className="size-5" />
            </div>
            <p className="font-semibold">Check your email</p>
            <p className="text-gray-500 text-sm dark:text-gray-400">
              We sent a download link to{" "}
              <span className="font-medium text-gray-900 dark:text-gray-100">{submittedEmail}</span>.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Download ProofKit</DialogTitle>
              <DialogDescription>
                Enter your email below and we'll send you a download link. We only use this email to notify you about
                critical ProofKit updates.
              </DialogDescription>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm" htmlFor="download-email">
                  Email
                </label>
                <input
                  autoComplete="email"
                  className={cn(
                    "flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-white transition",
                    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
                    "dark:border-white/15 dark:ring-offset-gray-950 dark:focus:ring-gray-600 dark:placeholder:text-gray-500",
                  )}
                  id="download-email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
              <Button
                className="h-11 w-full gap-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                disabled={!isValidEmail(email) || isSubmitting}
                type="submit"
              >
                <Send className="size-4" />
                {isSubmitting ? "Sending..." : "Send download link"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
