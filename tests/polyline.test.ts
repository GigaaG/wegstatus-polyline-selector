import { describe, expect, it } from "vitest";
import {
  buildPolyline,
  formatWegstatusPolyline,
  reversePolyline,
} from "../src/polyline";
import { segment } from "./fixtures";

describe("buildPolyline", () => {
  it("houdt een enkel A-naar-B-segment in de oorspronkelijke richting", () => {
    const result = buildPolyline([
      segment(1, 10, 11, [[4, 52], [4.1, 52.1]], { isAtoB: true, isBtoA: false }),
    ]);

    expect(result).toMatchObject({ ok: true, coordinates: [[4, 52], [4.1, 52.1]] });
  });

  it("draait een enkel B-naar-A-segment om", () => {
    const result = buildPolyline([
      segment(1, 10, 11, [[4, 52], [4.1, 52.1]], { isAtoB: false, isBtoA: true }),
    ]);

    expect(result).toMatchObject({ ok: true, coordinates: [[4.1, 52.1], [4, 52]] });
  });

  it("ordent een ongeordende keten en verwijdert dubbele knooppunten", () => {
    const result = buildPolyline([
      segment(2, 2, 3, [[2, 2], [3, 3]]),
      segment(3, 3, 4, [[3, 3], [4, 4]]),
      segment(1, 1, 2, [[1, 1], [2, 2]]),
    ]);

    expect(result).toEqual({
      ok: true,
      coordinates: [[1, 1], [2, 2], [3, 3], [4, 4]],
      isClosed: false,
    });
  });

  it("kiest de enige ketenrichting die alle eenrichtingssegmenten respecteert", () => {
    const result = buildPolyline([
      segment(2, 2, 3, [[2, 2], [3, 3]], { isAtoB: false, isBtoA: true }),
      segment(1, 1, 2, [[1, 1], [2, 2]], { isAtoB: false, isBtoA: true }),
    ]);

    expect(result).toMatchObject({ ok: true, coordinates: [[3, 3], [2, 2], [1, 1]] });
  });

  it("waarschuwt bij strijdige eenrichtingssegmenten maar houdt de lijn doorlopend", () => {
    const result = buildPolyline([
      segment(1, 1, 2, [[1, 1], [2, 2]], { isAtoB: true, isBtoA: false }),
      segment(2, 2, 3, [[2, 2], [3, 3]], { isAtoB: false, isBtoA: true }),
    ]);

    expect(result).toMatchObject({
      ok: true,
      coordinates: [[1, 1], [2, 2], [3, 3]],
      warning: expect.stringContaining("tegenstrijdige"),
    });
  });

  it("ordent en sluit een lus vanaf het eerst geselecteerde segment", () => {
    const result = buildPolyline([
      segment(2, 2, 3, [[1, 0], [0, 1]]),
      segment(3, 3, 1, [[0, 1], [0, 0]]),
      segment(1, 1, 2, [[0, 0], [1, 0]]),
    ]);

    expect(result).toEqual({
      ok: true,
      coordinates: [[1, 0], [0, 1], [0, 0], [1, 0]],
      isClosed: true,
    });
  });

  it("gebruikt coördinaten als endpoint-sleutel wanneer node-id's ontbreken", () => {
    const result = buildPolyline([
      segment(1, null, null, [[4, 52], [4.1, 52.1]]),
      segment(2, null, null, [[4.1, 52.1], [4.2, 52.2]]),
    ]);

    expect(result).toMatchObject({
      ok: true,
      coordinates: [[4, 52], [4.1, 52.1], [4.2, 52.2]],
    });
  });

  it("sluit een enkel lussegment exact wanneer de gedeelde nodecoördinaten afwijken", () => {
    const result = buildPolyline([
      segment(1, 10, 10, [[4, 52], [4.1, 52.1], [4.000001, 52.000001]]),
    ]);

    expect(result).toEqual({
      ok: true,
      coordinates: [[4, 52], [4.1, 52.1], [4.000001, 52.000001], [4, 52]],
      isClosed: true,
    });
  });

  it("weigert losse delen", () => {
    const result = buildPolyline([
      segment(1, 1, 2, [[1, 1], [2, 2]]),
      segment(2, 3, 4, [[3, 3], [4, 4]]),
    ]);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("losse delen") });
  });

  it("weigert een vertakking", () => {
    const result = buildPolyline([
      segment(1, 1, 2, [[1, 1], [2, 2]]),
      segment(2, 2, 3, [[2, 2], [3, 3]]),
      segment(3, 2, 4, [[2, 2], [4, 4]]),
    ]);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("vertakking") });
  });

  it("weigert een ongeldige LineString", () => {
    const result = buildPolyline([
      segment(1, 1, 2, [], { geometry: { type: "LineString", coordinates: [] } }),
    ]);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("geen geldige") });
  });
});

describe("polyline-output", () => {
  it("formatteert GeoJSON lon/lat als Wegstatus lat/lon met maximaal zes decimalen", () => {
    expect(formatWegstatusPolyline([[4.123456789, 52.987654321], [5, 53]])).toBe(
      "52.987654 4.123457 53 5",
    );
  });

  it("voegt geen nullen toe en normaliseert afgeronde negatieve nul", () => {
    expect(formatWegstatusPolyline([[4.1, -0.0000001], [-5.0000004, 53.12]])).toBe(
      "0 4.1 53.12 -5",
    );
  });

  it("keert de volledige polyline om zonder de invoer te muteren", () => {
    const coordinates = [[1, 2], [3, 4], [5, 6]] as const;
    expect(reversePolyline(coordinates)).toEqual([[5, 6], [3, 4], [1, 2]]);
    expect(coordinates).toEqual([[1, 2], [3, 4], [5, 6]]);
  });
});
