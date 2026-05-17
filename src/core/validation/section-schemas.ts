import type { Diagnostic } from "../diagnostics/types.js";
import type { ParsedSectionToken } from "../sections/tokens.js";
import type { TokenMap, TokenMapEntry, TokenNode, TokenScalar } from "../token-yaml/types.js";

const componentProperties = new Set([
  "backgroundColor",
  "textColor",
  "borderColor",
  "typography",
  "radius",
  "borderWidth",
  "borderStyle",
  "padding",
  "gap",
  "height",
  "width",
  "minHeight",
  "minWidth",
  "shadow",
  "zIndex",
  "transitionDuration",
  "transitionEasing",
]);

const textStyleFields = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "fontFeature",
  "fontVariation",
] as const;

const typographyRootFields = [
  "fontFamily",
  "baseFontSize",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "measure",
  "text",
] as const;

export function validateSectionSchemas(sectionTokens: readonly ParsedSectionToken[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const sectionToken of sectionTokens) {
    validateKeyStyles(sectionToken, diagnostics);

    switch (sectionToken.definition.group) {
      case "metadata":
        validateMetadata(sectionToken, diagnostics);
        break;
      case "colors":
        validateColors(sectionToken, diagnostics);
        break;
      case "typography":
        validateTypography(sectionToken, diagnostics);
        break;
      case "layout":
        validateLayout(sectionToken, diagnostics);
        break;
      case "elevation":
        validateElevation(sectionToken, diagnostics);
        break;
      case "shapes":
        validateShapes(sectionToken, diagnostics);
        break;
      case "components":
        validateComponents(sectionToken, diagnostics);
        break;
      case "iconography":
        validateIconography(sectionToken, diagnostics);
        break;
      case "motion":
        validateMotion(sectionToken, diagnostics);
        break;
      case undefined:
        break;
    }
  }

  return diagnostics;
}

function validateMetadata(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  warnUnknownKeys(sectionToken, diagnostics, ["themes", "defaultTheme"]);
}

function validateColors(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  const root = sectionToken.parsed.root;
  if (countScalarLeaves(root) === 0) {
    addError(
      sectionToken,
      diagnostics,
      "token-minimum",
      "Colors must define at least one color token.",
      root,
    );
  }

  validateLeaves(sectionToken, diagnostics, root, [], (scalar, path) => {
    if (scalar.valueType !== "string" || !isColorOrReference(String(scalar.value))) {
      addError(
        sectionToken,
        diagnostics,
        "invalid-color",
        `${path} must be a supported color string or token reference.`,
        scalar,
        path,
      );
    }
  });

  warnMissingAnchors(sectionToken, diagnostics, root, ["primary", "surface", "on-surface"]);
}

