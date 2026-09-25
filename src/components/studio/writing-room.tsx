import * as React from "react";

import "./writing-room.css";

interface WritingRoomProps {
  scopeId: string;
  page: React.ReactNode;
  partner: React.ReactNode;
  editorial: React.ReactNode;
  delivery?: React.ReactNode;
}

/**
 * a composition boundary, not another editor. native disclosure keeps every
 * child mounted, takes closed tools out of the focus order, and needs no
 * navigation state, model call, or document mutation. the caller keys by piece.
 */
export function WritingRoom({ scopeId, page, partner, editorial, delivery }: WritingRoomProps) {
  const group = `np-rooms-${scopeId}`;
  return (
    <div className="np-studio" aria-label="nova press writing room">
      <header className="np-studio__masthead">
        <span className="np-studio__brand"><span aria-hidden>N</span> nova press</span>
        <span className="np-studio__quiet">the page is yours.</span>
      </header>
      <div className="np-studio__floor">
        <section className="np-studio__page" aria-label="the page">{page}</section>
        <aside className="np-studio__tools" aria-label="the rooms">
          <p className="np-studio__caption">within reach</p>
          <details className="np-room" name={group}>
            <summary id={`${group}-partner`}>
              <span className="np-room__number" aria-hidden>01</span>
              <span>the partner</span>
              <span className="np-room__turn" aria-hidden>+</span>
            </summary>
            <div className="np-room__panel" role="region" aria-labelledby={`${group}-partner`}>
              <p className="np-room__hint">a conversation, not a replacement.</p>
              {partner}
            </div>
          </details>
          <details className="np-room" name={group}>
            <summary id={`${group}-editorial`}>
              <span className="np-room__number" aria-hidden>02</span>
              <span>the editorial brain</span>
              <span className="np-room__turn" aria-hidden>+</span>
            </summary>
            <div className="np-room__panel" role="region" aria-labelledby={`${group}-editorial`}>
              <p className="np-room__hint">mirrors, never verdicts.</p>
              {editorial}
            </div>
          </details>
          {delivery ? (
            <details className="np-room" name={group}>
              <summary id={`${group}-delivery`}>
                <span className="np-room__number" aria-hidden>03</span>
                <span>the way out</span>
                <span className="np-room__turn" aria-hidden>+</span>
              </summary>
              <div className="np-room__panel" role="region" aria-labelledby={`${group}-delivery`}>
                <p className="np-room__hint">publish and schedule at the foot of the page. newsletter delivery lives here.</p>
                {delivery}
              </div>
            </details>
          ) : null}
          <p className="np-studio__colophon">your voice.<br />your hand.</p>
        </aside>
      </div>
    </div>
  );
}
