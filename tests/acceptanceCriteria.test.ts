import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JiraServer } from '../src/index';

let server: JiraServer;
let requests: Array<{ endpoint: string; options?: any }>;

const acAdf = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'QA can toggle the flag and see tax on the invoice.' }],
    },
  ],
};

beforeEach(() => {
  server = Object.create(JiraServer.prototype);
  (server as any).config = { baseUrl: 'https://example.atlassian.net' };
  requests = [];
});

describe('createIssue acceptance criteria', () => {
  beforeEach(() => {
    (server as any).makeJiraRequest = vi.fn(async (endpoint: string, options?: any) => {
      requests.push({ endpoint, options });
      return { key: 'TER-1' };
    });
  });

  it('writes acceptanceCriteria to customfield_11927 as ADF', async () => {
    await (server as any).createIssue({
      projectKey: 'TER',
      summary: 'test',
      acceptanceCriteria: 'QA can toggle the flag.',
    });
    const fields = requests[0].options.data.fields;
    expect(fields.customfield_11927).toEqual(
      (server as any).convertToADF('QA can toggle the flag.')
    );
  });

  it('omits the field when acceptanceCriteria is not passed', async () => {
    await (server as any).createIssue({ projectKey: 'TER', summary: 'test' });
    const fields = requests[0].options.data.fields;
    expect(fields).not.toHaveProperty('customfield_11927');
  });
});

describe('getIssue acceptance criteria', () => {
  const issueData = (overrides: any = {}) => ({
    key: 'TER-1',
    fields: {
      summary: 'test issue',
      status: { name: 'Backlog' },
      assignee: null,
      reporter: { displayName: 'Fajar' },
      priority: { name: 'Medium' },
      created: '2026-08-27T10:00:00.000Z',
      updated: '2026-08-27T10:00:00.000Z',
      // "each" and "reach" used to bait the old regex scraper, which matched
      // the letters "ac" mid-word and sliced fragments from here.
      description: 'Please reach out to QA. Verify each item carefully.',
      ...overrides,
    },
    renderedFields: {},
  });

  it('renders AC from the stored customfield_11927, not from the description', async () => {
    (server as any).makeJiraRequest = vi.fn(async () =>
      issueData({ customfield_11927: acAdf })
    );
    const result = await (server as any).getIssue('TER-1');
    const text = result.content[0].text;
    expect(text).toContain('QA can toggle the flag and see tax on the invoice.');
  });

  it('does not slice fragments out of the description as fake AC', async () => {
    (server as any).makeJiraRequest = vi.fn(async () => issueData());
    const result = await (server as any).getIssue('TER-1');
    const text = result.content[0].text;
    const acSection = text.split('**Acceptance Criteria:**')[1].split('**Custom Fields:**')[0];
    expect(acSection).toContain('None found');
  });

  it('reports None found when the AC field is empty', async () => {
    (server as any).makeJiraRequest = vi.fn(async () =>
      issueData({ customfield_11927: null })
    );
    const result = await (server as any).getIssue('TER-1');
    const acSection = result.content[0].text
      .split('**Acceptance Criteria:**')[1]
      .split('**Custom Fields:**')[0];
    expect(acSection).toContain('None found');
  });
});
