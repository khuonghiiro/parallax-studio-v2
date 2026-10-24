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
uniform vec4 portalParams;
uniform float portalDarkness;
uniform vec2 portalShape;
uniform float vlightOn;
uniform vec2 vlightUv;
uniform vec3 vlightColor;
uniform vec3 vlightParams;
uniform vec2 vlightBeam;
uniform vec3 vlightExtra;
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

  // 2.5D Pseudo-Normal estimation from texture luminance & alpha silhouette (computed in uniform control flow)
  float sharpA = clamp(sharp.a, 0.0, 1.0);
  vec3 sharpUnpremul = sharpA > 0.003 ? (sharp.rgb / sharpA) : vec3(0.0);
  float sharpLuma = dot(sharpUnpremul, vec3(0.299, 0.587, 0.114));
  float heightField = sharpLuma * 0.65 + sharpA * 0.35;
  float dhdx = dFdx(heightField);
  float dhdy = dFdy(heightField);
  vec2 duvdx = dFdx(vUv);
  vec2 duvdy = dFdy(vUv);
  vec2 gradUv = vec2(
    dhdx * sign(duvdx.x + 1e-5) + dhdy * sign(duvdy.x),
    dhdx * sign(duvdx.y) + dhdy * sign(duvdy.y + 1e-5)
  );
  vec3 normal25D = normalize(vec3(-gradUv * 6.5, 1.0));

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

  // Nguồn sáng ảo 2.5D vật lý (3D Standoff Point/Spot Light giống After Effects 3D Light):
  // Đèn đặt cách bề mặt một khoảng zStandoff > 0 để chùm nón giao cắt mặt phẳng tạo vùng sáng elip/giọt nước mềm mại, không bao giờ cắt cạnh tam giác sắc gắt.
  float localLightHalo = 0.0;
  float haloAlpha = 0.0;
  float wickCore = 0.0;
  float ambientDim = clamp(vlightExtra.x, 0.0, 0.85);
  float lightSoftness = clamp(vlightExtra.y, 0.1, 1.0);
  float zDistRatio = clamp(vlightExtra.z, 0.0, 1.0);
  float radPx = max(36.0, vlightParams.y);
  float zStandoff = radPx * (0.22 + zDistRatio * 0.45);

  if (vlightOn > 0.5 && vlightParams.x > 0.005) {
    vec2 dPx = (vUv - vlightUv) * planeSize;
    float dist2D = length(dPx);
    float intensity = vlightParams.x;
    float coneCos = vlightParams.z;
    float dist3D = length(vec3(dPx, zStandoff));
    float rNorm = dist2D / radPx;

    float coneAtten = 1.0;
    if (coneCos > -0.98) {
      // Giao cắt chùm nón 3D với mặt phẳng Layer: tạo vệt chiếu elip/giọt nước 3D tự nhiên
      vec2 beamAxis = vec2(1.0, 0.0);
      float bLen = length(vlightBeam);
      if (bLen > 0.001) beamAxis = vlightBeam / bLen;
      vec2 perpAxis = vec2(-beamAxis.y, beamAxis.x);
      float alongPx = dot(dPx, beamAxis);
      float perpPx = dot(dPx, perpAxis);

      float halfAngle = acos(clamp(coneCos, -0.995, 0.995));
      float spreadScale = clamp(tan(halfAngle * 0.85), 0.28, 1.85);
      // Dịch nhẹ tâm chiếu về phía trước hướng tia nhưng vẫn giữ đầu đèn tròn mềm nhờ zStandoff
      float forwardShift = max(0.0, alongPx);
      float backCut = smoothstep(-radPx * 0.16, radPx * 0.12, alongPx);
      float effPerp = perpPx / max(0.32, spreadScale * (0.45 + 0.85 * (forwardShift / radPx)));
      float effAlong = (alongPx - radPx * 0.22) / (radPx * 0.78);
      float spotDist = length(vec2(effAlong * 0.72, effPerp / (radPx * 0.52)));

      // Phối hợp góc nón 3D thực (từ độ cao zStandoff) và elip chiếu sáng mềm
      vec3 beamDir3D = normalize(vec3(beamAxis * 0.86, -0.50));
      vec3 ray3D = normalize(vec3(dPx, -zStandoff * 0.68));
      float cos3D = dot(ray3D, beamDir3D);
      float angle3D = acos(clamp(cos3D, -1.0, 1.0));
      float penumbra3D = max(0.28, halfAngle * mix(0.55, 1.05, lightSoftness));
      float mask3D = 1.0 - smoothstep(max(0.05, halfAngle * 0.45), halfAngle + penumbra3D * 0.65, angle3D);
      float ellipsePool = exp(-1.65 * spotDist * spotDist);
      coneAtten = mix(mask3D * mask3D, ellipsePool, 0.45) * backCut;
    } else if (length(vlightBeam) > 0.01) {
      // Nguồn sáng 360° có hướng gió (Ánh nến / Lửa trại): kéo nhẹ quầng ấm theo chiều gió thổi
      vec2 windDir = normalize(vlightBeam);
      float windBias = clamp(dot(dPx / max(32.0, radPx), windDir), -0.3, 0.45);
      coneAtten = 1.0 + windBias * 0.22;
    }

    if (rNorm < 1.05 && coneAtten > 0.001) {
      float falloffK = mix(3.4, 1.8, lightSoftness);
      float r3D = length(vec2(rNorm, 0.22));
      float invSq = (1.0 + 0.22 * 0.22 * falloffK) / (1.0 + falloffK * r3D * r3D);
      float win = 1.0 - smoothstep(0.0, 1.05, rNorm);
      float radialAtten = invSq * win * win;
      localLightHalo = radialAtten * coneAtten * intensity;
    }

    // Quầng khí quyển nội bộ (vlightOn == 1): chỉ tạo đốm tim đèn nhỏ mềm tại tâm, giữ trong trẻo tuyệt đối vùng rỗng
    if (vlightOn < 1.5) {
      float edgeMarginU = min(vUv.x, 1.0 - vUv.x);
      float edgeMarginV = min(vUv.y, 1.0 - vUv.y);
      float borderFade = smoothstep(0.0, 0.08, min(edgeMarginU, edgeMarginV));
      float coreRadPx = clamp(radPx * 0.032, 7.0, 18.0);
      wickCore = exp(-2.6 * (dist2D * dist2D) / (coreRadPx * coreRadPx)) * min(0.9, intensity * 0.75) * borderFade;
      float airGlow = exp(-5.5 * (dist2D * dist2D) / (radPx * radPx)) * min(0.06, intensity * 0.04) * borderFade;
      float surfaceMask = smoothstep(0.02, 0.30, clamp(c.a, 0.0, 1.0));
      haloAlpha = max(wickCore * 0.55, airGlow) * (1.0 - surfaceMask * 0.75);
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

  vec3 wickColor = mix(vlightColor, vec3(1.0, 0.98, 0.92), clamp(wickCore * 0.85, 0.0, 0.85));
  vec3 rgb = texAlpha > 0.003 ? (c.rgb / texAlpha) : wickColor;

  // 1. Vùng Độ Sâu / Lối Vào Hang Động 2.5D: hỗ trợ vòm hang bất đối xứng (Rx, Ry), làm tối có chiều sâu giữ vân đá và được cứu sáng cục bộ tại từng điểm ảnh có đèn chiếu
  if (portalOn > 0.5 && portalDarkness > 0.01 && texAlpha > 0.01) {
    vec2 pRad = max(vec2(0.04), portalParams.zw);
    vec2 pDiff = (vUv - portalParams.xy) / pRad;
    float isArch = portalShape.x;
    float archScaleX = isArch > 0.5 ? (1.0 - clamp(pDiff.y, -0.55, 0.55) * 0.14) : 1.0;
    float pDist = length(vec2(pDiff.x / max(0.7, archScaleX), pDiff.y));
    if (pDist < 1.0) {
      float feather = clamp(portalShape.y, 0.15, 0.95);
      float outerLip = 1.0 - smoothstep(1.0 - feather * 0.85, 1.0, pDist);
      float innerAbyss = exp(-2.5 * pDist * pDist);
      float caveDepth = clamp((outerLip * 0.52 + innerAbyss * 0.62) * portalDarkness, 0.0, 0.96);
      float rescue = min(caveDepth * 0.94, localLightHalo * 0.86 + lightBoost * 0.18);
      float netCaveDark = max(0.0, caveDepth - rescue);
      // Giữ chi tiết vân đá ở viền cửa hang, chìm sâu vào màu bóng đêm ở lõi hang
      vec3 darkenedRock = rgb * (1.0 - netCaveDark * 0.84);
      rgb = mix(darkenedRock, shadeTint, netCaveDark * smoothstep(0.92, 0.18, pDist));
    }
  }

  // 2. Bóng tối hang động che phủ nhân vật khi đi sâu vào cửa hang (được cứu sáng trực tiếp phía hướng về ngọn đèn!)
  if (shadeDarkness > 0.005 && texAlpha > 0.01) {
    float netCharDark = max(0.0, shadeDarkness - localLightHalo * 0.74);
    vec3 shadedBody = rgb * (1.0 - netCharDark * 0.76);
    rgb = mix(shadedBody, shadeTint, clamp(netCharDark * 0.86, 0.0, 0.95));
  }

  // 3. Tương phản Sáng - Tối vật lý (Ambient Contrast) & Chiếu sáng nổi khối 2.5D (Normal Relief + Filmic Roll-off)
  if (vlightOn > 0.5 && texAlpha > 0.01) {
    if (ambientDim > 0.01) {
      float effAmbient = ambientDim * (vlightOn < 1.5 ? 0.65 : 0.42);
      float litMask = smoothstep(0.0, 0.65, localLightHalo);
      rgb *= mix(1.0 - effAmbient, 1.0, litMask);
    }

    if (localLightHalo > 0.002) {
      vec3 lightDir3D = normalize(vec3((vlightUv - vUv) * planeSize, zStandoff));
      float ndotl = clamp(dot(normal25D, lightDir3D), 0.0, 1.0);
      float reliefStrength = clamp(length(normal25D.xy) * 1.35, 0.0, 1.0);
      float bumpFactor = mix(1.0, mix(0.76, 1.28, ndotl), reliefStrength * 0.78);
      float specRim = reliefStrength * pow(ndotl, 2.2) * clamp(localLightHalo * 0.22, 0.0, 0.35);

      float surfE = clamp(localLightHalo * bumpFactor, 0.0, 1.65);
      // Chiếu sáng vật lý cân bằng: tôn màu bề mặt thực, không làm cháy trắng chi tiết vân đá
      vec3 diffuse = rgb * vlightColor * (surfE * 0.72);
      vec3 warmLift = vlightColor * (surfE * 0.14 * (0.35 + 0.65 * sharpLuma));
      vec3 specHighlight = mix(vlightColor, vec3(1.0, 0.98, 0.92), 0.4) * specRim;

      vec3 litRgb = rgb + diffuse + warmLift + specHighlight;
      if (wickCore > 0.02) {
        litRgb = mix(litRgb, wickColor, wickCore * 0.32);
      }
      // Filmic Soft-Shoulder Tone Mapping: giữ trọn chi tiết vùng sáng cao (Highlight Recovery)
      litRgb = litRgb / (vec3(1.0) + max(vec3(0.0), litRgb - vec3(0.65)) * 0.52);
      rgb = litRgb;
    }
  }

  // 4. Ánh sáng môi trường gián tiếp từ các nguồn sáng lân cận trong cùng Shot
  if (lightBoost > 0.01 && texAlpha > 0.01 && vlightOn < 0.5) {
    float boostE = clamp(lightBoost * 0.42, 0.0, 1.05);
    rgb = rgb * (1.0 + lightTint * boostE * 0.55) + lightTint * (boostE * 0.12 * sqrt(max(0.05, sharpLuma)));
  }

  c.a = finalAlpha;
  if (fogOn > 0.01) {
    float f = smoothstep(fogNear, fogFar, vDepth) * clamp(fogOn, 0.0, 1.0);
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
