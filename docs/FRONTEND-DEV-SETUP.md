# Frontend Development Environment Setup

This project uses local frontend development tools for visual testing and browser automation.

## Installed Tools

### 1. Frontend-Dev Plugin (claude-code-frontend-dev)

**Location**: `.claude/plugins/frontend-dev`

**Repository**: https://github.com/hemangjoshi37a/claude-code-frontend-dev

This plugin enables closed-loop visual testing and frontend development workflow.

**Usage**:
```bash
/frontend-dev
```

This command starts an automated development cycle that:
- Takes screenshots of your application
- Compares against design specifications
- Identifies visual discrepancies
- Generates code fixes automatically
- Reruns tests until convergence

### 2. Playwright MCP Server

**Configuration**: `.claude/.mcp.json`

Provides browser automation capabilities via the Model Context Protocol.

**Features**:
- Runs in headless mode (no browser takeover)
- Automated visual testing
- Screenshot capture and comparison
- DOM inspection and interaction

**Configuration Details**:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"],
      "env": {
        "PLAYWRIGHT_HEADLESS": "true"
      }
    }
  }
}
```

The `PLAYWRIGHT_HEADLESS: "true"` setting ensures browser operations run in the background without interfering with your workflow.

## Setup Process (Already Completed)

1. ✅ Cloned frontend-dev plugin to `.claude/plugins/frontend-dev`
2. ✅ Configured Playwright MCP server in `.claude/.mcp.json`
3. ✅ Installed Playwright library and Chromium browser via `setup.sh`

## Usage Guidelines

### Visual Testing Workflow

1. Start the frontend-dev loop:
   ```bash
   /frontend-dev
   ```

2. The system will:
   - Launch your application
   - Take screenshots
   - Compare against design specifications (PRD)
   - Identify visual issues
   - Generate and apply fixes
   - Retest automatically

3. The loop continues until visual convergence is achieved

### Playwright MCP Capabilities

The Playwright MCP server provides:
- **Screenshot capture**: Automated visual snapshots
- **DOM interaction**: Element selection and manipulation
- **Navigation**: Page routing and link testing
- **Assertions**: Visual and functional validation
- **Headless operation**: Background execution without browser popup

### Best Practices

1. **Design Specifications**: Keep design docs updated in `/docs` folder
   - `PRD.md` - Product requirements and design specifications

2. **Testing Strategy**:
   - Use visual regression testing for UI changes
   - Automate repetitive screenshot comparisons
   - Let the system identify discrepancies automatically

3. **Development Cycle**:
   - Make changes manually or let the agent propose fixes
   - Run `/frontend-dev` to validate changes
   - Iterate until designs match specifications

## Troubleshooting

### Browser Not Found
If you see browser errors, reinstall Chromium:
```bash
cd .claude/plugins/frontend-dev && bash setup.sh
```

### MCP Server Not Responding
Verify the configuration in `.claude/.mcp.json` and ensure `npx` is available:
```bash
npx -y @executeautomation/playwright-mcp-server --help
```

### Plugin Not Working
Check that the plugin directory exists and is properly configured:
```bash
ls -la .claude/plugins/frontend-dev
```

## Files and Directories

```
.claude/
├── .mcp.json                     # MCP server configuration
└── plugins/
    └── frontend-dev/             # Frontend development plugin
        ├── setup.sh              # Setup script
        └── ...                   # Plugin files

docs/
├── FRONTEND-DEV-SETUP.md         # This file
└── PRD.md                        # Product requirements and design specs
```

## Notes

- Browser automation runs in headless mode by default
- Screenshots and test artifacts are generated during development
- The plugin integrates with Claude Code's agent workflow
- Visual testing is automated and requires minimal manual intervention
