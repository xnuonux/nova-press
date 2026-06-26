import Link from "next/link";

import type { TreeNode } from "@/types/works";

// the binder ... the structure tree of a Work, rendered as an outliner. a leaf
// (a piece) links straight into the existing editor; a container holds children
// + an "add page" affordance. reorder nudges a node among its siblings. each row
// carries its corkboard card: a one-line synopsis, a live subtree word count,
// and an optional word target with a quiet progress meter. it is a pure server
// component: the actions are passed in (bound in the route) and post through
// plain forms, so it needs no client js. lunari register throughout.

type ActionFn = (formData: FormData) => Promise<void>;

interface BinderProps {
  workId: string;
  tree: TreeNode[];
  createLeaf: ActionFn;
  reorder: ActionFn;
  setCard: ActionFn;
}

/** a node's word goal, if one was set on its card (node_metadata.wordTarget). */
function wordTargetOf(node: TreeNode): number | null {
  const t = node.nodeMetadata?.wordTarget;
  return typeof t === "number" && t > 0 ? t : null;
}

export function Binder({ workId, tree, createLeaf, reorder, setCard }: BinderProps) {
  return (
    <div className="np-rise np-rise-2 flex flex-col gap-1">
      {tree.length === 0 ? (
        <p
          className="px-3 py-4 font-serif text-base leading-relaxed"
          style={{ color: "var(--lunari-fg-muted)" }}
        >
          an empty binder. add the first page below.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {tree.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              workId={workId}
              createLeaf={createLeaf}
              reorder={reorder}
              setCard={setCard}
            />
          ))}
        </ul>
      )}

      {/* add a page at the root of the work */}
      <div className="mt-2 pl-3">
        <AddPageForm workId={workId} parentId={null} createLeaf={createLeaf} label="add a page" />
      </div>
    </div>
  );
}

function NodeRow({
  node,
  workId,
  createLeaf,
  reorder,
  setCard,
}: {
  node: TreeNode;
  workId: string;
  createLeaf: ActionFn;
  reorder: ActionFn;
  setCard: ActionFn;
}) {
  const indent = 12 + node.depth * 18;
  const isOpenableLeaf = node.isLeaf && node.pieceId;
  const target = wordTargetOf(node);

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-md py-1.5 pr-2 transition-colors hover:bg-white/5"
        style={{ paddingLeft: `${indent}px` }}
      >
        {/* the title: a leaf is a link into the editor; a container is a label. */}
        {isOpenableLeaf ? (
          <Link
            href={`/editor/${node.pieceId}`}
            className="flex-1 truncate font-serif text-[15px] leading-snug transition-opacity hover:opacity-80"
            style={{ color: "var(--lunari-fg-primary)" }}
          >
            {node.title}
          </Link>
        ) : (
          <span
            className="flex-1 truncate font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            {node.title}
          </span>
        )}

        {/* the live word count, and the goal meter if a target is set. */}
        <WordMeter count={node.wordCount} target={target} />

        {/* reorder among siblings ... opacity lifts on hover so the binder stays calm. */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <ReorderButton workId={workId} nodeId={node.id} direction="up" reorder={reorder} />
          <ReorderButton workId={workId} nodeId={node.id} direction="down" reorder={reorder} />
        </div>
      </div>

      {/* the synopsis card line ... shown when set, editable inline via the card. */}
      <Card node={node} workId={workId} setCard={setCard} indent={indent} />

      {/* children + a per-container add affordance */}
      {!node.isLeaf ? (
        <>
          {node.children.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {node.children.map((child) => (
                <NodeRow
                  key={child.id}
                  node={child}
                  workId={workId}
                  createLeaf={createLeaf}
                  reorder={reorder}
                  setCard={setCard}
                />
              ))}
            </ul>
          ) : null}
          <div style={{ paddingLeft: `${indent + 18}px` }} className="py-0.5">
            <AddPageForm
              workId={workId}
              parentId={node.id}
              createLeaf={createLeaf}
              label="+ page"
            />
          </div>
        </>
      ) : null}
    </li>
  );
}

