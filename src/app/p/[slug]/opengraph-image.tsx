import { ImageResponse } from "next/og";

import { getPublishedPieceBySlug } from "@/lib/db/pieces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// the share card. "the share preview IS the product" ... a published nova piece
// gets a golden-hour card with its own title, not the generic site preview.
// runs on the node runtime so the service-role read works; total over a missing
// piece (falls back to the brand card) so a bad slug never 500s the crawler.
export const runtime = "nodejs";
export const alt = "a nova press piece";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let title = "nova press";
  try {
    const piece = await getPublishedPieceBySlug(createSupabaseAdminClient(), slug);
    if (piece?.title) {
      title = piece.title.length > 120 ? `${piece.title.slice(0, 117).trimEnd()}...` : piece.title;
    }
  } catch {
    // a read hiccup just yields the brand card ... never throw at the crawler.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "84px",
          background: "linear-gradient(135deg, #13100b 0%, #08080c 58%)",
          color: "#f4f1ea",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#c9a84c",
          }}
        >
          <div style={{ width: 13, height: 13, borderRadius: 999, background: "#c9a84c" }} />
          nova press
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: title.length > 70 ? 64 : 80,
              lineHeight: 1.04,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 34, width: 88, height: 4, background: "#c9a84c" }} />
        </div>

        <div style={{ fontSize: 24, letterSpacing: 4, textTransform: "uppercase", color: "#9a958c" }}>
          the writing studio
        </div>
      </div>
    ),
    { ...size },
  );
}
