import { describe, it, expect, beforeAll } from 'vitest';
import { JiraServer } from '../src/index';

// Create instance to access methods - suppress startup side effects
let server: JiraServer;

beforeAll(() => {
  // JiraServer constructor logs to stderr and sets up handlers, but we only need the utility methods
  server = Object.create(JiraServer.prototype);
});

describe('adfToText', () => {
  it('returns empty string for null/undefined', () => {
    expect(server.adfToText(null)).toBe('');
    expect(server.adfToText(undefined)).toBe('');
  });

  it('returns string input as-is', () => {
    expect(server.adfToText('hello')).toBe('hello');
  });

  it('handles simple text node', () => {
    expect(server.adfToText({ type: 'text', text: 'hello' })).toBe('hello');
  });

  it('handles text node with no text', () => {
    expect(server.adfToText({ type: 'text' })).toBe('');
  });

  it('handles simple paragraph', () => {
    const adf = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world' }],
    };
    expect(server.adfToText(adf)).toBe('Hello world');
  });

  it('handles doc with multiple paragraphs', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    expect(server.adfToText(adf)).toBe('First\n\nSecond');
  });

  it('handles headings with correct level', () => {
    const adf = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Title' }],
    };
    expect(server.adfToText(adf)).toBe('## Title');
  });

  it('defaults heading level to 1', () => {
    const adf = {
      type: 'heading',
      content: [{ type: 'text', text: 'Title' }],
    };
    expect(server.adfToText(adf)).toBe('# Title');
  });

  it('handles bullet list', () => {
    const adf = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
      ],
    };
    expect(server.adfToText(adf)).toBe('- Item 1\n- Item 2');
  });

  it('handles ordered list starting at 1', () => {
    const adf = {
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
      ],
    };
    expect(server.adfToText(adf)).toBe('1. First\n2. Second');
  });

  it('handles ordered list with custom start order', () => {
    const adf = {
      type: 'orderedList',
      attrs: { order: 5 },
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fifth' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sixth' }] }] },
      ],
    };
    expect(server.adfToText(adf)).toBe('5. Fifth\n6. Sixth');
  });

  it('handles code block with language', () => {
    const adf = {
      type: 'codeBlock',
      attrs: { language: 'python' },
      content: [{ type: 'text', text: 'print("hello")' }],
    };
    expect(server.adfToText(adf)).toBe('```python\nprint("hello")\n```');
  });

  it('handles code block without language', () => {
    const adf = {
      type: 'codeBlock',
      content: [{ type: 'text', text: 'some code' }],
    };
    expect(server.adfToText(adf)).toBe('```\nsome code\n```');
  });

  it('handles blockquote', () => {
    const adf = {
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted text' }] }],
    };
    expect(server.adfToText(adf)).toBe('> Quoted text');
  });

  it('handles hardBreak', () => {
    expect(server.adfToText({ type: 'hardBreak' })).toBe('\n');
  });

  it('handles mention with text (no @ prefix)', () => {
    const adf = { type: 'mention', attrs: { text: 'John Doe', id: 'abc123' } };
    expect(server.adfToText(adf)).toBe('@John Doe');
  });

  it('handles mention with @ prefix in text (no doubling)', () => {
    const adf = { type: 'mention', attrs: { text: '@Fajar', id: '456' } };
    expect(server.adfToText(adf)).toBe('@Fajar');
  });

  it('handles mention with only id', () => {
    const adf = { type: 'mention', attrs: { id: 'abc123' } };
    expect(server.adfToText(adf)).toBe('@abc123');
  });

  it('handles mention with no attrs', () => {
    const adf = { type: 'mention' };
    expect(server.adfToText(adf)).toBe('@unknown');
  });

  it('handles emoji', () => {
    const adf = { type: 'emoji', attrs: { shortName: ':thumbsup:' } };
    expect(server.adfToText(adf)).toBe(':thumbsup:');
  });

  it('handles inlineCard (link)', () => {
    const adf = { type: 'inlineCard', attrs: { url: 'https://example.com' } };
    expect(server.adfToText(adf)).toBe('https://example.com');
  });

  it('handles media nodes', () => {
    expect(server.adfToText({ type: 'mediaGroup' })).toBe('[media]');
    expect(server.adfToText({ type: 'mediaSingle' })).toBe('[media]');
  });

  it('handles table', () => {
    const adf = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] },
          ],
        },
      ],
    };
    const result = server.adfToText(adf);
    expect(result).toContain('| Name | Value |');
    expect(result).toContain('| A | 1 |');
  });

  it('handles horizontal rule', () => {
    expect(server.adfToText({ type: 'rule' })).toBe('---');
  });

  it('handles panel', () => {
    const adf = {
      type: 'panel',
      attrs: { panelType: 'warning' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Be careful' }] }],
    };
    expect(server.adfToText(adf)).toBe('[warning] Be careful');
  });

  it('handles status lozenge', () => {
    const adf = { type: 'status', attrs: { text: 'IN PROGRESS' } };
    expect(server.adfToText(adf)).toBe('[IN PROGRESS]');
  });

  it('handles task list', () => {
    const adf = {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { state: 'DONE' }, content: [{ type: 'text', text: 'Done task' }] },
        { type: 'taskItem', attrs: { state: 'TODO' }, content: [{ type: 'text', text: 'Todo task' }] },
      ],
    };
    const result = server.adfToText(adf);
    expect(result).toContain('- [x] Done task');
    expect(result).toContain('- [ ] Todo task');
  });

  it('handles unknown node types gracefully', () => {
    const adf = {
      type: 'unknownNodeType',
      content: [{ type: 'text', text: 'still works' }],
    };
    expect(server.adfToText(adf)).toBe('still works');
  });

  it('handles node with no content array', () => {
    const adf = { type: 'paragraph' };
    expect(server.adfToText(adf)).toBe('');
  });

  // Text marks
  it('handles bold text', () => {
    const adf = { type: 'text', text: 'bold', marks: [{ type: 'strong' }] };
    expect(server.adfToText(adf)).toBe('**bold**');
  });

  it('handles italic text', () => {
    const adf = { type: 'text', text: 'italic', marks: [{ type: 'em' }] };
    expect(server.adfToText(adf)).toBe('*italic*');
  });

  it('handles inline code', () => {
    const adf = { type: 'text', text: 'code', marks: [{ type: 'code' }] };
    expect(server.adfToText(adf)).toBe('`code`');
  });

  it('handles strikethrough text', () => {
    const adf = { type: 'text', text: 'deleted', marks: [{ type: 'strike' }] };
    expect(server.adfToText(adf)).toBe('~~deleted~~');
  });

  it('handles link mark', () => {
    const adf = { type: 'text', text: 'click here', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] };
    expect(server.adfToText(adf)).toBe('[click here](https://example.com)');
  });

  it('handles multiple marks on same text', () => {
    const adf = { type: 'text', text: 'important', marks: [{ type: 'strong' }, { type: 'em' }] };
    expect(server.adfToText(adf)).toBe('***important***');
  });

  // Depth limit
  it('truncates at depth limit', () => {
    // Build a deeply nested structure
    let node: any = { type: 'text', text: 'deep' };
    for (let i = 0; i < 60; i++) {
      node = { type: 'paragraph', content: [node] };
    }
    const result = server.adfToText(node);
    expect(result).toContain('[content truncated]');
  });

  // Realistic Jira comment
  it('handles realistic Jira comment ADF', () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hey ' },
            { type: 'mention', attrs: { id: '123', text: '@Fajar' } },
            { type: 'text', text: ', this looks good! ' },
            { type: 'emoji', attrs: { shortName: ':thumbsup:' } },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Just one note: please update the ' },
            { type: 'text', text: 'config.yaml', marks: [{ type: 'code' }] },
            { type: 'text', text: ' file.' },
          ],
        },
      ],
    };
    const result = server.adfToText(adf);
    expect(result).toContain('Hey @Fajar');
    expect(result).toContain(':thumbsup:');
    expect(result).toContain('`config.yaml`');
  });
});

