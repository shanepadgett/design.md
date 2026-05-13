import type { LegacyMap, LegacyValue } from "./types.js";

export function serializeTokenYaml(map: LegacyMap): string {
  return serializeEntries(map.entries, 0);
}

function serializeEntries(entries: LegacyMap["entries"], indent: number): string {
  const lines: string[] = [];

  for (const entry of entries) {
    const prefix = `${" ".repeat(indent)}${serializeKey(entry.key)}:`;

    if (isMap(entry.value)) {
      lines.push(prefix);
      lines.push(serializeEntries(entry.value.entries, indent + 2));
    } else {
      lines.push(`${prefix} ${serializeScalar(entry.value)}`);
    }
  }

  return lines.filter((line) => line.length > 0).join("\n");
}

function serializeKey(key: string): string {
  if (/^-?\d+(?:\.\d+)?$/.test(key) || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
    return `"${escapeString(key)}"`;
  }

  return key;
}

function serializeScalar(value: Exclude<LegacyValue, LegacyMap>): string {
  if (typeof value === "number") {
    return String(value);
  }

  return `"${escapeString(value)}"`;
}

function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isMap(value: LegacyValue): value is LegacyMap {
  return typeof value !== "string" && typeof value !== "number";
}
