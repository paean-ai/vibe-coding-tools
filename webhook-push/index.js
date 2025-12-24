#!/usr/bin/env node

/**
 * @paean-ai/webhook-push
 * 
 * Cross-platform webhook notification tool supporting multiple messaging platforms.
 * Designed for task progress notifications in CI/CD pipelines and development workflows.
 * 
 * Supported Platforms:
 * - WeCom (WeChat Work) - Default
 * - DingTalk
 * - Feishu (Lark)
 * - Slack
 * - Telegram
 * 
 * @example
 * // Programmatic usage
 * const { push, pushProgress } = require('@paean-ai/webhook-push');
 * 
 * await push('Task completed successfully!');
 * await pushProgress('Build', 'completed', 'All tests passed');
 */

const https = require('https');
const http = require('http');
const path = require('path');

// Load environment variables from .env file if exists
try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
} catch (e) {
  // dotenv not installed, continue without it
}

// ============================================================================
// Platform Configuration
// ============================================================================

/**
 * Supported webhook platforms
 */
const PLATFORMS = {
  WECOM: 'wecom',
  DINGTALK: 'dingtalk',
  FEISHU: 'feishu',
  SLACK: 'slack',
  TELEGRAM: 'telegram',
};

/**
 * Environment variable names for each platform's webhook key/token
 */
const ENV_KEYS = {
  [PLATFORMS.WECOM]: 'WEBHOOK_WECOM_KEY',
  [PLATFORMS.DINGTALK]: 'WEBHOOK_DINGTALK_TOKEN',
  [PLATFORMS.FEISHU]: 'WEBHOOK_FEISHU_TOKEN',
  [PLATFORMS.SLACK]: 'WEBHOOK_SLACK_URL',
  [PLATFORMS.TELEGRAM]: 'WEBHOOK_TELEGRAM_TOKEN',
};

/**
 * Additional environment variables for specific platforms
 */
const ENV_EXTRAS = {
  [PLATFORMS.TELEGRAM]: 'WEBHOOK_TELEGRAM_CHAT_ID',
};

/**
 * Default platform to use when not specified
 */
const DEFAULT_PLATFORM = PLATFORMS.WECOM;

// ============================================================================
// Webhook URL Builders
// ============================================================================

/**
 * Build webhook URL for each platform
 */
const buildWebhookUrl = {
  [PLATFORMS.WECOM]: (key) => 
    `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`,
  
  [PLATFORMS.DINGTALK]: (token) => 
    `https://oapi.dingtalk.com/robot/send?access_token=${token}`,
  
  [PLATFORMS.FEISHU]: (token) => 
    `https://open.feishu.cn/open-apis/bot/v2/hook/${token}`,
  
  [PLATFORMS.SLACK]: (url) => url, // Slack uses full webhook URL
  
  [PLATFORMS.TELEGRAM]: (token, chatId) => 
    `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}`,
};

// ============================================================================
// Message Formatters
// ============================================================================

/**
 * Format message payload for each platform
 */
const formatMessage = {
  /**
   * WeCom (WeChat Work) markdown format
   * @see https://developer.work.weixin.qq.com/document/path/91770
   */
  [PLATFORMS.WECOM]: (content, options = {}) => ({
    msgtype: 'markdown',
    markdown: {
      content: content,
    },
  }),

  /**
   * DingTalk markdown format
   * @see https://open.dingtalk.com/document/robots/custom-robot-access
   */
  [PLATFORMS.DINGTALK]: (content, options = {}) => ({
    msgtype: 'markdown',
    markdown: {
      title: options.title || 'Notification',
      text: content,
    },
  }),

  /**
   * Feishu (Lark) interactive card format
   * @see https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
   */
  [PLATFORMS.FEISHU]: (content, options = {}) => ({
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: options.title || 'Notification',
        },
        template: options.color || 'blue',
      },
      elements: [
        {
          tag: 'markdown',
          content: content,
        },
      ],
    },
  }),

  /**
   * Slack Block Kit format
   * @see https://api.slack.com/messaging/webhooks
   */
  [PLATFORMS.SLACK]: (content, options = {}) => ({
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: content,
        },
      },
    ],
  }),

  /**
   * Telegram message format
   * @see https://core.telegram.org/bots/api#sendmessage
   */
  [PLATFORMS.TELEGRAM]: (content, options = {}) => ({
    text: content,
    parse_mode: 'Markdown',
  }),
};

