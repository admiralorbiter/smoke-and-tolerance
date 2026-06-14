import init, { simulate_shot } from './pkg/sim.js';
import wasmUrl from './pkg/sim_bg.wasm?url';
import { FRAME_STRIDE } from '../types';

let initialized = false;
let wasmExports: any = null;

async function initWasm() {
  if (initialized) return;
  wasmExports = await init(wasmUrl);
  initialized = true;
}

self.onmessage = async (e: MessageEvent) => {
  const { input } = e.data;

  try {
    await initWasm();
    
    // Flatten custom alchemical mix parameters for flat Rust struct mapping
    const flatInput = {
      ...input,
      weatherProtection: input.weatherProtection || input.alchemicalMix?.weatherProtection,
      saltpeterRatio: input.alchemicalMix?.saltpeterRatio,
      charcoalRatio: input.alchemicalMix?.charcoalRatio,
      sulfurRatio: input.alchemicalMix?.sulfurRatio,
      charcoalSource: input.alchemicalMix?.charcoalSource,
      saltpeterPurity: input.alchemicalMix?.saltpeterPurity,
    };
    
    // Run the simulator in WASM
    const result = simulate_shot(flatInput);

    // Copy the flat f64 frame data out of WASM memory to prevent detaching WASM memory buffer
    const floatCount = result.frameCount * FRAME_STRIDE;
    const ptr = result.frameDataPtr;
    
    const wasmMem = wasmExports.memory;
    const rawBuffer = new ArrayBuffer(floatCount * 8);
    const jsView = new Float64Array(rawBuffer);
    const wasmView = new Float64Array(wasmMem.buffer, ptr, floatCount);
    
    jsView.set(wasmView);

    // Post message back transferring the rawBuffer
    (self as any).postMessage({
      success: true,
      result,
      rawBuffer
    }, [rawBuffer]);

  } catch (err: any) {
    (self as any).postMessage({
      success: false,
      error: err.toString()
    });
  }
};
