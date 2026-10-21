import * as THREE from "three";
import { meshForShape } from "@/lib/editorMeshCore";
import { shapeDepth, shapeWidth } from "@/lib/workplaneShapes";
import type { WorkplaneNote, WorkplaneShape } from "@/types/layerling";

/*
 * Where a pinned note is, worked out from the bodies alone - the same frame the
 * viewport hangs a note on (see `tapeAttachmentWorld`): the body's middle,
 * turned and mirrored like the body, with the pin given as a share of its
 * width, height and depth. The editor needs it when a body goes away and its
 * notes have to find their place without a scene to ask.
 */

type Point = { x: number; y: number; z: number };

/** How far from a surface a point may be and still count as lying on it (mm). */
const ON_SURFACE_TOLERANCE = 0.25;

function shapeFrame(shape: WorkplaneShape) {
  const sign = (mirrored?: boolean) => (mirrored ? -1 : 1);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(shape.rotationX ?? 0),
      THREE.MathUtils.degToRad(shape.rotation),
      THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
    )),
    new THREE.Vector3(sign(shape.mirrorX), sign(shape.mirrorY), sign(shape.mirrorZ)),
  );
}

function shapeDimensions(shape: WorkplaneShape): [number, number, number] {
  return [shapeWidth(shape), shape.height, shapeDepth(shape)];
}

export function noteAnchorWorld(shape: WorkplaneShape, normalized: readonly [number, number, number]): Point {
  const [width, height, depth] = shapeDimensions(shape);
  const world = new THREE.Vector3(normalized[0] * width, normalized[1] * height, normalized[2] * depth).applyMatrix4(shapeFrame(shape));
  return { x: world.x, y: world.y, z: world.z };
}

export function noteAnchorFromWorld(shape: WorkplaneShape, point: Point): [number, number, number] {
  const local = new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(shapeFrame(shape).invert());
  const share = (value: number, size: number) => (Math.abs(size) > 1e-9 ? value / size : 0);
  const [width, height, depth] = shapeDimensions(shape);
  return [share(local.x, width), share(local.y, height), share(local.z, depth)];
}

/** How far `point` is from the surface of `shape`, or Infinity when it is not even near its box. */
function distanceToSurface(shape: WorkplaneShape, point: THREE.Vector3) {
  const mesh = meshForShape(shape);
  if (!mesh.faces.length) return Number.POSITIVE_INFINITY;
  const box = new THREE.Box3().setFromPoints(mesh.vertices.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  if (box.expandByScalar(ON_SURFACE_TOLERANCE).containsPoint(point) === false) return Number.POSITIVE_INFINITY;
  const triangle = new THREE.Triangle();
  const closest = new THREE.Vector3();
  let best = Number.POSITIVE_INFINITY;
  for (const [a, b, c] of mesh.faces) {
    triangle.a.fromArray(mesh.vertices[a]);
    triangle.b.fromArray(mesh.vertices[b]);
    triangle.c.fromArray(mesh.vertices[c]);
    best = Math.min(best, triangle.closestPointToPoint(point, closest).distanceTo(point));
    if (best < 1e-6) break;
  }
  return best;
}

/**
 * The visible body whose surface runs through `point`: the nearest one, a
 * solid before a hole when both are as near. Hidden bodies do not count -
 * nobody could see what the note is on.
 */
export function visibleShapeUnderPoint(candidates: readonly WorkplaneShape[], point: Point): WorkplaneShape | null {
  const target = new THREE.Vector3(point.x, point.y, point.z);
  let found: { shape: WorkplaneShape; distance: number } | null = null;
  for (const shape of candidates) {
    if (shape.hidden) continue;
    const distance = distanceToSurface(shape, target);
    if (distance > ON_SURFACE_TOLERANCE) continue;
    const better = !found
      || distance < found.distance - 1e-6
      || (Math.abs(distance - found.distance) <= 1e-6 && Boolean(found.shape.hole) && !shape.hole);
    if (better) found = { shape, distance };
  }
  return found?.shape ?? null;
}

/**
 * The notes after the bodies went from `previous` to `next`. A note keeps its
 * body while that body is there. When the body goes away, the note goes to
 * the visible body that is new in `next` and lies under it - the parts of a
 * group that was taken apart, the group its body went into - or, with none,
 * stays where it stood, free on the workplane.
 *
 * `held` are the groups open for editing. Opening one hands its notes to the
 * parts under them, so they move with those parts; a note with no part under
 * it stays the group's and keeps its place until the group comes back -
 * `regrouping`, the step that opens, closes or cancels one - when it is
 * pinned to it again where it stands. Outside that step a note pinned to a
 * body that is new (one inserted with it) is left as it is.
 */
export function notesAfterShapeChange(
  notes: WorkplaneNote[],
  previous: readonly WorkplaneShape[],
  next: readonly WorkplaneShape[],
  held: ReadonlySet<string> = new Set(),
  regrouping = false,
): WorkplaneNote[] {
  if (notes.every((note) => !note.anchor)) return notes;
  const before = new Map(previous.map((shape) => [shape.id, shape]));
  const after = new Map(next.map((shape) => [shape.id, shape]));
  const added = next.filter((shape) => !before.has(shape.id));
  let changed = false;
  const result = notes.map((note) => {
    const anchor = note.anchor;
    if (!anchor) return note;
    const was = before.get(anchor.shapeId);
    const now = after.get(anchor.shapeId);
    if ((was || !regrouping) && now) return note;
    if (!was && !now && held.has(anchor.shapeId)) return note;
    const world = was ? noteAnchorWorld(was, anchor.normalized) : { x: note.x, y: note.y, z: note.z };
    changed = true;
    // Back from editing: pinned to it again where the note stands.
    if (now) return { ...note, anchor: { shapeId: now.id, normalized: noteAnchorFromWorld(now, world) } };
    const { anchor: _anchor, ...free } = note;
    const home = visibleShapeUnderPoint(added, world);
    if (home) return { ...free, ...world, anchor: { shapeId: home.id, normalized: noteAnchorFromWorld(home, world) } };
    return held.has(anchor.shapeId) ? { ...note, ...world } : { ...free, ...world };
  });
  return changed ? result : notes;
}

/** The notes pinned to `group`, at the spot it gives them - kept when it is opened, for cancelling. */
export function notesPinnedTo(notes: readonly WorkplaneNote[], group: WorkplaneShape): WorkplaneNote[] {
  return notes.flatMap((note) => (note.anchor?.shapeId === group.id ? [{ ...note, ...noteAnchorWorld(group, note.anchor.normalized) }] : []));
}

/** The notes with those kept by `notesPinnedTo` put back as they were, where they still exist. */
export function notesPutBack(notes: WorkplaneNote[], kept: readonly WorkplaneNote[]): WorkplaneNote[] {
  if (!kept.length) return notes;
  const byId = new Map(kept.map((note) => [note.id, note]));
  return notes.map((note) => byId.get(note.id) ?? note);
}