function validateTypography(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  const root = sectionToken.parsed.root;
  warnUnknownKeys(sectionToken, diagnostics, typographyRootFields);

  const baseFontSize = requireEntry(sectionToken, diagnostics, root, "baseFontSize");
  if (baseFontSize !== undefined) {
    validateDimensionScalar(sectionToken, diagnostics, baseFontSize.value, ["baseFontSize"]);
  }

  const text = requireEntry(sectionToken, diagnostics, root, "text");
  if (text !== undefined) {
    if (text.value.kind !== "map") {
      addError(
        sectionToken,
        diagnostics,
        "invalid-value-type",
        "Typography.text must be a map.",
        text.value,
        "Typography.text",
      );
    } else if (text.value.entries.length === 0) {
      addError(
        sectionToken,
        diagnostics,
        "token-minimum",
        "Typography.text must contain at least one text style.",
        text.value,
        "Typography.text",
      );
    } else {
      validateTextStyles(sectionToken, diagnostics, text.value);
    }
  }

  const fontFamily = findEntry(root, "fontFamily");
  const fontFamilyMap = validateMapEntry(
    sectionToken,
    diagnostics,
    fontFamily,
    "Typography.fontFamily",
  );
  if (fontFamilyMap !== undefined) {
    validateLeaves(sectionToken, diagnostics, fontFamilyMap, ["fontFamily"], (scalar, path) => {
      if (scalar.valueType !== "string") {
        addError(
          sectionToken,
          diagnostics,
          "invalid-value-type",
          `${path} must be a string or token reference.`,
          scalar,
          path,
        );
      }
    });
  }

  validateTypographyPrimitiveMap(sectionToken, diagnostics, root, "fontSize", (scalar, path) => {
    validateDimensionScalar(sectionToken, diagnostics, scalar, path.split(".").slice(1));
  });

  validateTypographyPrimitiveMap(sectionToken, diagnostics, root, "fontWeight", (scalar, path) => {
    validateNumberOrReference(sectionToken, diagnostics, scalar, path);
  });

  validateTypographyPrimitiveMap(sectionToken, diagnostics, root, "lineHeight", (scalar, path) => {
    validateNumberDimensionOrReference(sectionToken, diagnostics, scalar, path);
  });

  validateTypographyPrimitiveMap(
    sectionToken,
    diagnostics,
    root,
    "letterSpacing",
    (scalar, path) => {
      validateDimensionScalar(sectionToken, diagnostics, scalar, path.split(".").slice(1));
    },
  );

  const measure = findEntry(root, "measure");
  const measureMap = validateMapEntry(sectionToken, diagnostics, measure, "Typography.measure");
  if (measureMap !== undefined) {
    validateLeaves(sectionToken, diagnostics, measureMap, ["measure"], (scalar, path) => {
      validateDimensionScalar(sectionToken, diagnostics, scalar, path.split(".").slice(1));
    });
  }

  const textMap = text?.value.kind === "map" ? text.value : undefined;
  if (textMap !== undefined && !hasAnyEntry(textMap, ["body", "body-md"])) {
    addWarning(
      sectionToken,
      diagnostics,
      "missing-anchor",
      "Typography should define a body or body-md text style.",
      textMap,
      "Typography.text",
    );
  }
}

function validateTypographyPrimitiveMap(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  root: TokenMap,
  key: "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing",
  validate: (scalar: TokenScalar, path: string) => void,
): void {
  const entry = findEntry(root, key);
  const map = validateMapEntry(sectionToken, diagnostics, entry, `Typography.${key}`);
  if (map !== undefined) {
    validateLeaves(sectionToken, diagnostics, map, [key], validate);
  }
}

function validateTextStyles(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  textMap: TokenMap,
): void {
  for (const style of textMap.entries) {
    if (style.value.kind !== "map") {
      addError(
        sectionToken,
        diagnostics,
        "invalid-value-type",
        `Typography text style '${style.key}' must be a map.`,
        style.value,
        `Typography.text.${style.key}`,
      );
      continue;
    }

    for (const required of ["fontFamily", "fontSize", "lineHeight"]) {
      requireEntry(
        sectionToken,
        diagnostics,
        style.value,
        required,
        `Typography.text.${style.key}`,
      );
    }

    warnUnknownMapKeys(
      sectionToken,
      diagnostics,
      style.value,
      textStyleFields,
      `Typography.text.${style.key}`,
    );

    for (const field of style.value.entries) {
      const path = `Typography.text.${style.key}.${field.key}`;
      if (field.value.kind !== "scalar") {
        addError(
          sectionToken,
          diagnostics,
          "invalid-value-type",
          `${path} must be a scalar value.`,
          field.value,
          path,
        );
        continue;
      }

      if (field.key === "fontSize" || field.key === "letterSpacing") {
        validateDimensionScalar(sectionToken, diagnostics, field.value, [
          "text",
          style.key,
          field.key,
        ]);
      } else if (field.key === "fontWeight" || field.key === "lineHeight") {
        validateNumberDimensionOrReference(sectionToken, diagnostics, field.value, path);
      } else if (field.value.valueType !== "string") {
        addError(
          sectionToken,
          diagnostics,
          "invalid-value-type",
          `${path} must be a string or token reference.`,
          field.value,
          path,
        );
      }
    }
  }
}

