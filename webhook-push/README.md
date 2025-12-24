# @paean-ai/webhook-push

Cross-platform webhook notification tool for task progress updates. Supports multiple messaging platforms with a unified API, designed for CI/CD pipelines and development workflows.

## Features

- **Multi-platform support**: WeCom (default), DingTalk, Feishu, Slack, Telegram
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Simple API**: One function call to send notifications
- **Progress tracking**: Built-in formatting for task status updates
- **Environment-based config**: Secure key management via `.env` files
- **CLI included**: Use from terminal or scripts

## Installation

```bash
# Install in your project
yarn add @paean-ai/webhook-push

# Or install globally for CLI usage
yarn global add @paean-ai/webhook-push
```

For local development:

```bash
cd vibe-coding-tools/webhook-push
yarn install
```

## Quick Start

### 1. Configure Environment Variables

Create a `.env` file in your project root:

```bash
# Copy the example configuration
cp .env.example .env

# Edit with your webhook credentials
WEBHOOK_WECOM_KEY=your-wecom-webhook-key
```

### 2. Send Notifications

**CLI Usage:**

```bash
# Simple message
webhook-push "Build completed successfully!"

# Progress notification
webhook-push -t "Build" -s "completed" -d "All tests passed"

# Send to a specific platform
webhook-push -p slack "Deployment started"
```

**Programmatic Usage:**

```javascript
const { push, pushProgress } = require('@paean-ai/webhook-push');

// Simple message
await push('Build completed successfully!');

// Progress notification
await pushProgress('Build', 'completed', 'All 42 tests passed');

// Send to a specific platform
await push('Deployment started', { platform: 'slack' });
```

## CLI Reference

```
webhook-push [options] "message"
webhook-push --task <name> --status <status> [--details <details>]
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--platform` | `-p` | Target platform: wecom, dingtalk, feishu, slack, telegram |
| `--task` | `-t` | Task name for progress notifications |
| `--status` | `-s` | Status: started, in_progress, completed, failed, cancelled |
| `--details` | `-d` | Additional details text |
| `--title` | | Message title (used by some platforms) |
| `--check` | | Show which platforms are configured |
| `--help` | `-h` | Show help message |
| `--version` | | Show version number |

### Examples

```bash
# Check configuration status
webhook-push --check

# Simple message to WeCom (default)
webhook-push "Database backup complete"

# Progress notification
webhook-push -t "Deploy" -s "started"
webhook-push -t "Deploy" -s "in_progress" -d "Building Docker image..."
webhook-push -t "Deploy" -s "completed" -d "Version 2.1.0 deployed"

# Send to different platforms
webhook-push -p dingtalk "New release available"
webhook-push -p slack -t "CI" -s "failed" -d "Test suite failed"
webhook-push -p telegram "Server health check passed"
```

## API Reference

### `push(content, options)`

Send a message to a webhook platform.

```javascript
const { push } = require('@paean-ai/webhook-push');

await push('Your message here', {
  platform: 'wecom',    // Optional, default: 'wecom'
  title: 'Notification' // Optional, used by some platforms
});
```

### `pushProgress(taskName, status, details, options)`

Send a formatted progress notification.

```javascript
const { pushProgress } = require('@paean-ai/webhook-push');

await pushProgress(
  'Build',              // Task name
  'completed',          // Status
  'All tests passed',   // Details (optional)
  { platform: 'slack' } // Options (optional)
);
```

**Valid status values:**
- `started` - Task has begun
- `in_progress` - Task is running
- `completed` - Task finished successfully
- `failed` - Task encountered an error
- `cancelled` - Task was cancelled

### Configuration Helpers

