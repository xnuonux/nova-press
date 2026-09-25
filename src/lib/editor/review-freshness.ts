/** a result can belong to the latest request and still trail the writer's words. */
export interface ReviewStamp { readonly request: number; readonly revision: number; }

export function createReviewFreshness() {
  let request = 0;
  let revision = 0;
  return {
    edited: () => { revision += 1; },
    begin: (): ReviewStamp => ({ request: ++request, revision }),
    invalidate: () => { request += 1; },
    isLatest: (stamp: ReviewStamp) => stamp.request === request,
    isCurrent: (stamp: ReviewStamp) => stamp.request === request && stamp.revision === revision,
  };
}
