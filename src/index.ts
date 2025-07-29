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

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
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
                  description: "Updated description (optional)",
                },
                priority: {
                  type: "string",
                  description: "Priority name (e.g., High, Medium, Low) (optional)",
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
                  description: "Issue description (optional)",
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
              },
              required: ["projectKey", "summary"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
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

  private async makeJiraRequest(endpoint: string, options?: { params?: any; data?: any; method?: 'GET' | 'POST' | 'PUT' }) {
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
        fields: "summary,status,assignee,priority,created,updated,description,issuetype,reporter,parent",
        expand: "renderedFields",
      }
    });

    // Extract acceptance criteria from description or custom field
    const description = data.renderedFields?.description || data.fields?.description;
    const acceptanceCriteria = this.extractAcceptanceCriteria(description);

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

  private async searchIssues(jql: string, maxResults: number) {
    const data = await this.makeJiraRequest("/search", {
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

  private async getIssueComments(issueKey: string) {
    const data = await this.makeJiraRequest(`/issue/${issueKey}/comment`);

    const comments = data.comments?.map((comment: any) => ({
      author: comment.author.displayName,
      created: comment.created,
      body: comment.renderedBody || comment.body,
    })) || [];

    return {
      content: [
        {
          type: "text",
          text: `Comments for ${issueKey}:\n\n${comments
            .map((comment: any) => `**${comment.author}** (${new Date(comment.created).toLocaleDateString()}):\n${comment.body}`)
            .join('\n\n---\n\n')}`,
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
    const { issueKey, transition, assignee, summary, description, priority } = args;
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
    if (description) fields.description = description;
    if (priority) fields.priority = { name: priority };

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
    const { projectKey, summary, description, issueType = "Task", priority, assignee, labels } = args;

    const fields: any = {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType },
    };

    if (description) fields.description = description;
    if (priority) fields.priority = { name: priority };
    if (assignee) fields.assignee = { emailAddress: assignee };
    if (labels && labels.length > 0) fields.labels = labels.map((label: string) => ({ name: label }));

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

**URL:** ${issueUrl}

${description ? `**Description:**\n${description}` : ''}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Try to provide more helpful error messages
      let helpfulError = errorMessage;
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Jira MCP server running on stdio");
  }
}

const server = new JiraServer();
server.run().catch(console.error);