import { describe, it, expect } from 'vitest';

import { ChromeSection, ChromeShortcutItem, EditingShortcutData } from '@app-types';

import { normalizeSafeUrl } from '../src/utils/security';

describe('Shortcut Editing Logic', () => {
  const initialSections: ChromeSection[] = [
    {
      id: 'sec-1',
      title: 'Main',
      items: [
        { id: 'sc-1', type: 'shortcut', title: 'Google', url: 'https://google.com' },
        { id: 'sc-2', type: 'shortcut', title: 'GitHub', url: 'https://github.com' },
        { id: 'sc-3', type: 'shortcut', title: 'YouTube', url: 'https://youtube.com' },
      ],
    },
    {
      id: 'sec-2',
      title: 'Work',
      items: [
        { id: 'sc-4', type: 'shortcut', title: 'Slack', url: 'https://slack.com' },
        { id: 'sc-5', type: 'shortcut', title: 'Jira', url: 'https://atlassian.com' },
      ],
    },
  ];

  function applyEditShortcut(
    sections: ChromeSection[],
    data: EditingShortcutData,
  ): ChromeSection[] {
    const url = normalizeSafeUrl(data.url);
    if (!url) return sections;

    const title = data.title.trim() || 'domain.com';
    const customIcon = data.favicon?.trim() || undefined;
    const { id, sectionId: targetSecId } = data;

    if (!sections.some((s) => s.id === targetSecId)) return sections;

    let foundShortcut: ChromeShortcutItem | null = null;
    let sourceSectionId: string | null = null;

    for (const s of sections) {
      const item = s.items.find((it) => it.id === id);
      if (item) {
        sourceSectionId = s.id;
        foundShortcut = { ...item, title, url, favicon: customIcon };
        break;
      }
    }

    if (!foundShortcut || !sourceSectionId) return sections;

    if (sourceSectionId === targetSecId) {
      return sections.map((s) => {
        if (s.id === targetSecId) {
          return {
            ...s,
            items: s.items.map((it) => (it.id === id ? foundShortcut! : it)),
          };
        }
        return s;
      });
    }

    return sections.map((s) => {
      if (s.id === sourceSectionId) {
        return {
          ...s,
          items: s.items.filter((it) => it.id !== id),
        };
      }
      if (s.id === targetSecId) {
        return {
          ...s,
          items: [...s.items, foundShortcut!],
        };
      }
      return s;
    });
  }

  it('preserves the exact index of a shortcut when edited within the same section', () => {
    // Edit the middle shortcut (sc-2: GitHub)
    const result = applyEditShortcut(initialSections, {
      id: 'sc-2',
      title: 'GitHub Enterprise',
      url: 'https://github.com/enterprise',
      sectionId: 'sec-1',
    });

    const mainItems = result.find((s) => s.id === 'sec-1')!.items;
    expect(mainItems.map((it) => it.id)).toEqual(['sc-1', 'sc-2', 'sc-3']);
    expect(mainItems[1]).toEqual({
      id: 'sc-2',
      type: 'shortcut',
      title: 'GitHub Enterprise',
      url: 'https://github.com/enterprise',
      favicon: undefined,
    });
  });

  it('preserves position when first or last shortcut in section is edited', () => {
    // Edit the first shortcut (sc-1)
    const resultFirst = applyEditShortcut(initialSections, {
      id: 'sc-1',
      title: 'Google Search',
      url: 'https://google.com',
      sectionId: 'sec-1',
    });
    expect(resultFirst[0].items.map((it) => it.id)).toEqual(['sc-1', 'sc-2', 'sc-3']);
    expect(resultFirst[0].items[0].title).toBe('Google Search');

    // Edit the last shortcut (sc-3)
    const resultLast = applyEditShortcut(initialSections, {
      id: 'sc-3',
      title: 'YouTube Music',
      url: 'https://music.youtube.com',
      sectionId: 'sec-1',
    });
    expect(resultLast[0].items.map((it) => it.id)).toEqual(['sc-1', 'sc-2', 'sc-3']);
    expect(resultLast[0].items[2].title).toBe('YouTube Music');
  });

  it('moves shortcut to the end of target section when sectionId is changed', () => {
    // Move sc-2 (GitHub) from sec-1 to sec-2
    const result = applyEditShortcut(initialSections, {
      id: 'sc-2',
      title: 'GitHub Work',
      url: 'https://github.com',
      sectionId: 'sec-2',
    });

    const sec1Items = result.find((s) => s.id === 'sec-1')!.items;
    const sec2Items = result.find((s) => s.id === 'sec-2')!.items;

    expect(sec1Items.map((it) => it.id)).toEqual(['sc-1', 'sc-3']);
    expect(sec2Items.map((it) => it.id)).toEqual(['sc-4', 'sc-5', 'sc-2']);
    expect(sec2Items[2].title).toBe('GitHub Work');
  });

  it('does nothing if the target section does not exist', () => {
    const result = applyEditShortcut(initialSections, {
      id: 'sc-1',
      title: 'Test',
      url: 'https://test.com',
      sectionId: 'non-existent',
    });

    expect(result).toEqual(initialSections);
  });

  it('does nothing if the shortcut id does not exist', () => {
    const result = applyEditShortcut(initialSections, {
      id: 'non-existent',
      title: 'Test',
      url: 'https://test.com',
      sectionId: 'sec-1',
    });

    expect(result).toEqual(initialSections);
  });
});