function validateLayout(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  const root = sectionToken.parsed.root;
  warnUnknownKeys(sectionToken, diagnostics, ["spacing", "container", "grid", "breakpoint"]);

  const spacing = requireEntry(sectionToken, diagnostics, root, "spacing");
  const spacingMap = validateMapEntry(sectionToken, diagnostics, spacing, "Layout.spacing");
  if (spacingMap !== undefined) {
    validateDimensionMap(sectionToken, diagnostics, spacingMap, ["spacing"], true);
    if (!hasQuotedIntegerKey(spacingMap)) {
      warnMissingAnchors(
        sectionToken,
        diagnostics,
        spacingMap,
        ["sm", "md", "lg"],
        "Layout.spacing",
      );
    }
  }

  for (const key of ["container", "breakpoint"]) {
    const entry = findEntry(root, key);
    const map = validateMapEntry(sectionToken, diagnostics, entry, `Layout.${key}`);
    if (map !== undefined) {
      validateDimensionMap(sectionToken, diagnostics, map, [key], false);
    }
  }

  const grid = findEntry(root, "grid");
  const gridMap = validateMapEntry(sectionToken, diagnostics, grid, "Layout.grid");
  if (gridMap !== undefined) {
    warnUnknownMapKeys(sectionToken, diagnostics, gridMap, ["columns", "gutter"], "Layout.grid");
    for (const entry of gridMap.entries) {
      if (entry.value.kind !== "scalar") {
        addError(
          sectionToken,
          diagnostics,
          "invalid-value-type",
          `Layout.grid.${entry.key} must be a scalar value.`,
          entry.value,
          `Layout.grid.${entry.key}`,
        );
      } else if (entry.key === "columns") {
        validateNumberOrReference(
          sectionToken,
          diagnostics,
          entry.value,
          `Layout.grid.${entry.key}`,
        );
      } else if (entry.key === "gutter") {
        validateDimensionScalar(sectionToken, diagnostics, entry.value, ["grid", entry.key]);
      }
    }
  }
}

function validateElevation(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  const root = sectionToken.parsed.root;
  warnUnknownKeys(sectionToken, diagnostics, ["shadow", "zIndex"]);

  const shadow = findEntry(root, "shadow");
  const shadowMap = validateMapEntry(sectionToken, diagnostics, shadow, "Elevation.shadow");
  if (shadowMap !== undefined) {
    validateLeaves(sectionToken, diagnostics, shadowMap, ["shadow"], (scalar, path) => {
      if (scalar.valueType !== "string") {
        addError(
          sectionToken,
          diagnostics,
          "invalid-value-type",
          `${path} must be a string or token reference.`,
          scalar,
          path,
        );
      }
    });
  }

  const zIndex = findEntry(root, "zIndex");
  const zIndexMap = validateMapEntry(sectionToken, diagnostics, zIndex, "Elevation.zIndex");
  if (zIndexMap !== undefined) {
    validateLeaves(sectionToken, diagnostics, zIndexMap, ["zIndex"], (scalar, path) => {
      validateNumberOrReference(sectionToken, diagnostics, scalar, path);
    });
  }
}

function validateShapes(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  const root = sectionToken.parsed.root;
  warnUnknownKeys(sectionToken, diagnostics, ["radius", "borderWidth", "borderStyle"]);

  const radius = requireEntry(sectionToken, diagnostics, root, "radius");
  const radiusMap = validateMapEntry(sectionToken, diagnostics, radius, "Shapes.radius");
  if (radiusMap !== undefined) {
    validateDimensionMap(sectionToken, diagnostics, radiusMap, ["radius"], true);
    warnMissingAnchors(
      sectionToken,
      diagnostics,
      radiusMap,
      ["none", "sm", "md", "full"],
      "Shapes.radius",
    );
  }

  const borderWidth = findEntry(root, "borderWidth");
  const borderWidthMap = validateMapEntry(
    sectionToken,
    diagnostics,
    borderWidth,
    "Shapes.borderWidth",
  );
  if (borderWidthMap !== undefined) {
    validateDimensionMap(sectionToken, diagnostics, borderWidthMap, ["borderWidth"], false);
  }

  const borderStyle = findEntry(root, "borderStyle");
  const borderStyleMap = validateMapEntry(
    sectionToken,
    diagnostics,
    borderStyle,
    "Shapes.borderStyle",
  );
  if (borderStyleMap !== undefined) {
    validateLeaves(sectionToken, diagnostics, borderStyleMap, ["borderStyle"], (scalar, path) => {
      if (
        scalar.valueType !== "string" ||
        (!isWholeReference(String(scalar.value)) && !isBorderStyle(String(scalar.value)))
      ) {
        addError(
          sectionToken,
          diagnostics,
          "invalid-border-style",
          `${path} must be a CSS border-style keyword or token reference.`,
          scalar,
          path,
        );
      }
    });
  }
}

