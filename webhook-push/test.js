#!/usr/bin/env node

/**
 * Test suite for @paean-ai/webhook-push
 * 
 * Run: node test.js
 * 
 * These tests verify the module's functionality without making actual HTTP requests.
 * For integration tests with real webhooks, set the appropriate environment variables.
 */

const assert = require('assert');

// ============================================================================
// Test Utilities
// ============================================================================

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failedTests++;
  }
}

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ============================================================================
// Import Module
// ============================================================================

const {
  push,
  pushProgress,
  getConfig,
  isConfigured,
  getConfiguredPlatforms,
  PLATFORMS,
  ENV_KEYS,
  STATUS_STYLES,
  DEFAULT_PLATFORM,
} = require('./index');

// ============================================================================
// Tests: Constants and Configuration
// ============================================================================

describe('Constants', () => {
  test('PLATFORMS should contain all supported platforms', () => {
    assert.strictEqual(PLATFORMS.WECOM, 'wecom');
    assert.strictEqual(PLATFORMS.DINGTALK, 'dingtalk');
    assert.strictEqual(PLATFORMS.FEISHU, 'feishu');
    assert.strictEqual(PLATFORMS.SLACK, 'slack');
    assert.strictEqual(PLATFORMS.TELEGRAM, 'telegram');
    assert.strictEqual(Object.keys(PLATFORMS).length, 5);
  });

  test('ENV_KEYS should map platforms to environment variables', () => {
    assert.strictEqual(ENV_KEYS[PLATFORMS.WECOM], 'WEBHOOK_WECOM_KEY');
    assert.strictEqual(ENV_KEYS[PLATFORMS.DINGTALK], 'WEBHOOK_DINGTALK_TOKEN');
    assert.strictEqual(ENV_KEYS[PLATFORMS.FEISHU], 'WEBHOOK_FEISHU_TOKEN');
    assert.strictEqual(ENV_KEYS[PLATFORMS.SLACK], 'WEBHOOK_SLACK_URL');
    assert.strictEqual(ENV_KEYS[PLATFORMS.TELEGRAM], 'WEBHOOK_TELEGRAM_TOKEN');
  });

  test('STATUS_STYLES should contain all status types', () => {
    assert.ok(STATUS_STYLES.started);
    assert.ok(STATUS_STYLES.in_progress);
    assert.ok(STATUS_STYLES.completed);
    assert.ok(STATUS_STYLES.failed);
    assert.ok(STATUS_STYLES.cancelled);
  });

  test('Each status should have color, emoji, and wecom properties', () => {
    for (const [status, style] of Object.entries(STATUS_STYLES)) {
      assert.ok(style.color, `${status} should have color`);
      assert.ok(style.emoji, `${status} should have emoji`);
      assert.ok(style.wecom, `${status} should have wecom color`);
    }
  });

  test('DEFAULT_PLATFORM should be wecom', () => {
    assert.strictEqual(DEFAULT_PLATFORM, 'wecom');
  });
});

// ============================================================================
// Tests: Configuration Functions
// ============================================================================

