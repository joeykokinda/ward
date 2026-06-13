"use client";

// FaultyTerminal-style background: a retro CRT grid of flickering dot-matrix
// glyphs with scanlines, barrel curvature, glitch lines and mouse parallax,
// rendered on a raw WebGL canvas (no dependency). Tinted amber to match WARD's
// mission-control identity. Freezes for prefers-reduced-motion; cleans up its
// RAF, listeners and GL context on unmount.

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uTint;
uniform float uScale;
uniform float uDigitSize;
uniform float uScanline;
uniform float uGlitch;
uniform float uFlicker;
uniform float uCurvature;
uniform float uBrightness;
uniform vec2 uMouse;
uniform float uMouseStrength;

float hash21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// CRT barrel distortion
vec2 curve(vec2 uv, float amt){
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(6.0, 5.0);
  uv = uv + uv * off * off * amt;
  return uv * 0.5 + 0.5;
}

// 5x7 dot-matrix glyph, on/off per dot from a per-cell seed
float glyph(vec2 p, float seed){
  vec2 g = floor(clamp(p, 0.0, 1.0) * vec2(5.0, 7.0));
  return step(0.5, hash21(vec2(seed * 13.0, dot(g, vec2(1.0, 5.0)))));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  uv += (uMouse - 0.5) * uMouseStrength * 0.08;

  vec2 cuv = curve(uv, uCurvature);
  if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float aspect = uResolution.x / uResolution.y;
  vec2 p = cuv;
  p.x *= aspect;
  float t = uTime;

  // glitch: shove a few horizontal bands sideways
  float band = floor(cuv.y * 42.0);
  float gline = step(0.985, noise(vec2(band, floor(t * 11.0))));
  p.x += gline * uGlitch * 0.06 * (noise(vec2(t * 20.0, band)) - 0.5);

  // cell grid (digital-rain brightness scrolls down)
  float cols = 44.0 * uScale / max(uDigitSize, 0.3);
  vec2 cell = p * cols;
  vec2 cid = floor(cell);
  vec2 local = fract(cell);

  float rain = noise(cid * 0.30 + vec2(t * 0.15, t * 0.9));
  float amb = noise(cid * 0.13 - vec2(0.0, t * 0.3));
  float seed = hash21(cid + floor(t * 2.0 + amb * 6.0));

  float lit = glyph(local, seed) * smoothstep(0.42, 0.92, rain) * (0.35 + 0.65 * amb);

  // flicker
  lit *= 1.0 - uFlicker * 0.35 * noise(vec2(t * 9.0, 1.7));

  // scanlines
  float scan = 1.0 - uScanline * 0.5 * (0.5 + 0.5 * sin(cuv.y * uResolution.y * 1.4));

  vec3 color = uTint * lit * uBrightness * scan;
  color += uTint * 0.015; // faint phosphor base glow

  // vignette toward the curved edges
  float vig = smoothstep(1.1, 0.35, length(uv - 0.5));
  color *= mix(0.55, 1.0, vig);

  gl_FragColor = vec4(color, 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function FaultyTerminal({
  className = "",
  scale = 1,
  digitSize = 1.5,
  scanlineIntensity = 0.3,
  glitchAmount = 1,
  flickerAmount = 1,
  curvature = 0.2,
  tint = "#f59e0b",
  brightness = 1,
  mouseReact = true,
  mouseStrength = 0.2,
}: {
  className?: string;
  scale?: number;
  digitSize?: number;
  scanlineIntensity?: number;
  glitchAmount?: number;
  flickerAmount?: number;
  curvature?: number;
  tint?: string;
  brightness?: number;
  mouseReact?: boolean;
  mouseStrength?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("uResolution");
    const uTime = u("uTime");
    const uMouse = u("uMouse");
    gl.uniform3fv(u("uTint"), hexToRgb(tint));
    gl.uniform1f(u("uScale"), scale);
    gl.uniform1f(u("uDigitSize"), digitSize);
    gl.uniform1f(u("uScanline"), scanlineIntensity);
    gl.uniform1f(u("uGlitch"), glitchAmount);
    gl.uniform1f(u("uFlicker"), flickerAmount);
    gl.uniform1f(u("uCurvature"), curvature);
    gl.uniform1f(u("uBrightness"), brightness);
    gl.uniform1f(u("uMouseStrength"), mouseReact ? mouseStrength : 0);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - rect.left) / rect.width;
      mouse.ty = 1 - (e.clientY - rect.top) / rect.height;
    };
    if (mouseReact) window.addEventListener("mousemove", onMove);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      resize();
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uTime, reduce ? 4 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const ro = new ResizeObserver(() => {
      if (reduce) {
        resize();
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (mouseReact) window.removeEventListener("mousemove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    scale,
    digitSize,
    scanlineIntensity,
    glitchAmount,
    flickerAmount,
    curvature,
    tint,
    brightness,
    mouseReact,
    mouseStrength,
  ]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