function validateComponents(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  for (const component of sectionToken.parsed.root.entries) {
    if (component.value.kind !== "map") {
      addError(
        sectionToken,
        diagnostics,
        "invalid-value-type",
        `Component '${component.key}' must be a map.`,
        component.value,
        `Components.${component.key}`,
      );
      continue;
    }

    const base = findEntry(component.value, "base");
    const variants = findEntry(component.value, "variants");
    if (base === undefined && variants === undefined) {
      addError(
        sectionToken,
        diagnostics,
        "component-shape",
        `Component '${component.key}' must define base or variants.`,
        component.value,
        `Components.${component.key}`,
      );
    }

    warnUnknownMapKeys(
      sectionToken,
      diagnostics,
      component.value,
      ["base", "variants"],
      `Components.${component.key}`,
    );

    const baseMap = validateMapEntry(
      sectionToken,
      diagnostics,
      base,
      `Components.${component.key}.base`,
    );
    if (baseMap !== undefined) {
      validateComponentProperties(
        sectionToken,
        diagnostics,
        baseMap,
        `Components.${component.key}.base`,
      );
    }

    const variantsMap = validateMapEntry(
      sectionToken,
      diagnostics,
      variants,
      `Components.${component.key}.variants`,
    );
    if (variantsMap !== undefined) {
      for (const axis of variantsMap.entries) {
        if (axis.value.kind !== "map") {
          addError(
            sectionToken,
            diagnostics,
            "invalid-value-type",
            `Variant axis '${axis.key}' must be a map.`,
            axis.value,
            `Components.${component.key}.variants.${axis.key}`,
          );
          continue;
        }

        for (const variant of axis.value.entries) {
          if (variant.value.kind === "map") {
            validateComponentProperties(
              sectionToken,
              diagnostics,
              variant.value,
              `Components.${component.key}.variants.${axis.key}.${variant.key}`,
            );
          } else {
            addError(
              sectionToken,
              diagnostics,
              "invalid-value-type",
              `Variant '${variant.key}' must be a map.`,
              variant.value,
              `Components.${component.key}.variants.${axis.key}.${variant.key}`,
            );
          }
        }
      }
    }
  }
}

function validateComponentProperties(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  map: TokenMap,
  basePath: string,
): void {
  for (const property of map.entries) {
    const path = `${basePath}.${property.key}`;
    if (!componentProperties.has(property.key)) {
      addWarning(
        sectionToken,
        diagnostics,
        "unknown-component-property",
        `Unknown component property '${property.key}' is preserved but not exported.`,
        property.value,
        path,
      );
    }

    if (property.value.kind !== "scalar") {
      addError(
        sectionToken,
        diagnostics,
        "invalid-value-type",
        `${path} must be a scalar value.`,
        property.value,
        path,
      );
    }
  }
}

