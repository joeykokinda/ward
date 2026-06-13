"use client";

// Animated grainy, domain-warped gradient (Grainient-style) rendered on a raw
// WebGL canvas — no dependency. Tuned dark so light text stays readable: the
// amber only surfaces as flowing highlights over a near-black base. Freezes for
// prefers-reduced-motion and cleans up its RAF + GL context on unmount.

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor1; // base (near-black)
uniform vec3 uColor2; // mid (ember)
uniform vec3 uColor3; // high (amber)
uniform float uGrain;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv;
  p.x *= uResolution.x / uResolution.y;
  p *= 2.0;
  float t = uTime * 0.05;

  // domain warp — q then r push the field around over time
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t)));
  vec2 r = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.5 * t),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.5 * t)
  );
  float f = fbm(p + 2.5 * r);

  vec3 col = mix(uColor1, uColor2, smoothstep(0.05, 0.75, f));
  col = mix(col, uColor3, smoothstep(0.55, 1.05, f + 0.25 * r.x));

  // vignette keeps the edges dark so the panel reads as one piece
  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
  col *= mix(0.62, 1.0, vig);

  // film grain
  float g = hash(gl_FragCoord.xy + uTime) - 0.5;
  col += g * uGrain;

  gl_FragColor = vec4(col, 1.0);
}
`;

// WARD palette, normalized 0..1: near-black → ember → amber.
const COLOR1: [number, number, number] = [0.039, 0.039, 0.059]; // #0a0a0f
const COLOR2: [number, number, number] = [0.31, 0.12, 0.04]; // ~#4f1f0a ember
const COLOR3: [number, number, number] = [0.96, 0.62, 0.04]; // #f59e0b amber

export function Grainient({ className = "" }: { className?: string }) {
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
    // two triangles covering clip space
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    gl.uniform3fv(gl.getUniformLocation(program, "uColor1"), COLOR1);
    gl.uniform3fv(gl.getUniformLocation(program, "uColor2"), COLOR2);
    gl.uniform3fv(gl.getUniformLocation(program, "uColor3"), COLOR3);
    gl.uniform1f(gl.getUniformLocation(program, "uGrain"), 0.06);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      gl.uniform1f(uTime, reduce ? 8 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const ro = new ResizeObserver(() => {
      if (reduce) {
        resize();
        gl.uniform1f(uTime, 8);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
