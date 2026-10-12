vendored three.js, pinned at 0.160.0, downloaded from unpkg on 2026-10-12.
the artifact inlines these files as data-uris in the importmap, so the
deterministic build has no external runtime dependency. the upstream
files are pristine except one documented accommodation:

GLTFLoader.js rewrites its relative import
    import { toTrianglesDrawMode } from '../utils/BufferGeometryUtils.js';
to the bare specifier
    import { toTrianglesDrawMode } from 'three/addons/utils/BufferGeometryUtils.js';
because relative imports cannot resolve inside a data-uri module. the build
asserts the exact upstream line before patching, so a version change cannot
slip through unverified. sha-256 of each pristine upstream file:

9be041e96308775d00e2695cc607645b9a9b64fd7c0e759dd8f7c00a8d92becb  assets/vendor/three@0.160.0/BufferGeometryUtils.js
d073b438e6a07e1359741dd5d6c76c953420cc0d4fd84eb1bdde94315540e6a3  assets/vendor/three@0.160.0/GLTFLoader.js
5a44a9e86a2a0fb11933eed69bc2cd33c76a496854c1aed6ed776efa87d7b064  assets/vendor/three@0.160.0/OrbitControls.js
e21f41b7ef2016f2984a5d27850b42dffa797a6a194a138e288b06576d765a7b  assets/vendor/three@0.160.0/RoomEnvironment.js
76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495  assets/vendor/three@0.160.0/three.module.js