describe('Configuration Functions', () => {
  // Save original env
  const originalEnv = { ...process.env };

  // Clean up after each test
  const cleanEnv = () => {
    delete process.env.WEBHOOK_WECOM_KEY;
    delete process.env.WEBHOOK_DINGTALK_TOKEN;
    delete process.env.WEBHOOK_FEISHU_TOKEN;
    delete process.env.WEBHOOK_SLACK_URL;
    delete process.env.WEBHOOK_TELEGRAM_TOKEN;
    delete process.env.WEBHOOK_TELEGRAM_CHAT_ID;
  };

  test('isConfigured should return false when env var is not set', () => {
    cleanEnv();
    assert.strictEqual(isConfigured('wecom'), false);
    assert.strictEqual(isConfigured('slack'), false);
  });

  test('isConfigured should return true when env var is set', () => {
    cleanEnv();
    process.env.WEBHOOK_WECOM_KEY = 'test-key';
    assert.strictEqual(isConfigured('wecom'), true);
    cleanEnv();
  });

  test('getConfig should throw error for unknown platform', () => {
    cleanEnv();
    assert.throws(() => {
      getConfig('unknown-platform');
    }, /Unknown platform/);
  });

  test('getConfig should throw error when env var is missing', () => {
    cleanEnv();
    assert.throws(() => {
      getConfig('wecom');
    }, /Missing environment variable/);
  });

  test('getConfig should return config when env var is set', () => {
    cleanEnv();
    process.env.WEBHOOK_WECOM_KEY = 'test-key-123';
    const config = getConfig('wecom');
    assert.strictEqual(config.key, 'test-key-123');
    cleanEnv();
  });

  test('getConfig for Telegram should require both token and chat ID', () => {
    cleanEnv();
    process.env.WEBHOOK_TELEGRAM_TOKEN = 'test-token';
    assert.throws(() => {
      getConfig('telegram');
    }, /WEBHOOK_TELEGRAM_CHAT_ID/);
    
    process.env.WEBHOOK_TELEGRAM_CHAT_ID = '-123456';
    const config = getConfig('telegram');
    assert.strictEqual(config.key, 'test-token');
    assert.strictEqual(config.extra, '-123456');
    cleanEnv();
  });

  test('getConfiguredPlatforms should return array of configured platforms', () => {
    cleanEnv();
    assert.deepStrictEqual(getConfiguredPlatforms(), []);
    
    process.env.WEBHOOK_WECOM_KEY = 'test';
    process.env.WEBHOOK_SLACK_URL = 'https://hooks.slack.com/test';
    const platforms = getConfiguredPlatforms();
    assert.ok(platforms.includes('wecom'));
    assert.ok(platforms.includes('slack'));
    assert.strictEqual(platforms.length, 2);
    cleanEnv();
  });

  // Restore original env
  Object.assign(process.env, originalEnv);
});

// ============================================================================
// Tests: Function Signatures
// ============================================================================

describe('Function Signatures', () => {
  test('push should be a function', () => {
    assert.strictEqual(typeof push, 'function');
  });

  test('pushProgress should be a function', () => {
    assert.strictEqual(typeof pushProgress, 'function');
  });

  test('push should return a Promise', () => {
    // Set up mock env
    process.env.WEBHOOK_WECOM_KEY = 'test-key';
    const result = push('test');
    assert.ok(result instanceof Promise);
    // Clean up - the promise will reject but we don't need to wait for it
    result.catch(() => {});
    delete process.env.WEBHOOK_WECOM_KEY;
  });

  test('pushProgress should return a Promise', () => {
    process.env.WEBHOOK_WECOM_KEY = 'test-key';
    const result = pushProgress('Task', 'started');
    assert.ok(result instanceof Promise);
    result.catch(() => {});
    delete process.env.WEBHOOK_WECOM_KEY;
  });
});

// ============================================================================
// Tests: Module Exports
// ============================================================================

describe('Module Exports', () => {
  test('Module should export all required functions', () => {
    const module = require('./index');
    assert.ok(module.push);
    assert.ok(module.pushProgress);
    assert.ok(module.getConfig);
    assert.ok(module.isConfigured);
    assert.ok(module.getConfiguredPlatforms);
  });

  test('Module should export all required constants', () => {
    const module = require('./index');
    assert.ok(module.PLATFORMS);
    assert.ok(module.ENV_KEYS);
    assert.ok(module.STATUS_STYLES);
    assert.ok(module.DEFAULT_PLATFORM);
  });
});

// ============================================================================
// Tests: CLI Arguments Parser (via require)
// ============================================================================

describe('CLI Module', () => {
  test('CLI module should be loadable', () => {
    // Just verify the file exists and has proper shebang
    const fs = require('fs');
    const content = fs.readFileSync('./cli.js', 'utf8');
    assert.ok(content.startsWith('#!/usr/bin/env node'));
  });
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`Test Results: ${passedTests} passed, ${failedTests} failed`);
console.log('='.repeat(50));

if (failedTests > 0) {
  process.exit(1);
}

console.log('\n✓ All tests passed!\n');

