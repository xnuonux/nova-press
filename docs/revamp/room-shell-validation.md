# the page and its doors ... validation and handoff

## shipped to a review branch, not deployed

`writing-room.tsx` is a stateless composition. native `details` / `summary` disclosure owns the room doors; the editor and room children remain mounted. no room navigation reducer, new editor dependency, model call, data write, or publication handler was introduced.

the existing partner and editorial components gain an optional `embedded` presentation mode. the previous presentation remains the default for other callers. streaming, thread state, voice auditing, editorial lenses, and publication actions are not replaced. the authenticated editor route retains its reads and bound actions and keys the composition by piece id. this prevents state from one piece being reused as another piece's initial editor state.

partner and editorial brain are closed initially. a newsletter delivery room is present only for an already published piece. publish/schedule remain in the plate footer with their current live state. full artifact export remains in the existing work surface. voice, shape, world bible, and the native lunari adapter are not ported by this slice.

## observed locally

26 browser checks passed, zero failed, zero browser exceptions. tested the actual new stateless shell and its actual css with synthetic manuscript, conversation, review, and delivery children. chromium `144.0.7559.96`; the fixture used the available react `16.0.0` umd renderer. react-dom did not expose its version in that fixture. this is not react 19/plate integration evidence.

checks cover closed defaults; optional delivery; native exclusive disclosure; retained editor/composer node identity and local input values; enter/space activation; closed controls leaving the tab order; open controls joining it; focus-mode width recovery; no horizontal overflow and a usable page viewport at 320, 390, 768, 1024 and 1440 pixels; reduced-motion css; no network or action calls caused by disclosure.

typescript syntax transpilation passed for the new shell, editor page, embedded partner and embedded editorial component. the 27 focused save/review helper tests still pass. no full app typecheck, lint, production build, authenticated browser test, hydration test, model request, database write, newsletter send, or public release was performed.

the desktop and mobile screenshots are layout fixtures with invented writing, visibly marked as such. they are not screenshots of a deployed studio or proof of model/persistence behavior.

## required before merging

run the complete repository's test, typecheck, lint and build commands. mount the actual react 19 / plate page and open every room on both desktop and mobile. check long real partner threads, the seven-stage bar and finding list, newsletter modal, save and conflict handling, and keyboard order at browser zoom. verify page identity and caret selection while opening and closing rooms and across server refreshes. verify piece switches explicitly reset the editor and cancel stale client work without claiming that an already-sent server mutation was recalled.

confirm native exclusive details and css `:has` support in the supported browser matrix. older browsers may leave several doors open; no data semantics may depend on exclusivity. the embedded components must work with the application's actual global styles, not only the fixture styling.

this pull request is stacked on `astra/nova-press-save-safety`. review the safety patch first. after it merges, rebase/retarget this branch to the actual default branch, `feat/mythos-editorial-system`; do not deploy merely because a fixture passed.
