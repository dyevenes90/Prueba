export type SourceFragment = {
  ref: string;
  heading: string | null;
  text: string;
};

export type ExtractedRequirement = {
  category: string;
  classification: "obligatorio" | "informativo" | "por_confirmar";
  text: string;
  source: SourceFragment;
};

const maxExpandedBytes = 5 * 1024 * 1024;

async function inflateBytes(bytes: Uint8Array, format: "deflate" | "deflate-raw") {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(
    new DecompressionStream(format as CompressionFormat),
  );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxExpandedBytes) {
      await reader.cancel();
      throw new Error("El contenido del documento supera el l\u00edmite de an\u00e1lisis.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function findSignature(bytes: Uint8Array, signature: number, from: number, to: number) {
  for (let i = from; i <= to - 4; i++) if (u32(bytes, i) === signature) return i;
  return -1;
}

async function zipEntry(bytes: Uint8Array, wanted: string): Promise<Uint8Array> {
  const eocd = findSignature(bytes, 0x06054b50, Math.max(0, bytes.length - 65_557), bytes.length);
  if (eocd < 0) throw new Error("El DOCX no contiene un directorio ZIP v\u00e1lido.");
  const entries = u16(bytes, eocd + 10);
  const centralOffset = u32(bytes, eocd + 16);
  let cursor = centralOffset;
  for (let index = 0; index < entries; index++) {
    if (u32(bytes, cursor) !== 0x02014b50) throw new Error("Directorio DOCX inv\u00e1lido.");
    const method = u16(bytes, cursor + 10);
    const compressedSize = u32(bytes, cursor + 20);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const localOffset = u32(bytes, cursor + 42);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name === wanted) {
      if (u32(bytes, localOffset) !== 0x04034b50) throw new Error("Entrada DOCX inv\u00e1lida.");
      if (compressedSize > maxExpandedBytes) throw new Error("El contenido DOCX supera el l\u00edmite de an\u00e1lisis.");
      const dataOffset = localOffset + 30 + u16(bytes, localOffset + 26) + u16(bytes, localOffset + 28);
      const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
      let result: Uint8Array;
      if (method === 0) result = compressed.slice();
      else if (method === 8) {
        try {
          result = await inflateBytes(compressed, "deflate-raw");
        } catch {
          throw new Error("No se pudo descomprimir el texto DOCX.");
        }
      } else throw new Error("El m\u00e9todo de compresi\u00f3n DOCX no es compatible.");
      if (result.byteLength > maxExpandedBytes) throw new Error("El contenido DOCX supera el l\u00edmite de an\u00e1lisis.");
      return result;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("El documento no contiene texto Word principal.");
}

function xmlText(value: string): string {
  return value.replace(/&#x([\da-f]+);/gi, (_all, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_all, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export function parseDocx(bytes: Uint8Array): Promise<{ fragments: SourceFragment[]; imagesDetected: boolean }> {
  return zipEntry(bytes, "word/document.xml").then((xmlBytes) => {
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(xmlBytes);
    const fragments: SourceFragment[] = [];
    const paragraphs = xml.matchAll(/<w:p(?=\s|>)[^>]*>([\s\S]*?)<\/w:p>/g);
    for (const [index, match] of Array.from(paragraphs).entries()) {
      const body = match[1];
      const style = body.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i)?.[1] ?? null;
      const text = body.replace(/<w:tab\b[^>]*\/?\s*>/g, "\t")
        .replace(/<w:br\b[^>]*\/?\s*>/g, " ")
        .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, (_all, value: string) => xmlText(value))
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) fragments.push({ ref: `P${index + 1}`, heading: style, text: text.slice(0, 3_000) });
    }
    if (!fragments.length) throw new Error("El DOCX no contiene texto extra\u00edble.");
    return { fragments, imagesDetected: /<w:drawing\b|<w:pict\b|<a:blip\b/i.test(xml) };
  });
}

function decodePdfLiteral(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    let code = value.charCodeAt(i);
    if (code === 92 && i + 1 < value.length) {
      const next = value[++i];
      const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
      if (next in escapes) code = escapes[next];
      else if (/[0-7]/.test(next)) {
        let octal = next;
        while (i + 1 < value.length && octal.length < 3 && /[0-7]/.test(value[i + 1])) octal += value[++i];
        code = parseInt(octal, 8);
      } else if (next === "\r" || next === "\n") continue;
      else code = next.charCodeAt(0);
    }
    bytes.push(code & 0xff);
  }
  const data = new Uint8Array(bytes);
  if (data[0] === 0xfe && data[1] === 0xff) {
    const units: number[] = [];
    for (let i = 2; i + 1 < data.length; i += 2) units.push((data[i] << 8) | data[i + 1]);
    return String.fromCharCode(...units);
  }
  return new TextDecoder("windows-1252").decode(data);
}

function readPdfStrings(text: string): string[] {
  const output: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") {
      let depth = 1, start = ++i, escaped = false;
      for (; i < text.length && depth; i++) {
        const c = text[i];
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === "(") depth++;
        else if (c === ")") depth--;
      }
      if (!depth) output.push(decodePdfLiteral(text.slice(start, i - 1)));
      i--;
    } else if (text[i] === "<" && text[i + 1] !== "<") {
      const end = text.indexOf(">", i + 1);
      if (end > i) {
        const hex = text.slice(i + 1, end).replace(/\s/g, "");
        if (/^[\da-f]*$/i.test(hex)) {
          const bytes = new Uint8Array(Math.ceil(hex.length / 2));
          for (let j = 0; j < bytes.length; j++) bytes[j] = parseInt(hex.slice(j * 2, j * 2 + 2).padEnd(2, "0"), 16);
          output.push(bytes[0] === 0xfe && bytes[1] === 0xff
            ? String.fromCharCode(...Array.from({ length: Math.floor((bytes.length - 2) / 2) }, (_, j) => (bytes[2 + j * 2] << 8) | bytes[3 + j * 2]))
            : new TextDecoder("windows-1252").decode(bytes));
        }
        i = end;
      }
    }
  }
  return output;
}

async function streamText(bytes: Uint8Array): Promise<string> {
  let output = "";
  let expandedTotal = 0;
  const marker = new TextEncoder().encode("stream");
  let cursor = 0;
  while (cursor < bytes.length) {
    let start = -1;
    for (let i = cursor; i <= bytes.length - marker.length; i++) {
      if (marker.every((byte, j) => bytes[i + j] === byte)) { start = i; break; }
    }
    if (start < 0) break;
    let dataStart = start + marker.length;
    if (bytes[dataStart] === 13 && bytes[dataStart + 1] === 10) dataStart += 2;
    else if (bytes[dataStart] === 10 || bytes[dataStart] === 13) dataStart++;
    let end = -1;
    for (let i = dataStart; i <= bytes.length - 9; i++) {
      if (bytes[i] === 101 && bytes[i + 1] === 110 && bytes[i + 2] === 100 && bytes[i + 3] === 115 && bytes[i + 4] === 116 && bytes[i + 5] === 114 && bytes[i + 6] === 101 && bytes[i + 7] === 97 && bytes[i + 8] === 109) { end = i; break; }
    }
    if (end < 0) break;
    let payload = bytes.subarray(dataStart, end);
    if (payload[payload.length - 1] === 10) payload = payload.subarray(0, payload.length - 1);
    if (payload[payload.length - 1] === 13) payload = payload.subarray(0, payload.length - 1);
    const dictionary = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0, start - 600), start));
    if (/\/FlateDecode\b/.test(dictionary)) {
      try { payload = await inflateBytes(payload, "deflate"); expandedTotal += payload.byteLength; if (expandedTotal > maxExpandedBytes) break; }
      catch { cursor = end + 9; continue; }
    } else if (/\/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)\b/.test(dictionary)) {
      cursor = end + 9; continue;
    }
    const content = new TextDecoder("latin1").decode(payload);
    for (const textObject of content.matchAll(/\bBT\b([\s\S]*?)\bET\b/g)) {
      output += readPdfStrings(textObject[1]).join("") + "\n";
      if (output.length >= 500_000) break;
    }
    cursor = end + 9;
    if (output.length >= 500_000) break;
  }
  return output.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]+/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function parsePdf(bytes: Uint8Array): Promise<{ fragments: SourceFragment[]; imagesDetected: boolean }> {
  if (new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("El archivo no tiene una cabecera PDF v\u00e1lida.");
  const text = await streamText(bytes);
  if (!text) throw new Error("No se pudo extraer texto PDF. Puede contener solo im\u00e1genes o una codificaci\u00f3n no compatible; no se aplic\u00f3 OCR.");
  const fragments = text.split(/\n+/).map((line, index) => line.trim()).filter(Boolean)
    .map((line, index) => ({ ref: `Fragmento ${index + 1} (p\u00e1gina no verificable)`, heading: null, text: line.slice(0, 3_000) }));
  return { fragments, imagesDetected: /\/Subtype\s*\/Image\b/.test(new TextDecoder("latin1").decode(bytes)) };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
}

const categories: [RegExp, string][] = [
  [/foto|fotograf|imagen/, "documentos_y_fotografias"],
  [/factur|tribut|impuesto|iva/, "facturacion"],
  [/orden de compra|aceptar.{0,20}orden/, "orden_de_compra"],
  [/adjudic|evalu|menor precio|criterio/, "adjudicacion"],
  [/presupuesto|monto disponible|precio maximo/, "economico"],
  [/entrega|despacho|plazo|fecha/, "entrega_y_fechas"],
  [/parcial|linea|partida/, "oferta_parcial"],
  [/deber|obligator|requisit|exig|cumpl/, "requisito_tecnico"],
];

export function analyzeFragments(
  fragments: SourceFragment[], apiDetail: Record<string, unknown> | null,
  imagesDetected: boolean,
) {
  let currentHeading = "Documento";
  for (const fragment of fragments) {
    if (fragment.heading && /title|heading|titulo/i.test(normalize(fragment.heading))) currentHeading = fragment.text;
    if (!fragment.heading) fragment.heading = currentHeading;
  }
  const requirements: ExtractedRequirement[] = [];
  for (const fragment of fragments) for (const [pattern, category] of categories) {
    if (pattern.test(normalize(fragment.text))) {
      requirements.push({
        category,
        classification: /deber|obligator|exig|requerid/i.test(normalize(fragment.text))
          ? "obligatorio"
          : /menor precio|evaluacion|presupuesto|criterio|descripcion informativa/i.test(normalize(fragment.text))
          ? "informativo"
          : "por_confirmar",
        text: fragment.text,
        source: fragment,
      });
      break;
    }
  }
  const allText = fragments.map((fragment) => fragment.text).join("\n");
  const api = apiDetail ?? {};
  const apiBudget = getPath(api, ["presupuesto", "monto_disponible_clp"]) ?? getPath(api, ["presupuesto", "presupuesto_estimado"]);
  const apiDate = getPath(api, ["fechas", "fecha_cierre"]);
  const apiDeliveryDates = collectNamedFields(api, /fecha.*(?:entrega|recepcion)|(?:entrega|recepcion).*fecha|plazo.*fecha/i);
  const comparisons: Record<string, unknown>[] = [];
  const findDate = (context: RegExp) => fragments.find((fragment) => context.test(normalize(fragment.text)) && /\b\d{1,2}\s+de\s+\w+/i.test(fragment.text));
  const closingSource = findDate(/cierre|recepcion de ofertas|vencimiento/);
  const deliverySource = findDate(/entrega|despacho|plazo/);
  if (apiBudget != null) comparisons.push({ campo: "presupuesto", fuente_api: apiBudget, resultado_documento: allText.match(/(?:presupuesto|monto)[^\n$]{0,55}\$?\s?[\d.,]+[^\n]{0,30}/i)?.[0] ?? "No detectado", estado: "requiere_revision_manual" });
  if (apiDate) comparisons.push({ campo: "fecha_de_cierre", fuente_api: apiDate, resultado_documento: closingSource?.text ?? "No se localizo fecha en fragmento de cierre", fuente: closingSource?.ref ?? null, estado: "requiere_revision" });
  for (const field of apiDeliveryDates) comparisons.push({ campo: `fecha_api:${field.path}`, fuente_api: field.value, resultado_documento: deliverySource?.text ?? "No se localizo fecha en fragmento de entrega", fuente: deliverySource?.ref ?? null, estado: "requiere_revision" });
  const products = Array.isArray(api.productos_solicitados) ? api.productos_solicitados : [];
  for (const [index, product] of products.entries()) {
    if (!product || typeof product !== "object") continue;
    const row = product as Record<string, unknown>;
    const name = typeof row.nombre === "string" ? row.nombre : "";
    const norm = normalize(name);
    const tokens = norm.split(" ").filter((token) => token.length > 3);
    const source = fragments.find((fragment) => tokens.length && tokens.filter((token) => normalize(fragment.text).includes(token)).length >= Math.max(1, Math.ceil(tokens.length * 0.6)));
    comparisons.push({ campo: `producto_${index + 1}`, producto_api: row.nombre ?? null, cantidad_api: row.cantidad ?? null, fuente_anexo: source?.ref ?? "No localizado textualmente", evidencia: source?.text ?? null, estado: source ? "posible_coincidencia_revisar_presentacion_y_cantidad" : "no_localizado_en_anexo" });
  }
  const calendarWarnings: Record<string, unknown>[] = [];
  for (const fragment of fragments) {
    const match = normalize(fragment.text).match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de)?\s+(20\d{2})/i);
    if (!match) continue;
    const weekdays = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const months: Record<string, number> = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
    const expected = weekdays[new Date(Date.UTC(Number(match[4]), months[normalize(match[3])], Number(match[2]))).getUTCDay()];
    const stated = normalize(match[1]);
    if (expected !== stated) {
      const expectedLabel = expected === "miercoles" ? "mi\u00e9rcoles" : expected === "sabado" ? "s\u00e1bado" : expected;
      calendarWarnings.push({ estado: "contradiccion_fecha_dia", informado: fragment.text, dia_calculado: expectedLabel, fecha: `${match[4]}-${String(months[normalize(match[3])] + 1).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`, source: fragment, mensaje: `El documento indica que la entrega es ${match[1]} ${match[2]} de ${match[3]} de ${match[4]}, pero esa fecha corresponde a ${expectedLabel}. Se conserva el texto original; confirmar con la entidad.` });
    }
  }
  const first = fragments[0];
  const budgetMention = allText.match(/(?:presupuesto|monto disponible)[^\n]{0,50}/i)?.[0] ?? null;
  const itemExtract = (pattern: RegExp) => fragments.filter((fragment) => pattern.test(normalize(fragment.text))).map((source) => ({ texto: source.text, source }));
  const productMentions = itemExtract(/producto|cantidad|unidad|presentacion/).map((mention) => ({
    texto: mention.texto,
    cantidades_detectadas: mention.texto.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [],
    presentaciones_mencionadas: mention.texto.match(/\b(?:caja|pack|paquete|unidad|unidades|litro|litros|ml|kg|gramos|rollo|rollos|par|pares)\b[^,;.]*/gi) ?? [],
    source: mention.source,
  }));
  const inadmissibilityAlerts = fragments.filter((fragment) => /inadmisible|sera rechazada|no seran evaluadas|motivo de inadmisibilidad/i.test(normalize(fragment.text))).map((source) => ({ fundamento_explicito: source.text, source, requiere_revision: true }));
  return {
    version: 1,
    extraction_mode: "text_only_no_ocr",
    identification: { codigo_oportunidad: null, descripcion: first?.text ?? null, source: first ?? null },
    document_summary: {
      paragraph_count: fragments.length,
      images_detected: imagesDetected,
      warning: imagesDetected ? "Se detectaron im\u00e1genes; su contenido no fue le\u00eddo ni inferido." : null,
    },
    products_from_api: products,
    requirements,
    facts: {
      products: productMentions,
      technical_requirements: itemExtract(/deber|obligator|requisit|especificacion|caracteristica/),
      documents_and_photos: itemExtract(/documento|anexo|foto|fotograf|imagen/),
      dates_and_delivery: itemExtract(/fecha|plazo|entrega|despacho|martes|miercoles/),
      place: itemExtract(/direccion|lugar|comuna|region/),
      economic_terms: itemExtract(/presupuesto|precio|iva|impuesto|gasto|oferta economica/),
      award_criteria: itemExtract(/adjudic|menor precio|evaluacion|criterio/),
      invoicing: itemExtract(/factura|facturacion|electronica|tribut/),
      post_award: itemExtract(/orden de compra|aceptar|adjudicatario|posterior/),
      partial_offers: itemExtract(/parcial|linea|partida/),
    },
    budget_mention: budgetMention,
    api_comparisons: comparisons,
    inadmissibility_alerts: inadmissibilityAlerts,
    calendar_warnings: calendarWarnings,
    checklist: requirements.map((requirement, index) => ({
      key: `anexo-${index + 1}`,
      requirement: requirement.text,
      source: requirement.source,
      classification: requirement.classification,
      status: "pendiente",
      evidence: "",
      observations: "",
    })),
    limitations: ["La extracci\u00f3n propone hechos textuales; el usuario debe contrastarlos con el documento original.", "No se reconocen fotograf\u00edas ni texto dentro de im\u00e1genes.", "La extracci\u00f3n PDF no resuelve todos los mapas de fuentes; puede omitir o alterar caracteres y requiere contraste con el original.", "No se marca cumplimiento, equivalencia ni admisibilidad por inferencia."],
  };
}

function getPath(value: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? null;
}

function collectNamedFields(value: unknown, pattern: RegExp, path: string[] = []): { path: string; value: unknown }[] {
  if (!value || typeof value !== "object") return [];
  const found: { path: string; value: unknown }[] = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    if (pattern.test(key) && (typeof child === "string" || typeof child === "number")) found.push({ path: childPath.join("."), value: child });
    else found.push(...collectNamedFields(child, pattern, childPath));
  }
  return found.slice(0, 20);
}

export async function parseAndAnalyzeDocument(
  bytes: Uint8Array, mime: string, apiDetail: Record<string, unknown> | null,
) {
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const parsed = await parseDocx(bytes);
    return analyzeFragments(parsed.fragments, apiDetail, parsed.imagesDetected);
  }
  if (mime === "application/pdf") {
    const parsed = await parsePdf(bytes);
    return analyzeFragments(parsed.fragments, apiDetail, parsed.imagesDetected);
  }
  throw new Error("Por ahora se admiten documentos DOCX y PDF con texto extra\u00edble.");
}
