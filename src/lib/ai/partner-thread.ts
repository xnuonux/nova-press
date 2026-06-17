/**
 * partner thread ... the pure message model behind nova's rail.
 *
 * no react, server, or ai imports, so the rail (components/editor/partner-rail)
 * and a unit test can share it. ids are minted by the caller (the rail uses
 * crypto.randomUUID), never generated here, so the reducer stays deterministic
 * and fully testable. it supports both the non-streaming loop (ask -> settle)
 * and the streaming one (ask -> stream* -> settle), so wiring a token stream
 * later needs no reducer change.
 */

export type PartnerRole = "writer" | "nova";

export interface PartnerMessage {
  id: string;
  role: PartnerRole;
  text: string;
  // a nova turn that has opened but not finished: awaiting the reply, or
  // receiving tokens. the rail shows a live caret while this is true.
  streaming?: boolean;
  // the voice-keeper flagged drift on the finished turn.
  drift?: boolean;
  // this nova turn never landed (provider / network failure).
  failed?: boolean;
}

export type ThreadAction =
  // a writer line opens a nova turn in the same step, so the thread never shows
  // a writer bubble without nova already listening below it.
  | { type: "ask"; writerId: string; novaId: string; text: string }
  // replace the open nova turn's text with the latest accumulated stream.
  | { type: "stream"; id: string; text: string }
  // the nova turn finished: final (audited) text + the drift flag.
  | { type: "settle"; id: string; text: string; drift: boolean }
  // the nova turn failed before it could land.
  | { type: "fail"; id: string };

export function threadReducer(
  state: PartnerMessage[],
  action: ThreadAction,
): PartnerMessage[] {
  switch (action.type) {
    case "ask":
      return [
        ...state,
        { id: action.writerId, role: "writer", text: action.text },
        { id: action.novaId, role: "nova", text: "", streaming: true },
      ];
    case "stream":
      // guard on streaming so a late chunk can't clobber a turn that already
      // settled or failed.
      return state.map((m) =>
        m.id === action.id && m.streaming ? { ...m, text: action.text } : m,
      );
    case "settle":
      return state.map((m) =>
        m.id === action.id
          ? { ...m, text: action.text, streaming: false, drift: action.drift }
          : m,
      );
    case "fail":
      return state.map((m) =>
        m.id === action.id ? { ...m, streaming: false, failed: true } : m,
      );
    default:
      return state;
  }
}

// true while any nova turn is still open ... the rail disables the input so a
// writer can't stack a second ask on top of one that's still landing.
export function threadBusy(state: PartnerMessage[]): boolean {
  return state.some((m) => m.streaming);
}
