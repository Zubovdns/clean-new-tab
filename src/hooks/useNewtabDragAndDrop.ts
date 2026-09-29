import {
  CollisionDetection,
  defaultDropAnimationSideEffects,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DropAnimation,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, useRef, useCallback, useEffect } from 'react';

import { ChromeSection, ChromeShortcutItem } from '@app-types';

export const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
};

interface UseNewtabDragAndDropParams {
  sections: ChromeSection[];
  setSectionsLocally: (sections: ChromeSection[]) => void;
  commitSections: (sections: ChromeSection[]) => Promise<void>;
  reorderSections: (sourceIndex: number, destinationIndex: number) => void | Promise<void>;
}

export const useNewtabDragAndDrop = ({
  sections,
  setSectionsLocally,
  commitSections,
}: UseNewtabDragAndDropParams) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'section' | 'item' | null>(null);
  const [activeItem, setActiveItem] = useState<ChromeShortcutItem | null>(null);
  const [activeSection, setActiveSection] = useState<ChromeSection | null>(null);

  const isDraggingRef = useRef(false);

  const sectionsRef = useRef<ChromeSection[]>(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    if (activeId) {
      document.body.classList.add('is-dragging');
    } else {
      document.body.classList.remove('is-dragging');
    }
    return () => {
      document.body.classList.remove('is-dragging');
    };
  }, [activeId]);

  const initialSectionsSnapshot = useRef<ChromeSection[] | null>(null);
  const lastOverIdRef = useRef<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(pointerSensor, keyboardSensor);

  // Custom collision detection to eliminate dead zones completely
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // If dragging a section: only collide with other section containers
      if (activeType === 'section') {
        const sectionContainers = args.droppableContainers.filter(
          (c) => c.data.current?.type === 'section',
        );
        return closestCenter({
          ...args,
          droppableContainers: sectionContainers,
        });
      }

      // If dragging an item:
      // 1. Check direct pointer collisions
      const pointerCollisions = pointerWithin(args);

      if (pointerCollisions.length > 0) {
        // Prioritize shortcut items under cursor
        const itemCollision = pointerCollisions.find((c) => c.data?.current?.type === 'item');
        if (itemCollision) {
          lastOverIdRef.current = String(itemCollision.id);
          return [{ id: itemCollision.id }];
        }

        // If pointer is inside a section container
        const sectionCollision = pointerCollisions.find((c) => c.data?.current?.type === 'section');
        if (sectionCollision) {
          const sectionId = String(sectionCollision.id);
          const currentSections = sectionsRef.current;
          const section = currentSections.find((s) => s.id === sectionId);

          if (section && section.items.length > 0) {
            // Find closest item within this section to avoid empty space dead zones
            const sectionItemIds = new Set(section.items.map((it) => it.id));
            const sectionItemContainers = args.droppableContainers.filter(
              (c) => c.data.current?.type === 'item' && sectionItemIds.has(String(c.id)),
            );

            if (sectionItemContainers.length > 0) {
              const closestItemCollisions = closestCenter({
                ...args,
                droppableContainers: sectionItemContainers,
              });
              const closestItemId = getFirstCollision(closestItemCollisions, 'id');
              if (closestItemId != null) {
                lastOverIdRef.current = String(closestItemId);
                return [{ id: closestItemId }];
              }
            }
          }

          lastOverIdRef.current = sectionId;
          return [{ id: sectionId }];
        }
      }

      // 2. If pointer is outside direct containers (e.g. gaps/padding between cards/sections)
      const rectCollisions = rectIntersection(args);
      let overId = getFirstCollision(rectCollisions, 'id');

      if (overId == null) {
        const cornerCollisions = closestCorners(args);
        overId = getFirstCollision(cornerCollisions, 'id');
      }

      if (overId != null) {
        lastOverIdRef.current = String(overId);
        return [{ id: overId }];
      }

      // 3. Fallback to last known target to prevent abrupt cancellations in dead zones
      if (lastOverIdRef.current != null) {
        return [{ id: lastOverIdRef.current }];
      }

      return [];
    },
    [activeType],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const type = (active.data.current?.type as 'section' | 'item') || null;

      isDraggingRef.current = true;
      initialSectionsSnapshot.current = sectionsRef.current;
      lastOverIdRef.current = String(active.id);

      setActiveId(String(active.id));
      setActiveType(type);

      if (type === 'section') {
        const sec = sectionsRef.current.find((s) => s.id === active.id) || null;
        setActiveSection(sec);
        setActiveItem(null);
      } else if (type === 'item') {
        const item = active.data.current?.item as ChromeShortcutItem;
        setActiveItem(item || null);
        setActiveSection(null);
      }
    },
    [isDraggingRef],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId === overId) return;

      const type = active.data.current?.type;
      if (type !== 'item') return;

      const currentSections = sectionsRef.current;

      const findContainer = (id: string): ChromeSection | undefined => {
        const bySec = currentSections.find((s) => s.id === id);
        if (bySec) return bySec;
        return currentSections.find((s) => s.items.some((it) => it.id === id));
      };

      const activeContainer = findContainer(activeId);
      const overContainer = findContainer(overId);

      if (!activeContainer || !overContainer || activeContainer.id === overContainer.id) {
        return;
      }

      // Move item between different sections in transient state
      const activeItem = activeContainer.items.find((it) => it.id === activeId);
      if (!activeItem) return;

      const isOverSectionDirectly = overContainer.id === overId;
      let newIndex: number;

      if (isOverSectionDirectly) {
        // Appended to the end of the target section
        newIndex = overContainer.items.length;
      } else {
        const overIndex = overContainer.items.findIndex((it) => it.id === overId);
        newIndex = overIndex >= 0 ? overIndex : overContainer.items.length;
      }

      const updated = currentSections.map((sec) => {
        if (sec.id === activeContainer.id) {
          return {
            ...sec,
            items: sec.items.filter((it) => it.id !== activeId),
          };
        }
        if (sec.id === overContainer.id) {
          const nextItems = [...sec.items];
          nextItems.splice(newIndex, 0, activeItem);
          return {
            ...sec,
            items: nextItems,
          };
        }
        return sec;
      });

      setSectionsLocally(updated);
    },
    [setSectionsLocally],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const type = active.data.current?.type;

      const cleanup = () => {
        setActiveId(null);
        setActiveType(null);
        setActiveItem(null);
        setActiveSection(null);
        initialSectionsSnapshot.current = null;
        lastOverIdRef.current = null;
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 100);
      };

      if (!over) {
        if (initialSectionsSnapshot.current) {
          setSectionsLocally(initialSectionsSnapshot.current);
        }
        cleanup();
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);

      // Section sorting
      if (type === 'section') {
        const currentSections = sectionsRef.current;
        if (activeId !== overId) {
          const oldIndex = currentSections.findIndex((s) => s.id === activeId);
          const newIndex = currentSections.findIndex((s) => s.id === overId);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = arrayMove(currentSections, oldIndex, newIndex);
            setSectionsLocally(reordered);
            await commitSections(reordered);
            cleanup();
            return;
          }
        }
        cleanup();
        return;
      }

      // Shortcut item sorting
      if (type === 'item') {
        const currentSections = sectionsRef.current;
        const container = currentSections.find((s) => s.items.some((it) => it.id === activeId));
        if (!container) {
          cleanup();
          return;
        }

        const activeIndex = container.items.findIndex((it) => it.id === activeId);
        const isOverItem = container.items.some((it) => it.id === overId);
        const isOverSameSection = container.id === overId;

        if (isOverItem) {
          const overIndex = container.items.findIndex((it) => it.id === overId);
          if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
            const reorderedItems = arrayMove(container.items, activeIndex, overIndex);
            const finalSections = currentSections.map((sec) =>
              sec.id === container.id ? { ...sec, items: reorderedItems } : sec,
            );
            setSectionsLocally(finalSections);
            await commitSections(finalSections);
            cleanup();
            return;
          }
        } else if (isOverSameSection) {
          const lastIndex = container.items.length - 1;
          if (activeIndex !== -1 && activeIndex !== lastIndex) {
            const reorderedItems = arrayMove(container.items, activeIndex, lastIndex);
            const finalSections = currentSections.map((sec) =>
              sec.id === container.id ? { ...sec, items: reorderedItems } : sec,
            );
            setSectionsLocally(finalSections);
            await commitSections(finalSections);
            cleanup();
            return;
          }
        }

        // Commit current sections state (which includes any cross-section moves made during drag)
        await commitSections(currentSections);
        cleanup();
      }
    },
    [commitSections, isDraggingRef, setSectionsLocally],
  );

  const handleDragCancel = useCallback(() => {
    if (initialSectionsSnapshot.current) {
      setSectionsLocally(initialSectionsSnapshot.current);
    }
    setActiveId(null);
    setActiveType(null);
    setActiveItem(null);
    setActiveSection(null);
    initialSectionsSnapshot.current = null;
    lastOverIdRef.current = null;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, [isDraggingRef, setSectionsLocally]);

  return {
    sensors,
    activeId,
    activeType,
    activeItem,
    activeSection,
    isDraggingRef,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
};
