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

const RAY_STRIATION_GLSL_FUNCS = /* glsl */ `
float evalRayRidgeGlsl(float theta, float freq, float slotSeed, float microTime) {
  float h1 = fract(abs(sin(slotSeed * 127.1 + 311.7)) * 43758.5453);
  float h2 = fract(abs(sin(slotSeed * 269.5 + 183.3)) * 43758.5453);
  float h3 = fract(abs(sin(slotSeed * 419.2 + 71.9)) * 43758.5453);

  // Đảo góc tia ngẫu nhiên theo chu kỳ 1s: mỗi slot nhận góc lệch và nhịp pha hoàn toàn khác biệt
  float angleShift = (h1 - 0.5) * 6.28318;
  float microWobble = sin(microTime * 3.5 + h2 * 6.283) * 0.10 + sin(microTime * 1.2) * 0.06;
  float th = theta + angleShift + microWobble;

  float s1 = sin(th * freq + h2 * 6.283);
  float s2 = sin(th * (freq * 1.93) + h3 * 6.283 + 1.4);
  float s3 = sin(th * (freq * 3.17) - h1 * 6.283 + 2.7);
  float s4 = sin(th * (freq * 0.71) + microTime * 1.85 + sin(microTime * 0.4) * 2.2);
  float rawW = s1 * 0.42 + s2 * 0.30 + s3 * 0.18 + s4 * 0.10;
  return pow(max(0.0001, clamp(rawW * 0.5 + 0.5, 0.0, 1.0)), 1.55);
}

float computeRayStriationGlsl(float rayTheta, float freq, float rayPhase) {
  if (rayPhase <= 0.0005) {
    return evalRayRidgeGlsl(rayTheta, freq, 0.0, 0.0);
  }
  float timeSec = rayPhase;
  float slot1 = floor(timeSec);
  float slot2 = slot1 + 1.0;
  float prog = fract(timeSec);
  float blend = smoothstep(0.12, 0.88, prog);
  float r1 = evalRayRidgeGlsl(rayTheta, freq, slot1, timeSec);
  float r2 = evalRayRidgeGlsl(rayTheta, freq, slot2, timeSec);
  return mix(r1, r2, blend);
}
`;

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
uniform vec4 vlightRays; // x = rayIntensity, y = rayCount, z = hotspotFocus, w = rayAnimPhase
varying vec2 vUv;
varying float vDepth;

vec4 premul(vec4 s) {
  return vec4(s.rgb * s.a, s.a);
}

${RAY_STRIATION_GLSL_FUNCS}

