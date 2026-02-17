#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

class JiraServer {
  private server: Server;
  private config: JiraConfig;

  constructor() {
    this.server = new Server({
      name: "jira-mcp",
      version: "1.0.0",
    });

    this.config = {
      baseUrl: process.env.JIRA_BASE_URL || "https://your-domain.atlassian.net",
      email: process.env.JIRA_EMAIL || "",
      apiToken: process.env.JIRA_API_TOKEN || "",
    };

    // Debug: Log config (mask token)
    console.error(`[DEBUG] JIRA_BASE_URL: ${this.config.baseUrl}`);
    console.error(`[DEBUG] JIRA_EMAIL: ${this.config.email}`);
    console.error(`[DEBUG] JIRA_API_TOKEN length: ${this.config.apiToken?.length || 0}`);

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "jira_get_fields",
            description: "Get all available fields in Jira including custom fields",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "jira_get_issue",
            description: "Get a specific Jira issue by key (e.g., PROJECT-123)",
            inputSchema: {
              type: "object",
              properties: {
                issueKey: {
                  type: "string",
                  description: "The Jira issue key (e.g., PROJECT-123)",
                },
              },
              required: ["issueKey"],
            },
          },
          {
            name: "jira_search_issues",
            description: "Search for Jira issues using JQL",
            inputSchema: {
              type: "object",
              properties: {
                jql: {
                  type: "string",
                  description: "JQL query to search for issues",
                },
                maxResults: {
                  type: "number",
                  description: "Maximum number of results (default: 50)",
                  default: 50,
                },
              },
              required: ["jql"],
            },
          },
          {
            name: "jira_get_issue_comments",
            description: "Get comments for a specific Jira issue",
            inputSchema: {
              type: "object",
              properties: {
                issueKey: {
                  type: "string",
                  description: "The Jira issue key (e.g., PROJECT-123)",
                },
              },
              required: ["issueKey"],
            },
          },
          {
            name: "jira_get_transitions",
            description: "Get available status transitions for a Jira issue",
            inputSchema: {
              type: "object",
              properties: {
                issueKey: {
                  type: "string",
                  description: "The Jira issue key (e.g., PROJECT-123)",
                },
              },
              required: ["issueKey"],
            },
          },
          {
            name: "jira_update_issue",
            description: "Update a Jira issue (change status, assignee, etc.)",
            inputSchema: {
              type: "object",
              properties: {
                issueKey: {
                  type: "string",
                  description: "The Jira issue key (e.g., PROJECT-123)",
                },
                transition: {
                  type: "string",
                  description: "Status transition name or ID (use jira_get_transitions to see available options)",
                },
                assignee: {
                  type: "string",
                  description: "Assignee email or account ID (optional)",
                },
                summary: {
                  type: "string",
                  description: "Updated summary (optional)",
                },
                description: {
                  type: "string",
                  description: "Updated description in markdown format (optional). Supports: ```code blocks```, # headings, - bullet lists, 1. numbered lists, **bold**, `inline code`",
                },
                priority: {
                  type: "string",
                  description: "Priority name (e.g., High, Medium, Low) (optional)",
                },
                dueDate: {
                  type: "string",
                  description: "Due date in YYYY-MM-DD format (optional)",
                },
                startDate: {
                  type: "string",
                  description: "Start date in YYYY-MM-DD format (optional). Used for timeline view.",
                },
                storyPoints: {
                  type: "number",
                  description: "Story points estimate (optional)",
                },
                acceptanceCriteria: {
                  type: "string",
                  description: "Acceptance criteria in markdown format (optional). Will be converted to ADF and stored in the AC field.",
                },
                customFields: {
                  type: "object",
                  description: "Custom fields as key-value pairs where key is the field ID (e.g., customfield_10001) (optional)",
                  additionalProperties: true,
                },
              },
              required: ["issueKey"],
            },
          },
          {
            name: "jira_create_issue",
            description: "Create a new Jira issue",
            inputSchema: {
              type: "object",
              properties: {
                projectKey: {
                  type: "string",
                  description: "The project key where the issue will be created (e.g., PROJ)",
                },
                summary: {
                  type: "string",
                  description: "Issue summary/title",
                },
                description: {
                  type: "string",
                  description: "Issue description in markdown format (optional). Supports: ```code blocks```, # headings, - bullet lists, 1. numbered lists, **bold**, `inline code`",
                },
                issueType: {
                  type: "string",
                  description: "Issue type (e.g., Bug, Story, Task) - defaults to Task",
                  default: "Task",
                },
                priority: {
                  type: "string",
                  description: "Priority name (e.g., High, Medium, Low) (optional)",
                },
                assignee: {
                  type: "string",
                  description: "Assignee email or account ID (optional)",
                },
                labels: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of labels to add to the issue (optional)",
                },
                parentKey: {
                  type: "string",
                  description: "Parent epic key to link this issue to (e.g., PROJ-123) (optional)",
                },
                customFields: {
                  type: "object",
                  description: "Custom fields as key-value pairs where key is the field ID (e.g., customfield_10001) (optional)",
                  additionalProperties: true,
                },
              },
              required: ["projectKey", "summary"],
            },
          },
          {
            name: "jira_add_comment",
            description: "Add a comment to a Jira issue",
            inputSchema: {
              type: "object",
              properties: {
                issueKey: {
                  type: "string",
                  description: "The Jira issue key (e.g., PROJECT-123)",
                },
                body: {
                  type: "string",
                  description: "Comment body in plain text",
                },
              },
              required: ["issueKey", "body"],
            },
          },
          {
            name: "jira_get_issue_links",
            description: "Get all issue links for a Jira issue. Returns link IDs, types, and linked issues.",
            inputSchema: {
              type: "object",
              properties: {
                issueKey: {
                  type: "string",
                  description: "The Jira issue key (e.g., PROJECT-123)",
                },
              },
              required: ["issueKey"],
            },
          },
          {
            name: "jira_delete_link",
            description: "Delete an issue link by its ID. Use jira_get_issue_links to find the link ID first.",
            inputSchema: {
              type: "object",
              properties: {
                linkId: {
                  type: "string",
                  description: "The ID of the issue link to delete",
                },
              },
              required: ["linkId"],
            },
          },
          {
            name: "jira_link_issues",
            description: "Create a link between two Jira issues (e.g., blocks, is blocked by, relates to)",
            inputSchema: {
              type: "object",
              properties: {
                linkType: {
                  type: "string",
                  description: "Link type name (e.g., 'Blocks', 'Cloners', 'Duplicate', 'Relates'). The inward issue 'is blocked by' / outward issue 'blocks'.",
                },
                inwardIssueKey: {
                  type: "string",
                  description: "The issue key for the inward side of the link (e.g., the issue that 'is blocked by')",
                },
                outwardIssueKey: {
                  type: "string",
                  description: "The issue key for the outward side of the link (e.g., the issue that 'blocks')",
                },
              },
              required: ["linkType", "inwardIssueKey", "outwardIssueKey"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "jira_get_fields":
            return await this.getFields();
            
          case "jira_get_issue":
            return await this.getIssue(args?.issueKey as string);
          
          case "jira_search_issues":
            return await this.searchIssues(args?.jql as string, (args?.maxResults as number) || 50);
          
          case "jira_get_issue_comments":
            return await this.getIssueComments(args?.issueKey as string);
          
          case "jira_get_transitions":
            return await this.getTransitions(args?.issueKey as string);
          
          case "jira_update_issue":
            return await this.updateIssue(args);
          
          case "jira_create_issue":
            return await this.createIssue(args);

          case "jira_add_comment":
            return await this.addComment(args?.issueKey as string, args?.body as string);

          case "jira_link_issues":
            return await this.linkIssues(args);

          case "jira_get_issue_links":
            return await this.getIssueLinks(args?.issueKey as string);

          case "jira_delete_link":
            return await this.deleteLink(args?.linkId as string);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async makeJiraRequest(endpoint: string, options?: { params?: any; data?: any; method?: 'GET' | 'POST' | 'PUT' | 'DELETE' }) {
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
    const apiBase = `${this.config.baseUrl}/rest/api/3`;
    const method = options?.method || 'GET';
    
    const config = {
      method,
      url: `${apiBase}${endpoint}`,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        ...(method !== 'GET' && { 'Content-Type': 'application/json' })
      },
      ...(options?.params && { params: options.params }),
      ...(options?.data && { data: options.data })
    };
    
    const response = await axios(config);
    return response.data;
  }

  private async getIssue(issueKey: string) {
    const data = await this.makeJiraRequest(`/issue/${issueKey}`, {
      params: {
        fields: "*all",  // Get all fields including custom fields
        expand: "renderedFields",
      }
    });

    // Extract acceptance criteria from description or custom field
    const description = data.renderedFields?.description || data.fields?.description;
    const acceptanceCriteria = this.extractAcceptanceCriteria(description);
    
    // Extract custom fields
    const customFields: any = {};
    Object.keys(data.fields).forEach(key => {
      if (key.startsWith('customfield_') && data.fields[key] !== null) {
        customFields[key] = data.fields[key];
      }
    });

    const result = {
      key: data.key,
      summary: data.fields.summary,
      status: data.fields.status?.name,
      assignee: data.fields.assignee?.displayName || "Unassigned",
      reporter: data.fields.reporter?.displayName,
      priority: data.fields.priority?.name,
      created: data.fields.created,
      updated: data.fields.updated,
      description: description,
      acceptanceCriteria: acceptanceCriteria,
      customFields: customFields,
      url: `${this.config.baseUrl}/browse/${data.key}`,
    };

    return {
      content: [
        {
          type: "text",
          text: `**${result.key}: ${result.summary}**

**Status:** ${result.status}
**Assignee:** ${result.assignee}
**Priority:** ${result.priority}
**URL:** ${result.url}

**Description:**
${result.description}

**Acceptance Criteria:**
${result.acceptanceCriteria.length > 0 ? result.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n') : 'None found'}

**Custom Fields:**
${Object.keys(result.customFields).length > 0 ? 
  Object.keys(result.customFields).map(key => `- ${key}: ${JSON.stringify(result.customFields[key])}`).join('\n') : 
  'None found'}

**Created:** ${new Date(result.created).toLocaleDateString()}
**Updated:** ${new Date(result.updated).toLocaleDateString()}`,
        },
      ],
    };
  }

  private extractAcceptanceCriteria(description: string): string[] {
    if (!description) return [];
    
    // Look for common AC patterns
    const patterns = [
      /acceptance criteria:?\s*(.*?)(?=\n\n|\n[A-Z]|$)/gsi,
      /ac:?\s*(.*?)(?=\n\n|\n[A-Z]|$)/gsi,
      /given.*when.*then.*/gsi,
      /- \[[ x]\] .*/g,
      /\* .*/g,
    ];

    const criteria: string[] = [];
    
    for (const pattern of patterns) {
      const matches = description.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.replace(/acceptance criteria:?/i, '').replace(/ac:?/i, '').trim();
          if (cleaned && !criteria.includes(cleaned)) {
            criteria.push(cleaned);
          }
        });
      }
    }

    return criteria;
  }

  private convertToADF(text: string): any {
    // Convert markdown-formatted text to Atlassian Document Format
    const content: any[] = [];
    const lines = text.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code block: ```language ... ```
      if (line.trim().startsWith('```')) {
        const language = line.trim().slice(3).trim() || undefined;
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        content.push({
          type: 'codeBlock',
          ...(language && { attrs: { language } }),
          content: codeLines.length > 0
            ? [{ type: 'text', text: codeLines.join('\n') }]
            : [],
        });
        continue;
      }

      // Heading: # ## ### etc
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        content.push({
          type: 'heading',
          attrs: { level: headingMatch[1].length },
          content: this.parseInlineMarks(headingMatch[2]),
        });
        i++;
        continue;
      }

      // Bullet list: - or *
      if (line.match(/^\s*[-*]\s+/)) {
        const listItems: any[] = [];
        while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
          const itemText = lines[i].replace(/^\s*[-*]\s+/, '');
          listItems.push({
            type: 'listItem',
            content: [{ type: 'paragraph', content: this.parseInlineMarks(itemText) }],
          });
          i++;
        }
        content.push({ type: 'bulletList', content: listItems });
        continue;
      }

      // Ordered list: 1. 2. etc
      if (line.match(/^\s*\d+\.\s+/)) {
        const listItems: any[] = [];
        while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
          const itemText = lines[i].replace(/^\s*\d+\.\s+/, '');
          listItems.push({
            type: 'listItem',
            content: [{ type: 'paragraph', content: this.parseInlineMarks(itemText) }],
          });
          i++;
        }
        content.push({ type: 'orderedList', attrs: { order: 1 }, content: listItems });
        continue;
      }

      // Empty line - skip
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Regular paragraph - collect consecutive non-special lines
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].match(/^#{1,6}\s+/) &&
        !lines[i].match(/^\s*[-*]\s+/) &&
        !lines[i].match(/^\s*\d+\.\s+/)
      ) {
        paraLines.push(lines[i]);
        i++;
      }

      const paraContent: any[] = [];
      paraLines.forEach((pLine, idx) => {
        paraContent.push(...this.parseInlineMarks(pLine));
        if (idx < paraLines.length - 1) {
          paraContent.push({ type: 'hardBreak' });
        }
      });

      if (paraContent.length > 0) {
        content.push({ type: 'paragraph', content: paraContent });
      }
    }

    return {
      type: 'doc',
      version: 1,
      content: content.length > 0
        ? content
        : [{ type: 'paragraph', content: [{ type: 'text', text: ' ' }] }],
    };
  }

  private parseInlineMarks(text: string): any[] {
    const result: any[] = [];
    const regex = /(\*\*(.+?)\*\*|`([^`]+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', text: text.slice(lastIndex, match.index) });
      }
      if (match[2]) {
        result.push({ type: 'text', text: match[2], marks: [{ type: 'strong' }] });
      } else if (match[3]) {
        result.push({ type: 'text', text: match[3], marks: [{ type: 'code' }] });
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      result.push({ type: 'text', text: text.slice(lastIndex) });
    }

    if (result.length === 0 && text) {
      result.push({ type: 'text', text });
    }

    return result;
  }

  private async getFields() {
    const data = await this.makeJiraRequest("/field");
    
    const customFields = data.filter((field: any) => field.custom);
    
    // Filter for acceptance criteria related fields
    const acFields = customFields.filter((field: any) => 
      field.name && (
        field.name.toLowerCase().includes('acceptance') ||
        field.name.toLowerCase().includes('criteria') ||
        field.name.toLowerCase().includes('explain') ||
        field.name.toLowerCase().includes('happy') ||
        field.name.toLowerCase().includes('changed') ||
        field.name.toLowerCase().includes('code')
      )
    );
    
    return {
      content: [
        {
          type: "text",
          text: `**Acceptance Criteria Related Fields (${acFields.length}):**
${acFields.map((field: any) => `- ${field.name} (${field.id})`).join('\n')}

**All Custom Fields (${customFields.length}):**
${customFields.slice(0, 20).map((field: any) => `- ${field.name} (${field.id})`).join('\n')}
${customFields.length > 20 ? `\n... and ${customFields.length - 20} more custom fields` : ''}

**Usage Example:**
\`\`\`
customFields: {
  "customfield_10001": "Simple explanation of the change",
  "customfield_10002": "Code usage instructions"
}
\`\`\``
        },
      ],
    };
  }

  private async searchIssues(jql: string, maxResults: number) {
    const data = await this.makeJiraRequest("/search/jql", {
      params: {
        jql,
        maxResults,
        fields: "summary,status,assignee,priority,created,updated",
      }
    });

    const issues = data.issues?.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      assignee: issue.fields.assignee?.displayName || "Unassigned",
      priority: issue.fields.priority?.name,
      url: `${this.config.baseUrl}/browse/${issue.key}`,
    })) || [];

    return {
      content: [
        {
          type: "text",
          text: `Found ${issues.length} issues:\n\n${issues
            .map((issue: any) => `**${issue.key}**: ${issue.summary}\n- Status: ${issue.status}\n- Assignee: ${issue.assignee}\n- Priority: ${issue.priority}\n- URL: ${issue.url}`)
            .join('\n\n')}`,
        },
      ],
    };
  }

  private static readonly HTML_ENTITIES: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
    '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '...',
    '&rsquo;': "'", '&lsquo;': "'", '&rdquo;': '"', '&ldquo;': '"',
    '&bull;': '•', '&middot;': '·', '&copy;': '©', '&reg;': '®',
  };

  adfToText(node: any, depth: number = 0): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (depth > 50) return '[content truncated]';

    // Text node - apply marks (bold, italic, code, etc.)
    if (node.type === 'text') {
      let text = node.text || '';
      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case 'strong': text = `**${text}**`; break;
            case 'em': text = `*${text}*`; break;
            case 'code': text = `\`${text}\``; break;
            case 'strike': text = `~~${text}~~`; break;
            case 'link': text = `[${text}](${mark.attrs?.href || ''})`; break;
          }
        }
      }
      return text;
    }

    // Recursively process content array
    const children = (node.content || []).map((child: any) => this.adfToText(child, depth + 1));

    switch (node.type) {
      case 'doc':
        return children.join('\n\n');
      case 'paragraph':
        return children.join('');
      case 'heading': {
        const level = node.attrs?.level || 1;
        const prefix = '#'.repeat(level);
        return `${prefix} ${children.join('')}`;
      }
      case 'bulletList':
        return children.join('\n');
      case 'orderedList': {
        const start = node.attrs?.order || 1;
        return children.map((c: string, i: number) => `${start + i}. ${c.replace(/^- /, '')}`).join('\n');
      }
      case 'listItem':
        return `- ${children.join('\n  ')}`;
      case 'codeBlock': {
        const lang = node.attrs?.language || '';
        return `\`\`\`${lang}\n${children.join('')}\n\`\`\``;
      }
      case 'blockquote':
        return children.map((c: string) => `> ${c}`).join('\n');
      case 'hardBreak':
        return '\n';
      case 'mention': {
        const mentionText = node.attrs?.text || node.attrs?.id || 'unknown';
        // Jira often prefixes mention text with @, avoid doubling
        return mentionText.startsWith('@') ? mentionText : `@${mentionText}`;
      }
      case 'emoji':
        return node.attrs?.shortName || node.attrs?.text || '';
      case 'inlineCard':
      case 'blockCard':
        return node.attrs?.url || '';
      case 'mediaGroup':
      case 'mediaSingle':
        return '[media]';
      case 'table':
        return children.join('\n');
      case 'tableRow':
        return `| ${children.join(' | ')} |`;
      case 'tableHeader':
      case 'tableCell':
        return children.join('');
      case 'rule':
        return '---';
      case 'panel':
        return `[${node.attrs?.panelType || 'info'}] ${children.join('\n')}`;
      case 'expand':
        return `> ${node.attrs?.title || 'Details'}\n${children.join('\n')}`;
      case 'status':
        return `[${node.attrs?.text || 'status'}]`;
      case 'date':
        return node.attrs?.timestamp ? new Date(parseInt(node.attrs.timestamp)).toLocaleDateString() : '';
      case 'taskList':
        return children.join('\n');
      case 'taskItem': {
        const checked = node.attrs?.state === 'DONE' ? 'x' : ' ';
        return `- [${checked}] ${children.join('')}`;
      }
      case 'decisionList':
        return children.join('\n');
      case 'decisionItem':
        return `<> ${children.join('')}`;
      default:
        return children.join('');
    }
  }

  stripHtml(html: string): string {
    return html
      // Preserve emphasis before stripping tags
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`')
      .replace(/<del>(.*?)<\/del>/gi, '~~$1~~')
      .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      // Strip script/style blocks entirely
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Structural tags to text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<h([1-6])[^>]*>/gi, (_: string, level: string) => '#'.repeat(parseInt(level) || 1) + ' ')
      // Remove remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&[a-z]+;|&#\d+;/gi, (entity) => {
        const numMatch = entity.match(/&#(\d+);/);
        if (numMatch) {
          const code = parseInt(numMatch[1]);
          return code >= 0 && code <= 0x10FFFF ? String.fromCharCode(code) : entity;
        }
        return JiraServer.HTML_ENTITIES[entity.toLowerCase()] || entity;
      })
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async getIssueComments(issueKey: string) {
    const data = await this.makeJiraRequest(`/issue/${issueKey}/comment`, {
      params: {
        expand: 'renderedBody',
      },
    });

    const comments = data.comments?.map((comment: any) => {
      let body: string;
      if (comment.renderedBody) {
        body = this.stripHtml(comment.renderedBody);
      } else if (comment.body != null && typeof comment.body === 'object') {
        // ADF format - convert to readable text
        body = this.adfToText(comment.body);
      } else {
        body = String(comment.body || '(empty)');
      }

      return {
        id: comment.id,
        author: comment.author?.displayName || 'Unknown',
        created: comment.created,
        updated: comment.updated,
        body,
      };
    }) || [];

    if (comments.length === 0) {
      return {
        content: [{ type: "text", text: `No comments found for ${issueKey}.` }],
      };
    }

    const paginationNote = data.total > (data.comments?.length || 0)
      ? `\n\n_Note: Showing ${data.comments.length} of ${data.total} comments._`
      : '';

    return {
      content: [
        {
          type: "text",
          text: `Comments for ${issueKey} (${comments.length}${data.total > comments.length ? ` of ${data.total}` : ''}):\n\n${comments
            .map((comment: any) => {
              const updated = comment.updated !== comment.created
                ? ` (edited ${new Date(comment.updated).toLocaleDateString()})`
                : '';
              return `**${comment.author}** (${new Date(comment.created).toLocaleDateString()})${updated}:\n${comment.body}`;
            })
            .join('\n\n---\n\n')}${paginationNote}`,
        },
      ],
    };
  }

  private async getTransitions(issueKey: string) {
    const data = await this.makeJiraRequest(`/issue/${issueKey}/transitions`);

    const transitions = data.transitions?.map((transition: any) => ({
      id: transition.id,
      name: transition.name,
      to: transition.to?.name,
    })) || [];

    return {
      content: [
        {
          type: "text",
          text: `Available transitions for ${issueKey}:\n\n${transitions
            .map((transition: any) => `**${transition.name}** (ID: ${transition.id}) -> ${transition.to}`)
            .join('\n')}`,
        },
      ],
    };
  }

  private async updateIssue(args: any) {
    const { issueKey, transition, assignee, summary, description, priority, dueDate, startDate, storyPoints, acceptanceCriteria, customFields } = args;
    let updateResult = "";

    // Handle status transition
    if (transition) {
      try {
        // Get available transitions to find the correct ID
        const transitionsData = await this.makeJiraRequest(`/issue/${issueKey}/transitions`);
        const availableTransition = transitionsData.transitions?.find(
          (t: any) => t.name.toLowerCase() === transition.toLowerCase() || t.id === transition
        );

        if (!availableTransition) {
          throw new Error(`Transition "${transition}" not found. Use jira_get_transitions to see available options.`);
        }

        await this.makeJiraRequest(`/issue/${issueKey}/transitions`, {
          method: 'POST',
          data: {
            transition: { id: availableTransition.id }
          }
        });
        updateResult += `✓ Status changed to ${availableTransition.to?.name || transition}\n`;
      } catch (error) {
        updateResult += `✗ Failed to change status: ${error instanceof Error ? error.message : String(error)}\n`;
      }
    }

    // Handle other field updates
    const fields: any = {};
    if (assignee) {
      // Try to find user by email or use as account ID
      fields.assignee = { emailAddress: assignee };
    }
    if (summary) fields.summary = summary;
    if (description) fields.description = this.convertToADF(description);
    if (priority) fields.priority = { name: priority };
    if (dueDate) fields.duedate = dueDate;
    if (startDate) fields.customfield_10815 = startDate;
    if (storyPoints !== undefined) fields.customfield_10012 = storyPoints;
    if (acceptanceCriteria) fields.customfield_11927 = this.convertToADF(acceptanceCriteria);
    if (customFields) {
      Object.assign(fields, customFields);
    }

    if (Object.keys(fields).length > 0) {
      try {
        await this.makeJiraRequest(`/issue/${issueKey}`, {
          method: 'PUT',
          data: { fields }
        });
        updateResult += `✓ Updated fields: ${Object.keys(fields).join(', ')}\n`;
      } catch (error) {
        updateResult += `✗ Failed to update fields: ${error instanceof Error ? error.message : String(error)}\n`;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Update results for ${issueKey}:\n\n${updateResult || "No updates requested"}`,
        },
      ],
    };
  }

  private async createIssue(args: any) {
    const { projectKey, summary, description, issueType = "Task", priority, assignee, labels, parentKey, customFields } = args;

    const fields: any = {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType },
    };

    // Convert plain text description to ADF format if provided
    if (description) {
      fields.description = this.convertToADF(description);
    }
    
    if (priority) fields.priority = { name: priority };
    if (assignee) fields.assignee = { emailAddress: assignee };
    if (labels && labels.length > 0) fields.labels = labels;
    
    // Add parent link for epics
    if (parentKey) {
      fields.parent = { key: parentKey };
    }
    
    // Add custom fields
    if (customFields) {
      Object.keys(customFields).forEach(fieldId => {
        fields[fieldId] = customFields[fieldId];
      });
    }

    try {
      const data = await this.makeJiraRequest("/issue", {
        method: 'POST',
        data: { fields }
      });

      const issueKey = data.key;
      const issueUrl = `${this.config.baseUrl}/browse/${issueKey}`;

      return {
        content: [
          {
            type: "text",
            text: `✓ Successfully created issue: **${issueKey}**

**Summary:** ${summary}
**Project:** ${projectKey}
**Issue Type:** ${issueType}
${priority ? `**Priority:** ${priority}` : ''}
${assignee ? `**Assignee:** ${assignee}` : ''}
${labels && labels.length > 0 ? `**Labels:** ${labels.join(', ')}` : ''}
${parentKey ? `**Parent Epic:** ${parentKey}` : ''}

**URL:** ${issueUrl}

${description ? `**Description:**\n${description}` : ''}`,
          },
        ],
      };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error?.response?.data ? JSON.stringify(error.response.data) : '';
      
      // Try to provide more helpful error messages
      let helpfulError = errorMessage + (errorDetails ? `\nDetails: ${errorDetails}` : '');
      if (errorMessage.includes('project') || errorMessage.includes('Project')) {
        helpfulError += `\n\nTip: Make sure the project key "${projectKey}" exists and you have permission to create issues in it.`;
      }
      if (errorMessage.includes('issuetype') || errorMessage.includes('Issue Type')) {
        helpfulError += `\n\nTip: Make sure the issue type "${issueType}" is valid for this project. Common types: Task, Bug, Story, Epic.`;
      }
      if (errorMessage.includes('priority')) {
        helpfulError += `\n\nTip: Make sure the priority "${priority}" is valid. Common priorities: Highest, High, Medium, Low, Lowest.`;
      }

      return {
        content: [
          {
            type: "text",
            text: `✗ Failed to create issue: ${helpfulError}`,
          },
        ],
      };
    }
  }

  private async addComment(issueKey: string, body: string) {
    const data = await this.makeJiraRequest(`/issue/${issueKey}/comment`, {
      method: 'POST',
      data: {
        body: this.convertToADF(body),
      },
    });

    return {
      content: [
        {
          type: "text",
          text: `✓ Comment added to ${issueKey} (ID: ${data.id})`,
        },
      ],
    };
  }

  private async getIssueLinks(issueKey: string) {
    const data = await this.makeJiraRequest(`/issue/${issueKey}?fields=issuelinks`);
    const links = data.fields?.issuelinks || [];

    if (links.length === 0) {
      return {
        content: [{ type: "text", text: `No issue links found for ${issueKey}.` }],
      };
    }

    const formatted = links.map((link: any) => {
      const type = link.type?.name || "Unknown";
      const inward = link.type?.inward || "";
      const outward = link.type?.outward || "";
      if (link.outwardIssue) {
        return `- **Link ID ${link.id}**: ${issueKey} ${outward} **${link.outwardIssue.key}** (${link.outwardIssue.fields?.summary || ""}) [type: ${type}]`;
      } else if (link.inwardIssue) {
        return `- **Link ID ${link.id}**: ${issueKey} ${inward} **${link.inwardIssue.key}** (${link.inwardIssue.fields?.summary || ""}) [type: ${type}]`;
      }
      return `- **Link ID ${link.id}**: Unknown link`;
    });

    return {
      content: [{ type: "text", text: `Issue links for ${issueKey}:\n\n${formatted.join('\n')}` }],
    };
  }

  private async deleteLink(linkId: string) {
    try {
      await this.makeJiraRequest(`/issueLink/${linkId}`, { method: 'DELETE' });
      return {
        content: [{ type: "text", text: `✓ Deleted issue link ${linkId}` }],
      };
    } catch (error: any) {
      const errorDetails = error?.response?.data ? JSON.stringify(error.response.data) : '';
      return {
        content: [{ type: "text", text: `✗ Failed to delete link ${linkId}: ${error instanceof Error ? error.message : String(error)}${errorDetails ? `\nDetails: ${errorDetails}` : ''}` }],
      };
    }
  }

  private async linkIssues(args: any) {
    const { linkType, inwardIssueKey, outwardIssueKey } = args;

    try {
      await this.makeJiraRequest("/issueLink", {
        method: 'POST',
        data: {
          type: { name: linkType },
          inwardIssue: { key: inwardIssueKey },
          outwardIssue: { key: outwardIssueKey },
        }
      });

      return {
        content: [
          {
            type: "text",
            text: `✓ Linked ${outwardIssueKey} blocks ${inwardIssueKey}  (type: ${linkType})`,
          },
        ],
      };
    } catch (error: any) {
      const errorDetails = error?.response?.data ? JSON.stringify(error.response.data) : '';
      return {
        content: [
          {
            type: "text",
            text: `✗ Failed to link issues: ${error instanceof Error ? error.message : String(error)}${errorDetails ? `\nDetails: ${errorDetails}` : ''}`,
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Jira MCP server running on stdio");
  }
}

export { JiraServer };

const server = new JiraServer();
server.run().catch(console.error);