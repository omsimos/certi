import { LETTERING_SIZE } from "@/lib/badge/layout";
import type { Pose } from "@/lib/badge/pose";
import { type BadgeTemplate, TEMPLATE_MODE } from "@/lib/badge/templates";

import shaderSource from "./holo.wgsl?raw";

export class WebGPUUnavailableError extends Error {
  name = "WebGPUUnavailableError";
}

export type HoloScene = { template: BadgeTemplate; accent: string; mask: Uint8Array };

export type HoloRenderer = {
  setScene(s: HoloScene): void;
  // Draws at the canvas's current size.
  draw(pose: Pose): void;
  lost: Promise<void>;
  dispose(): void;
};

type Gpu = {
  device: GPUDevice;
  format: GPUTextureFormat;
  pipeline: GPURenderPipeline;
  sampler: GPUSampler;
};

// TypeScript's DOM lib types WebGPU but omits the usage flag namespaces; values from the spec.
const TEXTURE_BINDING = 0x04;
const TEXTURE_COPY_DST = 0x02;
const BUFFER_COPY_DST = 0x08;
const BUFFER_UNIFORM = 0x40;

// One device and pipeline shared by every renderer (live badge, previews, exports).
let shared: Promise<Gpu> | null = null;

async function initGpu(): Promise<Gpu> {
  const gpu = typeof navigator !== "undefined" && "gpu" in navigator ? navigator.gpu : undefined;
  if (!gpu) throw new WebGPUUnavailableError("This browser has no WebGPU");
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new WebGPUUnavailableError("No WebGPU adapter available");
  const device = await adapter.requestDevice();

  const module = device.createShaderModule({ code: shaderSource });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === "error");
  if (errors.length) {
    device.destroy();
    throw new Error(
      `Badge shader failed to compile:\n${errors.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join("\n")}`,
    );
  }

  const format = gpu.getPreferredCanvasFormat();
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs_main" },
    fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
  });
  const sampler = device.createSampler({ minFilter: "linear", magFilter: "linear" });
  return { device, format, pipeline, sampler };
}

function getGpu(): Promise<Gpu> {
  if (!shared) {
    const p = initGpu();
    shared = p;
    p.then(
      ({ device }) =>
        void device.lost.then(() => {
          if (shared === p) shared = null;
        }),
      () => {
        if (shared === p) shared = null;
      },
    );
  }
  return shared;
}

// A canvas keeps one context, so a stale renderer (e.g. a StrictMode remount) must not
// unconfigure it from under the renderer that replaced it.
const owners = new WeakMap<HTMLCanvasElement | OffscreenCanvas, object>();

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

export async function createHoloRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<HoloRenderer> {
  const { device, format, pipeline, sampler } = await getGpu();
  const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!context) throw new WebGPUUnavailableError("Couldn't get a WebGPU canvas context");
  context.configure({ device, format, alphaMode: "opaque" });
  const owner = {};
  owners.set(canvas, owner);

  const [W, H] = LETTERING_SIZE;
  const mask = device.createTexture({
    size: [W, H],
    format: "r8unorm",
    usage: TEXTURE_BINDING | TEXTURE_COPY_DST,
  });
  // Uniforms: resolution, tilt, pointer (vec2f each), hover, mode, then accent (vec4f).
  const ubo = device.createBuffer({
    size: 48,
    usage: BUFFER_UNIFORM | BUFFER_COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: ubo } },
      { binding: 1, resource: mask.createView() },
      { binding: 2, resource: sampler },
    ],
  });

  const uniforms = new Float32Array(12);
  let mode = 0;
  let accent = [0, 0, 0, 0];
  let disposed = false;

  return {
    setScene(s) {
      mode = TEMPLATE_MODE[s.template];
      accent = s.template === "branded" ? [...hexToRgb(s.accent), 1] : [0, 0, 0, 0];
      device.queue.writeTexture({ texture: mask }, s.mask, { bytesPerRow: W }, [W, H]);
    },
    draw(pose) {
      if (disposed) return;
      uniforms.set([
        canvas.width,
        canvas.height,
        ...pose.tilt,
        ...pose.pointer,
        pose.hover,
        mode,
        ...accent,
      ]);
      device.queue.writeBuffer(ubo, 0, uniforms);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: [0, 0, 0, 1],
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    lost: device.lost.then(() => undefined),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (owners.get(canvas) === owner) {
        owners.delete(canvas);
        context.unconfigure();
      }
      mask.destroy();
      ubo.destroy();
    },
  };
}