describe('stripHtml', () => {
  it('strips basic HTML tags', () => {
    expect(server.stripHtml('<p>Hello</p>')).toBe('Hello');
  });

  it('converts br to newlines', () => {
    expect(server.stripHtml('Hello<br>World')).toBe('Hello\nWorld');
    expect(server.stripHtml('Hello<br/>World')).toBe('Hello\nWorld');
    expect(server.stripHtml('Hello<br />World')).toBe('Hello\nWorld');
  });

  it('converts paragraphs to newlines', () => {
    expect(server.stripHtml('<p>First</p><p>Second</p>')).toBe('First\nSecond');
  });

  it('converts list items', () => {
    expect(server.stripHtml('<ul><li>Item 1</li><li>Item 2</li></ul>')).toBe('- Item 1\n- Item 2');
  });

  it('converts headings with correct level', () => {
    expect(server.stripHtml('<h1>Title</h1>')).toBe('# Title');
    expect(server.stripHtml('<h3>Section</h3>')).toBe('### Section');
  });

  it('preserves bold emphasis', () => {
    expect(server.stripHtml('<strong>bold</strong>')).toBe('**bold**');
  });

  it('preserves italic emphasis', () => {
    expect(server.stripHtml('<em>italic</em>')).toBe('*italic*');
  });

  it('preserves inline code', () => {
    expect(server.stripHtml('<code>const x = 1</code>')).toBe('`const x = 1`');
  });

  it('preserves strikethrough', () => {
    expect(server.stripHtml('<del>removed</del>')).toBe('~~removed~~');
  });

  it('converts links to markdown', () => {
    expect(server.stripHtml('<a href="https://example.com">click</a>')).toBe('[click](https://example.com)');
  });

  it('decodes common HTML entities', () => {
    expect(server.stripHtml('&amp; &lt; &gt; &quot; &#39;')).toBe('& < > " \'');
  });

  it('decodes extended HTML entities', () => {
    // &nbsp; becomes space, which is trimmed when leading/trailing
    expect(server.stripHtml('hello&nbsp;world')).toBe('hello world');
    expect(server.stripHtml('&mdash;&hellip;')).toBe('—...');
  });

  it('decodes numeric HTML entities', () => {
    expect(server.stripHtml('&#8217;')).toBe('\u2019'); // right single quotation mark
  });

  it('collapses multiple newlines', () => {
    expect(server.stripHtml('<p>A</p><p></p><p></p><p>B</p>')).toBe('A\n\nB');
  });

  it('strips script tags and their content', () => {
    expect(server.stripHtml('Hello<script>alert("xss")</script>World')).toBe('HelloWorld');
  });

  it('strips style tags and their content', () => {
    expect(server.stripHtml('Hello<style>.hidden{display:none}</style>World')).toBe('HelloWorld');
  });

  it('handles empty string', () => {
    expect(server.stripHtml('')).toBe('');
  });

  it('handles string with no HTML', () => {
    expect(server.stripHtml('plain text')).toBe('plain text');
  });
});
