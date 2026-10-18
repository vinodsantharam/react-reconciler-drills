# Drill 1: Plain object tree

## Call logs

<!-- Paste instrumented logs here: mount, text, update, removal, keyed reorder. -->

## Questions to answer for yourself

### Why are there both `appendInitialChild` and `appendChild`?

### Why is an instance created during render but only attached to the root at commit?

### What does `shouldSetTextContent` change about the tree?

### Why does the reconciler call you before and after each commit?

### When do keys turn a remove-and-create into a move?

## Surprises
