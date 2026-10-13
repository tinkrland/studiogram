const LIGHTS = {};
for (const name of ["key", "fill", "rim"]) {
  const l = new THREE.DirectionalLight(0xffffff, 1);
  l.castShadow = name === "key";
  if (l.castShadow) {
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera; c.left = -160; c.right = 160; c.top = 260; c.bottom = -120; c.near = 50; c.far = 1300;
    l.shadow.bias = -0.0004; l.shadow.radius = 4;
  }
  scene.add(l); LIGHTS[name] = l;
}
const hemi = new THREE.HemisphereLight(0xf5efe6, 0x3a3630, 1);
scene.add(hemi);

function applyLighting() {
  const L = S.lighting;
  const azToPos = (az, el, dist) => {
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist);
  };
  for (const name of ["key", "fill", "rim"]) {
    const st = L[name], l = LIGHTS[name];
    l.visible = st.on;
    if (!st.on) continue;
    l.color.set(st.color);
    l.intensity = st.intensity;
    l.position.copy(azToPos(st.azimuth, st.elevation, 620));
  }
  hemi.intensity = AMBIENCE[L.ambience];
}

// the lighting domain's authored values: defaults, ambience levels, recipes
function defaultLights() {
  return {
    recipe: "soft_studio", ambience: "bright",
    key: { on: true, color: "#fff4e6", intensity: 3.0, azimuth: 40, elevation: 55 },
    fill: { on: true, color: "#d6e8ff", intensity: 1.1, azimuth: -55, elevation: 20 },
    rim: { on: true, color: "#ffffff", intensity: 2.0, azimuth: 165, elevation: 45 }
  };
}
const AMBIENCE = { bright: 0.95, dim: 0.45, dark: 0.16 };
const LIGHT_RECIPES = {
  soft_studio: {
    label: "soft studio",
    ambience: "bright",
    key: { on: true, color: "#fff4e6", intensity: 3.0, azimuth: 40, elevation: 55 },
    fill: { on: true, color: "#d6e8ff", intensity: 1.1, azimuth: -55, elevation: 20 },
    rim: { on: true, color: "#ffffff", intensity: 2.0, azimuth: 165, elevation: 45 }
  },
  bright_commercial: {
    label: "bright commercial",
    ambience: "bright",
    key: { on: true, color: "#ffffff", intensity: 4.6, azimuth: 25, elevation: 60 },
    fill: { on: true, color: "#eef4ff", intensity: 2.0, azimuth: -45, elevation: 30 },
    rim: { on: true, color: "#ffffff", intensity: 1.2, azimuth: 170, elevation: 50 }
  },
  dramatic_rim: {
    label: "dramatic rim",
    ambience: "dark",
    key: { on: true, color: "#ffe9d2", intensity: 1.3, azimuth: 55, elevation: 35 },
    fill: { on: true, color: "#aac4e8", intensity: 0.25, azimuth: -60, elevation: 15 },
    rim: { on: true, color: "#ffffff", intensity: 4.4, azimuth: 160, elevation: 30 }
  },
  warm_gold: {
    label: "warm gold",
    ambience: "dim",
    key: { on: true, color: "#ffd9a0", intensity: 3.3, azimuth: 35, elevation: 50 },
    fill: { on: true, color: "#ffe9d0", intensity: 0.8, azimuth: -50, elevation: 25 },
    rim: { on: true, color: "#fff3e0", intensity: 2.4, azimuth: 150, elevation: 55 }
  }
};
