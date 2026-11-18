# Drill 2: Markdown string

## Call logs

<!-- Paste instrumented logs here: static mount, a state update from outside render(), a keyed reorder, a misplaced text node. -->

## Questions to answer for yourself

### Where does serialization happen, and why there?

### How does host context decide where text is allowed?

### Which errors can you catch in the render phase, and which only at commit?

### How does an error thrown inside the host config reach the caller of `render()`?

### Why should ordered-list numbers be worked out at serialization time, not stored on instances?

### Did `shouldSetTextContent` help anywhere (code blocks?), and what did it cost?

## Surprises