```javascript
const { 
  isConfigured,
  getConfiguredPlatforms,
  getConfig,
  PLATFORMS
} = require('@paean-ai/webhook-push');

// Check if a platform is configured
if (isConfigured('slack')) {
  await push('Message', { platform: 'slack' });
}

// Get all configured platforms
const platforms = getConfiguredPlatforms();
console.log('Available:', platforms); // ['wecom', 'slack']

// Available platform constants
console.log(PLATFORMS.WECOM);    // 'wecom'
console.log(PLATFORMS.DINGTALK); // 'dingtalk'
console.log(PLATFORMS.FEISHU);   // 'feishu'
console.log(PLATFORMS.SLACK);    // 'slack'
console.log(PLATFORMS.TELEGRAM); // 'telegram'
```

## Environment Variables

| Variable | Platform | Description |
|----------|----------|-------------|
| `WEBHOOK_WECOM_KEY` | WeCom | Webhook key from group bot settings |
| `WEBHOOK_DINGTALK_TOKEN` | DingTalk | Robot access token |
| `WEBHOOK_FEISHU_TOKEN` | Feishu | Bot webhook token |
| `WEBHOOK_SLACK_URL` | Slack | Full incoming webhook URL |
| `WEBHOOK_TELEGRAM_TOKEN` | Telegram | Bot token from @BotFather |
| `WEBHOOK_TELEGRAM_CHAT_ID` | Telegram | Target chat/group ID |

## Platform Setup Guides

### WeCom (WeChat Work)

1. Open WeCom Admin Console
2. Go to **App Management** > **Group Bots**
3. Create a new bot and copy the webhook key
4. Set `WEBHOOK_WECOM_KEY` in your `.env`

### DingTalk

1. Open your DingTalk group settings
2. Go to **Smart Group Assistant** > **Add Robot**
3. Select **Custom** robot and configure
4. Copy the access token from the webhook URL
5. Set `WEBHOOK_DINGTALK_TOKEN` in your `.env`

### Feishu (Lark)

1. Open your Feishu group settings
2. Go to **Bots** > **Add Bot** > **Custom Bot**
3. Copy the webhook token
4. Set `WEBHOOK_FEISHU_TOKEN` in your `.env`

### Slack

1. Go to [Slack API](https://api.slack.com/apps)
2. Create an app and enable **Incoming Webhooks**
3. Add a webhook to a channel
4. Copy the full webhook URL
5. Set `WEBHOOK_SLACK_URL` in your `.env`

### Telegram

1. Message [@BotFather](https://t.me/botfather) to create a bot
2. Copy the bot token
3. Get your chat ID (message [@userinfobot](https://t.me/userinfobot))
4. Set both `WEBHOOK_TELEGRAM_TOKEN` and `WEBHOOK_TELEGRAM_CHAT_ID`

## Integration Examples

### Node.js Script

```javascript
const { pushProgress } = require('@paean-ai/webhook-push');

async function runBuild() {
  await pushProgress('Build', 'started');
  
  try {
    // Your build logic here
    await buildProject();
    await pushProgress('Build', 'completed', 'Build successful');
  } catch (error) {
    await pushProgress('Build', 'failed', error.message);
    throw error;
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "deploy:start": "webhook-push -t Deploy -s started && npm run deploy",
    "deploy:done": "webhook-push -t Deploy -s completed -d 'Deployed to production'",
    "deploy:fail": "webhook-push -t Deploy -s failed"
  }
}
```

### CI/CD Pipeline (GitHub Actions)

```yaml
- name: Notify Start
  run: npx @paean-ai/webhook-push -t "CI Build" -s "started"
  env:
    WEBHOOK_WECOM_KEY: ${{ secrets.WEBHOOK_WECOM_KEY }}

- name: Run Tests
  run: npm test

- name: Notify Success
  if: success()
  run: npx @paean-ai/webhook-push -t "CI Build" -s "completed"
  env:
    WEBHOOK_WECOM_KEY: ${{ secrets.WEBHOOK_WECOM_KEY }}

- name: Notify Failure
  if: failure()
  run: npx @paean-ai/webhook-push -t "CI Build" -s "failed"
  env:
    WEBHOOK_WECOM_KEY: ${{ secrets.WEBHOOK_WECOM_KEY }}
```

## License

MIT

