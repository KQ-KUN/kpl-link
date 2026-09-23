export type Theme = "light" | "dark";

const STORAGE_KEY = "kpl-link:theme";

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const next = theme === "light" ? "dark" : "light";
  const toggle = document.querySelector<HTMLButtonElement>("#theme-toggle");
  toggle?.setAttribute("aria-label", `切换${next === "light" ? "浅色" : "深色"}模式`);
  const icon = toggle?.querySelector<HTMLElement>(".theme-icon");
  const label = toggle?.querySelector<HTMLElement>(".theme-label");
  if (icon) icon.textContent = theme === "light" ? "◐" : "☀";
  if (label) label.textContent = theme === "light" ? "深色" : "浅色";
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "light" ? "#f3f6fb" : "#080d1b",
  );
}

export function setupTheme(): void {
  const initial: Theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  applyTheme(initial);
  document.querySelector<HTMLButtonElement>("#theme-toggle")?.addEventListener("click", () => {
    const next: Theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The selected theme still applies for this page when storage is unavailable.
    }
  });
}
