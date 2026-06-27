// the one rule for turning a title into a safe download filename slug. shared by
// every export route (markdown / docx / epub) so the slug is defined once.
export function fileSlug(title: string, fallback: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}