// ============================================================================
// Progress Status Styles
// ============================================================================

/**
 * Status colors and emojis for different platforms
 */
const STATUS_STYLES = {
  started: { color: 'blue', emoji: '🚀', wecom: 'info' },
  in_progress: { color: 'yellow', emoji: '⏳', wecom: 'warning' },
  completed: { color: 'green', emoji: '✅', wecom: 'info' },
  failed: { color: 'red', emoji: '❌', wecom: 'warning' },
  cancelled: { color: 'grey', emoji: '⏹️', wecom: 'comment' },
};

// ============================================================================
// HTTP Request Helper
// ============================================================================

/**
 * Send HTTP POST request to webhook URL
 * @param {string} url - Webhook URL
 * @param {object} data - Request payload
 * @returns {Promise<object>} Response data
 */
function sendRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ raw: body });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Get configuration for a specific platform
 * @param {string} platform - Platform name
 * @returns {object} Configuration object with key/token and any extras
 * @throws {Error} If required configuration is missing
 */
function getConfig(platform) {
  const envKey = ENV_KEYS[platform];
  if (!envKey) {
    throw new Error(
      `Unknown platform: ${platform}. Supported platforms: ${Object.values(PLATFORMS).join(', ')}`
    );
  }

  const key = process.env[envKey];
  if (!key) {
    throw new Error(
      `Missing environment variable: ${envKey}\n` +
      `Please set it in your .env file or environment.\n` +
      `Example: ${envKey}=your-webhook-key-or-token`
    );
  }

  const config = { key };

  // Check for additional required env vars
  const extraEnv = ENV_EXTRAS[platform];
  if (extraEnv) {
    const extraValue = process.env[extraEnv];
    if (!extraValue) {
      throw new Error(
        `Missing environment variable: ${extraEnv}\n` +
        `This is required for ${platform} webhooks.`
      );
    }
    config.extra = extraValue;
  }

  return config;
}

/**
 * Check if a platform is configured
 * @param {string} platform - Platform name
 * @returns {boolean} True if platform is configured
 */
