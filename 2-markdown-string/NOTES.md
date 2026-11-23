# Drill 2: Markdown string

## Call logs

Captured from the real test suite (noise like `getCurrentUpdatePriority` removed). Every trace is in `test-traces.html`.

### Static mount: `<Steps steps={["a","b","c"]} />` (test 42, first render)

```
getRootHostContext()                          → "root"
getChildHostContext("root", "list")           → "list"       ← context flows DOWN first
getChildHostContext("list", "listItem")       → "listItem"
createTextInstance("a", ctx "listItem")       → "a"#1
createInstance("listItem", ctx "list")        → listItem#2   ← instances are built bottom-UP
appendInitialChild(listItem#2, "a"#1)
  … same for b (#3, #4) and c (#5, #6) …
createInstance("list", {ordered:true}, ctx "root") → list#7
appendInitialChild(list#7, listItem#2 / #4 / #6)
prepareForCommit()
clearContainer()
appendChildToContainer(list#7)                ← the whole tree goes in with ONE call
resetAfterCommit()                            → output "1. a\n2. b\n3. c\n"
```

### A state update from outside `render()` (test 49, `Counter`)

```
getRootHostContext()                          ← no render() call: React scheduled this itself
getChildHostContext("root", "paragraph")      → "inline"
prepareForCommit()
commitTextUpdate("0"#2, "0" → "1")            ← only the text that changed
commitUpdate(paragraph#3, {} → {})            ← new props object, nothing to store
resetAfterCommit()                            → output "count: 1\n", onChange("count: 1\n")
```

### A keyed reorder: `["a","b","c"]` → `["c","a","b"]` (test 42)

```
prepareForCommit()
commitUpdate(listItem#6 "c", {} → {})         ← c doesn't move
appendChild(list#7, listItem#2 "a")           ← a MOVES to the end
commitUpdate(listItem#2, {} → {})
appendChild(list#7, listItem#4 "b")           ← b MOVES to the end
commitUpdate(listItem#4, {} → {})
commitUpdate(list#7, {ordered:true} → {ordered:true})
resetAfterCommit()                            → "1. c\n2. a\n3. b\n"
```

### Misplaced text added by an update (test 36)

```
render(<list><listItem>a</listItem>stray</list>)   // the list already exists
getRootHostContext()
getChildHostContext("root", "list")           → "list"
createTextInstance("stray", ctx "list")       ✗ throws: Text "stray" is not allowed here (list)
getRootHostContext()                          ← React retries the render once…
getChildHostContext("root", "list")           → "list"
createTextInstance("stray", ctx "list")       ✗ …and it throws again
prepareForCommit()
removeChildFromContainer(list#3)              ← no error boundary: React unmounts the whole root
resetAfterCommit()                            → output ""
→ onUncaughtError(error) → collected → render() rethrows it
```

## Questions to answer for yourself

### Where does serialization happen, and why there?

In `resetAfterCommit`, once per commit, from the container's tree (`toMarkdown(container)`).

- **The tree is complete there.** React calls it after *all* the commit's changes are applied. Any earlier method only sees one change: `appendChildToContainer` sees one block, `commitTextUpdate` sees one text node and doesn't even get the container.
- **Updates never touch the container.** A text change (test 37) or a prop change (test 38) only calls `commitTextUpdate` or `commitUpdate`. If the string were built in container methods, it would never change after the first render. That was the bug before the restructure.
- **Exactly once per commit.** Test 48 makes a reorder, a removal and an insertion in one commit, and `onChange` fires once.
- **Every commit goes through it**, including ones not caused by `render()`. A `setState` inside a component (test 49) commits on its own, and `resetAfterCommit` still runs.

The rule that falls out: **host methods only change the tree, and the serializer only reads it.** Anything about position (blank lines between blocks, list numbers, indentation) is worked out at serialization, from the order of `children`.

### How does host context decide where text is allowed?

Host context is a value React carries **down** the tree during the render phase:

1. `getRootHostContext()` returns `"root"`, the context of the top level.
2. Before React handles an element's children, it calls `getChildHostContext(parentContext, type)`. The result becomes the context for that element's children: `list` → `"list"`, `listItem` → `"listItem"`, `codeBlock`/`inlineCode` → `"raw"`, `divider` → `"empty"`, anything else → `"inline"`.
3. `createInstance(type, props, container, hostContext)` and `createTextInstance(text, container, hostContext)` receive the context of the place they're being created in. They check it (`isElementAllowed`, `isTextAllowed`) and throw if the node doesn't belong there.

So "where text is allowed" is just: is the context `inline`, `listItem` or `raw`? Text at the top level gets `"root"` (test 26), text inside a list gets `"list"` (test 27), and both throw.

Things to notice in the logs:
- The `getChildHostContext` calls happen on the way **down** (before the children), and `createInstance` happens on the way **up** (children first). The context is already known when the children are created, even though their parent element doesn't exist yet.
- The same context also drives escaping. A text node created in `"raw"` context stores `raw: true`, so the serializer skips escaping inside `inlineCode` and `codeBlock` (tests 16, 17).
- react-dom uses the same mechanism to know that it's inside an `<svg>`, and creates elements in the SVG namespace.

