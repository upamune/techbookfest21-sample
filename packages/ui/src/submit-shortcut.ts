import type { KeyboardEvent } from "react";

export function submitOnCommandEnter(event: KeyboardEvent<HTMLFormElement>) {
  const isCommandEnter = event.key === "Enter" && (event.metaKey || event.ctrlKey);
  if (!isCommandEnter || event.nativeEvent.isComposing) return;
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  if (submitButton instanceof HTMLButtonElement) submitButton.click();
}
