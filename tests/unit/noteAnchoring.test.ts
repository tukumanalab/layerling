import { describe, expect, it } from "vitest";
import { groupedShape, restoreGroupedChildren } from "@/lib/editorBooleans";
import { noteAnchorFromWorld, noteAnchorWorld, notesAfterShapeChange, notesPinnedTo, notesPutBack, visibleShapeUnderPoint } from "@/lib/noteAnchoring";
import type { WorkplaneNote, WorkplaneShape } from "@/types/layerling";

/*
 * A pinned note follows its body. When the body goes away - taken apart,
 * grouped, opened for editing, deleted - the note has to find its place from
 * the bodies alone: on the visible body under it, on the group being edited,
 * or free where it stood.
 */

function box(id: string, x: number, z: number, overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return { id, name: id, kind: "box", color: "#d41721", x, z, elevation: 0, size: 10, width: 10, depth: 10, height: 10, rotation: 0, ...overrides };
}

function pinnedTo(shape: WorkplaneShape, normalized: [number, number, number], id = "note-1"): WorkplaneNote {
  return { id, text: "Hier", ...noteAnchorWorld(shape, normalized), anchor: { shapeId: shape.id, normalized } };
}

function near(point: { x: number; y: number; z: number }, expected: { x: number; y: number; z: number }) {
  expect(point.x).toBeCloseTo(expected.x, 4);
  expect(point.y).toBeCloseTo(expected.y, 4);
  expect(point.z).toBeCloseTo(expected.z, 4);
}

describe("a pin in space", () => {
  it("is where the viewport draws it, on a turned and mirrored body as well", () => {
    const turned = box("a", 12, -4, { rotation: 30, rotationX: 15, mirrorX: true, elevation: 3, width: 20 });
    const top = noteAnchorWorld(turned, [0.25, 0.5, 0]);
    expect(noteAnchorFromWorld(turned, top).map((value) => Number(value.toFixed(6)) + 0)).toEqual([0.25, 0.5, 0]);
    // A point on the top face lies on the body's surface.
    expect(visibleShapeUnderPoint([turned], top)?.id).toBe("a");
    expect(visibleShapeUnderPoint([turned], { x: 100, y: 0, z: 0 })).toBeNull();
  });
});

