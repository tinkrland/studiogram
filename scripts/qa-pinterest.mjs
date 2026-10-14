// qa for the pinterest publish glue: static contract checks, no
// network. runs in node. discipline matches qa-publish.mjs.
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const mod = readFileSync(root + "socmed-integration/99-pinterest.js", "utf8");
const fns = {
  config: readFileSync(root + "functions/studioPinterestConfig.ts", "utf8"),
  callback: readFileSync(root + "functions/studioPinterestCallback.ts", "utf8"),
  boards: readFileSync(root + "functions/studioPinterestBoards.ts", "utf8"),
  pin: readFileSync(root + "functions/studioPinterestCreatePin.ts", "utf8"),
  tags: readFileSync(root + "functions/studioPinterestProductTags.ts", "utf8"),
};
const ig98 = readFileSync(root + "socmed-integration/98-publish.js", "utf8") +
  readFileSync(root + "socmed-integration/98a-connect-handoff.js", "utf8");
const manifest = readFileSync(root + "scripts/build-app.sh", "utf8");
const captures = readFileSync(root + "socmed-integration/95-captures.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; process.stdout.write("ok   " + name + "\n"); }
  else { fail++; process.stderr.write("FAIL " + name + "\n"); }
};

// the v5 contract constants appear in the right places
check("scopes: authorize url carries boards+pins+user_accounts", fns.config.includes("boards:read,boards:write,pins:read,pins:write,user_accounts:read"));
check("token exchange: v5 oauth endpoint with basic auth", fns.callback.includes("api.pinterest.com/v5/oauth/token") && fns.callback.includes("Basic"));
check("callback exchange uses the canonical public redirect uri", fns.callback.includes("redirectUri = \"https://superagent-9bbbac66"));
check("pin create posts to v5 /pins", fns.pin.includes('api.pinterest.com/v5/pins"') || fns.pin.includes("https://api.pinterest.com/v5/pins"));
check("field caps: title 100, description 800, alt 500, link 2048", ["(body.title, 100)", "(body.description, 800)", "(body.alt_text, 500)", "(body.link, 2048)"].every((s) => fns.pin.includes(s)));
check("media source: single image_url variant", fns.pin.includes('source_type: "image_url"'));
check("media source: multiple_image_urls variant with per-image links", fns.pin.includes('source_type: "multiple_image_urls"') && fns.pin.includes("link: clamp(it.link, 2048)"));
check("multi-image cap is 5 (v5 maxItems)", fns.pin.includes("1 to 5 images") && mod.includes("slice(0, 5)"));
check("product tags: 1 to 24 product pin ids (v5 contract)", fns.tags.includes("1 to 24 product pin ids") && fns.tags.includes("/product_tags"));
check("boards list paginates with the v5 bookmark", fns.boards.includes("bookmark"));
check("publish records StudioPublishedSet with the connected username", fns.pin.includes("StudioPublishedSet") && fns.pin.includes("connected_username"));
check("callback messages are tagged provider pinterest", fns.callback.includes('provider: "pinterest"'));
check("the instagram listener ignores provider-tagged messages", ig98.includes("if (e.data.provider) return"));
check("token stays session-only in the artifact", mod.includes('sessionStorage.getItem(PIN_CONN_KEY)'));
check("the app secret never appears in the artifact module", !mod.includes("SECRET") && !mod.includes("app_secret"));
check("the caption compose rule is capped at 800 for pinterest", mod.includes("description.slice(0, 800)"));
check("98 shared helpers reused, not duplicated (jpeg + upload)", mod.includes("jpegFromPhoto") && mod.includes("studioUploadPhoto"));
check("the module is in the build manifest", manifest.includes("socmed-integration/99-pinterest.js"));
check("the pinterest bar renders in the capture strip", captures.includes("renderPinterestBar();"));

process.stdout.write(`\n${pass} pass, ${fail} fail\n`);
process.exit(fail ? 1 : 0);
