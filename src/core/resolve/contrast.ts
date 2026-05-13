import type { Diagnostic } from "../diagnostics/types.js";
import type { TokenPrimitive } from "../token-yaml/types.js";
import type { ResolvedToken } from "./types.js";

interface ContrastContext {
  tokens: ReadonlyMap<string, ResolvedToken>;
  themes: readonly string[];
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

interface ComponentVariant {
  component: string;
  axis: string;
  variant: string;
  props: Map<string, ResolvedToken>;
}

const contrastThreshold = 4.5;
const referencePattern = /\{([^{}]+)\}/g;

export function validateContrast(
  tokens: ReadonlyMap<string, ResolvedToken>,
  themes: readonly string[],
): Diagnostic[] {
  const context: ContrastContext = { tokens, themes };
  const diagnostics: Diagnostic[] = [];
  const themeNames = themes.length === 0 ? [undefined] : themes;

  for (const theme of themeNames) {
    validateSemanticPairs(context, diagnostics, theme);
    validateComponentPairs(context, diagnostics, theme);
  }

  return diagnostics;
}

function validateSemanticPairs(
  context: ContrastContext,
  diagnostics: Diagnostic[],
  theme: string | undefined,
): void {
  for (const [backgroundPath, foregroundPath] of [
    ["colors.surface", "colors.on-surface"],
    ["colors.primary", "colors.on-primary"],
    ["colors.secondary", "colors.on-secondary"],
    ["colors.error", "colors.on-error"],
  ] as const) {
    const background = context.tokens.get(backgroundPath);
    const foreground = context.tokens.get(foregroundPath);

    if (background === undefined || foreground === undefined) {
      continue;
    }

    validatePair(context, diagnostics, {
      background,
      foreground,
      path: `${backgroundPath}/${foregroundPath}`,
      theme,
    });
  }
}

function validateComponentPairs(
  context: ContrastContext,
  diagnostics: Diagnostic[],
  theme: string | undefined,
): void {
  const components = collectComponentProps(context.tokens);

  for (const [component, baseProps] of components.basePropsByComponent) {
    validateComponentPropPair(
      context,
      diagnostics,
      `Components.${component}.base`,
      baseProps,
      theme,
    );
  }

  for (const variant of components.variants) {
    const mergedProps = new Map(components.basePropsByComponent.get(variant.component));
    for (const [property, token] of variant.props) {
      mergedProps.set(property, token);
    }

    validateComponentPropPair(
      context,
      diagnostics,
      `Components.${variant.component}.variants.${variant.axis}.${variant.variant}`,
      mergedProps,
      theme,
    );
  }
}

function validateComponentPropPair(
  context: ContrastContext,
  diagnostics: Diagnostic[],
  path: string,
  props: ReadonlyMap<string, ResolvedToken>,
  theme: string | undefined,
): void {
  const background = props.get("backgroundColor");
  const foreground = props.get("textColor");

  if (background === undefined || foreground === undefined) {
    return;
  }

  validatePair(context, diagnostics, { background, foreground, path, theme });
}

function validatePair(
  context: ContrastContext,
  diagnostics: Diagnostic[],
  pair: {
    background: ResolvedToken;
    foreground: ResolvedToken;
    path: string;
    theme: string | undefined;
  },
): void {
  const background = resolveTokenColor(context, pair.background, pair.theme);
  const foreground = resolveTokenColor(context, pair.foreground, pair.theme);

  if (background === undefined || foreground === undefined) {
    return;
  }

  const effectiveBackground = compositeBackground(
    context,
    background,
    pair.theme,
    pair.background.path,
  );

  if (effectiveBackground === undefined) {
    return;
  }

  const effectiveForeground =
    foreground.alpha < 1 ? compositeColor(foreground, effectiveBackground) : foreground;
  const ratio = contrastRatio(effectiveForeground, effectiveBackground);

  if (ratio >= contrastThreshold) {
    return;
  }

  const message = [
    `Contrast for ${pair.path}${themeSuffix(pair.theme)} is ${ratio.toFixed(2)}:1,`,
    `below WCAG AA ${contrastThreshold}:1.`,
  ].join(" ");

  diagnostics.push({
    severity: "warning",
    rule: "contrast",
    path: pair.path,
    message,
    span: pair.foreground.span,
  });
}

function collectComponentProps(tokens: ReadonlyMap<string, ResolvedToken>): {
  basePropsByComponent: Map<string, Map<string, ResolvedToken>>;
  variants: ComponentVariant[];
} {
  const basePropsByComponent = new Map<string, Map<string, ResolvedToken>>();
  const variantsByPath = new Map<string, ComponentVariant>();

  for (const token of tokens.values()) {
    if (token.group !== "components") {
      continue;
    }

    const [, component, scope, third, fourth, fifth] = token.path.split(".");
    if (component === undefined || scope === undefined) {
      continue;
    }

    if (scope === "base" && third !== undefined && fourth === undefined) {
      getMap(basePropsByComponent, component).set(third, token);
      continue;
    }

    if (
      scope !== "variants" ||
      third === undefined ||
      fourth === undefined ||
      fifth === undefined
    ) {
      continue;
    }

    const variantPath = `${component}.${third}.${fourth}`;
    let variant = variantsByPath.get(variantPath);
    if (variant === undefined) {
      variant = {
        component,
        axis: third,
        variant: fourth,
        props: new Map(),
      };
      variantsByPath.set(variantPath, variant);
    }

    variant.props.set(fifth, token);
  }

  return {
    basePropsByComponent,
    variants: [...variantsByPath.values()],
  };
}

function getMap(
  maps: Map<string, Map<string, ResolvedToken>>,
  key: string,
): Map<string, ResolvedToken> {
  let map = maps.get(key);
  if (map === undefined) {
    map = new Map();
    maps.set(key, map);
  }

  return map;
}

function resolveTokenColor(
  context: ContrastContext,
  token: ResolvedToken,
  theme: string | undefined,
): RgbColor | undefined {
  const primitive = resolveTokenPrimitive(context, token.path, theme, new Set());
  if (typeof primitive !== "string") {
    return undefined;
  }

  return parseColor(primitive);
}

function resolveTokenPrimitive(
  context: ContrastContext,
  path: string,
  theme: string | undefined,
  seen: Set<string>,
): TokenPrimitive | undefined {
  if (seen.has(path)) {
    return undefined;
  }

  const token = context.tokens.get(path);
  if (token === undefined) {
    return undefined;
  }

  seen.add(path);
  const primitive = resolveValue(context, token.value, theme, seen);
  seen.delete(path);

  return primitive;
}

function resolveValue(
  context: ContrastContext,
  value: ResolvedToken["value"],
  theme: string | undefined,
  seen: Set<string>,
): TokenPrimitive | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    if (theme === undefined) {
      return undefined;
    }