function validateIconography(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  const root = sectionToken.parsed.root;
  warnUnknownKeys(sectionToken, diagnostics, [
    "library",
    "style",
    "strokeWidth",
    "grid",
    "size",
    "color",
  ]);
  const library = requireEntry(sectionToken, diagnostics, root, "library");
  const libraryScalar = validateScalarEntry(
    sectionToken,
    diagnostics,
    library,
    "Iconography.library",
  );
  if (libraryScalar !== undefined && libraryScalar.valueType !== "string") {
    addError(
      sectionToken,
      diagnostics,
      "invalid-value-type",
      "Iconography.library must be a string.",
      libraryScalar,
      "Iconography.library",
    );
  }

  const strokeWidth = findEntry(root, "strokeWidth");
  const strokeWidthScalar = validateScalarEntry(
    sectionToken,
    diagnostics,
    strokeWidth,
    "Iconography.strokeWidth",
  );
  if (strokeWidthScalar !== undefined) {
    validateNumberOrReference(
      sectionToken,
      diagnostics,
      strokeWidthScalar,
      "Iconography.strokeWidth",
    );
  }

  const grid = findEntry(root, "grid");
  const gridScalar = validateScalarEntry(sectionToken, diagnostics, grid, "Iconography.grid");
  if (gridScalar !== undefined) {
    validateDimensionScalar(sectionToken, diagnostics, gridScalar, ["grid"]);
  }

  const size = findEntry(root, "size");
  const sizeMap = validateMapEntry(sectionToken, diagnostics, size, "Iconography.size");
  if (sizeMap !== undefined) {
    validateDimensionMap(sectionToken, diagnostics, sizeMap, ["size"], false);
  }

  const style = findEntry(root, "style");
  const styleScalar = validateScalarEntry(sectionToken, diagnostics, style, "Iconography.style");
  if (styleScalar !== undefined && styleScalar.valueType === "string") {
    const value = String(styleScalar.value);
    if (
      !isWholeReference(value) &&
      !["outlined", "filled", "rounded", "sharp", "duotone"].includes(value)
    ) {
      addWarning(
        sectionToken,
        diagnostics,
        "unknown-icon-style",
        `Unknown icon style '${value}' is preserved.`,
        styleScalar,
        "Iconography.style",
      );
    }
  }

  const color = findEntry(root, "color");
  const colorScalar = validateScalarEntry(sectionToken, diagnostics, color, "Iconography.color");
  if (colorScalar !== undefined) {
    const value = String(colorScalar.value);
    if (colorScalar.valueType !== "string" || !isColorOrReference(value)) {
      addError(
        sectionToken,
        diagnostics,
        "invalid-color",
        "Iconography.color must be a supported color string or token reference.",
        colorScalar,
        "Iconography.color",
      );
    }
  }
}

function validateMotion(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  const root = sectionToken.parsed.root;
  warnUnknownKeys(sectionToken, diagnostics, ["duration", "easing", "reducedMotion"]);

  const duration = findEntry(root, "duration");
  const durationMap = validateMapEntry(sectionToken, diagnostics, duration, "Motion.duration");
  if (durationMap !== undefined) {
    validateDurationMap(sectionToken, diagnostics, durationMap, ["duration"]);
  }

  const reducedMotion = findEntry(root, "reducedMotion");
  const reducedMotionMap = validateMapEntry(
    sectionToken,
    diagnostics,
    reducedMotion,
    "Motion.reducedMotion",
  );
  if (reducedMotionMap !== undefined) {
    validateDurationMap(sectionToken, diagnostics, reducedMotionMap, ["reducedMotion"]);
  }

  const easing = findEntry(root, "easing");
  const easingMap = validateMapEntry(sectionToken, diagnostics, easing, "Motion.easing");
  if (easingMap !== undefined) {
    validateLeaves(sectionToken, diagnostics, easingMap, ["easing"], (scalar, path) => {
      if (
        scalar.valueType !== "string" ||
        (!isWholeReference(String(scalar.value)) && !isEasing(String(scalar.value)))
      ) {
        addError(
          sectionToken,
          diagnostics,
          "invalid-easing",
          `${path} must be a CSS easing keyword/function or token reference.`,
          scalar,
          path,
        );
      }
    });
  }

  warnReducedMotion(sectionToken, diagnostics, durationMap, reducedMotionMap);
}

function warnReducedMotion(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  duration: TokenNode | undefined,
  reducedMotion: TokenNode | undefined,
): void {
  if (duration?.kind !== "map") {
    return;
  }

  const reducedMotionKeys =
    reducedMotion?.kind === "map"
      ? new Set(reducedMotion.entries.map((entry) => entry.key))
      : new Set<string>();

  for (const entry of duration.entries) {
    if (entry.value.kind !== "scalar" || entry.value.valueType !== "string") {
      continue;
    }

    const milliseconds = parseTimeMs(String(entry.value.value));
    if (milliseconds !== undefined && milliseconds > 200 && !reducedMotionKeys.has(entry.key)) {
      addWarning(
        sectionToken,
        diagnostics,
        "missing-reduced-motion",
        `Motion duration '${entry.key}' should define a same-key reducedMotion value.`,
        entry.value,
        `Motion.duration.${entry.key}`,
      );
    }
  }
}