void main() {
  // Derivatives / implicit-LOD sampling happen OUTSIDE any branch or loop.
  vec2 tc = vUv * texSize;
  vec2 dx = dFdx(tc);
  vec2 dy = dFdy(tc);
  float baseLod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  vec4 sharp = premul(texture2D(map, vUv));

  // 2.5D Pseudo-Normal & Silhouette Edge Gradient from texture luminance & alpha (uniform control flow)
  float sharpA = clamp(sharp.a, 0.0, 1.0);
  vec3 sharpUnpremul = sharpA > 0.003 ? (sharp.rgb / sharpA) : vec3(0.0);
  float sharpLuma = dot(sharpUnpremul, vec3(0.299, 0.587, 0.114));
  float heightField = sharpLuma * 0.65 + sharpA * 0.35;
  float dhdx = dFdx(heightField);
  float dhdy = dFdy(heightField);
  float dadx = dFdx(sharpA);
  float dady = dFdy(sharpA);
  vec2 duvdx = dFdx(vUv);
  vec2 duvdy = dFdy(vUv);
  vec2 gradUv = vec2(
    dhdx * sign(duvdx.x + 1e-5) + dhdy * sign(duvdy.x),
    dhdx * sign(duvdx.y) + dhdy * sign(duvdy.y + 1e-5)
  );
  vec2 alphaGradUv = vec2(
    dadx * sign(duvdx.x + 1e-5) + dady * sign(duvdy.x),
    dadx * sign(duvdx.y) + dady * sign(duvdy.y + 1e-5)
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
    float outerVal = pow(max(0.0001, clamp(avgOuter, 0.0, 1.0)), 0.75) * (1.0 - curA);
    float innerVal = pow(max(0.0001, clamp(avgInner, 0.0, 1.0)), 0.85) * curA;

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

  // Nguồn sáng ảo 2.5D vật lý (đồng nhất 100% với computeUnified25DLightAtOffset trong virtualLight.ts):
  // - Chóa 2 vùng Hotspot + Spill cho đèn pin/đèn nón.
  // - Quầng sáng giọt nước bất đối xứng xuôi chiều đối lưu / gió cho ngọn nến & lửa.
  // - Tỉa tia sáng khí quyển Tyndall (vlightRays).
  float localLightHalo = 0.0;
  float wickCore = 0.0;
  float ambientDim = clamp(vlightExtra.x, 0.0, 0.85);
  float lightSoftness = clamp(vlightExtra.y, 0.1, 1.0);
  float beamCurvature = clamp(vlightExtra.z, -0.8, 1.0);
  float rayAmt = clamp(vlightRays.x, 0.0, 1.0);
  float rayCount = clamp(floor(vlightRays.y + 0.5), 3.0, 24.0);
  float hotspotFocus = clamp(vlightRays.z, 0.0, 1.0);
  float rayPhase = vlightRays.w;
  float radPx = max(36.0, vlightParams.y);
  float zStandoff = radPx * 0.22;

  if (vlightOn > 0.5 && vlightParams.x > 0.005) {
    vec2 dPx = (vUv - vlightUv) * planeSize;
    float dist2D = length(dPx);
    float intensity = vlightParams.x;
    float coneCos = vlightParams.z;
    float rawRNorm = dist2D / radPx;

    if (rawRNorm < 1.48) {
      float effRNorm = rawRNorm;
      float coneAtten = 1.0;
      float rayTheta = atan(dPx.y, dPx.x + 1e-5);
      bool isCone = coneCos > -0.98;

      if (isCone) {
        vec2 beamAxis = vec2(1.0, 0.0);
        float bLen = length(vlightBeam);
        if (bLen > 0.001) beamAxis = vlightBeam / bLen;
        vec2 perpAxis = vec2(-beamAxis.y, beamAxis.x);
        float alongPx = dot(dPx, beamAxis);
        float signedPerpPx = dot(dPx, perpAxis);
        float perpPx = abs(signedPerpPx);
        rayTheta = atan(signedPerpPx, alongPx + 1e-5);

        float halfAngle = acos(clamp(coneCos, -0.995, 0.995));
        float tanHalf = clamp(tan(halfAngle * 0.92), 0.18, 2.4);
        float nozzlePx = clamp(radPx * 0.04, 10.0, 26.0);

        float alongNorm = clamp((alongPx + nozzlePx) / radPx, 0.0, 1.2);
        float curveExp = clamp(1.0 - beamCurvature * 0.52, 0.42, 1.65);
        float curvedEnvelopeWidth = nozzlePx * 0.85 + radPx * tanHalf * pow(max(0.0001, alongNorm), curveExp) * (1.0 + beamCurvature * 0.18);

        float widthRatio = perpPx / max(8.0, curvedEnvelopeWidth);
        float edgeFeather = max(0.22, 0.32 + lightSoftness * 0.55);
        float innerEdge = max(0.05, 1.0 - edgeFeather * 0.75);
        float outerEdge = 1.0 + edgeFeather * 0.45;
        float envMask = 1.0 - smoothstep(innerEdge, outerEdge, widthRatio);

        float capCurve = 1.0 - (0.35 + beamCurvature * 0.35) * min(1.0, widthRatio * widthRatio * 0.45);
        float effR = alongNorm / max(0.45, capCurve);
        float capFade = 1.0 - smoothstep(1.0, 1.28, effR);

        float backGate = smoothstep(-nozzlePx * 1.1, nozzlePx * 1.0, alongPx);
        float hotspotK = 1.4 + hotspotFocus * 3.2;
        float hotspot = exp(-hotspotK * widthRatio * widthRatio);
        float centerProfile = (0.68 - hotspotFocus * 0.22) + (0.32 + hotspotFocus * 0.56) * hotspot;
        coneAtten = envMask * centerProfile * backGate * capFade;
      } else {
        float bLen = length(vlightBeam);
        if (bLen > 0.01) {
          float stretch = bLen <= 0.78 ? bLen : 0.24;
          vec2 windDir = vlightBeam / bLen;
          vec2 windPerp = vec2(-windDir.y, windDir.x);
          float alongP = dot(dPx, windDir);
          float perpP = dot(dPx, windPerp);
          float alongScale = alongP >= 0.0 ? (1.0 + stretch * 0.58) : max(0.52, 1.0 - stretch * 0.42);
          float perpScale = max(0.72, 1.0 - stretch * 0.22);
          effRNorm = length(vec2(alongP / alongScale, perpP / perpScale)) / radPx;
          float windBias = clamp(alongP / max(32.0, radPx), -0.28, 0.46);
          coneAtten = 1.0 + windBias * (0.14 + stretch * 0.28);
        }
      }

      if (effRNorm < 1.05 && coneAtten > 0.001) {
        float baseFalloff = mix(3.2, 1.65, (lightSoftness - 0.1) / 0.9);
        float falloffK = isCone ? baseFalloff : baseFalloff * (0.82 + hotspotFocus * 0.44);
        float r3D = length(vec2(effRNorm, 0.20));
        float invSq = (1.0 + 0.04 * falloffK) / (1.0 + falloffK * r3D * r3D);
        float win = 1.0 - smoothstep(0.0, 1.05, effRNorm);
        float radialAtten = invSq * win * win;

        float rayFactor = 1.0;
        if (rayAmt > 0.01 && effRNorm > 0.04) {
          float freq = isCone ? rayCount * 2.2 : rayCount;
          float ridge = computeRayStriationGlsl(rayTheta, freq, rayPhase);
          float emerge = smoothstep(0.05, 0.26, effRNorm);
          float outerFade = 1.0 - smoothstep(0.75, 1.06, effRNorm) * 0.35;
          rayFactor = 1.0 + (ridge - 0.42) * rayAmt * 0.82 * emerge * outerFade;
        }

        localLightHalo = radialAtten * coneAtten * rayFactor * intensity;
      }

      if (vlightOn < 1.5) {
        float coreRadPx = clamp(radPx * 0.036, 7.0, 20.0);
        wickCore = exp(-2.4 * (dist2D * dist2D) / (coreRadPx * coreRadPx)) * min(1.0, intensity * 0.85);
      }
    }
  }

  float texAlpha = clamp(c.a, 0.0, 1.0);
  if (isModel3D > 0.5) {
    if (texAlpha < alphaCutoff) discard;
    if (opacity >= 0.999 && texAlpha >= alphaCutoff) texAlpha = 1.0;
  } else {
    if (texAlpha < 0.004) discard;
  }

  vec3 wickColor = mix(vlightColor, vec3(1.0, 0.98, 0.92), clamp(wickCore * 0.85, 0.0, 0.85));
  vec3 rgb = c.rgb / max(0.003, texAlpha);

  // 1. Vùng Độ Sâu / Lối Vào Hang Động 2.5D: hỗ trợ vòm hang bất đối xứng (Rx, Ry), cứu sáng cục bộ tại từng điểm ảnh có đèn chiếu
  if (portalOn > 0.5 && portalDarkness > 0.01) {
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
      float rescue = min(caveDepth * 0.95, localLightHalo * 0.90 + lightBoost * 0.22);
      float netCaveDark = max(0.0, caveDepth - rescue);
      vec3 darkenedRock = rgb * (1.0 - netCaveDark * 0.84);
      rgb = mix(darkenedRock, shadeTint, netCaveDark * smoothstep(0.92, 0.18, pDist));
    }
  }

  // 2. Bóng tối hang động che phủ nhân vật khi đi sâu vào cửa hang (được cứu sáng trực tiếp phía hướng về ngọn đèn)
  if (shadeDarkness > 0.005) {
    float netCharDark = max(0.0, shadeDarkness - localLightHalo * 0.78);
    vec3 shadedBody = rgb * (1.0 - netCharDark * 0.76);
    rgb = mix(shadedBody, shadeTint, clamp(netCharDark * 0.86, 0.0, 0.95));
  }

  // 3. Tương phản Sáng - Tối vật lý, Chiếu sáng nổi khối 2.5D & Bắt viền sáng Rim Light theo hướng nguồn sáng
  if (vlightOn > 0.5) {
    if (ambientDim > 0.01) {
      float effAmbient = ambientDim * (vlightOn < 1.5 ? 0.70 : 0.52);
      float litMask = clamp(localLightHalo * 1.15, 0.0, 1.0);
      rgb *= mix(1.0 - effAmbient, 1.0, litMask);
    }

    if (localLightHalo > 0.002) {
      vec2 toLightVec = (vlightUv - vUv) * planeSize;
      vec3 lightDir3D = normalize(vec3(toLightVec, zStandoff));
      float ndotl = clamp(dot(normal25D, lightDir3D), 0.0, 1.0);
      float reliefStrength = clamp(length(normal25D.xy) * 1.35, 0.0, 1.0);
      float bumpFactor = mix(1.0, mix(0.76, 1.32, ndotl), reliefStrength * 0.80);
      float specRim = reliefStrength * pow(max(0.0001, ndotl), 2.2) * clamp(localLightHalo * 0.25, 0.0, 0.42);

      // Viền sáng Rim Catch-Light 2.5D trên các vật thể môi trường nhận sáng (vlightOn == 2) dọc theo mép hướng về ngọn đèn
      float edgeMag = clamp(length(alphaGradUv) * 2.4, 0.0, 1.0);
      float silhouetteRim = 0.0;
      if (vlightOn > 1.5 && edgeMag > 0.03 && length(toLightVec) > 2.0) {
        vec2 edgeOutDir = normalize(-alphaGradUv + vec2(1e-5));
        vec2 toLightDir2D = normalize(toLightVec);
        float rimFacing = pow(max(0.0001, clamp(dot(edgeOutDir, toLightDir2D), 0.0, 1.0)), 1.5);
        silhouetteRim = edgeMag * rimFacing * clamp(localLightHalo * 0.55, 0.0, 0.72);
      }

      float surfE = clamp(localLightHalo * bumpFactor, 0.0, 3.0);
      float surfaceOpacity = smoothstep(0.04, 0.42, texAlpha);
      vec3 diffuse = rgb * vlightColor * (surfE * 0.88);
      vec3 warmLift = vlightColor * (surfE * (0.26 + 0.24 * sharpLuma) * surfaceOpacity);
      vec3 specHighlight = mix(vlightColor, vec3(1.0, 0.98, 0.92), 0.42) * (specRim + silhouetteRim) * surfaceOpacity;

      vec3 litRgb = rgb + diffuse + warmLift + specHighlight;
      if (wickCore > 0.02) {
        litRgb = mix(litRgb, wickColor, wickCore * 0.42);
      }
      litRgb = litRgb / (vec3(1.0) + max(vec3(0.0), litRgb - vec3(0.78)) * 0.35);
      rgb = litRgb;
    }
  }

  // 4. Ánh sáng phản xạ môi trường đa nguồn (Multi-Light Environmental Bounce) trong cùng Shot
  if (lightBoost > 0.01) {
    float bounceScale = vlightOn < 0.5 ? 0.48 : (vlightOn > 1.5 ? 0.16 : 0.0);
    if (bounceScale > 0.01) {
      float boostE = clamp(lightBoost * bounceScale, 0.0, 1.2);
      rgb = rgb * (1.0 + lightTint * boostE * 0.60) + lightTint * (boostE * 0.16 * (0.3 + 0.7 * sharpLuma));
    }
  }

  c.a = texAlpha;
  if (fogOn > 0.01) {
    float f = smoothstep(fogNear, fogFar, vDepth) * clamp(fogOn, 0.0, 1.0);
    rgb = mix(rgb, fogColor, f);
  }
  gl_FragColor = vec4(rgb, c.a * opacity);
}
`

/**
 * Shader luồng sáng khí quyển 2.5D không bị cắt bởi kích thước layer nguồn (Unclipped Volumetric Light Beam):
 * Hỗ trợ tỉa tia sáng khí quyển Tyndall, chóa 2 vùng Hotspot + Spill và quầng lửa tạt theo chiều gió.
 */
export const VOLUMETRIC_LIGHT_FRAG = /* glsl */ `
uniform vec3 vlightColor;
uniform vec3 vlightParams; // x = intensity, y = radPx, z = coneCos
uniform vec2 vlightBeam;
uniform vec3 vlightExtra;  // x = ambientDim, y = softness, z = beamCurvature
uniform vec4 vlightRays;   // x = rayIntensity, y = rayCount, z = hotspotFocus, w = rayAnimPhase
uniform float quadSpanPx;
varying vec2 vUv;

