"use client";
// THE DEEP · the ambient substrate ... my own dithering-warp WebGL shader (not a library), tuned to
// dom's oxblood reds. domain-warped fbm -> the red-descent ramp -> 4x4 bayer ordered dither (the halftone
// "dreamslur" texture). low-power, one fullscreen triangle, self-cleaning. renders BEHIND everything.
import { useEffect, useRef } from "react";

const FRAG = `
precision highp float;
uniform vec2 R; uniform float T; uniform float DIM;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
float bayer(vec2 c){int x=int(mod(c.x,4.)),y=int(mod(c.y,4.));int idx=x+y*4;
  float m[16];m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
  m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  float v=0.;for(int k=0;k<16;k++){if(k==idx)v=m[k];}return v/16.;}
vec3 ramp(float t){
  vec3 v=vec3(0.031,0.035,0.055); vec3 a=vec3(0.259,0.0,0.0); vec3 b=vec3(0.459,0.0,0.0);
  vec3 c=vec3(0.478,0.082,0.157); vec3 d=vec3(0.66,0.12,0.22);
  t=clamp(t,0.,1.);
  if(t<.30)return mix(v,a,t/.30);
  if(t<.58)return mix(a,b,(t-.30)/.28);
  if(t<.82)return mix(b,c,(t-.58)/.24);
  return mix(c,d,(t-.82)/.18);
}
void main(){
  vec2 uv=gl_FragCoord.xy/R.xy; vec2 p=uv*vec2(R.x/R.y,1.)*2.6; float t=T*.018;
  vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,-t*.7)));
  vec2 r=vec2(fbm(p+2.4*q+vec2(1.7,t*.5)),fbm(p+2.4*q+vec2(8.3,-t*.4)));
  float f=fbm(p+3.2*r); f=pow(f,1.35);
  float vg=smoothstep(1.25,.15,length(uv-.5));
  float val=f*mix(.55,1.05,vg);
  float levels=5.; float dv=val+(bayer(gl_FragCoord.xy)-.5)*(1./levels); dv=floor(dv*levels)/levels;
  vec3 col=ramp(dv);
  col+=vec3(.10,.12,.16)*smoothstep(.72,1.,f)*.25;
  col*=DIM;
  gl_FragColor=vec4(col,1.);
}`;
const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

export interface DeepShaderProps {
  /** overall brightness ... it lives behind content. default .82 */
  dim?: number;
  /** css position. 'fixed' (full-viewport bg) or 'absolute' (fills its relative parent). default 'fixed' */
  position?: "fixed" | "absolute";
  className?: string;
  style?: React.CSSProperties;
}

export default function DeepShader({
  dim = 0.82,
  position = "fixed",
  className,
  style,
}: DeepShaderProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const gl = cv.getContext("webgl", {
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    if (!gl) {
      cv.style.background = "radial-gradient(120% 90% at 50% 0%,#1a0505,#08090e 70%)";
      return;
    }
    const sh = (t: number, s: string) => {
      const o = gl.createShader(t)!;
      gl.shaderSource(o, s);
      gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS))
        console.error("[deepshader] compile failed: " + gl.getShaderInfoLog(o));
      return o;
    };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      console.error("[deepshader] link failed: " + gl.getProgramInfoLog(pr));
      cv.style.display = "none"; // hide the dead canvas ... the parent's oxblood gradient shows instead of a white void
      return;
    }
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(pr, "R"),
      uT = gl.getUniformLocation(pr, "T"),
      uD = gl.getUniformLocation(pr, "DIM");
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const size = () => {
      cv.width = Math.floor(window.innerWidth * dpr);
      cv.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
    };
    size();
    window.addEventListener("resize", size, { passive: true });
    const t0 = performance.now();
    let raf = 0;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      gl.uniform2f(uR, cv.width, cv.height);
      gl.uniform1f(uT, (performance.now() - t0) / 1000);
      gl.uniform1f(uD, dim);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    };
    loop();
    // NOTE: do NOT loseContext() here. React StrictMode double-mounts in dev; losing the context on the
    // first cleanup leaves the remount with a dead context (getContext returns the lost one) -> the shader
    // fails to compile and silently falls back to the flat gradient. the browser reclaims the context on GC.
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, [dim]);
  // the dark gradient backdrop is ALWAYS present ... the shader (when it compiles) draws opaque oxblood over it;
  // if a gpu/context can't compile the shader, this dark base shows instead of a white canvas.
  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{
        position,
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        display: "block",
        background: "radial-gradient(125% 95% at 50% 0%,#180406,#08090e 68%)",
        ...style,
      }}
    />
  );
}
