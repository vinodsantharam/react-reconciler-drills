# Drill 1: Plain object tree

## Call logs

Captured with `instrument()` on 2026-11-17. Noise is filtered out: priority getters/setters, host context, `shouldSetTextContent`, scheduling, `detachDeletedInstance`. `[circular]` is the fiber handle or a props object holding React elements.

How to read them:
- **Render phase** (`createInstance`, `createTextInstance`, `appendInitialChild`, `finalizeInitialChildren`) builds new subtrees **bottom-up**: children are created before their parent. Nothing is attached to the container yet.
- **Commit phase** sits between `prepareForCommit` and `resetAfterCommit`. Only here does the live tree change.
- On the first mount, the whole new tree goes into the container with **one** `appendChildToContainer`.

#### Mount (StaticTree)

First render:

```
createInstance("box", {"id":"a"}, {"children":[]}, {}, [circular])
finalizeInitialChildren({"type":"box","props":{"id":"a"},"children":[]}, "box", {"id":"a"}, {})
createInstance("box", {"id":"b"}, {"children":[]}, {}, [circular])
finalizeInitialChildren({"type":"box","props":{"id":"b"},"children":[]}, "box", {"id":"b"}, {})
createInstance("box", [circular], {"children":[]}, {}, [circular])
appendInitialChild({"type":"box","props":{"id":"root"},"children":[]}, {"type":"box","props":{"id":"a"},"children":[]})
appendInitialChild({"type":"box","props":{"id":"root"},"children":[{"type":"box","props":{"id":"..., {"type":"box","props":{"id":"b"},"children":[]})
finalizeInitialChildren({"type":"box","props":{"id":"root"},"children":[{"type":"box","props":{"id":"..., "box", [circular], {})
prepareForCommit({"children":[]})
clearContainer({"children":[]})
appendChildToContainer({"children":[]}, {"type":"box","props":{"id":"root"},"children":[{"type":"box","props":{"id":"...)
resetAfterCommit({"children":[{"type":"box","props":{"id":"root"},"children":[{"type":"box","p...)
```

#### Text (TextTree)

First render:

```
createTextInstance("hello", {"children":[]}, {}, [circular])
createTextInstance("world", {"children":[]}, {}, [circular])
createInstance("leaf", {"children":"world"}, {"children":[]}, {}, [circular])
appendInitialChild({"type":"leaf","props":{},"children":[]}, {"text":"world"})
finalizeInitialChildren({"type":"leaf","props":{},"children":[{"text":"world"}]}, "leaf", {"children":"world"}, {})
createTextInstance("two", {"children":[]}, {}, [circular])
createTextInstance(" ", {"children":[]}, {}, [circular])
createTextInstance("texts", {"children":[]}, {}, [circular])
createInstance("box", [circular], {"children":[]}, {}, [circular])
appendInitialChild({"type":"box","props":{},"children":[]}, {"text":"hello"})
appendInitialChild({"type":"box","props":{},"children":[{"text":"hello"}]}, {"type":"leaf","props":{},"children":[{"text":"world"}]})
appendInitialChild({"type":"box","props":{},"children":[{"text":"hello"},{"type":"leaf","props":..., {"text":"two"})
appendInitialChild({"type":"box","props":{},"children":[{"text":"hello"},{"type":"leaf","props":..., {"text":" "})
appendInitialChild({"type":"box","props":{},"children":[{"text":"hello"},{"type":"leaf","props":..., {"text":"texts"})
finalizeInitialChildren({"type":"box","props":{},"children":[{"text":"hello"},{"type":"leaf","props":..., "box", [circular], {})
prepareForCommit({"children":[]})
clearContainer({"children":[]})
appendChildToContainer({"children":[]}, {"type":"box","props":{},"children":[{"text":"hello"},{"type":"leaf","props":...)
resetAfterCommit({"children":[{"type":"box","props":{},"children":[{"text":"hello"},{"type":"l...)
```

#### Update (text and props)

`<box>count: {1}</box>`:

```
createTextInstance("count: ", {"children":[]}, {}, [circular])
createTextInstance("1", {"children":[]}, {}, [circular])
createInstance("box", {"children":["count: ",1]}, {"children":[]}, {}, [circular])
appendInitialChild({"type":"box","props":{},"children":[]}, {"text":"count: "})
appendInitialChild({"type":"box","props":{},"children":[{"text":"count: "}]}, {"text":"1"})
finalizeInitialChildren({"type":"box","props":{},"children":[{"text":"count: "},{"text":"1"}]}, "box", {"children":["count: ",1]}, {})
prepareForCommit({"children":[]})
clearContainer({"children":[]})
appendChildToContainer({"children":[]}, {"type":"box","props":{},"children":[{"text":"count: "},{"text":"1"}]})
resetAfterCommit({"children":[{"type":"box","props":{},"children":[{"text":"count: "},{"text":...)
```

Then `<box>count: {2}</box>`:

