/** GLSL shaders. All compositing happens in display (sRGB) space, like After Effects' default. */

export const LAYER_VERT = /* glsl */ `
uniform vec2 uvRepeat;
uniform vec2 uvOffset;
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv * uvRepeat + uvOffset;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

export const LAYER_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 texSize;     // texels
uniform vec2 planeSize;   // world units
uniform float opacity;
uniform float dofOn;
uniform float focusDistance;
uniform float aperture;
uniform float fogOn;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float glowOn;
uniform int glowSide;
uniform vec3 glowColor;
uniform float glowRadius;
uniform float glowIntensity;
uniform float isModel3D;
uniform float alphaCutoff;
uniform float shadeDarkness;
uniform vec3 shadeTint;
uniform float lightBoost;
uniform vec3 lightTint;
uniform float portalOn;
uniform vec3 portalParams;
uniform float portalDarkness;
uniform float vlightOn;
uniform vec2 vlightUv;
uniform vec3 vlightColor;
uniform vec3 vlightParams;
uniform vec2 vlightBeam;
varying vec2 vUv;
varying float vDepth;

vec4 premul(vec4 s) {
  return vec4(s.rgb * s.a, s.a);
}

void main() {
  // Derivatives / implicit-LOD sampling happen OUTSIDE any branch or loop.
  vec2 tc = vUv * texSize;
  vec2 dx = dFdx(tc);
  vec2 dy = dFdy(tc);
  float baseLod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  vec4 sharp = premul(texture2D(map, vUv));

  float blurWorld = dofOn * aperture * abs(vDepth - focusDistance) * 0.02;
  vec4 c = sharp;
  if (blurWorld >= 0.35) {
    float blurTexels = blurWorld * texSize.x / planeSize.x;
    float lod = baseLod + clamp(log2(max(1.0, blurTexels / 3.0)), 0.0, 8.0);
    vec2 radiusUv = vec2(blurWorld) / planeSize;
    c = vec4(0.0);
    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 24.0);
      float a = fi * 2.39996323;
      c += premul(textureLod(map, vUv + vec2(cos(a), sin(a)) * r * radiusUv, lod));
    }
    c /= 24.0;
  }

  if (glowOn > 0.5 && glowIntensity > 0.001 && glowRadius > 0.1) {
    vec2 glowStep = vec2(glowRadius) / texSize;
    float totalWeight = 0.0;
    float sumOuter = 0.0;
    float sumInner = 0.0;
    for (int i = 0; i < 16; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 16.0);
      float a = fi * 2.39996323;
      vec2 offset = vec2(cos(a), sin(a)) * r * glowStep;
      float sa = texture2D(map, vUv + offset).a;
      float w = 1.0 - r * 0.65;
      totalWeight += w;
      sumOuter += sa * w;
      sumInner += (1.0 - sa) * w;
    }
    float avgOuter = sumOuter / totalWeight;
    float avgInner = sumInner / totalWeight;
    float curA = clamp(c.a, 0.0, 1.0);
    float outerVal = pow(clamp(avgOuter, 0.0, 1.0), 0.75) * (1.0 - curA);
    float innerVal = pow(clamp(avgInner, 0.0, 1.0), 0.85) * curA;

    float glowVal = 0.0;
    if (glowSide == 0) {
      glowVal = outerVal;
    } else if (glowSide == 1) {
      glowVal = innerVal;
    } else {
      glowVal = max(outerVal, innerVal);
    }
    glowVal *= glowIntensity;

    if (glowVal > 0.001) {
      vec3 glowRgb = glowColor * glowVal;
      c.rgb += glowRgb;
      if (glowSide == 0 || glowSide == 2) {
        float glowAlpha = clamp(outerVal * min(1.0, glowIntensity), 0.0, 1.0);
        c.a = max(c.a, glowAlpha);
      }
    }
  }

  // Nguồn sáng ảo 2.5D trực tiếp trên layer (vlightOn=1) hoặc chiếu sang layer lân cận cùng cảnh (vlightOn=2)
  float localLightHalo = 0.0;
  float haloAlpha = 0.0;
  float coreGlow = 0.0;
  if (vlightOn > 0.5 && vlightParams.x > 0.005) {
    vec2 dUv = (vUv - vlightUv) * planeSize;
    float distPx = length(dUv);
    float radPx = max(24.0, vlightParams.y);
    if (distPx < radPx) {
      float radial = pow(clamp(1.0 - distPx / radPx, 0.0, 1.0), 1.45);
      float coneFactor = 1.0;
      if (vlightParams.z > -0.98 && distPx > 2.0) {
        vec2 dir = dUv / distPx;
        float d = dot(dir, vlightBeam);
        float edge0 = vlightParams.z - 0.12;
        float edge1 = max(edge0 + 0.08, min(0.995, vlightParams.z + 0.26));
        float beamCone = smoothstep(edge0, edge1, d);
        float sourceCore = pow(clamp(1.0 - distPx / max(44.0, radPx * 0.56), 0.0, 1.0), 1.45) * 0.72;
        coneFactor = max(beamCone, sourceCore);
      }
      localLightHalo = radial * coneFactor * vlightParams.x;
      if (vlightOn < 1.5) {
        haloAlpha = pow(radial, 1.65) * coneFactor * clamp(vlightParams.x * 0.52, 0.0, 0.84);
        float coreRad = max(16.0, min(radPx * 0.22, 54.0));
        if (distPx < coreRad) {
          coreGlow = pow(clamp(1.0 - distPx / coreRad, 0.0, 1.0), 1.85) * max(coneFactor, 0.65) * clamp(vlightParams.x * 0.68, 0.0, 0.94);
        }
      }
    }
  }

  // Vùng Độ Sâu / Lối vào Hang động trên tấm ảnh nền/cổng đá (Tạo hốc tối chiều sâu tự nhiên cả trên vòm đá lẫn lòng hang)
  float portalHoleAlpha = 0.0;
  float caveDepth = 0.0;
  if (portalOn > 0.5 && portalDarkness > 0.01) {
    vec2 pDiff = vUv - portalParams.xy;
    float pDist = length(pDiff) / max(0.05, portalParams.z);
    if (pDist < 1.0) {
      caveDepth = pow(clamp(1.0 - pDist, 0.0, 1.0), 1.45) * portalDarkness;
      if (pDist < 0.88) {
        float holeFalloff = pow(clamp(1.0 - pDist / 0.88, 0.0, 1.0), 1.55);
        portalHoleAlpha = holeFalloff * portalDarkness * 0.92;
      }
    }
  }

  float texAlpha = clamp(c.a, 0.0, 1.0);
  float surfaceOrPortalAlpha = max(texAlpha, portalHoleAlpha);
  float finalAlpha = max(surfaceOrPortalAlpha, haloAlpha);
  if (isModel3D > 0.5) {
    if (finalAlpha < alphaCutoff) discard;
    if (opacity >= 0.999 && texAlpha >= alphaCutoff) finalAlpha = 1.0;
  } else {
    if (finalAlpha < 0.004) discard;
  }
  vec3 rgb = texAlpha > 0.003 ? (c.rgb / texAlpha) : (portalHoleAlpha > 0.003 ? shadeTint : vlightColor);

  if (caveDepth > 0.005 && surfaceOrPortalAlpha > 0.01) {
    float rescue = min(caveDepth, (lightBoost + localLightHalo) * 0.82);
    rgb = mix(rgb, shadeTint, max(0.0, caveDepth - rescue));
  }

  // Bóng tối hang động che phủ dần nhân vật khi đi sâu vào cửa hang
  if (shadeDarkness > 0.005 && texAlpha > 0.01) {
    rgb = mix(rgb, shadeTint, clamp(shadeDarkness, 0.0, 0.96));
  }

  // Chiếu sáng bề mặt vật thể / lòng hang từ nguồn sáng 2.5D, giữ nguyên chi tiết vân đá/nhân vật
  if (localLightHalo > 0.005) {
    float surfStrength = clamp(localLightHalo * 0.88, 0.0, 1.75);
    vec3 litRgb = rgb * (1.0 + vlightColor * surfStrength * 0.92) + vlightColor * (surfStrength * 0.38);
    if (coreGlow > 0.005) {
      vec3 coreColor = mix(vlightColor, vec3(1.0, 0.97, 0.88), 0.48);
      litRgb = mix(litRgb, coreColor, coreGlow);
    }
    rgb = mix(vlightColor, litRgb, clamp(surfaceOrPortalAlpha, 0.0, 1.0));
  }

  // Ánh sáng ảo 2.5D từ các layer lân cận chiếu sáng nhân vật / vách hang
  if (lightBoost > 0.01 && surfaceOrPortalAlpha > 0.01) {
    float boostStrength = clamp(lightBoost * 0.65, 0.0, 1.35);
    rgb = rgb * (1.0 + lightTint * boostStrength * 0.62) + lightTint * (boostStrength * 0.25);
  }

  c.a = finalAlpha;
  if (fogOn > 0.5) {
    float f = smoothstep(fogNear, fogFar, vDepth);
    rgb = mix(rgb, fogColor, f);
  }
  gl_FragColor = vec4(rgb, c.a * opacity);
}
`