function validateKeyStyles(sectionToken: ParsedSectionToken, diagnostics: Diagnostic[]): void {
  validateMapKeyStyles(sectionToken, diagnostics, sectionToken.parsed.root, []);
}

function validateMapKeyStyles(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  map: TokenMap,
  parentSegments: string[],
): void {
  for (const entry of map.entries) {
    if (!isStructuralKey(sectionToken, parentSegments, entry.key) && !isRecommendedKey(entry)) {
      diagnostics.push({
        severity: "warning",
        rule: "key-style",
        path: [sectionToken.section.name, ...parentSegments, entry.key].join("."),
        message: `Key '${entry.key}' should use kebab-case or a double-quoted numeric scale key.`,
        span: entry.keySpan,
      });
    }

    if (entry.value.kind === "map") {
      validateMapKeyStyles(sectionToken, diagnostics, entry.value, [...parentSegments, entry.key]);
    }
  }
}

function isStructuralKey(
  sectionToken: ParsedSectionToken,
  parentSegments: readonly string[],
  key: string,
): boolean {
  switch (sectionToken.definition.group) {
    case "metadata":
      return parentSegments.length === 0 && ["themes", "defaultTheme"].includes(key);
    case "typography":
      return isTypographyStructuralKey(parentSegments, key);
    case "layout":
      return isLayoutStructuralKey(parentSegments, key);
    case "elevation":
      return parentSegments.length === 0 && ["shadow", "zIndex"].includes(key);
    case "shapes":
      return parentSegments.length === 0 && ["radius", "borderWidth", "borderStyle"].includes(key);
    case "components":
      return isComponentStructuralKey(parentSegments, key);
    case "iconography":
      return (
        parentSegments.length === 0 &&
        ["library", "style", "strokeWidth", "grid", "size", "color"].includes(key)
      );
    case "motion":
      return parentSegments.length === 0 && ["duration", "easing", "reducedMotion"].includes(key);
    case "colors":
    case undefined:
      return false;
  }

  return false;
}

function isTypographyStructuralKey(parentSegments: readonly string[], key: string): boolean {
  if (parentSegments.length === 0) {
    return typographyRootFields.includes(key as (typeof typographyRootFields)[number]);
  }

  return (
    parentSegments.length === 2 &&
    parentSegments[0] === "text" &&
    textStyleFields.includes(key as (typeof textStyleFields)[number])
  );
}

function isLayoutStructuralKey(parentSegments: readonly string[], key: string): boolean {
  if (parentSegments.length === 0) {
    return ["spacing", "container", "grid", "breakpoint"].includes(key);
  }

  return (
    parentSegments.length === 1 &&
    parentSegments[0] === "grid" &&
    ["columns", "gutter"].includes(key)
  );
}

function isComponentStructuralKey(parentSegments: readonly string[], key: string): boolean {
  if (parentSegments.length === 1) {
    return key === "base" || key === "variants";
  }

  const isBaseProperty = parentSegments.length === 2 && parentSegments[1] === "base";
  const isVariantProperty = parentSegments.length === 4 && parentSegments[1] === "variants";

  return (isBaseProperty || isVariantProperty) && componentProperties.has(key);
}

function isRecommendedKey(entry: TokenMapEntry): boolean {
  if (entry.quotedKey && /^\d+$/.test(entry.key)) {
    return true;
  }

  if (!entry.quotedKey && /^-?\d+(?:\.\d+)?$/.test(entry.key)) {
    return true;
  }

  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.key);
}

function validateDimensionMap(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  map: TokenMap,
  segments: string[],
  allowZero: boolean,
): void {
  if (map.entries.length === 0) {
    addError(
      sectionToken,
      diagnostics,
      "token-minimum",
      `${sectionToken.section.name}.${segments.join(".")} must contain at least one token.`,
      map,
    );
  }

  validateLeaves(sectionToken, diagnostics, map, segments, (scalar, path) => {
    validateDimensionScalar(sectionToken, diagnostics, scalar, path.split(".").slice(1), allowZero);
  });
}

