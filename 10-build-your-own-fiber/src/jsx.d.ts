// JSX types for the classic `h` factory. The same demo components run on your
// reconciler and on the real one, so elements are typed loosely.
// Host element names match drill 1.

declare global {
  namespace JSX {
    type Element = any;
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicAttributes {
      key?: string | number;
    }
    interface IntrinsicElements {
      box: { key?: string | number; id?: string; children?: unknown };
      leaf: { key?: string | number; count?: number; children?: unknown };
      item: { key?: string | number; id: string; children?: unknown };
    }
  }
}

export {};