    const themedValue = value[theme];
    return themedValue === undefined ? undefined : resolveValue(context, themedValue, theme, seen);
  }

  const wholeReference = /^\{([^{}]+)\}$/.exec(value);
  if (wholeReference?.[1] !== undefined) {
    return resolveTokenPrimitive(context, wholeReference[1].trim(), theme, seen);
  }

  let resolved = "";
  let cursor = 0;
  for (const match of value.matchAll(referencePattern)) {
    const rawReference = match[1];
    const index = match.index;
    if (rawReference === undefined || index === undefined) {
      continue;
    }

    const primitive = resolveTokenPrimitive(context, rawReference.trim(), theme, seen);
    if (primitive === undefined) {
      return undefined;
    }

    resolved += value.slice(cursor, index) + String(primitive);
    cursor = index + match[0].length;
  }

  return cursor === 0 ? value : resolved + value.slice(cursor);
}

function compositeBackground(
  context: ContrastContext,
  background: RgbColor,
  theme: string | undefined,
  backgroundPath: string,
): RgbColor | undefined {
  if (background.alpha >= 1) {
    return background;
  }

  const backdrop = resolveBackdrop(context, theme, backgroundPath);
  return backdrop === undefined ? undefined : compositeColor(background, backdrop);
}

function resolveBackdrop(
  context: ContrastContext,
  theme: string | undefined,
  backgroundPath: string,
): RgbColor | undefined {
  for (const path of ["colors.surface", "colors.background"]) {
    if (path === backgroundPath) {
      continue;
    }

    const token = context.tokens.get(path);
    if (token === undefined) {
      continue;
    }

    const color = resolveTokenColor(context, token, theme);
    if (color !== undefined && color.alpha >= 1) {
      return color;
    }
  }

  return undefined;
}

function compositeColor(foreground: RgbColor, background: RgbColor): RgbColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) {
    return { r: 0, g: 0, b: 0, alpha: 0 };
  }

  return {
    r:
      (foreground.r * foreground.alpha + background.r * background.alpha * (1 - foreground.alpha)) /
      alpha,
    g:
      (foreground.g * foreground.alpha + background.g * background.alpha * (1 - foreground.alpha)) /
      alpha,
    b:
      (foreground.b * foreground.alpha + background.b * background.alpha * (1 - foreground.alpha)) /
      alpha,
    alpha,
  };
}

