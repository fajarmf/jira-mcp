import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JiraServer } from '../src/index';

// Create instance to access methods - suppress startup side effects
let server: JiraServer;
let requests: Array<{ endpoint: string; options?: any }>;

// Jira semantics (verified empirically on TER-19182 and TER-19270):
// a stored link {inwardIssue: A, outwardIssue: B} of type Blocks means "A blocks B".
const storedLinkReadback = {
  fields: {
    issuelinks: [
      {
        id: '12345',
        type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
        // Reading issue TER-1's links: the other issue (TER-2) appears as
        // outwardIssue, so TER-1 <outward desc> TER-2 = "TER-1 blocks TER-2".
        outwardIssue: { key: 'TER-2', fields: { summary: 'the blocked one' } },
      },
    ],
  },
};

beforeEach(() => {
  server = Object.create(JiraServer.prototype);
  requests = [];
  (server as any).makeJiraRequest = vi.fn(async (endpoint: string, options?: any) => {
    requests.push({ endpoint, options });
    if (endpoint === '/issueLink') return {};
    if (endpoint.startsWith('/issue/')) return storedLinkReadback;
    throw new Error(`unexpected endpoint ${endpoint}`);
  });
});

describe('linkIssues', () => {
  it('passes inward/outward through to the Jira API unchanged', async () => {
    await (server as any).linkIssues({
      linkType: 'Blocks',
      inwardIssueKey: 'TER-1',
      outwardIssueKey: 'TER-2',
    });
    expect(requests[0]).toEqual({
      endpoint: '/issueLink',
      options: {
        method: 'POST',
        data: {
          type: { name: 'Blocks' },
          inwardIssue: { key: 'TER-1' },
          outwardIssue: { key: 'TER-2' },
        },
      },
    });
  });

  it('reads the stored link back instead of trusting the POST', async () => {
    await (server as any).linkIssues({
      linkType: 'Blocks',
      inwardIssueKey: 'TER-1',
      outwardIssueKey: 'TER-2',
    });
    expect(requests.map((r) => r.endpoint)).toEqual([
      '/issueLink',
      '/issue/TER-1?fields=issuelinks',
    ]);
  });

  it('reports the direction Jira actually stored: inward blocks outward', async () => {
    const result = await (server as any).linkIssues({
      linkType: 'Blocks',
      inwardIssueKey: 'TER-1',
      outwardIssueKey: 'TER-2',
    });
    const text = result.content[0].text;
    expect(text).toContain('TER-1 blocks TER-2');
    expect(text).not.toContain('TER-2 blocks TER-1');
  });

  it('warns instead of guessing when the readback does not contain the link', async () => {
    (server as any).makeJiraRequest = vi.fn(async (endpoint: string) => {
      if (endpoint === '/issueLink') return {};
      return { fields: { issuelinks: [] } };
    });
    const result = await (server as any).linkIssues({
      linkType: 'Blocks',
      inwardIssueKey: 'TER-1',
      outwardIssueKey: 'TER-2',
    });
    const text = result.content[0].text;
    expect(text).toContain('verify');
    expect(text).not.toContain('TER-1 blocks TER-2');
  });

  it('still reports creation when the readback request itself fails', async () => {
    (server as any).makeJiraRequest = vi.fn(async (endpoint: string) => {
      if (endpoint === '/issueLink') return {};
      throw new Error('boom');
    });
    const result = await (server as any).linkIssues({
      linkType: 'Blocks',
      inwardIssueKey: 'TER-1',
      outwardIssueKey: 'TER-2',
    });
    const text = result.content[0].text;
    expect(text).toContain('✓');
    expect(text).toContain('verify');
  });

  it('reports a failed POST as a failure', async () => {
    (server as any).makeJiraRequest = vi.fn(async () => {
      throw new Error('bad request');
    });
    const result = await (server as any).linkIssues({
      linkType: 'Blocks',
      inwardIssueKey: 'TER-1',
      outwardIssueKey: 'TER-2',
    });
    expect(result.content[0].text).toContain('✗ Failed to link issues');
  });
});