### Which errors can you catch in the render phase, and which only at commit?

**Render phase** (in `createInstance` and `createTextInstance`): anything about **what** a node is and **where** it's created. That covers unknown types (35), elements in the wrong place (28–33), and text in the wrong place (26, 27, 34). It includes updates, because new nodes are always created during render (test 36: the stray text is created in the update's render phase). React can't move an existing host node to a different parent; a new parent means a new instance, so placement is always checked at creation.

Render-phase errors are safe: nothing has touched the container yet. React even retries the render once before giving up (each failing test shows two attempts).

**Commit only**: anything that arrives through a commit method.
- A **prop change on an existing element** goes through `commitUpdate`, in the commit phase. React 19 has no `prepareUpdate` anymore. For example, changing `level` to 7 on an existing heading couldn't be rejected in render.
- Rules that depend on the **final arrangement** (for example "a list can't be empty", or anything about siblings) are only knowable once all of a commit's moves and removals are done, so in `resetAfterCommit` or at serialization.

A commit-phase error is worse: some mutations of that commit may already be applied.

### How does an error thrown inside the host config reach the caller of `render()`?

It doesn't reach it on its own. React **catches** every error thrown by components and by the host config, so it never escapes `updateContainerSync` / `flushSyncWork`:

1. The render throws. React retries it once synchronously. It throws again.
2. No error boundary catches it, so React **unmounts the root**. It commits an empty tree (test 36 shows `removeChildFromContainer(list)` then `resetAfterCommit` with output `""`).
3. React calls the `onUncaughtError` callback that was passed to `createContainer`.

Before the fix, that callback was `console.error`, so the error was printed and `render()` returned normally. That's why none of the "throws" tests could pass. Now each root keeps an `errors` array: `onUncaughtError` pushes into it, and `render()` clears it before the update and rethrows the first error after `flushSyncWork()`.

### Why should ordered-list numbers be worked out at serialization time, not stored on instances?

Because a number is a **position**, and positions change without React calling anything on the items that move.

- Test 43 removes the first item. React calls `removeChild(list, a)` and nothing that says "b is now number 1". The `commitUpdate` calls on b and c only happen because their props objects are new. They aren't a signal you can rely on.
- Test 42 moves a and b with `appendChild`. c never moves, but its number changes from 3 to 1.
- Test 44 switches `ordered` on the list; the items aren't touched at all.

If numbers were stored, every insert, move and removal would have to renumber the siblings, and a mistake would leave a stale number on the screen. The order of `list.children` is already the source of truth, so `index + 1` at serialization is always right. Same idea as the blank line between blocks: anything derived from position belongs to whoever sees all the siblings.

### Did `shouldSetTextContent` help anywhere (code blocks?), and what did it cost?

It didn't help. The renderer always returns `false`, so every string becomes its own text node.

Returning `true` for `codeBlock` (or `inlineCode`) with a string child looks tempting: no text instance, and the text sits in `props.children`. It would cost:
- **Two code paths.** `{"one"}` is a single string, but test 9 has several children, which arrive as an array, so `shouldSetTextContent` would return `false` there anyway. The serializer would need to read text from `props.children` in one case and from text nodes in the other.
- **Updates.** The text would change through `commitUpdate` (props) instead of `commitTextUpdate`, so `commitUpdate` could no longer just drop `children`.
- **Switching kinds.** Going from text to element children needs `resetTextContent`.

The thing it seemed to offer, "this text is raw, don't escape it", was solved more cleanly by host context: the text node records `raw: true` when it's created.

## Surprises

- **A failed render still commits.** In test 26, after the error React runs `prepareForCommit`, `clearContainer` and `resetAfterCommit`, so `onChange("")` fires even though `render()` then throws.
- **An error during an update wipes the document.** In test 36 the list that rendered fine before is removed with `removeChildFromContainer`. With no error boundary, React unmounts the whole root.
- **React retries a failing render once** before reporting the error. Every "throws" trace shows the failing `create…` call twice.
- **Strict mode only re-runs components, not host calls.** In test 49 `Counter` rendered twice, but `createInstance` ran once. Strict mode also runs every effect as mount → cleanup → mount, which exposed the demo bug where `useEffect(() => onReady?.(…))` returned the increment function as its "cleanup".
- **Unchanged siblings still get `commitUpdate`.** In test 40, removing the middle paragraph also calls `commitUpdate({} → {})` on "before" and "after", because `Toggle` re-rendered and made new props objects.
- **A keyed reorder moves the fewest items, not the "obvious" one.** For `[a,b,c] → [c,a,b]`, React keeps c and moves a and b to the end, instead of moving c to the front.
- **`getRootHostContext` runs on every render**, including updates, and on each retry.
- **`shouldSetTextContent` is called twice per element during updates.** Cheap, but it means it must have no side effects.
