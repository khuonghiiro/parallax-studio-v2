/** GLSL shaders. All compositing happens in display (sRGB) space, like After Effects' default. */

export const LAYER_VERT = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
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
  if (c.a < 0.004) discard;
  vec3 rgb = c.rgb / c.a;
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
  vec2 q = vUv - 0.5;
  q.x *= resolution.x / resolution.y;
  float v = 1.0 - smoothstep(0.25, 0.95, length(q));
  c *= mix(1.0, v, vignette);
  c += (hash(vUv * resolution) - 0.5) * grain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`
