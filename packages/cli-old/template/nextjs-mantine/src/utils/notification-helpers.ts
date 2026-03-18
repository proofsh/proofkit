import {
  showNotification,
  type NotificationData,
} from "@mantine/notifications";

export function showErrorNotification(): void;
export function showErrorNotification(props: NotificationData): void;
export function showErrorNotification(message: string): void;
export function showErrorNotification(args?: string | NotificationData): void {
  const message =
    typeof args === "string" ? args : "An unexpected error occurred.";
  const defaultProps = typeof args === "string" ? {} : (args ?? {});

  showNotification({ color: "red", title: "Error", message, ...defaultProps });
}

export function showSuccessNotification(): void;
export function showSuccessNotification(props: NotificationData): void;
export function showSuccessNotification(message: string): void;
export function showSuccessNotification(
  args?: string | NotificationData,
): void {
  const message = typeof args === "string" ? args : "Success!";
  const defaultProps = typeof args === "string" ? {} : (args ?? {});

  showNotification({
    color: "green",
    title: "Success",
    message,
    ...defaultProps,
  });
}
