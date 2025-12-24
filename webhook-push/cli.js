#!/usr/bin/env node

/**
 * CLI for @paean-ai/webhook-push
 * 
 * Usage:
 *   webhook-push "Your message here"
 *   webhook-push --task "Build" --status "completed" --details "All tests passed"
 *   webhook-push -p slack "Your message for Slack"
 * 
 * Run `webhook-push --help` for full documentation.
 */

const path = require('path');

// Load environment variables from .env file
try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
} catch (e) {
  // dotenv not installed
}

const { 
  push, 
  pushProgress, 
  PLATFORMS, 
  ENV_KEYS, 
  getConfiguredPlatforms,
  isConfigured 
} = require('./index');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const args = process.argv.slice(2);

/**
 * Parse command line arguments
 * Supports: --flag value, -f value, --flag=value, positional args
 */
function parseArgs(args) {
  const result = {
    flags: {},
    positional: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      // Long flag
      if (arg.includes('=')) {
        const [key, value] = arg.slice(2).split('=');
        result.flags[key] = value;
      } else {
        const key = arg.slice(2);
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          result.flags[key] = nextArg;
          i++;
        } else {
          result.flags[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flag
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        result.flags[key] = nextArg;
        i++;
      } else {
        result.flags[key] = true;
      }
    } else {
      // Positional argument
      result.positional.push(arg);
    }
  }

  return result;
}

// ============================================================================
// Help Text
// ============================================================================

const HELP_TEXT = `
@vibe-coding-tools/webhook-push - Cross-platform webhook notification tool

USAGE:
  webhook-push [options] "message"
  webhook-push --task <name> --status <status> [--details <details>]

OPTIONS:
  -p, --platform <platform>   Target platform (default: wecom)
                              Supported: wecom, dingtalk, feishu, slack, telegram
  
  -t, --task <name>           Task name (for progress notifications)
  -s, --status <status>       Task status: started, in_progress, completed, failed, cancelled
  -d, --details <text>        Additional details for the notification
  
  --title <title>             Message title (used by some platforms)
  
  -h, --help                  Show this help message
  --check                     Check which platforms are configured
  --version                   Show version number

EXAMPLES:
  # Simple message (uses default platform: WeCom)
  webhook-push "Build completed successfully!"

  # Message to a specific platform
  webhook-push -p slack "Deployment started"

  # Progress notification
  webhook-push -t "Build" -s "started"
  webhook-push -t "Build" -s "completed" -d "All 42 tests passed"

  # Progress to Slack
  webhook-push -p slack -t "Deploy" -s "in_progress" -d "Deploying to production..."

ENVIRONMENT VARIABLES:
  WEBHOOK_WECOM_KEY           WeCom webhook key
  WEBHOOK_DINGTALK_TOKEN      DingTalk robot access token
  WEBHOOK_FEISHU_TOKEN        Feishu bot webhook token
  WEBHOOK_SLACK_URL           Slack incoming webhook URL (full URL)
  WEBHOOK_TELEGRAM_TOKEN      Telegram bot token
  WEBHOOK_TELEGRAM_CHAT_ID    Telegram chat ID (required for Telegram)

  Tip: Create a .env file in your project root with these variables.

PLATFORM WEBHOOK SETUP:
  WeCom:    https://developer.work.weixin.qq.com/document/path/91770
  DingTalk: https://open.dingtalk.com/document/robots/custom-robot-access
  Feishu:   https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
  Slack:    https://api.slack.com/messaging/webhooks
  Telegram: https://core.telegram.org/bots/api

`;

const VERSION = require('./package.json').version;

// ============================================================================
// Main CLI Logic
// ============================================================================

async function main() {
  const { flags, positional } = parseArgs(args);

  // Help
  if (flags.h || flags.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // Version
  if (flags.version) {
    console.log(`v${VERSION}`);
    process.exit(0);
  }

  // Check configuration
  if (flags.check) {
    console.log('\nWebhook Configuration Status:');
    console.log('─'.repeat(40));
    
    for (const [platform, envKey] of Object.entries(ENV_KEYS)) {
      const configured = isConfigured(platform);
      const status = configured ? '✓ Configured' : '✗ Not configured';
      const symbol = configured ? '✓' : '✗';
      console.log(`  ${symbol} ${platform.padEnd(12)} ${envKey}`);
    }
    
    const configuredPlatforms = getConfiguredPlatforms();
    console.log('─'.repeat(40));
    if (configuredPlatforms.length > 0) {
      console.log(`\nReady to use: ${configuredPlatforms.join(', ')}`);
    } else {
      console.log('\n⚠ No platforms configured. Set environment variables or create a .env file.');
    }
    console.log();
    process.exit(0);
  }

  // Build options
  const options = {
    platform: flags.p || flags.platform || 'wecom',
    title: flags.title,
  };

  try {
    // Progress notification mode
    if (flags.t || flags.task) {
      const taskName = flags.t || flags.task;
      const status = flags.s || flags.status;
      const details = flags.d || flags.details || '';

      if (!status) {
        console.error('Error: --status (-s) is required for progress notifications');
        console.error('Valid statuses: started, in_progress, completed, failed, cancelled');
        process.exit(1);
      }

      const validStatuses = ['started', 'in_progress', 'completed', 'failed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        console.error(`Error: Invalid status "${status}"`);
        console.error(`Valid statuses: ${validStatuses.join(', ')}`);
        process.exit(1);
      }

      console.log(`Sending progress notification to ${options.platform}...`);
      await pushProgress(taskName, status, details, options);
      console.log('✓ Notification sent successfully');
      process.exit(0);
    }

    // Simple message mode
    const message = positional.join(' ');
    if (!message) {
      console.error('Error: No message provided');
      console.error('Usage: webhook-push "Your message here"');
      console.error('       webhook-push --help for more options');
      process.exit(1);
    }

    console.log(`Sending message to ${options.platform}...`);
    await push(message, options);
    console.log('✓ Message sent successfully');
    process.exit(0);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});

