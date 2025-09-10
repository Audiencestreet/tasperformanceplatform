import { Hono } from "hono";
import { Database } from "../database";
import { PostbackService } from "../postback-service";

export function mountPostbacks(app: Hono, db: Database, postbacks: PostbackService) {
  // PX → us conversion postback (GET or POST supported)
  app.all("/postback", async (c) => {
    const url = new URL(c.req.url);
    const params = c.req.method === "GET"
      ? url.searchParams
      : new URLSearchParams(await c.req.text());

    const aff_sub = params.get("aff_sub") ?? "";
    const aff_sub2 = params.get("aff_sub2") ?? "";
    const transaction_id = params.get("transaction_id") ?? "";
    const payout = Number(params.get("payout") ?? "0");

    if (!transaction_id) return c.json({ ok: false, error: "missing_transaction_id" }, 400);

    // Idempotent insert/update
    await db.recordConversion({
      transaction_id,
      sub_id: aff_sub,
      click_id: aff_sub2,
      payout,
      partner: "px",
      event: "conversion"
    });

    // Optional: re-fire affiliate postbacks
    await postbacks.triggerPostbacks({ eventType: "conversion", vars: { transaction_id, payout, aff_sub, aff_sub2 } });
    return c.json({ ok: true });
  });
}
