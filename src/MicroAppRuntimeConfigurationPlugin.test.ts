import { afterAll, beforeEach, describe, expect, test } from '@rstest/core';
import { MicroAppRuntimeConfigurationPlugin } from './MicroAppRuntimeConfigurationPlugin';

const createDefaultConfig = () => ({
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

type TestConfig = ReturnType<typeof createDefaultConfig>;
type PluginWithConfig = { config: TestConfig };

const getConfig = (plugin: MicroAppRuntimeConfigurationPlugin): TestConfig =>
  (plugin as unknown as PluginWithConfig).config;

describe('MicroAppRuntimeConfigurationPlugin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('environment variable overrides', () => {
    test('should override a simple string value', () => {
      process.env.MICRO_APP_RUNTIME_title = 'New Title';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect(config.spec.title).toBe('New Title');
    });

    test('should override a nested string value using __ separator', () => {
      process.env.MICRO_APP_RUNTIME_selfConfiguration__managementEndpoint = '/new/endpoint';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect(config.spec.selfConfiguration.managementEndpoint).toBe('/new/endpoint');
    });

    test('should override deeply nested values', () => {
      process.env.MICRO_APP_RUNTIME_auth__clientId = 'new-client-id';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect(config.spec.auth.clientId).toBe('new-client-id');
    });

    test('should override an array with JSON syntax', () => {
      process.env.MICRO_APP_RUNTIME_selfConfiguration__features = '["feature1","feature2"]';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect(config.spec.selfConfiguration.features).toEqual(['feature1', 'feature2']);
    });

    test('should treat comma-separated values as a string (use JSON for arrays)', () => {
      process.env.MICRO_APP_RUNTIME_selfConfiguration__features = 'feature1,feature2,feature3';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect(config.spec.selfConfiguration.features).toBe('feature1,feature2,feature3');
    });

    test('should parse boolean values from JSON', () => {
      process.env.MICRO_APP_RUNTIME_auth__providerLogout = 'true';

      const defaultConfig = createDefaultConfig();
      defaultConfig.spec.auth.providerLogout = false;

      const plugin = new MicroAppRuntimeConfigurationPlugin(defaultConfig);
      const config = getConfig(plugin);

      expect(config.spec.auth.providerLogout).toBe(true);
    });

    test('should parse number values from JSON', () => {
      process.env.MICRO_APP_RUNTIME_auth__timeout = '30000';

      const defaultConfig = createDefaultConfig();
      defaultConfig.spec.auth.timeout = 5000;

      const plugin = new MicroAppRuntimeConfigurationPlugin(defaultConfig);
      const config = getConfig(plugin);

      expect(config.spec.auth.timeout).toBe(30000);
    });

    test('should not modify the original config object', () => {
      process.env.MICRO_APP_RUNTIME_title = 'Modified Title';

      const defaultConfig = createDefaultConfig();
      new MicroAppRuntimeConfigurationPlugin(defaultConfig);

      expect(defaultConfig.spec.title).toBe('Data Management');
    });

    test('should create intermediate objects for non-existent paths', () => {
      process.env.MICRO_APP_RUNTIME_newSection__newKey = 'newValue';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);
      const spec = config.spec as unknown as Record<string, Record<string, unknown>>;

      expect(spec.newSection.newKey).toBe('newValue');
    });
  });

  describe('custom prefix', () => {
    test('should use a custom prefix for environment variables', () => {
      process.env.CUSTOM_PREFIX_title = 'Custom Title';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig(), 'CUSTOM_PREFIX_');
      const config = getConfig(plugin);

      expect(config.spec.title).toBe('Custom Title');
    });

    test('should ignore variables with default prefix when custom prefix is set', () => {
      process.env.MICRO_APP_RUNTIME_title = 'Should Be Ignored';
      process.env.CUSTOM_title = 'Custom Title';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig(), 'CUSTOM_');
      const config = getConfig(plugin);

      expect(config.spec.title).toBe('Custom Title');
    });
  });

  describe('edge cases', () => {
    test('should handle empty string values', () => {
      process.env.MICRO_APP_RUNTIME_title = '';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect(config.spec.title).toBe('');
    });

    test('should handle JSON objects', () => {
      process.env.MICRO_APP_RUNTIME_customObject = '{"key":"value","nested":{"a":1}}';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect((config.spec as Record<string, unknown>).customObject).toEqual({
        key: 'value',
        nested: { a: 1 },
      });
    });

    test('should treat invalid JSON as string', () => {
      process.env.MICRO_APP_RUNTIME_title = 'not{valid}json';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect(config.spec.title).toBe('not{valid}json');
    });

    test('should treat non-JSON values as strings', () => {
      process.env.MICRO_APP_RUNTIME_selfConfiguration__features = 'single_feature';

      const plugin = new MicroAppRuntimeConfigurationPlugin(createDefaultConfig());
      const config = getConfig(plugin);

      expect(config.spec.selfConfiguration.features).toBe('single_feature');
    });
  });
});