```
prepareForCommit({"children":[{"type":"box","props":{},"children":[{"text":"count: "},{"text":...)
commitTextUpdate({"text":"1"}, "1", "2", undefined, undefined)
commitUpdate({"type":"box","props":{},"children":[{"text":"count: "},{"text":"2"}]}, "box", {"children":["count: ",1]}, {"children":["count: ",2]}, [circular])
resetAfterCommit({"children":[{"type":"box","props":{},"children":[{"text":"count: "},{"text":...)
```

#### Removal (Toggle)

`show={true}`:

```
createInstance("box", {"id":"maybe"}, {"children":[]}, {}, [circular])
finalizeInitialChildren({"type":"box","props":{"id":"maybe"},"children":[]}, "box", {"id":"maybe"}, {})
createInstance("box", [circular], {"children":[]}, {}, [circular])
appendInitialChild({"type":"box","props":{},"children":[]}, {"type":"box","props":{"id":"maybe"},"children":[]})
finalizeInitialChildren({"type":"box","props":{},"children":[{"type":"box","props":{"id":"maybe"},"ch..., "box", [circular], {})
prepareForCommit({"children":[]})
clearContainer({"children":[]})
appendChildToContainer({"children":[]}, {"type":"box","props":{},"children":[{"type":"box","props":{"id":"maybe"},"ch...)
resetAfterCommit({"children":[{"type":"box","props":{},"children":[{"type":"box","props":{"id"...)
```

Then `show={false}`:

```
prepareForCommit({"children":[{"type":"box","props":{},"children":[{"type":"box","props":{"id"...)
removeChild({"type":"box","props":{},"children":[{"type":"box","props":{"id":"maybe"},"ch..., {"type":"box","props":{"id":"maybe"},"children":[]}, undefined, undefined, undefined)
commitUpdate({"type":"box","props":{},"children":[]}, "box", [circular], {"children":false}, [circular])
resetAfterCommit({"children":[{"type":"box","props":{},"children":[]}]})
```

#### Keyed reorder (KeyedList)

`[a, b, c]`:

```
createInstance("item", {"id":"a"}, {"children":[]}, {}, [circular])
finalizeInitialChildren({"type":"item","props":{"id":"a"},"children":[]}, "item", {"id":"a"}, {})
createInstance("item", {"id":"b"}, {"children":[]}, {}, [circular])
finalizeInitialChildren({"type":"item","props":{"id":"b"},"children":[]}, "item", {"id":"b"}, {})
createInstance("item", {"id":"c"}, {"children":[]}, {}, [circular])
finalizeInitialChildren({"type":"item","props":{"id":"c"},"children":[]}, "item", {"id":"c"}, {})
createInstance("box", [circular], {"children":[]}, {}, [circular])
appendInitialChild({"type":"box","props":{},"children":[]}, {"type":"item","props":{"id":"a"},"children":[]})
appendInitialChild({"type":"box","props":{},"children":[{"type":"item","props":{"id":"a"},"child..., {"type":"item","props":{"id":"b"},"children":[]})
appendInitialChild({"type":"box","props":{},"children":[{"type":"item","props":{"id":"a"},"child..., {"type":"item","props":{"id":"c"},"children":[]})
finalizeInitialChildren({"type":"box","props":{},"children":[{"type":"item","props":{"id":"a"},"child..., "box", [circular], {})
prepareForCommit({"children":[]})
clearContainer({"children":[]})
appendChildToContainer({"children":[]}, {"type":"box","props":{},"children":[{"type":"item","props":{"id":"a"},"child...)
resetAfterCommit({"children":[{"type":"box","props":{},"children":[{"type":"item","props":{"id...)
```

Then `[c, a, b]` (a and b are appended):

```
prepareForCommit({"children":[{"type":"box","props":{},"children":[{"type":"item","props":{"id...)
commitUpdate({"type":"item","props":{"id":"c"},"children":[]}, "item", {"id":"c"}, {"id":"c"}, [circular])
appendChild({"type":"box","props":{},"children":[{"type":"item","props":{"id":"a"},"child..., {"type":"item","props":{"id":"a"},"children":[]})
commitUpdate({"type":"item","props":{"id":"a"},"children":[]}, "item", {"id":"a"}, {"id":"a"}, [circular])
appendChild({"type":"box","props":{},"children":[{"type":"item","props":{"id":"b"},"child..., {"type":"item","props":{"id":"b"},"children":[]})
commitUpdate({"type":"item","props":{"id":"b"},"children":[]}, "item", {"id":"b"}, {"id":"b"}, [circular])
commitUpdate({"type":"box","props":{},"children":[{"type":"item","props":{"id":"c"},"child..., "box", [circular], [circular], [circular])
resetAfterCommit({"children":[{"type":"box","props":{},"children":[{"type":"item","props":{"id...)
```

Then `[a, c, b]` (back to a different order):

