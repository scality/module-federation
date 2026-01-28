import { afterAll, beforeEach, describe, expect, test } from '@rstest/core';
import {
  applyEnvOverrides,
  MicroAppRuntimeConfigurationPlugin,
  pluginMicroAppRuntimeConfiguration,
  type MicroAppRuntimeConfiguration,
} from './MicroAppRuntimeConfigurationPlugin';

const createDefaultConfig = (): MicroAppRuntimeConfiguration => ({
  kind: 'MicroAppRuntimeConfiguration',
  apiVersion: 'ui.scality.com/v1alpha1',
  metadata: {
    kind: 'zenko-ui',
    name: 'zenko.eu-west-1',
  },
  spec: {
    title: 'Data Management',
    selfConfiguration: {
      managementEndpoint: '/zenko/management',
      stsEndpoint: '/zenko/sts',
      zenkoEndpoint: '/zenko/s3',
      iamEndpoint: '/zenko/iam',
      features: [] as string[],
      basePath: '/',
    },
    auth: {
      kind: 'OIDC',
      providerUrl: '/oidc',
      clientId: 'zenko-ui',
    } as Record<string, unknown>,
  },
});

// ============================================================================
// applyEnvOverrides Tests (shared logic for both plugins)
// ============================================================================

describe('applyEnvOverrides', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('basic overrides', () => {
    test('should override a simple string value', () => {
      process.env.MICRO_APP_RUNTIME_title = 'New Title';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect(result.spec.title).toBe('New Title');
    });

    test('should override a nested string value using __ separator', () => {
      process.env.MICRO_APP_RUNTIME_selfConfiguration__managementEndpoint = '/new/endpoint';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect((result.spec.selfConfiguration as Record<string, unknown>).managementEndpoint).toBe('/new/endpoint');
    });

    test('should override deeply nested values', () => {
      process.env.MICRO_APP_RUNTIME_auth__clientId = 'new-client-id';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect((result.spec.auth as Record<string, unknown>).clientId).toBe('new-client-id');
    });
  });

  describe('JSON parsing', () => {
    test('should override an array with JSON syntax', () => {
      process.env.MICRO_APP_RUNTIME_selfConfiguration__features = '["feature1","feature2"]';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect((result.spec.selfConfiguration as Record<string, unknown>).features).toEqual(['feature1', 'feature2']);
    });

    test('should treat comma-separated values as a string (use JSON for arrays)', () => {
      process.env.MICRO_APP_RUNTIME_selfConfiguration__features = 'feature1,feature2,feature3';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect((result.spec.selfConfiguration as Record<string, unknown>).features).toBe('feature1,feature2,feature3');
    });

    test('should parse boolean values from JSON', () => {
      process.env.MICRO_APP_RUNTIME_auth__providerLogout = 'true';

      const config = createDefaultConfig();
      (config.spec.auth as Record<string, unknown>).providerLogout = false;

      const result = applyEnvOverrides(config, 'MICRO_APP_RUNTIME_');

      expect((result.spec.auth as Record<string, unknown>).providerLogout).toBe(true);
    });

    test('should parse number values from JSON', () => {
      process.env.MICRO_APP_RUNTIME_auth__timeout = '30000';

      const config = createDefaultConfig();
      (config.spec.auth as Record<string, unknown>).timeout = 5000;

      const result = applyEnvOverrides(config, 'MICRO_APP_RUNTIME_');

      expect((result.spec.auth as Record<string, unknown>).timeout).toBe(30000);
    });

    test('should handle JSON objects', () => {
      process.env.MICRO_APP_RUNTIME_customObject = '{"key":"value","nested":{"a":1}}';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect(result.spec.customObject).toEqual({
        key: 'value',
        nested: { a: 1 },
      });
    });

    test('should treat invalid JSON as string', () => {
      process.env.MICRO_APP_RUNTIME_title = 'not{valid}json';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect(result.spec.title).toBe('not{valid}json');
    });
  });

  describe('custom prefix', () => {
    test('should use a custom prefix for environment variables', () => {
      process.env.CUSTOM_PREFIX_title = 'Custom Title';

      const result = applyEnvOverrides(createDefaultConfig(), 'CUSTOM_PREFIX_');

      expect(result.spec.title).toBe('Custom Title');
    });

    test('should ignore variables with default prefix when custom prefix is set', () => {
      process.env.MICRO_APP_RUNTIME_title = 'Should Be Ignored';
      process.env.CUSTOM_title = 'Custom Title';

      const result = applyEnvOverrides(createDefaultConfig(), 'CUSTOM_');

      expect(result.spec.title).toBe('Custom Title');
    });
  });

  describe('edge cases', () => {
    test('should handle empty string values', () => {
      process.env.MICRO_APP_RUNTIME_title = '';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect(result.spec.title).toBe('');
    });

    test('should not modify the original config object', () => {
      process.env.MICRO_APP_RUNTIME_title = 'Modified Title';

      const config = createDefaultConfig();
      applyEnvOverrides(config, 'MICRO_APP_RUNTIME_');

      expect(config.spec.title).toBe('Data Management');
    });

    test('should create intermediate objects for non-existent paths', () => {
      process.env.MICRO_APP_RUNTIME_newSection__newKey = 'newValue';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect((result.spec as Record<string, Record<string, unknown>>).newSection.newKey).toBe('newValue');
    });

    test('should treat non-JSON values as strings', () => {
      process.env.MICRO_APP_RUNTIME_selfConfiguration__features = 'single_feature';

      const result = applyEnvOverrides(createDefaultConfig(), 'MICRO_APP_RUNTIME_');

      expect((result.spec.selfConfiguration as Record<string, unknown>).features).toBe('single_feature');
    });
  });
});

// ============================================================================
// MicroAppRuntimeConfigurationPlugin Tests (Rspack plugin-specific)
// ============================================================================

describe('MicroAppRuntimeConfigurationPlugin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should create plugin instance with default prefix', () => {
    process.env.MICRO_APP_RUNTIME_title = 'Test Title';

    const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());

    expect(typeof plugin.apply).toBe('function');
  });

  test('should accept custom headers', () => {
    const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig(), 'MICRO_APP_RUNTIME_', {
      'Cache-Control': 'no-cache',
    });

    expect(typeof plugin.apply).toBe('function');
  });
});

// ============================================================================
// pluginMicroAppRuntimeConfiguration Tests (Rsbuild plugin-specific)
// ============================================================================

describe('pluginMicroAppRuntimeConfiguration', () => {
  test('should return a valid RsbuildPlugin with correct name', () => {
    const plugin = pluginMicroAppRuntimeConfiguration({
      defaultConfig: createDefaultConfig(),
    });

    expect(plugin.name).toBe('plugin-micro-app-runtime-configuration');
    expect(typeof plugin.setup).toBe('function');
  });
});