function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: RgbColor): number {
  const r = linearSrgbChannel(color.r / 255);
  const g = linearSrgbChannel(color.g / 255);
  const b = linearSrgbChannel(color.b / 255);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(source: string): RgbColor | undefined {
  const value = source.trim().toLowerCase();

  if (value === "transparent") {
    return { r: 0, g: 0, b: 0, alpha: 0 };
  }

  if (value.startsWith("#")) {
    return parseHexColor(value);
  }

  const match = /^(rgb|rgba|hsl|hsla|oklab|oklch|color)\((.*)\)$/.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) {
    return undefined;
  }

  switch (match[1]) {
    case "rgb":
    case "rgba":
      return parseRgbColor(match[2]);
    case "hsl":
    case "hsla":
      return parseHslColor(match[2]);
    case "oklab":
      return parseOklabColor(match[2]);
    case "oklch":
      return parseOklchColor(match[2]);
    case "color":
      return parseColorFunction(match[2]);
  }

  return undefined;
}

function parseHexColor(value: string): RgbColor | undefined {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/.test(hex)) {
    return undefined;
  }

  const expanded =
    hex.length <= 4 ? [...hex].map((character) => `${character}${character}`).join("") : hex;
  const red = expanded.slice(0, 2);
  const green = expanded.slice(2, 4);
  const blue = expanded.slice(4, 6);
  const alpha = expanded.slice(6, 8);

  return {
    r: Number.parseInt(red, 16),
    g: Number.parseInt(green, 16),
    b: Number.parseInt(blue, 16),
    alpha: alpha.length === 0 ? 1 : Number.parseInt(alpha, 16) / 255,
  };
}

function parseRgbColor(body: string): RgbColor | undefined {
  const args = parseFunctionArgs(body);
  if (args.components.length < 3) {
    return undefined;
  }

  const red = parseRgbComponent(args.components[0]);
  const green = parseRgbComponent(args.components[1]);
  const blue = parseRgbComponent(args.components[2]);
  const alpha = parseAlpha(args.alpha ?? args.components[3] ?? "1");

  if (red === undefined || green === undefined || blue === undefined || alpha === undefined) {
    return undefined;
  }

  return {
    r: clamp(red, 0, 255),
    g: clamp(green, 0, 255),
    b: clamp(blue, 0, 255),
    alpha,
  };
}

function parseHslColor(body: string): RgbColor | undefined {
  const args = parseFunctionArgs(body);
  if (args.components.length < 3) {
    return undefined;
  }

  const hue = parseHue(args.components[0]);
  const saturation = parsePercentage(args.components[1]);
  const lightness = parsePercentage(args.components[2]);
  const alpha = parseAlpha(args.alpha ?? args.components[3] ?? "1");

  if (
    hue === undefined ||
    saturation === undefined ||
    lightness === undefined ||
    alpha === undefined
  ) {
    return undefined;
  }

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = modulo(hue / 60, 6);
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = hslMatch(huePrime, chroma, x);
  const m = lightness - chroma / 2;

  return {
    r: (match.r + m) * 255,
    g: (match.g + m) * 255,
    b: (match.b + m) * 255,
    alpha,
  };
}

function parseOklabColor(body: string): RgbColor | undefined {
  const args = parseFunctionArgs(body);
  if (args.components.length < 3) {
    return undefined;
  }

  const lightness = parseLightness(args.components[0]);
  const a = parseNumberOrPercentage(args.components[1]);
  const b = parseNumberOrPercentage(args.components[2]);
  const alpha = parseAlpha(args.alpha ?? args.components[3] ?? "1");

  if (lightness === undefined || a === undefined || b === undefined || alpha === undefined) {
    return undefined;
  }

  return oklabToSrgb(lightness, a, b, alpha);
}

function parseOklchColor(body: string): RgbColor | undefined {
  const args = parseFunctionArgs(body);
  if (args.components.length < 3) {
    return undefined;
  }

  const lightness = parseLightness(args.components[0]);
  const chroma = parseNumberOrPercentage(args.components[1]);
  const hue = parseHue(args.components[2]);
  const alpha = parseAlpha(args.alpha ?? args.components[3] ?? "1");

  if (lightness === undefined || chroma === undefined || hue === undefined || alpha === undefined) {
    return undefined;
  }

  const radians = (hue * Math.PI) / 180;
  return oklabToSrgb(lightness, chroma * Math.cos(radians), chroma * Math.sin(radians), alpha);
}

