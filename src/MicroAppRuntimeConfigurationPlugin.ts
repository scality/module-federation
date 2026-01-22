import type { Compiler } from '@rspack/core';

type MicroAppRuntimeConfiguration = {
  kind: string;
  apiVersion: string;
  metadata: Record<string, unknown>;
  spec: Record<string, unknown>;
};

export class MicroAppRuntimeConfigurationPlugin {
  private config: MicroAppRuntimeConfiguration;
  private prefix: string;
  private headers: Record<string, string>;
  private debug: boolean;

  constructor(defaultConfig: MicroAppRuntimeConfiguration, prefix = 'MICRO_APP_RUNTIME_', headers = {}) {
    this.prefix = prefix;
    this.headers = headers;
    this.debug = process.env.DEBUG_MICRO_APP_RUNTIME_CONFIGURATION === 'true' || false;
    this.config = this.applyEnvOverrides(defaultConfig);
  }

  private applyEnvOverrides(config: MicroAppRuntimeConfiguration): MicroAppRuntimeConfiguration {
    const result = JSON.parse(JSON.stringify(config)) as MicroAppRuntimeConfiguration;

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(this.prefix) && value !== undefined) {
        // Use "__" as path separator (e.g., "selfConfiguration__url_salt" → ["selfConfiguration", "url_salt"])
        const specPath = key.slice(this.prefix.length).split('__');
        this.setNestedValue(result.spec, specPath, this.parseValue(value));
      }
    }

    if (this.debug) {
      console.log('config', result);
    }
    return result;
  }

  private setNestedValue(obj: Record<string, unknown>, keys: string[], value: unknown): void {
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  private parseValue(value: string): unknown {
    // Try parsing as JSON first (handles arrays, objects, booleans, numbers)
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }

  apply(compiler: Compiler): void {
    const publicPath = compiler.options.output?.publicPath ?? '/';
    const normalizedPublicPath = typeof publicPath === 'string' ? publicPath.replace(/\/$/, '') : '';

    // Extend devServer configuration
    const originalSetupMiddlewares = compiler.options.devServer?.setupMiddlewares;

    if (compiler.options.devServer) {
      compiler.options.devServer.setupMiddlewares = (middlewares, devServer) => {
        const endpoint = `${normalizedPublicPath}/.well-known/runtime-app-configuration`;

        // @ts-expect-error - devServer.app is not typed
        devServer.app?.get(endpoint, (_req, res) => {
          res.set(this.headers);
          res.json(this.config);
        });

        if (originalSetupMiddlewares) {
          return originalSetupMiddlewares(middlewares, devServer);
        }
        return middlewares;
      };
    }
  }
}