function validateDurationMap(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  map: TokenMap,
  segments: string[],
): void {
  validateLeaves(sectionToken, diagnostics, map, segments, (scalar, path) => {
    if (!isTimeOrReference(scalar)) {
      addError(
        sectionToken,
        diagnostics,
        "invalid-time",
        `${path} must be a CSS time string, numeric 0, or token reference.`,
        scalar,
        path,
      );
    }
  });
}

function validateDimensionScalar(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  scalar: TokenNode,
  segments: string[],
  allowZero = true,
): void {
  const path = `${sectionToken.section.name}.${segments.join(".")}`;
  if (scalar.kind !== "scalar" || !isDimensionOrReference(scalar, allowZero)) {
    addError(
      sectionToken,
      diagnostics,
      "invalid-dimension",
      `${path} must be a CSS dimension, numeric 0, or token reference.`,
      scalar,
      path,
    );
  }
}

function validateNumberOrReference(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  scalar: TokenScalar,
  path: string,
): void {
  if (scalar.valueType !== "number" && !isWholeReference(String(scalar.value))) {
    addError(
      sectionToken,
      diagnostics,
      "invalid-value-type",
      `${path} must be a number or token reference.`,
      scalar,
      path,
    );
  }
}

function validateNumberDimensionOrReference(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  scalar: TokenScalar,
  path: string,
): void {
  if (
    scalar.valueType === "number" ||
    isWholeReference(String(scalar.value)) ||
    isDimension(String(scalar.value))
  ) {
    return;
  }

  addError(
    sectionToken,
    diagnostics,
    "invalid-value-type",
    `${path} must be a number, CSS dimension, or token reference.`,
    scalar,
    path,
  );
}

function validateLeaves(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  node: TokenNode,
  segments: string[],
  validate: (scalar: TokenScalar, path: string) => void,
): void {
  if (node.kind === "scalar") {
    validate(node, `${sectionToken.section.name}.${segments.join(".")}`);
    return;
  }

  if (node.kind === "list") {
    addError(
      sectionToken,
      diagnostics,
      "invalid-value-type",
      `${sectionToken.section.name}.${segments.join(".")} must not be a list.`,
      node,
    );
    return;
  }

  for (const entry of node.entries) {
    validateLeaves(sectionToken, diagnostics, entry.value, [...segments, entry.key], validate);
  }
}

function validateMapEntry(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  entry: TokenMapEntry | undefined,
  path: string,
): TokenMap | undefined {
  if (entry === undefined) {
    return undefined;
  }

  if (entry.value.kind !== "map") {
    addError(
      sectionToken,
      diagnostics,
      "invalid-value-type",
      `${path} must be a map.`,
      entry.value,
      path,
    );
    return undefined;
  }

  return entry.value;
}

function validateScalarEntry(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  entry: TokenMapEntry | undefined,
  path: string,
): TokenScalar | undefined {
  if (entry === undefined) {
    return undefined;
  }

  if (entry.value.kind !== "scalar") {
    addError(
      sectionToken,
      diagnostics,
      "invalid-value-type",
      `${path} must be a scalar value.`,
      entry.value,
      path,
    );
    return undefined;
  }

  return entry.value;
}

function requireEntry(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  map: TokenMap,
  key: string,
  basePath = sectionToken.section.name,
): TokenMapEntry | undefined {
  const entry = findEntry(map, key);
  if (entry === undefined) {
    addError(
      sectionToken,
      diagnostics,
      "required-token",
      `${basePath} must define '${key}'.`,
      map,
      `${basePath}.${key}`,
    );
  }

  return entry;
}

function warnUnknownKeys(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  allowedKeys: readonly string[],
): void {
  warnUnknownMapKeys(
    sectionToken,
    diagnostics,
    sectionToken.parsed.root,
    allowedKeys,
    sectionToken.section.name,
  );
}

