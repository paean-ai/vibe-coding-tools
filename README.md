# vibe-coding-tools

A collection of developer tools designed for AI-assisted coding workflows. These tools help streamline common development tasks like notifications, progress tracking, and CI/CD integrations.

## Available Tools

### [@paean-ai/webhook-push](./webhook-push/)

Cross-platform webhook notification tool supporting multiple messaging platforms.

**Features:**
- Multi-platform support: WeCom (default), DingTalk, Feishu, Slack, Telegram
- Cross-platform: Works on Windows, macOS, and Linux
- Simple CLI and programmatic API
- Progress tracking with beautiful status formatting
- Environment-based configuration

**Quick Start:**

```bash
# Install
yarn add @paean-ai/webhook-push

# Configure (create .env file)
WEBHOOK_WECOM_KEY=your-wecom-webhook-key

# Use CLI
webhook-push "Build completed successfully!"
webhook-push -t "Deploy" -s "completed" -d "Version 2.0 deployed"

# Use in Node.js
const { push, pushProgress } = require('@paean-ai/webhook-push');
await pushProgress('Build', 'completed', 'All tests passed');
```

[Full documentation →](./webhook-push/README.md)

## Installation

Each tool can be installed independently:

```bash
# webhook-push
yarn add @paean-ai/webhook-push
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT