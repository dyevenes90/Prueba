import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { assertDistinctOutput, buildFixtureFromApiBody, shouldWriteFixture, validateFixture } from "./ops_compra_agil_fixture.mjs";

const fixturePath = resolve("supabase/tests/fixtures/compra-agil-real-page.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

test("lee y valida el fixture saneado real sin pedir límites externos", () => {
  const checked = validateFixture(fixture);
  assert.equal(checked.regionId, 9);
  assert.equal(checked.page, 1);
  assert.equal(checked.totalPages, 175);
  assert.equal(checked.items.length, 10);
  assert.equal(new Set(checked.items.map((item) => item.codigo)).size, 10);
  assert.equal(shouldWriteFixture({ reuseFixtureOffline: true, explicitOutput: false }), false);
});

test("rechaza campos que no pertenecen a la lista pública y preserva el archivo de entrada", async () => {
  const before = await readFile(fixturePath);
  const invalid = structuredClone(fixture);
  invalid.items[0].descripcion = "debe rechazarse";
  assert.throws(() => validateFixture(invalid), /campo no permitido/);
  assert.deepEqual(await readFile(fixturePath), before);
});

test("reutiliza modo offline sin ticket y prohíbe apuntar la salida al mismo fixture", () => {
  assert.equal(shouldWriteFixture({ reuseFixtureOffline: true, explicitOutput: false }), false);
  assert.throws(() => assertDistinctOutput(fixturePath, fixturePath), /no puede sobrescribir/);
  assert.equal(shouldWriteFixture({ reuseFixtureOffline: true, explicitOutput: true }), true);
});

test("mantiene compatibilidad con respuestas originales de la API y las sanea", () => {
  const raw = {
    payload: {
      paginacion: { total_paginas: 3 },
      items: [{
        ...fixture.items[0],
        descripcion: "se excluye",
        comprador: { correo: "privado@example.invalid" },
      }],
    },
  };
  const clean = buildFixtureFromApiBody(raw, {
    regionId: 9,
    page: 1,
    pageSize: 10,
    windowFrom: fixture.windowFrom,
    windowTo: fixture.windowTo,
    capturedAt: fixture.capturedAt,
  });
  assert.equal(clean.totalPages, 3);
  assert.equal(clean.items[0].codigo, fixture.items[0].codigo);
  assert.equal("descripcion" in clean.items[0], false);
  assert.equal("comprador" in clean.items[0], false);
});