function warnUnknownMapKeys(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  map: TokenMap,
  allowedKeys: readonly string[],
  basePath: string,
): void {
  const allowed = new Set(allowedKeys);

  for (const entry of map.entries) {
    if (!allowed.has(entry.key)) {
      addWarning(
        sectionToken,
        diagnostics,
        "unknown-key",
        `Unknown key '${entry.key}' is preserved but not exported by current tooling.`,
        entry.value,
        `${basePath}.${entry.key}`,
      );
    }
  }
}

function warnMissingAnchors(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  map: TokenMap,
  anchors: readonly string[],
  path = sectionToken.section.name,
): void {
  const missing = anchors.filter((anchor) => findEntry(map, anchor) === undefined);
  if (missing.length > 0) {
    addWarning(
      sectionToken,
      diagnostics,
      "missing-anchor",
      `${path} should define recommended anchors: ${missing.join(", ")}.`,
      map,
      path,
    );
  }
}

function countScalarLeaves(node: TokenNode): number {
  if (node.kind === "scalar") {
    return 1;
  }

  if (node.kind === "list") {
    return node.items.length;
  }

  return node.entries.reduce((count, entry) => count + countScalarLeaves(entry.value), 0);
}

function findEntry(map: TokenMap, key: string): TokenMapEntry | undefined {
  return map.entries.find((entry) => entry.key === key);
}

function hasAnyEntry(map: TokenMap, keys: readonly string[]): boolean {
  return keys.some((key) => findEntry(map, key) !== undefined);
}

function hasQuotedIntegerKey(map: TokenMap): boolean {
  return map.entries.some((entry) => entry.quotedKey && /^\d+$/.test(entry.key));
}

function addError(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  rule: string,
  message: string,
  node: TokenNode,
  path?: string,
): void {
  addDiagnostic(sectionToken, diagnostics, "error", rule, message, node, path);
}

function addWarning(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  rule: string,
  message: string,
  node: TokenNode,
  path?: string,
): void {
  addDiagnostic(sectionToken, diagnostics, "warning", rule, message, node, path);
}

function addDiagnostic(
  sectionToken: ParsedSectionToken,
  diagnostics: Diagnostic[],
  severity: "error" | "warning",
  rule: string,
  message: string,
  node: TokenNode,
  path?: string,
): void {
  const diagnostic: Diagnostic = {
    severity,
    rule,
    message,
    span: node.span,
  };

  if (path !== undefined) {
    diagnostic.path = path;
  } else {
    diagnostic.path = sectionToken.section.name;
  }

  diagnostics.push(diagnostic);
}

function isColorOrReference(value: string): boolean {
  return (
    isWholeReference(value) ||
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ||
    /^(?:rgb|rgba|hsl|hsla|oklab|oklch)\([^)]*\)$/.test(value) ||
    /^color\(display-p3 [^)]*\)$/.test(value) ||
    value === "transparent"
  );
}

function isDimensionOrReference(scalar: TokenScalar, allowZero: boolean): boolean {
  if (scalar.valueType === "number") {
    return allowZero && scalar.value === 0;
  }

  const value = String(scalar.value);
  return isWholeReference(value) || isDimension(value);
}

function isTimeOrReference(scalar: TokenScalar): boolean {
  if (scalar.valueType === "number") {
    return scalar.value === 0;
  }

  const value = String(scalar.value);
  return isWholeReference(value) || parseTimeMs(value) !== undefined;
}

function parseTimeMs(value: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) {
    return undefined;
  }

  const amount = Number(match[1]);
  return match[2] === "s" ? amount * 1000 : amount;
}

function isDimension(value: string): boolean {
  return /^-?\d+(?:\.\d+)?(?:px|rem|em|ch|ex|vw|vh|vmin|vmax|%|svh|lvh|dvh)$/.test(value);
}

function isBorderStyle(value: string): boolean {
  return [
    "none",
    "hidden",
    "dotted",
    "dashed",
    "solid",
    "double",
    "groove",
    "ridge",
    "inset",
    "outset",
  ].includes(value);
}

function isEasing(value: string): boolean {
  return (
    ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end"].includes(
      value,
    ) || /^(?:cubic-bezier|linear|steps)\([^)]*\)$/.test(value)
  );
}

function isWholeReference(value: string): boolean {
  return /^\{[^{}\s]+\}$/.test(value);
}
