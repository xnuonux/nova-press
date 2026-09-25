import { draftText, indexDraft, type Draft } from "./manuscript-desk";

export type DraftFile = Readonly<{ filename: string; mime: string; content: string }>;
const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]!);

export function draftFilename(title: string): string {
  const clean = Array.from(title.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ").trim().replace(/^\.+|[. ]+$/g, "")).slice(0, 64).join("");
  return !clean || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean) ? "nova-draft" : clean;
}

/** an intentionally text-first proof; never a replacement for the rich source. */
export function readingProof(draft: Draft): string {
  const blocks = indexDraft(draft);
  const body = blocks.map((block) => {
    const text = escape(block.text);
    if (/^h[1-6]$/.test(block.type)) return `<${block.type}>${text}</${block.type}>`;
    if (block.type === "hr") return "<hr>";
    if (block.type === "blockquote") return `<blockquote>${text}</blockquote>`;
    if (block.type === "verse_line") return `<div class="verse">${text || "<br>"}</div>`;
    return `<p>${text || "<br>"}</p>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer"><title>${escape(draft.title || "untitled")}</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f5f1e9;color:#25221e;font:18px/1.8 Georgia,serif}main{max-width:72ch;margin:0 auto;padding:64px 28px 100px}header{border-bottom:1px solid #c8b98a;margin-bottom:40px;padding-bottom:28px}.eyebrow,footer{font:12px/1.6 system-ui,sans-serif;letter-spacing:.08em;color:#655c4a}h1{font-size:2.5rem;line-height:1.15;font-weight:400;overflow-wrap:anywhere}h2,h3,h4,h5,h6{line-height:1.35;font-weight:400;break-after:avoid;overflow-wrap:anywhere}p,blockquote,.verse{white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4}p{margin:1.25em 0;orphans:3;widows:3}.verse{min-height:1.8em}blockquote{margin:1.5em 0;padding-left:1.3em;border-left:2px solid #ac9556}hr{border:0;border-top:1px solid #c8b98a;margin:2em 0}footer{margin-top:56px;border-top:1px solid #c8b98a;padding-top:18px;letter-spacing:0}@media(max-width:480px){main{padding:32px 20px}h1{font-size:2rem}}@media print{body{background:white;color:black}main{padding:0;max-width:none}.eyebrow,footer{color:#555}header{break-after:avoid}@page{margin:22mm}}
</style></head><body><main><header><div class="eyebrow">nova press ... private draft proof</div><h1>${escape(draft.title || "untitled")}</h1></header>
${body}
<footer>text-first proof of a local draft ... not a publication or a save receipt. inline marks, links, media and complex layouts are not reproduced. keep the json snapshot for the full source.${blocks.some((b) => !b.readable) ? " some blocks have no readable text and are omitted here." : ""}</footer>
</main></body></html>`;
}

export function exportDraft(draft: Draft, format: "json" | "txt" | "html", createdAt: string): DraftFile {
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("the export needs a valid date");
  const basename = draftFilename(draft.title);
  if (format === "json") return {
    filename: `${basename}.nova.json`, mime: "application/json;charset=utf-8",
    content: JSON.stringify({ format: "nova-press-draft", version: 1, capturedAt: createdAt,
      custody: "local draft ... server save and publication are not attested",
      pieceId: draft.pieceId, title: draft.title, body: draft.body }, null, 2) + "\n",
  };
  if (format === "txt") return {
    filename: `${basename}.txt`, mime: "text/plain;charset=utf-8",
    content: draft.title + "\n\n" + draftText(draft),
  };
  if (format === "html") return {
    filename: `${basename}.proof.html`, mime: "text/html;charset=utf-8", content: readingProof(draft),
  };
  throw new Error("unknown draft export format");
}