function parseColorFunction(body: string): RgbColor | undefined {
  const args = parseFunctionArgs(body);
  const colorSpace = args.components[0];
  if (colorSpace !== "display-p3" || args.components.length < 4) {
    return undefined;
  }

  const red = parseColorFunctionComponent(args.components[1]);
  const green = parseColorFunctionComponent(args.components[2]);
  const blue = parseColorFunctionComponent(args.components[3]);
  const alpha = parseAlpha(args.alpha ?? args.components[4] ?? "1");

  if (red === undefined || green === undefined || blue === undefined || alpha === undefined) {
    return undefined;
  }

  return displayP3ToSrgb(red, green, blue, alpha);
}

function parseFunctionArgs(body: string): { components: string[]; alpha?: string } {
  const slashParts = body.replaceAll(",", " ").split("/");
  const components = slashParts[0]?.trim().split(/\s+/).filter(Boolean) ?? [];
  const alphaSource = slashParts[1]?.trim().split(/\s+/)[0];
  const result: { components: string[]; alpha?: string } = { components };

  if (alphaSource !== undefined && alphaSource.length > 0) {
    result.alpha = alphaSource;
  }

  return result;
}

function parseRgbComponent(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.endsWith("%")) {
    const percentage = Number(value.slice(0, -1));
    return Number.isFinite(percentage) ? percentage * 2.55 : undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseColorFunctionComponent(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.endsWith("%")) {
    return parsePercentage(value);
  }

  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, 0, 1) : undefined;
}

function parseAlpha(value: string): number | undefined {
  if (value.endsWith("%")) {
    return parsePercentage(value);
  }

  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, 0, 1) : undefined;
}

function parsePercentage(value: string | undefined): number | undefined {
  if (value === undefined || !value.endsWith("%")) {
    return undefined;
  }

  const number = Number(value.slice(0, -1));
  return Number.isFinite(number) ? clamp(number / 100, 0, 1) : undefined;
}

function parseNumberOrPercentage(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.endsWith("%")) {
    return parsePercentage(value);
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseLightness(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.endsWith("%")) {
    return parsePercentage(value);
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseHue(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.endsWith("turn")) {
    const number = Number(value.slice(0, -4));
    return Number.isFinite(number) ? number * 360 : undefined;
  }

  if (value.endsWith("rad")) {
    const number = Number(value.slice(0, -3));
    return Number.isFinite(number) ? (number * 180) / Math.PI : undefined;
  }

  const number = Number(value.endsWith("deg") ? value.slice(0, -3) : value);
  return Number.isFinite(number) ? number : undefined;
}

function hslMatch(
  huePrime: number,
  chroma: number,
  x: number,
): { r: number; g: number; b: number } {
  if (huePrime < 1) {
    return { r: chroma, g: x, b: 0 };
  }

  if (huePrime < 2) {
    return { r: x, g: chroma, b: 0 };
  }

  if (huePrime < 3) {
    return { r: 0, g: chroma, b: x };
  }

  if (huePrime < 4) {
    return { r: 0, g: x, b: chroma };
  }

  if (huePrime < 5) {
    return { r: x, g: 0, b: chroma };
  }

  return { r: chroma, g: 0, b: x };
}

function oklabToSrgb(lightness: number, a: number, b: number, alpha: number): RgbColor {
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  return linearSrgbToRgbColor({
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    alpha,
  });
}

function displayP3ToSrgb(red: number, green: number, blue: number, alpha: number): RgbColor {
  const r = linearSrgbChannel(red);
  const g = linearSrgbChannel(green);
  const b = linearSrgbChannel(blue);
  const x = 0.4865709486 * r + 0.2656676932 * g + 0.1982172852 * b;
  const y = 0.2289745641 * r + 0.6917385218 * g + 0.0792869141 * b;
  const z = 0.0451133819 * g + 1.0439443689 * b;

  return linearSrgbToRgbColor({
    r: 3.2409699419 * x - 1.5373831776 * y - 0.4986107603 * z,
    g: -0.9692436363 * x + 1.8759675015 * y + 0.0415550574 * z,
    b: 0.0556300797 * x - 0.2039769589 * y + 1.0569715142 * z,
    alpha,
  });
}

function linearSrgbToRgbColor(color: RgbColor): RgbColor {
  return {
    r: encodedSrgbChannel(color.r) * 255,
    g: encodedSrgbChannel(color.g) * 255,
    b: encodedSrgbChannel(color.b) * 255,
    alpha: color.alpha,
  };
}

function linearSrgbChannel(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function encodedSrgbChannel(channel: number): number {
  const clamped = clamp(channel, 0, 1);
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function themeSuffix(theme: string | undefined): string {
  return theme === undefined ? "" : ` in theme '${theme}'`;
}
