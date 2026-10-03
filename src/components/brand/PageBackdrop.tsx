import { useEffect, useRef, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { t } from "@/lib/theme/tokens";

import { useRoom } from "./useRoom";

export type PageBackdropTone = "page" | "signin";

export interface PageBackdropProps {
  /** Which artboard to draw. Defaults to the app's 768px breakpoint. */
  viewport?: "desktop" | "mobile";
  /** `signin` is the entrance's room on desktop; every other page is `page`. */
  tone?: PageBackdropTone;
}

interface Ripple {
  x: number;
  y: number;
  startTime: number;
}

const RIPPLE_LIFETIME = 4000; // ms
const MAX_RIPPLES = 8;

// Get CSS token values
function getCSSTokenValue(tokenVar: string): string {
  if (typeof window === "undefined") return "#000000";
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenVar).trim();
  return value || "#000000";
}

function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function rgbToVec3(rgb: string): [number, number, number] {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [
    parseInt(match[1]) / 255,
    parseInt(match[2]) / 255,
    parseInt(match[3]) / 255,
  ];
}

const VERTEX_SHADER = `#version 100
precision highp float;

attribute vec2 position;
varying vec2 uv;

void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

function createFragmentShader(isDusk: boolean): string {
  return `#version 100
precision highp float;

varying vec2 uv;
uniform float time;
uniform vec3 bgColor;
uniform vec3 arcViolet;
uniform vec3 arcSalmon;
uniform vec3 horizonSalmon;
uniform float shadowStrength;
uniform vec3 ripplePos[8];
uniform float rippleAge[8];
uniform int rippleCount;

// Hash function for noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Value noise
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n00 = hash(i);
  float n10 = hash(i + vec2(1.0, 0.0));
  float n01 = hash(i + vec2(0.0, 1.0));
  float n11 = hash(i + vec2(1.0, 1.0));

  float nx0 = mix(n00, n10, f.x);
  float nx1 = mix(n01, n11, f.x);
  return mix(nx0, nx1, f.y);
}

// FBM (fractional Brownian motion)
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxValue = 0.0;

  for(int i = 0; i < 5; i++) {
    value += amplitude * valueNoise(p * frequency);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value / maxValue;
}

// Domain warp
vec2 domainWarp(vec2 p, vec2 warpDir) {
  return p + warpDir * 0.1;
}

