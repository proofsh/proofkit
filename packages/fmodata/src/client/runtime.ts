import type { InternalLogger } from "../logger";
import { extractConfigFromLayer, type FMODataLayer, type ODataConfig } from "../services";

export interface ClientRuntime {
  layer: FMODataLayer;
  config: ODataConfig;
  logger: InternalLogger;
}

/**
 * Single boundary for synchronous extraction of config/logger from the DI layer.
 * Builder/manager constructors should call this once and pass runtime around.
 */
export function createClientRuntime(layer: FMODataLayer): ClientRuntime {
  const { config, logger } = extractConfigFromLayer(layer);
  return {
    layer,
    config,
    logger,
  };
}
