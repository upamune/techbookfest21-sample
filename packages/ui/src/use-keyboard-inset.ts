import { useEffect } from "react";

export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
