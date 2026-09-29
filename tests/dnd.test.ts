import { arrayMove } from '@dnd-kit/sortable';
import { describe, it, expect } from 'vitest';

import { ChromeSection } from '@app-types';

describe('Drag and Drop Logic', () => {
  const mockSections: ChromeSection[] = [
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

  it('reorders items within the same section correctly using arrayMove', () => {
    const items = [...mockSections[0].items];
    // Move Google (index 0) to index 2 (after YouTube)
    const reordered = arrayMove(items, 0, 2);

    expect(reordered.map((it) => it.id)).toEqual(['sc-2', 'sc-3', 'sc-1']);
  });

  it('reorders sections correctly using arrayMove', () => {
    const sections = [...mockSections];
    const reordered = arrayMove(sections, 0, 1);

    expect(reordered.map((s) => s.id)).toEqual(['sec-2', 'sec-1']);
  });

  it('moves item across sections from source to target at specified index', () => {
    const activeId = 'sc-2'; // GitHub from sec-1
    const targetSectionId = 'sec-2';
    const targetIndex = 1; // insert between Slack (0) and Jira (1)

    const sourceSection = mockSections.find((s) => s.items.some((it) => it.id === activeId))!;
    const activeItem = sourceSection.items.find((it) => it.id === activeId)!;

    const updatedSections = mockSections.map((sec) => {
      if (sec.id === sourceSection.id) {
        return {
          ...sec,
          items: sec.items.filter((it) => it.id !== activeId),
        };
      }
      if (sec.id === targetSectionId) {
        const nextItems = [...sec.items];
        nextItems.splice(targetIndex, 0, activeItem);
        return {
          ...sec,
          items: nextItems,
        };
      }
      return sec;
    });

    // Check source section
    expect(updatedSections[0].items.map((it) => it.id)).toEqual(['sc-1', 'sc-3']);
    // Check target section: Slack, GitHub, Jira
    expect(updatedSections[1].items.map((it) => it.id)).toEqual(['sc-4', 'sc-2', 'sc-5']);
  });

  it('appends item to end of target section when dropped on section container', () => {
    const activeId = 'sc-1'; // Google from sec-1
    const targetSectionId = 'sec-2';

    const sourceSection = mockSections.find((s) => s.items.some((it) => it.id === activeId))!;
    const activeItem = sourceSection.items.find((it) => it.id === activeId)!;

    const updatedSections = mockSections.map((sec) => {
      if (sec.id === sourceSection.id) {
        return {
          ...sec,
          items: sec.items.filter((it) => it.id !== activeId),
        };
      }
      if (sec.id === targetSectionId) {
        return {
          ...sec,
          items: [...sec.items, activeItem],
        };
      }
      return sec;
    });

    expect(updatedSections[0].items.map((it) => it.id)).toEqual(['sc-2', 'sc-3']);
    expect(updatedSections[1].items.map((it) => it.id)).toEqual(['sc-4', 'sc-5', 'sc-1']);
  });

  it('correctly handles moving item into an empty section', () => {
    const emptySection: ChromeSection = {
      id: 'sec-empty',
      title: 'Empty',
      items: [],
    };
    const sectionsWithEmpty = [...mockSections, emptySection];

    const activeId = 'sc-3'; // YouTube
    const sourceSection = sectionsWithEmpty.find((s) => s.items.some((it) => it.id === activeId))!;
    const activeItem = sourceSection.items.find((it) => it.id === activeId)!;

    const updatedSections = sectionsWithEmpty.map((sec) => {
      if (sec.id === sourceSection.id) {
        return {
          ...sec,
          items: sec.items.filter((it) => it.id !== activeId),
        };
      }
      if (sec.id === 'sec-empty') {
        return {
          ...sec,
          items: [activeItem],
        };
      }
      return sec;
    });

    const target = updatedSections.find((s) => s.id === 'sec-empty')!;
    expect(target.items.length).toBe(1);
    expect(target.items[0].id).toBe('sc-3');
  });
});