// the word count, plus a quiet progress meter when a target is set. tabular nums
// so the figures don't jitter as they grow. a met goal glows golden hour.
function WordMeter({ count, target }: { count: number; target: number | null }) {
  if (count <= 0 && target == null) return null;
  const pct = target ? Math.min(100, Math.round((count / target) * 100)) : 0;
  const met = target != null && count >= target;
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span
        className="font-mono text-[10px] uppercase tabular-nums tracking-[0.14em]"
        style={{ color: met ? "var(--nova-accent)" : "var(--lunari-fg-subtle)" }}
      >
        {target
          ? `${count.toLocaleString()} / ${target.toLocaleString()}`
          : `${count.toLocaleString()} words`}
      </span>
      {target ? (
        <span
          className="hidden h-1 w-16 overflow-hidden rounded-full sm:block"
          style={{ background: "var(--lunari-border)" }}
          aria-hidden
        >
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: "var(--nova-accent)", opacity: met ? 1 : 0.7 }}
          />
        </span>
      ) : null}
    </span>
  );
}

// the corkboard card: a synopsis line that shows when set, and an inline editor
// (a pure <details>, no client js) to write the synopsis + a word target. the
// synopsis carries the story beat; the target carries the goal.
function Card({
  node,
  workId,
  setCard,
  indent,
}: {
  node: TreeNode;
  workId: string;
  setCard: ActionFn;
  indent: number;
}) {
  const target = wordTargetOf(node);
  return (
    <>
      {/* the synopsis sits ON the board, always visible when set ... a closed
          <details> would hide it, so it lives outside the fold. the editor
          below tucks away until the writer opens it. */}
      {node.synopsis ? (
        <p
          className="py-0.5 font-serif text-[13px] italic leading-snug"
          style={{ paddingLeft: `${indent}px`, color: "var(--lunari-fg-muted)" }}
        >
          {node.synopsis}
        </p>
      ) : null}

      <details className="group/card">
        <summary
          className="flex w-fit cursor-pointer list-none items-center gap-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] opacity-40 transition-opacity marker:hidden hover:opacity-100 focus-visible:opacity-100 group-open/card:opacity-100"
          style={{ paddingLeft: `${indent}px`, color: "var(--nova-accent)" }}
        >
          {node.synopsis ? "edit card" : "+ card"}
        </summary>

        <form
          action={setCard}
          className="flex flex-col gap-2 py-2"
          style={{ paddingLeft: `${indent}px` }}
        >
          <input type="hidden" name="workId" value={workId} />
          <input type="hidden" name="nodeId" value={node.id} />
          <textarea
            name="synopsis"
            defaultValue={node.synopsis ?? ""}
            rows={2}
            placeholder="one line ... what happens here"
            className="w-full max-w-md resize-none rounded-md border border-[var(--lunari-border)] bg-transparent px-3 py-2 font-serif text-[13px] leading-snug outline-none focus:border-[var(--nova-accent)]"
            style={{ color: "var(--lunari-fg-primary)" }}
          />
          <div className="flex items-center gap-3">
            <input
              type="number"
              name="wordTarget"
              min={0}
              step={100}
              defaultValue={target ?? ""}
              placeholder="word goal"
              className="w-28 rounded-md border border-[var(--lunari-border)] bg-transparent px-3 py-1.5 font-mono text-[11px] tabular-nums outline-none focus:border-[var(--nova-accent)]"
              style={{ color: "var(--lunari-fg-primary)" }}
            />
            <button
              type="submit"
              className="inline-flex items-center rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-80"
              style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}
            >
              save card
            </button>
          </div>
        </form>
      </details>
    </>
  );
}

function AddPageForm({
  workId,
  parentId,
  createLeaf,
  label,
}: {
  workId: string;
  parentId: string | null;
  createLeaf: ActionFn;
  label: string;
}) {
  return (
    <form action={createLeaf}>
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <input type="hidden" name="nodeType" value="document" />
      <input type="hidden" name="pieceKind" value="prose" />
      <button
        type="submit"
        className="inline-flex items-center font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-80"
        style={{ color: "var(--nova-accent)" }}
      >
        {label}
      </button>
    </form>
  );
}

function ReorderButton({
  workId,
  nodeId,
  direction,
  reorder,
}: {
  workId: string;
  nodeId: string;
  direction: "up" | "down";
  reorder: ActionFn;
}) {
  return (
    <form action={reorder}>
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="nodeId" value={nodeId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        aria-label={direction === "up" ? "move up" : "move down"}
        className="flex h-5 w-5 items-center justify-center rounded font-mono text-[11px] transition-colors hover:bg-white/10"
        style={{ color: "var(--lunari-fg-subtle)" }}
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}
