// the shared backdrop: a golden-hour dawn glow + 3% paper grain, fixed
// behind everything and click-through. wrap a surface's content in
// `relative z-10` so it sits above this. `glow` toggles the dawn layer
// for surfaces that want a flatter canvas (e.g. the editor).
export function Atmosphere({ glow = true }: { glow?: boolean }) {
  return (
    <div className="np-atmosphere" aria-hidden>
      {glow ? <div className="np-dawn" /> : null}
      <div className="np-grain" />
    </div>
  );
}