export const PARTICLE_VERT = /* glsl */ `
uniform float time;
uniform vec3 area;
uniform vec3 velocity;
uniform float sway;
uniform float size;
uniform float pxScale;
uniform float dofOn;
uniform float focusDistance;
uniform float aperture;
uniform float twinkle;
attribute vec4 aRand;
varying float vAlpha;
varying float vDepth;
varying float vSoft;

void main() {
  vec3 p = position + velocity * (0.6 + aRand.x * 0.8) * time;
  p.x += sin(time * (0.3 + aRand.y * 0.7) + aRand.z * 6.2831) * sway;
  p.y += cos(time * (0.25 + aRand.w * 0.6) + aRand.x * 6.2831) * sway;
  p = mod(p + area * 0.5, area) - area * 0.5;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(1.0, -mv.z);
  vDepth = dist;
  float coc = dofOn * aperture * abs(dist - focusDistance) * 0.02;
  float baseSize = size * (0.5 + aRand.y);
  float worldSize = baseSize + coc * 2.0;
  gl_PointSize = worldSize * pxScale / dist;
  float spread = baseSize / worldSize;
  vSoft = 1.0 - spread;
  float tw = twinkle > 0.5 ? 0.55 + 0.45 * sin(time * (1.5 + aRand.w * 3.0) + aRand.z * 40.0) : 1.0;
  vAlpha = tw * clamp(spread * spread * 1.5, 0.12, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

export const PARTICLE_FRAG = /* glsl */ `
uniform vec3 color;
uniform float opacity;
uniform float glow;
uniform float fogOn;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying float vAlpha;
varying float vDepth;
varying float vSoft;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float core = 1.0 - smoothstep(mix(0.55, 0.0, vSoft), 1.0, r);
  float halo = glow > 0.5 ? exp(-r * 4.0) * 0.6 : 0.0;
  float a = (core + halo) * vAlpha * opacity;
  vec3 rgb = color;
  if (fogOn > 0.5) rgb = mix(rgb, fogColor, smoothstep(fogNear, fogFar, vDepth) * 0.7);
  gl_FragColor = vec4(rgb, a);
}
`

export const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const POST_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform float vignette;
uniform float grain;
uniform float seed;
uniform float fade;
uniform vec2 resolution;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32 + seed);
  return fract(p.x * p.y);
}

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  c *= pow(2.0, exposure);
  c = (c - 0.5) * contrast + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  if (vignette > 0.001) {
    vec2 q = (vUv - 0.5) * 1.414;
    float dist = length(q);
    float v = clamp(1.0 - smoothstep(0.5, 1.25, dist), 0.0, 1.0);
    c *= mix(1.0, v, vignette);
  }
  if (grain > 0.001) {
    c += (hash(vUv * resolution) - 0.5) * grain;
  }
  c *= 1.0 - fade;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`

export const COPY_FRAG = /* glsl */ `
uniform sampler2D tScene;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.0);
}
`
