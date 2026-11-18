import { deflateRawSync, deflateSync } from "node:zlib";
import { analyzeFragments, parseDocx, parsePdf } from "./parser.ts";

function put16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 255;
  target[offset + 1] = (value >>> 8) & 255;
}

function put32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 255;
  target[offset + 1] = (value >>> 8) & 255;
  target[offset + 2] = (value >>> 16) & 255;
  target[offset + 3] = (value >>> 24) & 255;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDocx(xml: string) {
  const encoder = new TextEncoder();
  const name = encoder.encode("word/document.xml");
  const data = encoder.encode(xml);
  const compressed = new Uint8Array(deflateRawSync(data));
  const crc = crc32(data);
  const local = new Uint8Array(30 + name.length + compressed.length);
  put32(local, 0, 0x04034b50);put16(local, 4, 20);put16(local, 8, 8);put32(local, 14, crc);
  put32(local, 18, compressed.length);put32(local, 22, data.length);put16(local, 26, name.length);
  local.set(name, 30);local.set(compressed, 30 + name.length);
  const central = new Uint8Array(46 + name.length);
  put32(central, 0, 0x02014b50);put16(central, 4, 20);put16(central, 6, 20);put16(central, 10, 8);
  put32(central, 16, crc);put32(central, 20, compressed.length);put32(central, 24, data.length);put16(central, 28, name.length);
  central.set(name, 46);
  const end = new Uint8Array(22);put32(end, 0, 0x06054b50);put16(end, 8, 1);put16(end, 10, 1);put32(end, 12, central.length);put32(end, 16, local.length);
  const result = new Uint8Array(local.length + central.length + end.length);
  result.set(local);result.set(central, local.length);result.set(end, local.length + central.length);
  return result;
}

Deno.test("DOCX text and paragraph references are extracted", async () => {
  const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Entrega</w:t></w:r></w:p><w:p><w:r><w:t>Se exige una fotograf&#237;a.</w:t></w:r><w:drawing/></w:p></w:body></w:document>';
  const parsed = await parseDocx(zipDocx(xml));
  if (parsed.fragments.length !== 2 || parsed.fragments[1].ref !== "P2") throw new Error("No se preservaron los p\u00e1rrafos");
  if (parsed.fragments[1].text !== "Se exige una fotograf\u00eda.") throw new Error("No se decodificaron entidades XML");
  if (!parsed.imagesDetected) throw new Error("No se detect\u00f3 una imagen incrustada");
});

Deno.test("PDF text extraction reports text without OCR", async () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj << /Length 32 >> stream\nBT (CONAF 1091-42-COT26) Tj ET\nendstream\nendobj\n%%EOF");
  const parsed = await parsePdf(pdf);
  if (!parsed.fragments.some((fragment) => fragment.text.includes("CONAF"))) throw new Error("No se extrajo el texto PDF");
});

Deno.test("PDF Flate text streams are decompressed", async () => {
  const encoder = new TextEncoder();
  const head = encoder.encode("%PDF-1.4\n<< /Filter /FlateDecode >>\nstream\n");
  const payload = new Uint8Array(deflateSync(encoder.encode("BT (Presupuesto IVA incluido) Tj ET")));
  const tail = encoder.encode("\nendstream\n%%EOF");
  const pdf = new Uint8Array(head.length + payload.length + tail.length);
  pdf.set(head);pdf.set(payload, head.length);pdf.set(tail, head.length + payload.length);
  const parsed = await parsePdf(pdf);
  if (!parsed.fragments.some((fragment) => fragment.text.includes("Presupuesto"))) throw new Error("No se descomprimio el texto PDF");
});

Deno.test("weekday contradiction is surfaced without rewriting the source", () => {
  const fragments = [
    { ref: "P3", heading: "Entrega", text: "Entrega martes 25 de noviembre de 2026." },
    { ref: "P4", heading: "Productos", text: "Bloqueador solar, 8 unidades, presentación de 200 ml." },
  ];
  const result = analyzeFragments(fragments, {
    presupuesto: { monto_disponible_clp: 250000 },
    entrega: { fecha_entrega: "2026-11-25" },
    productos_solicitados: [{ nombre: "Bloqueador solar", cantidad: 8 }],
  }, false);
  if (result.calendar_warnings.length !== 1) throw new Error("No se detect\u00f3 el d\u00eda de semana contradictorio");
  const warning = result.calendar_warnings[0];
  if (warning.dia_calculado !== "mi\u00e9rcoles") throw new Error("El d\u00eda calculado no coincide");
  const source = warning.source as { text: string };
  if (source.text !== "Entrega martes 25 de noviembre de 2026.") throw new Error("Se alter\u00f3 el texto original");
  if (!result.api_comparisons.some((row) => row.campo === "fecha_api:entrega.fecha_entrega")) throw new Error("No se contrast\u00f3 la fecha de entrega de la API");
  const product = result.api_comparisons.find((row) => String(row.campo).startsWith("producto_"));
  if (product?.estado !== "posible_coincidencia_revisar_presentacion_y_cantidad") throw new Error("La coincidencia de producto no qued\u00f3 pendiente de revisi\u00f3n");
});
