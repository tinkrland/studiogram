vendored mediabunny, pinned at 1.61.3, taken from the official npm
package `mediabunny@1.61.3` (`dist/bundles/mediabunny.mjs`, the readable
esm bundle; the package ships it unchanged). mediabunny is the webcodecs
media toolkit used for deterministic video export: mp4 and mov carry the
h.264 track in sibling containers, webm carries vp9. license: mozilla
public license 2.0 (LICENSE in this directory, upstream file unchanged).

the artifact inlines the bundle as a data-uri in the importmap under the
"mediabunny" specifier, so the deterministic build keeps no external
runtime dependency. the upstream file is pristine, byte for byte; no
accommodation was needed. the app imports it lazily (only at export or
demux time), so page load never parses the encoder until it is used.

sha-256 of the vendored files:

ef4af783346b35fb85a32fc17b7cbeba7549129ef5105ae644a9041d414a99a5  mediabunny.mjs
