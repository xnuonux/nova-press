"use client";
import DeepShader from "../design-system/deep/DeepShader";

// THE DEEP · nova press substrate. the oxblood dithering dreamslur + a moonlit-marble sheen.
// mounted once in the root layout; renders behind everything (the ancient temple at night).
export default function DeepBackdrop() {
  return (
    <>
      <DeepShader position="fixed" dim={0.68} />
      <div aria-hidden className="deep-marble" />
    </>
  );
}
