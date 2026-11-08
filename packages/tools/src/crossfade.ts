import { flushSync } from "react-dom";

export function crossfade(apply: () => void) {
  if (!("startViewTransition" in document)) {
    apply();
    return;
  }
  document.startViewTransition(() => {
    flushSync(apply);
  });
}
