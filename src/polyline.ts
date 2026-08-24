import type { LineString, Position } from "geojson";

export type Coordinate = readonly [longitude: number, latitude: number];

export interface SegmentInput {
  id: number;
  fromNodeId: number | null;
  toNodeId: number | null;
  isAtoB: boolean;
  isBtoA: boolean;
  geometry: LineString;
}

export interface PolylineSuccess {
  ok: true;
  coordinates: Coordinate[];
  isClosed: boolean;
  warning?: string;
}

export interface PolylineFailure {
  ok: false;
  error: string;
}

export type PolylineResult = PolylineSuccess | PolylineFailure;

interface Edge {
  segment: SegmentInput;
  startKey: string;
  endKey: string;
  coordinates: Coordinate[];
}

interface OrderedEdge {
  edge: Edge;
  forward: boolean;
}

interface Traversal {
  steps: OrderedEdge[];
  respectsOneWays: boolean;
}

const CONFLICTING_DIRECTIONS_WARNING =
  "De selectie bevat tegenstrijdige eenrichtingssegmenten. Controleer de richting.";

export function buildPolyline(segments: readonly SegmentInput[]): PolylineResult {
  if (segments.length === 0) {
    return failure("Selecteer minimaal één segment.");
  }

  const seenIds = new Set<number>();
  const edges: Edge[] = [];

  for (const segment of segments) {
    if (seenIds.has(segment.id)) {
      return failure(`Segment ${segment.id} komt meer dan één keer voor.`);
    }
    seenIds.add(segment.id);

    const coordinates = validateCoordinates(segment);
    if (!coordinates) {
      return failure(`Segment ${segment.id} heeft geen geldige LineString-geometrie.`);
    }

    edges.push({
      segment,
      startKey: endpointKey(segment.fromNodeId, coordinates[0]!),
      endKey: endpointKey(segment.toNodeId, coordinates.at(-1)!),
      coordinates,
    });
  }

  if (edges.length === 1) {
    return buildSingleSegment(edges[0]!);
  }

  const adjacency = buildAdjacency(edges);
  const degreeOneNodes: string[] = [];

  for (const [nodeKey, connectedEdges] of adjacency) {
    if (connectedEdges.length > 2) {
      return failure("De selectie bevat een vertakking en kan niet één polyline vormen.");
    }
    if (connectedEdges.length === 1) {
      degreeOneNodes.push(nodeKey);
    }
  }

  if (!isConnected(edges, adjacency)) {
    return failure("De geselecteerde segmenten vormen meerdere losse delen.");
  }

  const isClosed = degreeOneNodes.length === 0;
  if (!isClosed && degreeOneNodes.length !== 2) {
    return failure("De geselecteerde segmenten vormen geen doorlopende keten of gesloten lus.");
  }

  const candidates = isClosed
    ? buildCycleCandidates(edges, adjacency)
    : degreeOneNodes.map((nodeKey) => traverse(edges, adjacency, nodeKey));

  if (candidates.some((candidate) => candidate === null)) {
    return failure("De geselecteerde segmenten konden niet doorlopend worden geordend.");
  }

  const traversals = candidates as Traversal[];
  const selected = chooseTraversal(traversals, edges[0]!);
  const coordinates = concatenateCoordinates(selected.steps, isClosed);
  const hasOneWayConflict = !traversals.some((candidate) => candidate.respectsOneWays);

  return {
    ok: true,
    coordinates,
    isClosed,
    ...(hasOneWayConflict ? { warning: CONFLICTING_DIRECTIONS_WARNING } : {}),
  };
}

export function reversePolyline(coordinates: readonly Coordinate[]): Coordinate[] {
  return [...coordinates].reverse().map(([longitude, latitude]) => [longitude, latitude]);
}

