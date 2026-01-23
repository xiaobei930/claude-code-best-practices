# Hooks Configuration

This directory contains standalone hooks configuration for plugin compatibility.

## Quick Setup

Copy hooks configuration to your `settings.local.json`:

```bash
# If settings.local.json doesn't exist
cp .claude/settings.local.json.example .claude/settings.local.json
```

## Hook Scripts by Category

### Safety Hooks (PreToolUse)

| Script                 | Function                    | Blocks                     |
| ---------------------- | --------------------------- | -------------------------- |
| `validate_command.py`  | Validate dangerous commands | `rm -rf /`, `format`, etc. |
| `pause_before_push.sh` | Pause before git push       | Gives time to review       |
| `protect_files.py`     | Protect sensitive files     | `.env`, `.key`, `.git/`    |
| `block_random_md.py`   | Block random .md creation   | Non-essential docs         |

### Quality Hooks (PostToolUse)

| Script                 | Function              | Trigger                |
| ---------------------- | --------------------- | ---------------------- |
| `format_file.py`       | Auto-format code      | Write/Edit             |
| `check_console_log.py` | Check console.log     | Edit                   |
| `typescript_check.sh`  | TypeScript type check | Write/Edit on .ts/.tsx |

### Session Lifecycle

| Hook         | Script                | When                       |
| ------------ | --------------------- | -------------------------- |
| SessionStart | `session_check.py`    | New session starts         |
| SessionStart | `session_start.sh`    | Load previous context      |
| PreCompact   | `pre_compact.sh`      | Before context compression |
| Stop         | `session_end.sh`      | Session ends               |
| Stop         | `evaluate-session.sh` | Extract learnings          |

### Strategic Hooks

| Script                | Function                  | Location                              |
| --------------------- | ------------------------- | ------------------------------------- |
| `suggest-compact.sh`  | Suggest compaction timing | `.claude/skills/strategic-compact/`   |
| `evaluate-session.sh` | Extract patterns          | `.claude/skills/continuous-learning/` |

## File Locations

```
.claude/
├── scripts/                      # Core hook scripts
│   ├── validate_command.py       # Command validation
│   ├── protect_files.py          # File protection
│   ├── format_file.py            # Auto-formatting
│   ├── session_start.sh          # Session start
│   ├── session_end.sh            # Session end
│   └── pre_compact.sh            # Pre-compaction
│
├── skills/
│   ├── strategic-compact/        # Compaction suggestions
│   │   └── suggest-compact.sh
│   └── continuous-learning/      # Pattern extraction
│       └── evaluate-session.sh
│
└── settings.local.json           # Active hooks config (not committed)

hooks/
├── hooks.json                    # Plugin-compatible config
└── README.md                     # This file
```

## Creating Custom Hooks

1. Create script in `.claude/scripts/` or relevant skill directory
2. Add hook config to `.claude/settings.local.json`
3. Test with a sample action

Example custom hook:

```json
{
  "matcher": "Write",
  "hooks": [
    {
      "type": "command",
      "command": "python .claude/scripts/my_hook.py",
      "timeout": 5000
    }
  ],
  "description": "My custom hook"
}
```

## Disabling Hooks

Comment out or remove from `settings.local.json`. The `hooks.json` here is for reference only.
