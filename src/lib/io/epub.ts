// nova press · the mythos · the epub export arm of the io spine.
//
// a Work -> a .epub. the pure part (epubChaptersFromSections) folds the reading
// sections into one chapter per leaf, titled by its breadcrumb path (act one ·
// chapter 1 · scene 1) so a flat epub toc still carries the structure. the
// impure part (workToEpub) hands those chapters to @lesjoursfr/html-to-epub,
// which writes a real .epub into a throwaway temp dir we read back + clean up.
// the heavy epub lib is imported lazily (and kept external via next.config's
// serverExternalPackages), so the pure helper stays unit-testable and the
// server compiler never mangles its filesystem render.

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** a reading section as the epub builder needs it: a leaf already carries its
 *  serialized html; a container carries only structure (its title rides the
 *  breadcrumb path of the leaves beneath it). */
export interface EpubSection {
  title: string;
  depth: number;
  isLeaf: boolean;
  html: string;
}

/** an epub chapter ... a title + its html body. */
export interface EpubChapter {
  title: string;
  data: string;
}

/**
 * one chapter per leaf, in reading order, titled by the path of its ancestor
 * containers joined with " · ". a container never becomes a chapter on its own;
 * it lends its title to the leaves beneath it. an empty leaf still ships an
 * empty paragraph so the chapter is valid xhtml.
 */
export function epubChaptersFromSections(sections: readonly EpubSection[]): EpubChapter[] {
  const stack: { depth: number; title: string }[] = [];
  const chapters: EpubChapter[] = [];
  for (const s of sections) {
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= s.depth) {
      stack.pop();
    }
    if (s.isLeaf) {
      const path = [...stack.map((a) => a.title), s.title].filter(Boolean).join(" · ");
      chapters.push({ title: path || s.title || "untitled", data: s.html || "<p></p>" });
    } else {
      stack.push({ depth: s.depth, title: s.title });
    }
  }
  return chapters;
}

/**
 * render chapters into a .epub and return its bytes. writes into a fresh temp
 * dir (the lib needs a real output path), reads it back, and removes the dir.
 * server-only by nature ... it touches the filesystem + a heavy dep, so it is
 * imported only from a route, never the client.
 */
export async function workToEpub(title: string, chapters: EpubChapter[]): Promise<Buffer> {
  const { EPub } = await import("@lesjoursfr/html-to-epub");

  const safeTitle = title.trim() || "untitled";
  const content = chapters.length > 0 ? chapters : [{ title: safeTitle, data: "<p></p>" }];

  const dir = await mkdtemp(join(tmpdir(), "np-epub-"));
  const out = join(dir, "book.epub");
  try {
    const epub = new EPub(
      {
        title: safeTitle,
        description: safeTitle,
        // no author: the writer owns the book, not the platform (and there's no
        // nova-owned display name in the shared substrate to credit anyway).
        lang: "en",
        tocTitle: "contents",
        appendChapterTitles: true,
        // keep the lib's OWN working dir UNDER our throwaway dir, so the finally
        // below cleans it on success AND on error, and nothing is ever written
        // inside node_modules (which is read-only on a serverless prod fs).
        tempDir: dir,
        content,
      },
      out,
    );
    await epub.render();
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