function isConfigured(platform) {
  try {
    getConfig(platform);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get all configured platforms
 * @returns {string[]} Array of configured platform names
 */
function getConfiguredPlatforms() {
  return Object.values(PLATFORMS).filter(isConfigured);
}

// ============================================================================
// Main Push Functions
// ============================================================================

/**
 * Push a message to a webhook platform
 * 
 * @param {string} content - Message content (supports markdown)
 * @param {object} options - Push options
 * @param {string} [options.platform] - Target platform (default: wecom)
 * @param {string} [options.title] - Message title (used by some platforms)
 * @param {string} [options.color] - Theme color (used by some platforms)
 * @returns {Promise<object>} API response
 * 
 * @example
 * // Simple message
 * await push('Build completed successfully!');
 * 
 * // With platform selection
 * await push('Deployment started', { platform: 'slack' });
 * 
 * // With title (for platforms that support it)
 * await push('All tests passed', { platform: 'dingtalk', title: 'CI/CD Update' });
 */
async function push(content, options = {}) {
  const platform = options.platform || DEFAULT_PLATFORM;
  const config = getConfig(platform);
  
  // Build webhook URL
  const urlBuilder = buildWebhookUrl[platform];
  const url = urlBuilder(config.key, config.extra);
  
  // Format message for platform
  const formatter = formatMessage[platform];
  const payload = formatter(content, options);
  
  // Send request
  return sendRequest(url, payload);
}

/**
 * Push a progress notification with consistent formatting
 * 
 * @param {string} taskName - Name of the task
 * @param {string} status - Status: started, in_progress, completed, failed, cancelled
 * @param {string} [details] - Additional details (optional)
 * @param {object} [options] - Push options (same as push())
 * @returns {Promise<object>} API response
 * 
 * @example
 * await pushProgress('Build', 'started');
 * await pushProgress('Build', 'in_progress', 'Running tests...');
 * await pushProgress('Build', 'completed', 'All 42 tests passed');
 * await pushProgress('Build', 'failed', 'Test suite failed', { platform: 'slack' });
 */
async function pushProgress(taskName, status, details = '', options = {}) {
  const platform = options.platform || DEFAULT_PLATFORM;
  const style = STATUS_STYLES[status] || STATUS_STYLES.in_progress;
  
  let content;
  
  // Format content based on platform
  switch (platform) {
    case PLATFORMS.WECOM:
      content = formatWeComProgress(taskName, status, details, style);
      break;
    case PLATFORMS.DINGTALK:
      content = formatDingTalkProgress(taskName, status, details, style);
      break;
    case PLATFORMS.FEISHU:
      content = formatFeishuProgress(taskName, status, details, style);
      options.color = style.color;
      break;
    case PLATFORMS.SLACK:
      content = formatSlackProgress(taskName, status, details, style);
      break;
    case PLATFORMS.TELEGRAM:
      content = formatTelegramProgress(taskName, status, details, style);
      break;
    default:
      content = formatGenericProgress(taskName, status, details, style);
  }
  
  return push(content, { ...options, title: `${taskName} - ${status}` });
}

// ============================================================================
// Platform-Specific Progress Formatters
// ============================================================================

function formatWeComProgress(taskName, status, details, style) {
  let content = `**${taskName}** - <font color="${style.wecom}">${status.toUpperCase()}</font>`;
  if (details) {
    content += `\n> ${details}`;
  }
  content += `\n> Time: ${new Date().toISOString()}`;
  return content;
}

function formatDingTalkProgress(taskName, status, details, style) {
  let content = `### ${style.emoji} ${taskName}\n\n`;
  content += `**Status:** ${status.toUpperCase()}\n\n`;
  if (details) {
    content += `> ${details}\n\n`;
  }
  content += `---\n*${new Date().toISOString()}*`;
  return content;
}

function formatFeishuProgress(taskName, status, details, style) {
  let content = `**${taskName}**\n`;
  content += `Status: ${status.toUpperCase()}\n`;
  if (details) {
    content += `\n${details}\n`;
  }
  content += `\n---\n${new Date().toISOString()}`;
  return content;
}

function formatSlackProgress(taskName, status, details, style) {
  let content = `${style.emoji} *${taskName}* - \`${status.toUpperCase()}\``;
  if (details) {
    content += `\n> ${details}`;
  }
  content += `\n_${new Date().toISOString()}_`;
  return content;
}

function formatTelegramProgress(taskName, status, details, style) {
  let content = `${style.emoji} *${taskName}* - \`${status.toUpperCase()}\``;
  if (details) {
    content += `\n\n${details}`;
  }
  content += `\n\n_${new Date().toISOString()}_`;
  return content;
}

function formatGenericProgress(taskName, status, details, style) {
  let content = `${style.emoji} ${taskName} - ${status.toUpperCase()}`;
  if (details) {
    content += `\n${details}`;
  }
  content += `\n${new Date().toISOString()}`;
  return content;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Main functions
  push,
  pushProgress,
  
  // Configuration helpers
  getConfig,
  isConfigured,
  getConfiguredPlatforms,
  
  // Constants
  PLATFORMS,
  ENV_KEYS,
  STATUS_STYLES,
  DEFAULT_PLATFORM,
};

