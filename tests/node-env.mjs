// Minimal browser globals so the Parlor design system bundle and site/js modules load in Node.
const noop = () => {};
const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
globalThis.window = globalThis;
globalThis.document = {
  documentElement: { classList, setAttribute: noop, dataset: {} },
  createElement: () => ({ style: {}, classList, setAttribute: noop, appendChild: noop }),
  addEventListener: noop, head: { appendChild: noop },
};
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
await import('../site/parlor/bundle.js');
export const P = globalThis.Parlor;
