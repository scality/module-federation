import type { RsbuildPlugin } from '@rsbuild/core';
import type { Compiler } from '@rspack/core';

// ============================================================================
// Types
// ============================================================================

type MicroAppRuntimeConfiguration = {
  kind: string;
  apiVersion: string;
  metadata: Record<string, unknown>;
  spec: Record<string, unknown>;
};

type MicroAppRuntimeConfigurationPluginOptions = {
  defaultConfig: MicroAppRuntimeConfiguration;
  prefix?: string;
  headers?: Record<string, string>;
};

// ============================================================================
// Shared utility functions
// ============================================================================

const LOG_PREFIX = '[MicroAppRuntimeConfiguration]';

function debug(...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(LOG_PREFIX, ...args);
  }
}

function isDebugEnabled(): boolean {
  return process.env.DEBUG_MICRO_APP_RUNTIME_CONFIGURATION === 'true';
}

function parseValue(value: string): unknown {
  // Try parsing as JSON first (handles arrays, objects, booleans, numbers)
  try {
    return JSON.parse(value);
  } catch {
    // Return as string if not valid JSON
    return value;
  }
}

function getNestedValue(obj: Record<string, unknown>, keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, keys: string[], value: unknown): void {
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

type EnvOverride = {
  envVar: string;
  path: string;
  previousValue: unknown;
  newValue: unknown;
};

function applyEnvOverrides(config: MicroAppRuntimeConfiguration, prefix: string): MicroAppRuntimeConfiguration {
  const result = JSON.parse(JSON.stringify(config)) as MicroAppRuntimeConfiguration;
  const overrides: EnvOverride[] = [];

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value !== undefined) {
      // Use "__" as path separator (e.g., "selfConfiguration__url_salt" → ["selfConfiguration", "url_salt"])
      const specPath = key.slice(prefix.length).split('__');
      const previousValue = getNestedValue(result.spec, specPath);
      const newValue = parseValue(value);

      setNestedValue(result.spec, specPath, newValue);

      overrides.push({
        envVar: key,
        path: `spec.${specPath.join('.')}`,
        previousValue,
        newValue,
      });
    }
  }

  if (isDebugEnabled() && overrides.length > 0) {
    debug('Environment variable overrides applied:');
    for (const override of overrides) {
      debug(`  ${override.envVar}`);
      debug(`    Path: ${override.path}`);
      debug(`    Previous: ${JSON.stringify(override.previousValue)}`);
      debug(`    New: ${JSON.stringify(override.newValue)}`);
    }
  }

  return result;
}

function logFinalConfig(config: MicroAppRuntimeConfiguration, endpoint: string): void {
  debug('Serving runtime configuration at:', endpoint);
  debug('Final configuration:', JSON.stringify(config, null, 2));
}

// ============================================================================
// Rspack Plugin (class-based)
// ============================================================================

export class MicroAppRuntimeConfigurationPlugin {
  private config: MicroAppRuntimeConfiguration;
  private headers: Record<string, string>;

  constructor(
    defaultConfig: MicroAppRuntimeConfiguration,
    prefix = 'MICRO_APP_RUNTIME_',
    headers: Record<string, string> = {},
  ) {
    this.headers = headers;
    debug('Initializing plugin with prefix:', prefix);
    this.config = applyEnvOverrides(defaultConfig, prefix);
  }

  apply(compiler: Compiler): void {
    const publicPath = compiler.options.output?.publicPath ?? '/';
    const normalizedPublicPath = typeof publicPath === 'string' ? publicPath.replace(/\/$/, '') : '';

    // Extend devServer configuration
    const originalSetupMiddlewares = compiler.options.devServer?.setupMiddlewares;

    if (compiler.options.devServer) {
      compiler.options.devServer.setupMiddlewares = (middlewares, devServer) => {
        const endpoint = `${normalizedPublicPath}/.well-known/runtime-app-configuration`;

        logFinalConfig(this.config, endpoint);

        // @ts-expect-error - devServer.app is not typed
        devServer.app?.get(endpoint, (_req, res) => {
          debug('Request received for runtime configuration');
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

// ============================================================================
// Rsbuild Plugin (functional)
// ============================================================================

export const pluginMicroAppRuntimeConfiguration = (
  options: MicroAppRuntimeConfigurationPluginOptions,
): RsbuildPlugin => {
  const { defaultConfig, prefix = 'MICRO_APP_RUNTIME_', headers = {} } = options;

  debug('Initializing plugin with prefix:', prefix);
  const config = applyEnvOverrides(defaultConfig, prefix);

  return {
    name: 'plugin-micro-app-runtime-configuration',
    setup(api) {
      api.modifyRsbuildConfig((rsbuildConfig, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(rsbuildConfig, {
          dev: {
            setupMiddlewares: [
              (middlewares) => {
                const assetPrefix = rsbuildConfig.dev?.assetPrefix ?? '/';
                const normalizedPrefix = typeof assetPrefix === 'string' ? assetPrefix.replace(/\/$/, '') : '';
                const endpoint = `${normalizedPrefix}/.well-known/runtime-app-configuration`;

                logFinalConfig(config, endpoint);

                middlewares.unshift((req, res, next) => {
                  if (req.url?.startsWith(endpoint)) {
                    debug('Request received for runtime configuration');
                    res.setHeader('Content-Type', 'application/json');
                    for (const [key, value] of Object.entries(headers)) {
                      res.setHeader(key, value);
                    }
                    res.end(JSON.stringify(config));
                    return;
                  }
                  next();
                });
              },
            ],
          },
        });
      });
    },
  };
};
