/**
 * Shared by the cache and the precompute script. Lives on its own so plain Node can
 * import it: the `@/` alias only exists inside the Next build.
 */
export function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos: "robótica" == "robotica"
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