function formatCoordinate(value: number): string {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function formatWegstatusPolyline(coordinates: readonly Coordinate[]): string {
  return coordinates
    .flatMap(([longitude, latitude]) => [formatCoordinate(latitude), formatCoordinate(longitude)])
    .join(" ");
}

function buildSingleSegment(edge: Edge): PolylineSuccess {
  const preferReverse = edge.segment.isBtoA && !edge.segment.isAtoB;
  const coordinates: Coordinate[] = preferReverse
    ? reversePolyline(edge.coordinates)
    : edge.coordinates.map(([longitude, latitude]) => [longitude, latitude] as Coordinate);
  const isClosed = edge.startKey === edge.endKey || coordinateEquals(coordinates[0]!, coordinates.at(-1)!);

  if (isClosed && !coordinateEquals(coordinates[0]!, coordinates.at(-1)!)) {
    coordinates.push([coordinates[0]![0], coordinates[0]![1]]);
  }

  return {
    ok: true,
    coordinates,
    isClosed,
  };
}

function validateCoordinates(segment: SegmentInput): Coordinate[] | null {
  if (segment.geometry.type !== "LineString" || segment.geometry.coordinates.length < 2) {
    return null;
  }

  const coordinates: Coordinate[] = [];
  for (const position of segment.geometry.coordinates) {
    if (!isCoordinate(position)) {
      return null;
    }
    coordinates.push([position[0], position[1]]);
  }
  return coordinates;
}

function isCoordinate(position: Position): position is [number, number, ...number[]] {
  return (
    position.length >= 2 &&
    typeof position[0] === "number" &&
    Number.isFinite(position[0]) &&
    typeof position[1] === "number" &&
    Number.isFinite(position[1])
  );
}

function endpointKey(nodeId: number | null, coordinate: Coordinate): string {
  return nodeId === null
    ? `coordinate:${coordinate[0]},${coordinate[1]}`
    : `node:${nodeId}`;
}

function buildAdjacency(edges: readonly Edge[]): Map<string, number[]> {
  const adjacency = new Map<string, number[]>();
  edges.forEach((edge, edgeIndex) => {
    addAdjacentEdge(adjacency, edge.startKey, edgeIndex);
    addAdjacentEdge(adjacency, edge.endKey, edgeIndex);
  });
  return adjacency;
}

function addAdjacentEdge(adjacency: Map<string, number[]>, key: string, edgeIndex: number): void {
  const connectedEdges = adjacency.get(key) ?? [];
  connectedEdges.push(edgeIndex);
  adjacency.set(key, connectedEdges);
}

function isConnected(edges: readonly Edge[], adjacency: ReadonlyMap<string, readonly number[]>): boolean {
  const visited = new Set<number>();
  const pending = [0];

  while (pending.length > 0) {
    const edgeIndex = pending.pop()!;
    if (visited.has(edgeIndex)) {
      continue;
    }
    visited.add(edgeIndex);
    const edge = edges[edgeIndex]!;
    for (const nodeKey of [edge.startKey, edge.endKey]) {
      for (const adjacentEdge of adjacency.get(nodeKey) ?? []) {
        if (!visited.has(adjacentEdge)) {
          pending.push(adjacentEdge);
        }
      }
    }
  }

  return visited.size === edges.length;
}

function buildCycleCandidates(
  edges: readonly Edge[],
  adjacency: ReadonlyMap<string, readonly number[]>,
): Array<Traversal | null> {
  const anchor = edges[0]!;
  if (anchor.startKey === anchor.endKey) {
    const forward = traverse(edges, adjacency, anchor.startKey, 0);
    if (!forward) {
      return [null];
    }
    return [forward, reverseTraversal(forward)];
  }

  return [
    traverse(edges, adjacency, anchor.startKey, 0),
    traverse(edges, adjacency, anchor.endKey, 0),
  ];
}

function traverse(
  edges: readonly Edge[],
  adjacency: ReadonlyMap<string, readonly number[]>,
  startKey: string,
  forcedFirstEdge?: number,
): Traversal | null {
  const usedEdges = new Set<number>();
  const steps: OrderedEdge[] = [];
  let currentKey = startKey;

  while (steps.length < edges.length) {
    const candidates = (adjacency.get(currentKey) ?? []).filter(
      (edgeIndex) => !usedEdges.has(edgeIndex),
    );
    const edgeIndex = steps.length === 0 && forcedFirstEdge !== undefined
      ? candidates.includes(forcedFirstEdge) ? forcedFirstEdge : undefined
      : candidates[0];

    if (edgeIndex === undefined) {
      return null;
    }

    const edge = edges[edgeIndex]!;
    const forward = edge.startKey === currentKey;
    steps.push({ edge, forward });
    usedEdges.add(edgeIndex);
    currentKey = forward ? edge.endKey : edge.startKey;
  }

  if (usedEdges.size !== edges.length) {
    return null;
  }

  return {
    steps,
    respectsOneWays: steps.every(respectsOneWayDirection),
  };
}

function reverseTraversal(traversal: Traversal): Traversal {
  const steps = [...traversal.steps]
    .reverse()
    .map(({ edge, forward }) => ({ edge, forward: !forward }));
  return {
    steps,
    respectsOneWays: steps.every(respectsOneWayDirection),
  };
}

function chooseTraversal(candidates: readonly Traversal[], anchor: Edge): Traversal {
  const respectingCandidates = candidates.filter((candidate) => candidate.respectsOneWays);
  if (respectingCandidates.length === 1) {
    return respectingCandidates[0]!;
  }

  const anchorPreferredForward = !(anchor.segment.isBtoA && !anchor.segment.isAtoB);
  const pool = respectingCandidates.length > 0 ? respectingCandidates : candidates;
  return pool.find((candidate) => {
    const anchorStep = candidate.steps.find(({ edge }) => edge.segment.id === anchor.segment.id);
    return anchorStep?.forward === anchorPreferredForward;
  }) ?? pool[0]!;
}

function respectsOneWayDirection({ edge, forward }: OrderedEdge): boolean {
  if (edge.segment.isAtoB && !edge.segment.isBtoA) {
    return forward;
  }
  if (edge.segment.isBtoA && !edge.segment.isAtoB) {
    return !forward;
  }
  return true;
}

function concatenateCoordinates(steps: readonly OrderedEdge[], isClosed: boolean): Coordinate[] {
  const coordinates: Coordinate[] = [];

  steps.forEach(({ edge, forward }, index) => {
    const orientedCoordinates = forward ? edge.coordinates : reversePolyline(edge.coordinates);
    const coordinatesToAdd = index === 0 ? orientedCoordinates : orientedCoordinates.slice(1);
    coordinates.push(
      ...coordinatesToAdd.map(
        ([longitude, latitude]) => [longitude, latitude] as Coordinate,
      ),
    );
  });

  if (isClosed) {
    const first = coordinates[0]!;
    while (
      coordinates.length > 2 &&
      coordinateEquals(coordinates.at(-1)!, first) &&
      coordinateEquals(coordinates.at(-2)!, first)
    ) {
      coordinates.pop();
    }
    if (!coordinateEquals(coordinates.at(-1)!, first)) {
      coordinates.push([first[0], first[1]]);
    }
  }

  return coordinates;
}

function coordinateEquals(left: Coordinate, right: Coordinate): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function failure(error: string): PolylineFailure {
  return { ok: false, error };
}
