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
  float coreHotness = 0.0;
  if (vlightOn > 0.5 && vlightParams.x > 0.005) {
    vec2 dUv = (vUv - vlightUv) * planeSize;
    float intensity = vlightParams.x;
    float intensityReach = vlightOn > 1.5
      ? clamp(0.78 + pow(intensity, 0.65) * 0.38, 0.72, 1.65)
      : clamp(0.62 + pow(intensity, 0.70) * 0.42, 0.50, 1.65);
    float radPx = max(32.0, vlightParams.y * intensityReach);

    // Tính khoảng cách chuẩn hóa rSurf cho bề mặt (bán kính rộng radPx) và rHalo cho quầng khí quyển nội bộ (luôn nằm gọn trong biên mesh)
    float safeEdgePx = max(24.0, min(min(vlightUv.x, 1.0 - vlightUv.x) * planeSize.x, min(vlightUv.y, 1.0 - vlightUv.y) * planeSize.y));
    float haloRadPx = min(radPx, safeEdgePx * clamp(0.74 + pow(intensity, 0.60) * 0.24, 0.62, 0.98));

    float rSurf = 2.0;
    float rHalo = 2.0;
    float axisBoost = 1.0;

    if (vlightParams.z > -0.98) {
      // Nguồn sáng có hướng (Đèn pin / Nến bạt gió / Chùm sáng định hướng): chiếu theo hệ trục (beamAxis, perpAxis) tạo chùm tia hình giọt nước mượt
      vec2 beamAxis = vec2(1.0, 0.0);
      float bLen = length(vlightBeam);
      if (bLen > 0.001) beamAxis = vlightBeam / bLen;
      vec2 perpAxis = vec2(-beamAxis.y, beamAxis.x);
      float alongPx = dot(dUv, beamAxis);
      float perpPx = abs(dot(dUv, perpAxis));

      float sinHalfCone = sqrt(max(0.03, 1.0 - vlightParams.z * vlightParams.z));
      float spreadRatio = clamp(sinHalfCone * 1.15, 0.22, 0.98);

      float fwdSurf = radPx;
      float backSurf = radPx * 0.28;
      float alongNormSurf = alongPx >= 0.0 ? (alongPx / fwdSurf) : (-alongPx / backSurf);
      float perpRadSurf = mix(radPx * 0.22, radPx * spreadRatio, clamp(alongPx / fwdSurf, 0.0, 1.0));
      rSurf = length(vec2(alongNormSurf, perpPx / max(12.0, perpRadSurf)));

      float fwdHalo = haloRadPx;
      float backHalo = haloRadPx * 0.34;
      float alongNormHalo = alongPx >= 0.0 ? (alongPx / fwdHalo) : (-alongPx / backHalo);
      float perpRadHalo = mix(haloRadPx * 0.28, haloRadPx * max(0.35, spreadRatio), clamp(alongPx / fwdHalo, 0.0, 1.0));
      rHalo = length(vec2(alongNormHalo, perpPx / max(10.0, perpRadHalo)));

      float distPx = length(dUv);
      if (distPx > 1.0 && alongPx > 0.0) {
        float cosAng = alongPx / distPx;
        axisBoost = 1.0 + pow(max(0.0, cosAng), 2.6) * 0.42;
      }
    } else {
      // Nguồn sáng tỏa tròn 360°
      float distPx = length(dUv);
      rSurf = distPx / radPx;
      rHalo = distPx / max(18.0, haloRadPx);
    }

    if (rSurf < 1.0) {
      // Đường cong suy giảm C2 kết hợp lõi Gaussian: đặc rực ở tâm (r=0), ấm rõ ở vùng trung gian (r=0.35..0.6) và tan mượt về 0 tại r=1.0 (không có viền tròn)
      float sSurf = 1.0 - smoothstep(0.0, 1.0, rSurf);
      float bloomSurf = pow(sSurf, 1.85);
      float cSurf = exp(-8.0 * rSurf * rSurf);
      localLightHalo = (bloomSurf * 0.82 + cSurf * 0.62) * axisBoost * intensity;
      coreHotness = clamp(cSurf * axisBoost * min(1.4, intensity * 0.90), 0.0, 0.94);
    }

    if (vlightOn < 1.5 && rHalo < 1.0) {
      float sHalo = 1.0 - smoothstep(0.0, 1.0, rHalo);
      float bloomHalo = pow(sHalo, 1.85);
      float cHalo = exp(-7.5 * rHalo * rHalo);
      float rawHalo = (bloomHalo * 0.68 + cHalo * 0.52) * axisBoost;
      haloAlpha = clamp(rawHalo * min(1.20, intensity * 0.78), 0.0, 0.88);
      coreHotness = max(coreHotness, clamp(cHalo * min(1.35, intensity * 0.88), 0.0, 0.94));
    }
  }

  float texAlpha = clamp(c.a, 0.0, 1.0);
  float finalAlpha = max(texAlpha, haloAlpha);
  if (isModel3D > 0.5) {
    if (finalAlpha < alphaCutoff) discard;
    if (opacity >= 0.999 && texAlpha >= alphaCutoff) finalAlpha = 1.0;
  } else {
    if (finalAlpha < 0.004) discard;
  }

  vec3 lightGradColor = mix(vlightColor, vec3(1.0, 0.98, 0.90), coreHotness);
  vec3 rgb = texAlpha > 0.003 ? (c.rgb / texAlpha) : lightGradColor;

  // Vùng Độ Sâu / Lối vào Hang động: chỉ làm tối mềm trên phần hình ảnh đặc (texAlpha > 0.01), tuyệt đối không vẽ hình tròn lơ lửng vào vùng trong suốt
  if (portalOn > 0.5 && portalDarkness > 0.01 && texAlpha > 0.01) {
    vec2 pDiff = vUv - portalParams.xy;
    float pDist = length(pDiff) / max(0.05, portalParams.z);
    if (pDist < 1.0) {
      float caveDepth = exp(-3.2 * pDist * pDist) * pow(max(0.0, 1.0 - pDist * pDist), 1.8) * portalDarkness;
      float rescue = min(caveDepth, (lightBoost + localLightHalo) * 0.88);
      rgb = mix(rgb, shadeTint, max(0.0, caveDepth - rescue));
    }
  }

  // Bóng tối hang động che phủ dần nhân vật khi đi sâu vào cửa hang
  if (shadeDarkness > 0.005 && texAlpha > 0.01) {
    rgb = mix(rgb, shadeTint, clamp(shadeDarkness, 0.0, 0.96));
  }

  // Chiếu sáng bề mặt vật thể từ tâm sáng đậm lan tỏa mềm ra ngoài, giữ chi tiết gốc
  if (localLightHalo > 0.005) {
    float surfStrength = clamp(localLightHalo * 0.88, 0.0, 1.75);
    vec3 litRgb = rgb * (1.0 + lightGradColor * surfStrength * 0.85) + lightGradColor * (surfStrength * 0.36);
    if (coreHotness > 0.02) {
      litRgb = mix(litRgb, vec3(1.0, 0.98, 0.92), coreHotness * (vlightOn < 1.5 ? 0.42 : 0.26));
    }
    rgb = mix(lightGradColor, litRgb, texAlpha);
  }

  // Ánh sáng ảo 2.5D từ các layer lân cận chiếu sáng nhẹ lên toàn layer
  if (lightBoost > 0.01 && texAlpha > 0.01) {
    float boostStrength = clamp(lightBoost * 0.45, 0.0, 1.15);
    rgb = rgb * (1.0 + lightTint * boostStrength * 0.42) + lightTint * (boostStrength * 0.16);
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
