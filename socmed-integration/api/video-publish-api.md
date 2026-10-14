# video share + connect handoff contracts

verified 2026-10-14 against live endpoints on the canonical public host
https://superagent-9bbbac66.base44.app/functions. the artifact calls these
cross-origin from a local file, so every posting endpoint answers the
options preflight (204, allow-origin *, allow-headers content-type,range,
authorization) and tags allow-origin * on its responses.

## the chunked video upload (studioUploadVideo)

a rendered take can exceed a single request body, so the artifact slices
the mp4/webm buffer into base64 chunks (512 kb) and posts each one. every
chunk lands in its own StudioVideo row:

- required fields: video_id, rec_name, mime, bytes_total, chunk_index,
  chunk_total, data_base64; optional width, height, duration_ms, fmt
- mime matches the container prefix: video/(mp4|webm|quicktime)(;|$) -
  browsers attach codec parameters ("video/mp4; codecs=\"avc1...\"") and
  the validator must accept them
- chunk_total 1 to 100, chunk_index 0 to chunk_total - 1
- response: {ok, video_id, chunk_index}; 400 on shape errors

## the range serve (studioVideo)

GET ?vid=<video_id> streams the chunks in order as one body:

- no range header: 200 with the full bytes, content-type from the first
  chunk, content-length exact, accept-ranges bytes
- range bytes=a-b: 206 with content-range; open-ended (a-) serves to the
  end; suffix (-n) serves the last n bytes
- out of bounds: 416 with content-range */<size>
- missing vid: 400

## the share ledger (studioVideoRecord)

POST {provider: "link"|"vimeo", name, permalink, meta, connected_username}
records the share as a StudioPublishedSet row (products_json carries the
kind/provider/video meta). the vimeo path also records a successful push
with the returned video link.

## the vimeo publish (artifact side)

connect: oauth via studioVimeoConfig + studioVimeoCallback (see the
handoff below). upload: POST https://api.vimeo.com/me/videos (json, field
payload, the byte size exact), then tus-style patch upload to
upload_link with upload-offset headers, approach tus, then set
privacy.view. unlisted is the paid-plan default; on refusal the fallback
order is unlisted, disable, nobody.

## the connect handoff (why polling, not postMessage)

the base44 edge injects content-security-policy: script-src 'none' on
every function response. no callback page can run scripts, so the old
postMessage delivery from the oauth callbacks can never fire on the
canonical host. the delivery that survives is server-side:

1. the artifact mints a one-time code (conn-<provider>-<rand>) and sends
   it as the oauth state on the authorize url (state replaced or
   appended client-side; providers echo state back on redirect)
2. the callback (studioOauthCallback, studioPinterestCallback,
   studioVimeoCallback) reads state from the redirect, exchanges the
   code for the token (secrets stay server-side), and stores the whole
   payload as a StudioConnHandoff row keyed by provider + state
3. the artifact polls GET studioConnPoll?provider=&code= every 2 s
   (3 s on fetch errors), 4 minute client deadline
4. studioConnPoll: waiting while nothing is stored; on a hit it returns
   the payload once and deletes the row (consume-on-read); ttl 5
   minutes; failures stored by the callback carry {ok: false, reason}
   so the poll surfaces the refusal

the postMessage script stays embedded in the callback pages as a no-op
fallback in case the edge policy ever relaxes. the same helper
(98a-connect-handoff.js) drives instagram, pinterest, and vimeo
connects in the artifact.

## what is still blocked

- vimeo app secrets are not set; studioVimeoConfig returns configured
  false until the owner adds STUDIOGRAM_VIMEO_CLIENT_ID and
  STUDIOGRAM_VIMEO_CLIENT_SECRET
- instagram and pinterest redirect uris must be registered in their
  developer apps; non-role users need the api review passes before the
  oauth dialogs work for them
