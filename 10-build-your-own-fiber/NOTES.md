# Drill 10: Build your own Fiber

## Call logs

<!-- `npm run compare [scenario]` prints the real reconciler's host calls next to yours. -->

### Mount: React's log vs yours

### A keyed reorder: React's log vs yours

### A state update: React's log vs yours

## Questions to answer for yourself

### Why does a fiber link to `child`, `sibling` and `return` instead of holding a children array?

### What is a "unit of work", and why can the render phase stop between two of them but the commit phase can't?

### Why are host instances created in `completeWork` (bottom-up) and attached to the container in one call?

### What are the current and work-in-progress trees, and what is `alternate` for?

### Where do hooks live, and why must they be called in the same order on every render?

### What happens to an unfinished render when a new update arrives? What does React do?

### How does React's keyed diff (`lastPlacedIndex`) decide what moves? Why did c stay put in `[a,b,c] → [c,a,b]`?

### When does React skip re-rendering a component (bailout), and what did you need to track to do the same?

### Which host calls did the real reconciler make that yours didn't, or the other way round, and why?

## Surprises
