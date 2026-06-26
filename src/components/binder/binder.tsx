import Link from "next/link";

import type { TreeNode } from "@/types/works";

// the binder ... the structure tree of a Work, rendered as an outliner. a leaf
// (a piece) links straight into the existing editor; a container holds children
// + an "add page" affordance. reorder nudges a node among its siblings. it is a
// pure server component: the actions are passed in (bound in the route) and post
// through plain forms, so it needs no client js. lunari register throughout.

type ActionFn = (formData: FormData) => Promise<void>;

interface BinderProps {
  workId: string;
  tree: TreeNode[];
  createLeaf: ActionFn;
  reorder: ActionFn;
}

export function Binder({ workId, tree, createLeaf, reorder }: BinderProps) {
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
}: {
  node: TreeNode;
  workId: string;
  createLeaf: ActionFn;
  reorder: ActionFn;
}) {
  const indent = 12 + node.depth * 18;
  const isOpenableLeaf = node.isLeaf && node.pieceId;

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

        {/* reorder among siblings ... opacity lifts on hover so the binder stays calm. */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <ReorderButton workId={workId} nodeId={node.id} direction="up" reorder={reorder} />
          <ReorderButton workId={workId} nodeId={node.id} direction="down" reorder={reorder} />
        </div>
      </div>

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
