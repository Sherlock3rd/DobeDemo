# Task 4 Report: Unlocked-Only 3D Rendering and Animation Boundaries

## Status

GREEN — Task 4 implementation and all required gates pass.

## Implementation commit

- Hash: `28190fbe927fd44e42a72f4afaf87ce395c83bf7`
- Parent: `1d7154484a689376db55502b80137613893faa89`
- Branch: `main` (local only; not pushed)
- Message: `feat: render only unlocked building slots`
- Created with the repository's established plumbing path (`git write-tree`, `git hash-object -t commit -w --stdin`, `git update-ref`) without amend, push, force, or Git config changes.
- The six scoped source/test files were staged with their existing `100644` modes preserved. Pre-existing unrelated working-tree mode-only changes were not committed.

## RED → GREEN

1. **Unlocked-prefix RED:** added coverage for every `BuildingId` × Lv.1–10, explicit fresh repair/commercial counts, repair Lv.6 = 5, commercial Lv.6 = 6, mixed built/scaffold states, and serialized absence of locked suffix IDs/scaffold geometry. The focused render command failed in 3 tests because the old API accepted `BuildingKind` and mapped the full fixed-capacity catalog.
2. **Unlocked-prefix GREEN:** changed `getRenderedBuildingFragments` to accept `BuildingId`, resolve its definition, slice blueprints to `getUnlockedChildCount`, and only then map unlocked slots. `BuildingModel` now passes `definition.id` and memoizes on it. Focused render/model tests passed: 37/37.
3. **Animation-boundary RED:** added main-level-plus-child, hidden-child, and repair Lv.5→6 suppression cases; corrected the arbitrary-slot positive case so the chosen slot is unlocked. Two tests failed because the old detector ignored main-level changes and unlocked-prefix boundaries.
4. **Animation-boundary GREEN:** changed detection to require an unchanged main level and array length, reject every hidden-prefix delta, and accept exactly one unlocked child delta of `+1`. Existing 400 ms clearing, same-slot restart, multi-change/reset/rehydrate suppression, and reduced-motion behavior remain covered.
5. **Geometry envelope:** expanded every-building Lv.1–10 checks to representative unlocked child levels 0, 1, and current main level while preserving footprint, AABB, rooftop attachment, semantic tag, positive geometry, and hitbox assertions.

## Files

- `src/scene/city/buildingFragmentCatalog.ts`
- `src/scene/city/buildingFragmentCatalog.test.ts`
- `src/scene/city/BuildingVisual.tsx`
- `src/scene/city/BuildingVisual.test.tsx`
- `src/scene/city/BuildingModel.tsx`
- `src/scene/city/BuildingModel.test.tsx`

## Gates

- Task-focused tests: 4 files / 63 tests passed.
- Full suite: 37 files / 466 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run format:check`: passed.

## Self-review

- Rendering creates no fragment group, scaffold, mesh, or animation candidate for locked suffix slots because slicing occurs before render-state/geometry mapping.
- Lv.0 unlocked slots remain scaffold-only; Lv.1+ unlocked slots retain their own authored geometry and independent child-level enhancement.
- Animation identity remains the stable blueprint ID; only one unlocked child `+1` at unchanged main level can opt in, while consecutive upgrades of that same ID still increment `animationRun` and restart the 400 ms animation.
- Main-level transitions (including a newly visible Lv.0 slot and repair Lv.5→6), hidden changes, array migrations, multi-slot changes, resets, initial mount, and rehydrate cannot animate.
- Scope stayed within the six Task 4 files plus this report; no UI, Settings, Store, or progression rules were changed.

## Concerns

- The implementation commit is local only and not pushed, as requested.
- The repository still shows numerous pre-existing unrelated `100644 → 100755` working-tree mode-only changes; they were deliberately left unstaged and outside this task.
