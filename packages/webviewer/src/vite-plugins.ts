import type { FmBridgeOptions as InternalFmBridgeOptions } from "./fm-bridge.js";
import { fmBridge as createFmBridge } from "./fm-bridge.js";

export interface FmBridgeOptions extends InternalFmBridgeOptions {}

export const fmBridge = createFmBridge;