```
prepareForCommit({"children":[{"type":"box","props":{},"children":[{"type":"item","props":{"id...)
commitUpdate({"type":"item","props":{"id":"a"},"children":[]}, "item", {"id":"a"}, {"id":"a"}, [circular])
insertBefore({"type":"box","props":{},"children":[{"type":"item","props":{"id":"c"},"child..., {"type":"item","props":{"id":"c"},"children":[]}, {"type":"item","props":{"id":"b"},"children":[]})
commitUpdate({"type":"item","props":{"id":"c"},"children":[]}, "item", {"id":"c"}, {"id":"c"}, [circular])
commitUpdate({"type":"item","props":{"id":"b"},"children":[]}, "item", {"id":"b"}, {"id":"b"}, [circular])
commitUpdate({"type":"box","props":{},"children":[{"type":"item","props":{"id":"a"},"child..., "box", [circular], [circular], [circular])
resetAfterCommit({"children":[{"type":"box","props":{},"children":[{"type":"item","props":{"id...)
```

## Questions to answer for yourself

### Why are there both `appendInitialChild` and `appendChild`?

They run in different phases, on different kinds of tree.

- **`appendInitialChild`** runs during **render**, while React builds a brand-new subtree. Neither the parent nor the child is on screen yet, so nobody can see this mutation, and React can still throw the whole subtree away.
- **`appendChild`** runs during **commit**, on a parent that's **already in the live tree**. That change is visible.

Evidence: the mount logs above contain only `appendInitialChild`, then a single `appendChildToContainer`. Updates (tests D, E, I) use `appendChild` and `insertBefore`.

### Why is an instance created during render but only attached to the root at commit?

Render can be paused, restarted or discarded (concurrent rendering, Suspense, errors), so it must not cause visible side effects. Building detached objects is safe because nobody sees them. Attaching to the root is visible, so it happens once, all together, in commit, which can't be interrupted. The user never sees a half-built tree.

The flip side (tests J and K): a throw **during commit** made React unmount the whole root, because it can't trust a partially committed tree.

### What does `shouldSetTextContent` change about the tree?

It only applies when an element's children is a **single string or number**.

- **`false`** (my choice): React creates a separate `{ text }` node with `createTextInstance`, adds it as a child, and updates it later with `commitTextUpdate`. Text shows up as a node in `children`.
- **`true`**: React creates **no** text node. The instance has to store the text itself: set it in `createInstance`, update it in `commitUpdate` (via `props.children`), and clear it in `resetTextContent` when the child becomes an element.

Multiple children (`count: {1}` in test C) always get separate text nodes, whatever this returns.

### Why does the reconciler call you before and after each commit?

`prepareForCommit` and `resetAfterCommit` wrap the whole batch of changes in one commit. They let the host do work **once per commit instead of once per change**:

- react-dom saves focus and selection before and restores them after.
- In later drills (terminal, canvas), `resetAfterCommit` is where to **repaint once** after all the changes, instead of after every `appendChild`.

Drill 1 doesn't need them, so they're no-ops here.

### When do keys turn a remove-and-create into a move?

Keys let React match old and new children **by identity instead of by position**. When the new list has an element with the **same key and same type** as an old one, React reuses that instance and moves it with `appendChild` or `insertBefore` on an object that's **already in the list**.

- **No keys:** React matches by index. Same type at the same index means reuse it and update its props. A different type means remove it and create a new one.
- **Key or type changed:** remove and create.
- React only moves what it has to. It walks the new list and keeps any child whose old position is after the last one it kept; everything else is moved.
  - `[a,b,c] → [c,a,b]`: `c` stays, `a` and `b` are appended (`appendChild`, test E).
  - `[a,b,c] → [b,a,c]`: only `a` moves, with `insertBefore(a, c)` (test I).
  - `[c,a,b] → [a,c,b]`: only `c` moves, with `insertBefore(c, b)` (logs above).

## Surprises

- **Moves reuse `appendChild` and `insertBefore`** with a child that's already in the list. Without removing it first, you get duplicates (`[a,b,c,a,b]`). In `insertBefore`, remove the child **before** looking up `beforeChild`'s index, because the removal can shift it.
- **An error during commit unmounts the entire root.** A missing `insertInContainerBefore` didn't just misplace a node: it left the container empty.
- **`commitUpdate` must never touch `instance.children`.** It receives `children` in the props, but child objects belong to `appendChild`, `insertBefore`, `removeChild` and `commitTextUpdate`. Overwriting them makes React update objects that are no longer in the tree, and nothing errors.
- **React 19 has no `prepareUpdate`**, and `commitUpdate` is called whenever the props **object** is new, not only when values differ. In the reorder logs, `item` gets `commitUpdate` with `{id:"c"} → {id:"c"}`. Diffing old vs new props, if it matters, is the host's job.
- **The container has its own versions** of the child methods: `appendChildToContainer`, `insertInContainerBefore`, `removeChildFromContainer`. They're used whenever children sit directly in the root, e.g. a fragment at the top level.
