# Claude Code Plugin Structure

This directory contains metadata for Claude Code Plugin Marketplace compatibility.

## Files

| File               | Purpose                                     |
| ------------------ | ------------------------------------------- |
| `plugin.json`      | Plugin metadata (name, version, components) |
| `marketplace.json` | Marketplace listing information             |

## Plugin Components

```
.claude/
├── commands/    # 30 slash commands
├── skills/      # 12 development skills
├── agents/      # 6 sub-agents
├── rules/       # 13 coding standards
└── scripts/     # 17 automation scripts

hooks/           # Hook scripts organized by function
memory-bank/     # Progress persistence
```

## Usage

This template is designed to be cloned directly. The plugin structure enables future marketplace distribution.

```bash
# Clone and use
git clone https://github.com/xiaobei930/claude-code-best-practices.git my-project
cd my-project && bash .claude/scripts/init.sh
```

## Version History

| Version | Changes                  |
| ------- | ------------------------ |
| 1.0.0   | Initial plugin structure |