${RAY_STRIATION_GLSL_FUNCS}

void main() {
  float intensity = vlightParams.x;
  float radPx = max(36.0, vlightParams.y);
  float coneCos = vlightParams.z;
  float lightSoftness = clamp(vlightExtra.y, 0.1, 1.0);
  float beamCurvature = clamp(vlightExtra.z, -0.8, 1.0);
  float rayAmt = clamp(vlightRays.x, 0.0, 1.0);
  float rayCount = clamp(floor(vlightRays.y + 0.5), 3.0, 24.0);
  float hotspotFocus = clamp(vlightRays.z, 0.0, 1.0);
  float rayPhase = vlightRays.w;

  vec2 dPx = (vUv - vec2(0.5)) * quadSpanPx;
  float dist2D = length(dPx);
  float rawRNorm = dist2D / radPx;
  if (rawRNorm >= 1.48 || intensity <= 0.005) discard;

  float effRNorm = rawRNorm;
  float coneAtten = 1.0;
  float rayTheta = atan(dPx.y, dPx.x + 1e-5);
  bool isCone = coneCos > -0.98;

  if (isCone) {
    vec2 beamAxis = vec2(1.0, 0.0);
    float bLen = length(vlightBeam);
    if (bLen > 0.001) beamAxis = vlightBeam / bLen;
    vec2 perpAxis = vec2(-beamAxis.y, beamAxis.x);
    float alongPx = dot(dPx, beamAxis);
    float signedPerpPx = dot(dPx, perpAxis);
    float perpPx = abs(signedPerpPx);
    rayTheta = atan(signedPerpPx, alongPx + 1e-5);

    float halfAngle = acos(clamp(coneCos, -0.995, 0.995));
    float tanHalf = clamp(tan(halfAngle * 0.92), 0.18, 2.4);
    float nozzlePx = clamp(radPx * 0.04, 10.0, 26.0);

    float alongNorm = clamp((alongPx + nozzlePx) / radPx, 0.0, 1.2);
    float curveExp = clamp(1.0 - beamCurvature * 0.52, 0.42, 1.65);
    float curvedEnvelopeWidth = nozzlePx * 0.85 + radPx * tanHalf * pow(max(0.0001, alongNorm), curveExp) * (1.0 + beamCurvature * 0.18);

    float widthRatio = perpPx / max(8.0, curvedEnvelopeWidth);
    float edgeFeather = max(0.22, 0.32 + lightSoftness * 0.55);
    float innerEdge = max(0.05, 1.0 - edgeFeather * 0.75);
    float outerEdge = 1.0 + edgeFeather * 0.45;
    float envMask = 1.0 - smoothstep(innerEdge, outerEdge, widthRatio);

    float capCurve = 1.0 - (0.35 + beamCurvature * 0.35) * min(1.0, widthRatio * widthRatio * 0.45);
    float effR = alongNorm / max(0.45, capCurve);
    float capFade = 1.0 - smoothstep(1.0, 1.28, effR);

    float backGate = smoothstep(-nozzlePx * 1.1, nozzlePx * 1.0, alongPx);
    float hotspotK = 1.4 + hotspotFocus * 3.2;
    float hotspot = exp(-hotspotK * widthRatio * widthRatio);
    float centerProfile = (0.68 - hotspotFocus * 0.22) + (0.32 + hotspotFocus * 0.56) * hotspot;
    coneAtten = envMask * centerProfile * backGate * capFade;
  } else {
    float bLen = length(vlightBeam);
    if (bLen > 0.01) {
      float stretch = bLen <= 0.78 ? bLen : 0.24;
      vec2 windDir = vlightBeam / bLen;
      vec2 windPerp = vec2(-windDir.y, windDir.x);
      float alongP = dot(dPx, windDir);
      float perpP = dot(dPx, windPerp);
      float alongScale = alongP >= 0.0 ? (1.0 + stretch * 0.58) : max(0.52, 1.0 - stretch * 0.42);
      float perpScale = max(0.72, 1.0 - stretch * 0.22);
      effRNorm = length(vec2(alongP / alongScale, perpP / perpScale)) / radPx;
      float windBias = clamp(alongP / max(32.0, radPx), -0.28, 0.46);
      coneAtten = 1.0 + windBias * (0.14 + stretch * 0.28);
    }
  }

  if (effRNorm >= 1.05 || coneAtten <= 0.001) discard;

  float baseFalloff = mix(3.2, 1.65, (lightSoftness - 0.1) / 0.9);
  float falloffK = isCone ? baseFalloff : baseFalloff * (0.82 + hotspotFocus * 0.44);
  float r3D = length(vec2(effRNorm, 0.20));
  float invSq = (1.0 + 0.04 * falloffK) / (1.0 + falloffK * r3D * r3D);
  float win = 1.0 - smoothstep(0.0, 1.05, effRNorm);
  float radialAtten = invSq * win * win;

  float rayFactor = 1.0;
  if (rayAmt > 0.01 && effRNorm > 0.04) {
    float freq = isCone ? rayCount * 2.2 : rayCount;
    float ridge = computeRayStriationGlsl(rayTheta, freq, rayPhase);
    float emerge = smoothstep(0.05, 0.26, effRNorm);
    float outerFade = 1.0 - smoothstep(0.75, 1.06, effRNorm) * 0.35;
    rayFactor = 1.0 + (ridge - 0.42) * rayAmt * 0.82 * emerge * outerFade;
  }

  float halo = radialAtten * coneAtten * rayFactor * intensity;

  // Triệt tiêu hoàn toàn điểm hội tụ tâm (wick dot) để luồng sáng khí quyển tan mềm mại tự nhiên
  float rayBoostAlpha = isCone ? (0.28 + rayAmt * 0.08) : (0.18 + rayAmt * 0.07);
  float beamAlpha = clamp(halo * rayBoostAlpha, 0.0, 0.72);
  if (beamAlpha < 0.003) discard;

  vec3 col = mix(vlightColor, vec3(1.0, 0.98, 0.92), clamp(halo * 0.25, 0.0, 0.6));
  gl_FragColor = vec4(col * beamAlpha, beamAlpha);
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