void main() {
  vec2 uv_work = uv;

  // Drift animation
  float drift = time * 0.05;
  uv_work.x += sin(time * 0.02) * 0.1;
  uv_work.y += cos(time * 0.015) * 0.08;

  // FBM base
  float f = fbm(uv_work * 2.0 + vec2(drift, 0.0));

  // Domain warp round 1
  vec2 q = vec2(f);
  float qf = fbm(uv_work * 2.0 + q + vec2(drift * 0.7, 0.0));

  // Domain warp round 2
  vec2 r = vec2(qf);
  float final = fbm(uv_work * 2.0 + r * 1.9 + vec2(drift * 0.5, 0.0));

  // Base color
  vec3 color = bgColor;

  // Shadow strength from folds
  float shadowAmount = shadowStrength;
  float shadow = smoothstep(0.30, 0.95, final) * shadowAmount;
  color = mix(color, vec3(0.0), shadow);

  // Horizon band (Noon only)
  ${isDusk ? "" : `
  float horizon = exp(-pow((uv.y - 0.52) / 0.09, 2.0)) * 0.3;
  color += horizonSalmon * horizon;
  `}

  // Arc region lift
  vec2 arcPos = vec2(0.92, 0.04);
  float distToArc = distance(uv, arcPos);
  float glow = smoothstep(1.05, 0.05, distToArc);

  color = mix(color, arcViolet, pow(glow, 1.6) * 0.5);
  color = mix(color, arcSalmon, pow(glow, 1.9) * 0.3);

  // Subtle sheen from warp
  float sheen = r.x * 0.1;
  color += sheen * 0.05;

  // Hash grain
  float grain = hash(uv * 100.0 + vec2(time * 0.1)) * 0.016;
  color += grain - 0.008;

  // Ripple effects
  for(int i = 0; i < 8; i++) {
    if(i >= rippleCount) break;

    float age = rippleAge[i];
    if(age > 4000.0) continue;

    vec2 ripUv = uv * vec2(1.0, 1.0);
    float dist = distance(ripUv, ripplePos[i].xy);
    float wavePhase = age * 0.0004 - 0.4;
    float wave = exp(-((dist - wavePhase) * (dist - wavePhase)) / 0.01) *
                  exp(-age / 1000.0);

    // Chromatic aberration on ripple
    if(wave > 0.01) {
      float aberration = wave * 0.075;

      // Sample R at offset
      vec2 uvR = ripUv + normalize(ripUv - ripplePos[i].xy) * aberration * 1.22;
      float sampleR = fbm(uvR * 2.0 + vec2(drift, 0.0));

      // Sample G at no offset
      float sampleG = fbm(ripUv * 2.0 + vec2(drift, 0.0));

      // Sample B at offset
      vec2 uvB = ripUv - normalize(ripUv - ripplePos[i].xy) * aberration * 0.74;
      float sampleB = fbm(uvB * 2.0 + vec2(drift, 0.0));

      vec3 aberrantColor = vec3(sampleR, sampleG, sampleB) * wave;
      color += aberrantColor * 0.3;
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
`;
}

function WebGLCanvas({
  isDusk,
  tone,
}: {
  isDusk: boolean;
  tone: PageBackdropTone;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());
  const prefersReducedMotionRef = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check for WebGL support
    const gl = canvas.getContext("webgl");
    if (!gl) {
      // Hide canvas if no WebGL support, use CSS fallback
      canvas.style.display = "none";
      return;
    }

    glRef.current = gl;

    // Compile shader
    const compileShader = (source: string, type: GLenum) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Failed to create shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        throw new Error("Shader compilation failed");
      }
      return shader;
    };

    const vertexShader = compileShader(VERTEX_SHADER, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(
      createFragmentShader(isDusk),
      gl.FRAGMENT_SHADER,
    );

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      throw new Error("Program linking failed");
    }

    gl.useProgram(program);

    // Set up fullscreen triangle
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const timeLocation = gl.getUniformLocation(program, "time");
    const bgColorLocation = gl.getUniformLocation(program, "bgColor");
    const arcVioletLocation = gl.getUniformLocation(program, "arcViolet");
    const arcSalmonLocation = gl.getUniformLocation(program, "arcSalmon");
    const horizonSalmonLocation = gl.getUniformLocation(
      program,
      "horizonSalmon",
    );
    const shadowStrengthLocation = gl.getUniformLocation(
      program,
      "shadowStrength",
    );
    const ripplePosLocation = gl.getUniformLocation(program, "ripplePos");
    const rippleAgeLocation = gl.getUniformLocation(program, "rippleAge");
    const rippleCountLocation = gl.getUniformLocation(program, "rippleCount");

    const handlePointerDown = (event: PointerEvent) => {
      if (ripplesRef.current.length >= MAX_RIPPLES) {
        ripplesRef.current.shift();
      }

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;

      ripplesRef.current.push({
        x,
        y,
        startTime: Date.now(),
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Enter" || event.code === "Space") {
        const focused = document.activeElement as HTMLElement;
        if (focused) {
          const rect = focused.getBoundingClientRect();
          const x = (rect.left + rect.width / 2) / window.innerWidth;
          const y =
            1 -
            (rect.top + rect.height / 2) /
              (window.innerHeight * devicePixelRatio);

          if (ripplesRef.current.length >= MAX_RIPPLES) {
            ripplesRef.current.shift();
          }

          ripplesRef.current.push({
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
            startTime: Date.now(),
          });
        }
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      } else {
        startTimeRef.current = Date.now() - (animationFrameRef.current || 0);
        animate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const animate = () => {
      if (document.hidden) return;

      // Remove expired ripples
      const now = Date.now();
      ripplesRef.current = ripplesRef.current.filter(
        (r) => now - r.startTime < RIPPLE_LIFETIME,
      );

      // Stop animation if reduced motion is on and no ripples
      if (
        prefersReducedMotionRef.current &&
        ripplesRef.current.length === 0
      ) {
        // Render one final frame
        renderFrame(0);
        return;
      }

      renderFrame(Date.now() - startTimeRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const renderFrame = (elapsed: number) => {
      // Set canvas size
      const dpr = Math.min(devicePixelRatio, 1.5);
      const scale =
        window.innerWidth * window.innerHeight > 2200000 ? 0.72 : 1;
      const width = window.innerWidth * dpr * scale;
      const height = window.innerHeight * dpr * scale;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);

      // Get and set color uniforms
      const bgValue = isDusk
        ? "1a1523"
        : getCSSTokenValue("--bg");
      const bgColor = isDusk
        ? hexToVec3("#1a1523")
        : hexToVec3(bgValue.startsWith("#") ? bgValue : "#e9ebe7");

      const arcViolet = isDusk
        ? hexToVec3("#a78bfa")
        : hexToVec3("#8fa79b");
      const arcSalmon = isDusk
        ? hexToVec3("#d98c6b")
        : hexToVec3("#e3a594");
      const horizonSalmon = isDusk
        ? hexToVec3("#8c78c4")
        : hexToVec3("#f1d5cb");

      gl.uniform3f(bgColorLocation, bgColor[0], bgColor[1], bgColor[2]);
      gl.uniform3f(
        arcVioletLocation,
        arcViolet[0],
        arcViolet[1],
        arcViolet[2],
      );
      gl.uniform3f(arcSalmonLocation, arcSalmon[0], arcSalmon[1], arcSalmon[2]);
      gl.uniform3f(
        horizonSalmonLocation,
        horizonSalmon[0],
        horizonSalmon[1],
        horizonSalmon[2],
      );

      const shadowStrength = isDusk ? 1.0 : 0.42;
      gl.uniform1f(shadowStrengthLocation, shadowStrength);

      gl.uniform1f(timeLocation, elapsed);

      // Set ripple data
      const ripplePositions: number[] = [];
      const rippleAges: number[] = [];

      for (let i = 0; i < MAX_RIPPLES; i++) {
        if (i < ripplesRef.current.length) {
          const ripple = ripplesRef.current[i];
          ripplePositions.push(ripple.x, ripple.y, 0);
          rippleAges.push(now - ripple.startTime);
        } else {
          ripplePositions.push(0, 0, 0);
          rippleAges.push(0);
        }
      }

      gl.uniform3fv(ripplePosLocation, ripplePositions);
      gl.uniform1fv(rippleAgeLocation, rippleAges);
      gl.uniform1i(rippleCountLocation, ripplesRef.current.length);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // Start animation
    startTimeRef.current = Date.now();
    animate();

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
    };
  }, [isDusk]);

  return (
    <canvas
      ref={canvasRef}
      data-ui="backdrop-canvas"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        display: "block",
      }}
    />
  );
}

export function PageBackdrop({ viewport, tone = "page" }: PageBackdropProps) {
  const dusk = useRoom() === "dusk";
  const isMobile = useIsMobile();
  const phone = (viewport ?? (isMobile ? "mobile" : "desktop")) === "mobile";
  const [hasWebGL, setHasWebGL] = useState(true);

  // Check WebGL support
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    setHasWebGL(gl !== null);
  }, []);

  // Get backdrop gradient as fallback
  const backdropValue = dusk
    ? "radial-gradient(60% 42% at 88% 0%, rgba(140,120,196,.42) 0%, rgba(140,120,196,0) 72%), radial-gradient(40% 26% at 80% 6%, rgba(217,140,107,.22) 0%, rgba(217,140,107,0) 70%), radial-gradient(55% 45% at 10% 100%, rgba(92,84,128,.28) 0%, rgba(92,84,128,0) 70%), linear-gradient(180deg, #241C33 0%, #1F1829 45%, #1A1523 100%)"
    : "linear-gradient(180deg, #C2CFCF 0%, #D2DADA 24%, #E1E3DE 42%, #EDD3C8 51%, #F2BEA8 55%, #E6DED9 61%, #E0E5E2 74%, #E9EBE7 100%)";

  return (
    <>
      {hasWebGL ? (
        <WebGLCanvas isDusk={dusk} tone={tone} />
      ) : (
        <div
          data-ui="page-backdrop-fallback"
          data-tone={tone}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background: backdropValue,
          }}
        />
      )}
    </>
  );
}

export default PageBackdrop;
