// the shared connect handoff: loaded before every provider module
// (98 publish, 99 pinterest, 98c video share) so all three oauth
// connects deliver the same way.
// the connect handoff: the base44 edge blocks scripts on the oauth
// callback pages (a script-src none csp on every function response),
// so the callback cannot postMessage the token back. delivery is
// server-side instead: mint a one-time code, send it as the oauth
// state, open the dialog, and poll studioConnPoll until the callback
// stores the connection under that code. the postMessage listeners
// below stay as a fallback if the edge policy ever relaxes.
// the handoff poll lives on the same canonical host as every other
// studio endpoint; declared here so the module carries no imports
const HANDOFF_BASE = "https://superagent-9bbbac66.base44.app/functions";

function connectHandoff(provider, authorizeUrl, apply) {
  const code = "conn-" + provider + "-" + Math.random().toString(36).slice(2, 12);
  const url = /([?&])state=[^&]*/.test(authorizeUrl)
    ? authorizeUrl.replace(/([?&])state=[^&]*/, "$1state=" + encodeURIComponent(code))
    : authorizeUrl + "&state=" + encodeURIComponent(code);
  const win = window.open(url, "studiogram-" + provider, "width=520,height=720");
  const deadline = Date.now() + 4 * 60 * 1000; // the server ttl is 5 minutes
  (function poll() {
    if (Date.now() > deadline) { toast("connect timed out: try again"); return; }
    fetch(HANDOFF_BASE + "/studioConnPoll?provider=" + provider + "&code=" + encodeURIComponent(code))
      .then((r) => r.json())
      .then((res) => {
        if (res && res.ok && res.handoff) {
          if (res.handoff.ok === false) { toast("connect failed: " + (res.handoff.reason || "unknown error")); return; }
          apply(res.handoff);
          if (win) try { win.close(); } catch (e) {}
          renderCaptureStrip();
        } else if (res && res.ok === false) {
          toast("connect failed: " + (res.reason || "unknown error"));
        } else {
          setTimeout(poll, 2000);
        }
      })
      .catch(() => setTimeout(poll, 3000));
  })();
}
