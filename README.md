# Jira MCP Server

A Model Context Protocol (MCP) server that integrates with Atlassian Jira to search issues, retrieve details, and access comments.

## Features

- 🔍 **Search Issues**: Use JQL (Jira Query Language) to find issues
- 📋 **Get Issue Details**: Retrieve complete issue information including acceptance criteria
- 💬 **Access Comments**: Get all comments for any issue
- 🔧 **Configurable**: Works with any Jira Cloud instance

## Installation

```bash
# Clone the repository
git clone https://github.com/fajarmf/jira-mcp.git
cd jira-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
export JIRA_BASE_URL="https://your-domain.atlassian.net"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
```

### Getting a Jira API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label and copy the token
4. Use this token as your `JIRA_API_TOKEN`

### MCP Configuration

Add the server to your MCP configuration file (`~/.mcp.json`):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp/build/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Usage

Once configured, the following tools are available:

### jira_get_issue
Get detailed information about a specific Jira issue.

**Parameters:**
- `issueKey` (required): The Jira issue key (e.g., "PROJECT-123")

**Example:**
```json
{
  "tool": "jira_get_issue",
  "arguments": {
    "issueKey": "PROJECT-123"
  }
}
```

### jira_search_issues
Search for issues using JQL (Jira Query Language).

**Parameters:**
- `jql` (required): JQL query string
- `maxResults` (optional): Maximum number of results (default: 50)

**Example:**
```json
{
  "tool": "jira_search_issues",
  "arguments": {
    "jql": "project = PROJECT AND status = \"In Progress\"",
    "maxResults": 10
  }
}
```

### jira_get_issue_comments
Get all comments for a specific issue.

**Parameters:**
- `issueKey` (required): The Jira issue key (e.g., "PROJECT-123")

**Example:**
```json
{
  "tool": "jira_get_issue_comments",
  "arguments": {
    "issueKey": "PROJECT-123"
  }
}
```

## JQL Examples

Here are some useful JQL queries you can use with the search tool:

```jql
# Find open issues assigned to you
assignee = currentUser() AND resolution = Unresolved

# Find high priority bugs
priority = High AND type = Bug

# Find recently updated issues
updated >= -7d

# Find issues in specific status
status in ("To Do", "In Progress")

# Find issues by project and component
project = MYPROJECT AND component = "Backend"

# Find overdue issues
due < now() AND resolution = Unresolved
```

## Features

### Acceptance Criteria Extraction
The server automatically extracts acceptance criteria from issue descriptions using common patterns:
- "Acceptance Criteria:" sections
- "AC:" sections
- Given/When/Then scenarios
- Checkbox lists
- Bullet points

### Error Handling
- Comprehensive error handling for API failures
- Clear error messages for authentication issues
- Graceful handling of missing issues or invalid queries

## Development

### Project Structure
```
jira-mcp/
├── src/
│   └── index.ts        # Main MCP server implementation
├── build/              # Compiled JavaScript files
├── package.json
├── tsconfig.json
└── README.md
```

### Building
```bash
npm run build
```

### Running
```bash
npm start
```

## Requirements

- Node.js 16+
- TypeScript 5.0+
- Valid Jira Cloud instance with API access
- Jira API token with appropriate permissions

## Permissions Required

Your Jira API token needs the following permissions:
- Read access to projects and issues
- Read access to comments
- Browse projects permission

## Troubleshooting

### Authentication Errors
- Verify your email and API token are correct
- Check that your API token has the necessary permissions
- Ensure your Jira base URL is correct (should not include `/rest/api/3`)

### Connection Issues
- Verify the Jira base URL format: `https://your-domain.atlassian.net`
- Check your internet connection
- Ensure Jira Cloud is accessible from your network

### JQL Errors
- Validate your JQL syntax in Jira's issue navigator first
- Check that field names and values exist in your Jira instance
- Remember JQL is case-sensitive for some operators

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Create an issue on GitHub
- Check Jira's REST API documentation
- Review the MCP protocol documentation