describe("notes when bodies change", () => {
  it("go to the part under them when a group is taken apart", () => {
    const group = groupedShape([box("a", 0, 0), box("b", 30, 0)])!;
    const note = pinnedTo(group, [0.4, 0.5, 0]); // on top of b
    const parts = restoreGroupedChildren(group);
    const [moved] = notesAfterShapeChange([note], [group], parts);
    expect(moved.anchor?.shapeId).toBe(parts[1].id);
    near(noteAnchorWorld(parts[1], moved.anchor!.normalized), { x: note.x, y: note.y, z: note.z });
  });

  it("do not go to a hidden part, and stay where they stood when nothing visible is under them", () => {
    const group = groupedShape([box("a", 0, 0), box("b", 30, 0, { hidden: true })])!;
    const note = pinnedTo(group, [0.4, 0.5, 0]);
    const [free] = notesAfterShapeChange([note], [group], restoreGroupedChildren(group));
    expect(free.anchor).toBeUndefined();
    near(free, { x: note.x, y: note.y, z: note.z });
  });

  it("stay with a group inside the one taken apart", () => {
    const inner = groupedShape([box("a", 0, 0), box("b", 15, 0)])!;
    const outer = groupedShape([inner, box("c", 40, 0)])!;
    const note = pinnedTo(outer, [-0.3, 0.5, 0]); // on top of a, inside the inner group
    const parts = restoreGroupedChildren(outer);
    const [moved] = notesAfterShapeChange([note], [outer], parts);
    expect(moved.anchor?.shapeId).toBe(parts[0].id);
    expect(parts[0].groupedShapes?.length).toBe(2);
  });

  it("go into the group their body went into", () => {
    const a = box("a", 0, 0);
    const note = pinnedTo(a, [0, 0.5, 0]);
    const group = groupedShape([a, box("b", 30, 0)])!;
    const [moved] = notesAfterShapeChange([note], [a, box("b", 30, 0)], [group]);
    expect(moved.anchor?.shapeId).toBe(group.id);
    near(noteAnchorWorld(group, moved.anchor!.normalized), { x: note.x, y: note.y, z: note.z });
  });

  it("move with the part under them while their group is open, and go back to the group when it closes", () => {
    const inner = groupedShape([box("a", 0, 0), box("b", 15, 0)])!;
    const outer = groupedShape([inner, box("c", 40, 0)])!;
    const stale = { ...pinnedTo(outer, [-0.3, 0.5, 0]), x: -99, y: -99, z: -99 }; // on top of a, inside the inner group
    const parts = restoreGroupedChildren(outer);
    const [opened] = notesAfterShapeChange([stale], [outer], parts, new Set([outer.id]), true);
    expect(opened.anchor?.shapeId).toBe(parts[0].id);
    near(opened, noteAnchorWorld(outer, [-0.3, 0.5, 0]));
    // The inner group is moved inside the open one: the note goes with it.
    const moved = [{ ...parts[0], x: parts[0].x + 5 }, parts[1]];
    near(noteAnchorWorld(moved[0], opened.anchor!.normalized), { x: opened.x + 5, y: opened.y, z: opened.z });
    // Closed again: the same group, pinned where the note now stands.
    const closed = { ...groupedShape(moved)!, id: outer.id };
    const [back] = notesAfterShapeChange([opened], moved, [closed], new Set(), true);
    expect(back.anchor?.shapeId).toBe(outer.id);
    near(noteAnchorWorld(closed, back.anchor!.normalized), noteAnchorWorld(moved[0], opened.anchor!.normalized));
  });

  it("stay with an open group when no visible part is under them, and keep their place", () => {
    const group = groupedShape([box("a", 0, 0), box("b", 30, 0, { hidden: true })])!;
    const note = pinnedTo(group, [0.4, 0.5, 0]); // on top of the hidden part
    const parts = restoreGroupedChildren(group);
    const [held] = notesAfterShapeChange([note], [group], parts, new Set([group.id]), true);
    expect(held.anchor?.shapeId).toBe(group.id);
    near(held, noteAnchorWorld(group, [0.4, 0.5, 0]));
    // Further edits inside leave it alone.
    const notes = [held];
    expect(notesAfterShapeChange(notes, parts, parts.slice(0, 1), new Set([group.id]))).toBe(notes);
  });

  it("come back as they were when the editing is cancelled, wherever the parts were moved", () => {
    const group = groupedShape([box("a", 0, 0), box("b", 30, 0)])!;
    const note = pinnedTo(group, [0.4, 0.5, 0]);
    const kept = notesPinnedTo([note], group);
    const parts = restoreGroupedChildren(group);
    const [opened] = notesAfterShapeChange([note], [group], parts, new Set([group.id]), true);
    const moved = [parts[0], { ...parts[1], x: parts[1].x + 50 }];
    const [back] = notesAfterShapeChange(notesPutBack([opened], kept), moved, [group], new Set(), true);
    expect(back.anchor?.shapeId).toBe(group.id);
    expect(back.anchor!.normalized.map((value) => Number(value.toFixed(6)) + 0)).toEqual([0.4, 0.5, 0]);
  });

  it("are let go where their body last was when it is deleted, not at an old spot", () => {
    const a = box("a", 20, 20);
    const note = { ...pinnedTo(a, [0, 0.5, 0]), x: 0, y: 0, z: 0 };
    const [free] = notesAfterShapeChange([note], [a], []);
    expect(free.anchor).toBeUndefined();
    near(free, { x: 20, y: 10, z: 20 });
  });

  it("pinned to a body that came in with them are left alone outside a regroup", () => {
    const a = box("a", 0, 0);
    const notes = [{ ...pinnedTo(a, [0, 0.5, 0]), x: -99 }];
    expect(notesAfterShapeChange(notes, [], [a])).toBe(notes);
  });

  it("are left alone while their body is there", () => {
    const a = box("a", 0, 0);
    const notes = [pinnedTo(a, [0, 0.5, 0])];
    expect(notesAfterShapeChange(notes, [a], [{ ...a, x: 5 }])).toBe(notes);
  });
});
