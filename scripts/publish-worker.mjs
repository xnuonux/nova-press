// nova press · the scheduled-publish worker.
//
// a tiny pg-boss loop: once a minute, tick POST /api/worker/publish-due and
// let the app (typescript, tested, RLS-aware) do the actual sweep. pg-boss
// gives the tick durability + a singleton lock across worker instances; the
// endpoint gives the logic one home.
//
// SUBSTRATE CARE: the shared lunari database already carries a `pgboss`
// schema owned by another product's workers. this worker initializes its OWN
// schema (np_boss) so nova's pg-boss version can never migrate ... and break
// ... someone else's queue tables.
//
// run it beside the app:  pnpm worker:publish
// env (via --env-file=.env.local): DATABASE_URL, NOVA_WORKER_SECRET,
// NOVA_APP_URL (defaults to the local dev server).

import PgBoss from "pg-boss";

const DATABASE_URL = process.env.DATABASE_URL;
const SECRET = process.env.NOVA_WORKER_SECRET;
const APP_URL = process.env.NOVA_APP_URL || "http://localhost:3000";
const QUEUE = "np-publish-due";

if (!DATABASE_URL) {
  console.error("worker: DATABASE_URL is not set ... nothing to connect to");
  process.exit(1);
}
if (!SECRET) {
  console.error("worker: NOVA_WORKER_SECRET is not set ... the sweep endpoint would 404");
  process.exit(1);
}

async function sweep() {
  try {
    const res = await fetch(`${APP_URL}/api/worker/publish-due`, {
      method: "POST",
      headers: { "x-nova-worker-secret": SECRET },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      if (body.published > 0 || body.reverted > 0) {
        console.log(
          `worker: swept ... ${body.published} published, ${body.reverted} walked back to draft`,
        );
      }
    } else {
      console.error(`worker: sweep answered ${res.status}`, body.error ?? "");
    }
  } catch (err) {
    // the app may be restarting ... the next tick tries again.
    console.error("worker: sweep unreachable ...", err instanceof Error ? err.message : err);
  }
}

const boss = new PgBoss({ connectionString: DATABASE_URL, schema: "np_boss" });
boss.on("error", (err) => console.error("worker: pg-boss ...", err.message));

await boss.start();
await boss.createQueue(QUEUE).catch(() => {
  // already there ... fine.
});
await boss.schedule(QUEUE, "* * * * *");
await boss.work(QUEUE, sweep);

// one sweep at boot so a due piece never waits for the first cron tick.
await sweep();

console.log(`worker: watching for due publishes (${APP_URL}, schema np_boss)`);

const stop = async () => {
  console.log("worker: stopping ...");
  await boss.stop({ graceful: true }).catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
