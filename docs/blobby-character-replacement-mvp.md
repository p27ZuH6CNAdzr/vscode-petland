# Character Replacement MVP

Status: the first three milestones are implemented: Agents-only runtime switching, idle/working poses derived from the displayed chat request state, and character-safe enablement announcements. The complete MVP is not yet verified.

## Goal

Prove that a completely different character can replace Blobby in the Agents window without reproducing Blobby's functionality.

The MVP succeeds when a user can select the replacement at runtime, send a chat request, see its pose change, and switch back to Blobby without restarting.

“Full character replacement” means a new visual identity, not feature parity.

## Agreed scope

| Area | MVP decision |
| --- | --- |
| Surface | Agents window only; editor-window Blobby is unchanged |
| Artwork | Two static transparent 96-by-96 PNGs: idle and working |
| Motion | None |
| Position | Stationary at the existing chat-input perch |
| Selection | Runtime choice between Blobby and Replacement |
| Persistence | Remember the choice locally across restarts |
| Default | Blobby |
| Integration | Observe the displayed chat's existing request state |

The replacement uses an original, procedurally drawn clockwork owl. Replacing either image with artwork of the same dimensions must not require behavior changes.

## Behavior contract

| Situation | Replacement behavior |
| --- | --- |
| No active request | Idle pose |
| Active request, not awaiting confirmation | Working pose |
| Awaiting confirmation | Idle pose; existing confirmation UI remains authoritative |
| Request completes, fails, or is canceled | Idle pose |
| Displayed chat changes | Immediately derive the pose from the new host's chat |
| Replacement selected during a request | Immediately show the corresponding pose |
| Host changes | Move directly to the new input perch without a transition effect |
| No eligible visible host | Hidden |
| Pet disabled or AI features hidden | Hidden |
| Application restarts | Restore character choice without changing existing pet enablement |

Idle is a visual resting pose, not a claim that no confirmation or other user action is pending. The replacement does not become an alternative source of request status or error reporting.

Preserve the existing pet's active-window visibility rules so the replacement does not create an additional visible companion in another window.

## Explicit non-goals

- Animations, blinking, gaze tracking, facing changes, or runtime eye overlays.
- Click reactions, sleep, emotions, speech, or sound.
- Dragging, throwing, hopping, collision physics, respawn effects, or games.
- Accessories, achievements, recoloring, or size controls for the replacement.
- Conversation, model calls, tools, or a new agent-state integration.
- Character packs, skin manifests, asset importers, or extension APIs.
- A new settings page or customization editor.
- Replacing Blobby in editor windows.
- Deleting or simplifying Blobby's existing implementation.

Unsupported Blobby controls must not be presented as if they apply to the replacement. Existing Blobby preferences and achievement state remain intact.

## Implementation approach

### Reuse the host, not the full Blobby widget

Implement a small replacement widget rather than adding many disabled-feature branches to `ChatPetWidget`.

The existing [widget coordinator](../src/vs/workbench/contrib/chat/browser/widget/chatPetWidgetService.ts) already works with widget disposal, host changes, and optional game access. Use that lifecycle seam to select the implementation, while keeping Agents-specific selection in the appropriate owning layer.

The existing [host contract](../src/vs/workbench/contrib/chat/browser/widget/chatPetWidget.ts) provides the chat model and platform information. Observe that model directly; do not introduce a second provider or agent integration.

### Minimal pieces

1. **Artwork:** two bundled transparent PNGs with identical dimensions and a consistent body anchor. Bake eyes into the images. Start with a 96-by-96 source canvas displayed at the existing 48-by-48 default size.
2. **Replacement widget:** render one of the two images, observe request state, position at the input perch, and handle visibility and disposal. No animation scheduler or accessory compositor.
3. **Selection command:** an Agents-window-only Command Palette action offering Blobby or Replacement. Keep selection keyboard-accessible and respect AI feature hiding.
4. **Local selection state:** persist only the character choice through an owning service. Do not write another component's private storage keys or reset Blobby preferences.
5. **Switching lifecycle:** dispose the outgoing implementation and create the selected implementation against the current host. Editor windows always retain Blobby.

Keep the integration narrow. Do not introduce a general character registry, capability framework, or configurable asset pipeline.

The [color implementation](../src/vs/workbench/contrib/chat/browser/chatPetColors.ts), accessory rig, and Blobby sprite assets do not need modification.

### Implementation checks

Before editing, confirm the smallest supported wiring for:

- Agents-window-specific selection without reversing the Sessions-to-Workbench dependency direction.
- Reusing enablement, AI hiding, active-window ownership, and host visibility without instantiating a hidden Blobby widget.
- Replacing the active implementation without losing the current host or leaking model subscriptions.

These are integration checks, not reasons to expand the MVP. If a shared lifecycle change is necessary, keep it limited to what both implementations require.

## Accessibility and failure handling

- Treat static character artwork as decorative, not as a button or an extra keyboard stop.
- Use a localized, keyboard-operable selection command and announce a user-requested selection change.
- Update existing accessibility help to explain selection and the replacement's limited behavior.
- Keep existing chat progress, confirmation, completion, and error accessibility behavior unchanged.
- Static poses work identically with reduced motion enabled.
- Report asset-load failures explicitly through repository-standard diagnostics. Do not silently restore Blobby or leave an invisible interactive element.

## Implementation sequence

1. Establish runtime switching with one idle placeholder, local persistence, visibility, cleanup, and focused validation.
2. Add the working placeholder and derive its pose from the displayed chat's request and confirmation state.
3. Finish character-aware accessibility messaging and verify the complete request, chat-switching, and multi-window flow.

Keep each slice incremental and reviewable. Final artwork and additional character behavior are separate follow-up decisions.

## Acceptance criteria

Checked items have focused-test or live verification, as detailed below; they do not imply that every multi-window scenario has been exercised.

- [x] Switch between Blobby and Replacement without restarting.
- [x] Exactly one selected character appears in an eligible Agents-window host.
- [x] Idle and working poses follow request lifecycle, including confirmation, cancellation, and errors.
- [x] Switching characters during a request immediately shows the correct pose.
- [x] Switching chats immediately follows the newly displayed chat's state.
- [x] Host changes and resizing preserve placement without movement effects.
- [x] Hide/show works and selection survives restart.
- [x] AI feature hiding and active-window visibility remain effective.
- [ ] Editor-window Blobby is unchanged.
- [x] Returning to Blobby restores its existing widget and preserves its preferences.
- [x] No Blobby eyes, accessories, effects, or invisible gesture handlers remain active over the replacement.
- [x] Repeated switching does not accumulate DOM nodes or subscriptions.
- [x] Selection is keyboard-accessible and help accurately describes the limited replacement.
- [x] Missing artwork produces an explicit diagnostic without silently switching characters.

## Validation plan

Add focused tests for state mapping, selection scope and persistence, switching disposal, and visibility. Reuse existing pet coordinator tests where appropriate; do not duplicate Blobby's full test suite.

Manually exercise the acceptance flow in a running Agents window: select Replacement, send a request, cancel or complete it, switch chats, switch back to Blobby, and restart to verify persistence. Also check keyboard selection, reduced motion, resizing, and AI opt-out.

Run the smallest existing lint, build, and test commands covering the implementation. Record commands and results for each milestone.

## First milestone

### What is available

In the Agents window, run **Chat: Select Pet Character** from the Command Palette and choose **Replacement**. An original robot placeholder replaces Blobby at the input perch. Choose **Blobby** to restore its existing widget without restarting. Character selection does not enable the pet; `/vscode-pet` retains its existing show/hide behavior.

The [Sessions character service](../src/vs/sessions/contrib/chat/browser/chatPetCharacter.ts) persists the choice locally, independently of Blobby's appearance preferences. The [Sessions widget service](../src/vs/sessions/contrib/chat/browser/sessionsChatPetWidgetService.ts) reuses the existing host coordinator and disposes the outgoing widget before creating the next one. Both implementations share the extracted [window-ownership helper](../src/vs/workbench/contrib/chat/browser/widget/chatPetWindowOwnership.ts); editor windows do not load the replacement contribution.

The [replacement widget](../src/vs/sessions/contrib/chat/browser/chatPetReplacementWidget.ts) renders one decorative image with no interaction handlers, animation scheduler, or agent integration. Its [idle artwork](../src/vs/sessions/contrib/chat/browser/media/chatPetReplacement/idle.png) is a 96-by-96 transparent PNG displayed at 48-by-48.

### Validation results

- `pnpm run typecheck-client` — passed.
- `pnpm run valid-layers-check` — passed.
- `pnpm run build-fast --client-only` — passed, including incremental refresh after the final test change.
- `pnpm run build-fast` — passed through the existing **Build Fast** workspace task to prepare extension outputs for live verification.
- Targeted `pnpm run oxlint` on the ten changed TypeScript files — passed.
- `pnpm run stylelint src/vs/sessions/contrib/chat/browser/media/chatPetReplacement.css` — passed.

The combined regression selection passed with **187 passing, 1 pending**:

```bash
./scripts/test.sh \
  --run src/vs/sessions/contrib/chat/test/browser/chatPetCharacter.test.ts \
  --run src/vs/workbench/contrib/chat/test/browser/widget/chatPetWidgetService.test.ts \
  --run src/vs/workbench/contrib/chat/test/browser/widget/chatPetWidget.test.ts \
  --reporter dot
```

After adding explicit asset-load-error assertions to the new suite, the following passed with **5 passing**; production code was unchanged:

```bash
./scripts/test.sh \
  --run src/vs/sessions/contrib/chat/test/browser/chatPetCharacter.test.ts \
  --reporter dot
```

The [focused tests](../src/vs/sessions/contrib/chat/test/browser/chatPetCharacter.test.ts) cover persistence, untouched Blobby preferences, disposal-before-creation, latest-host retention, command scope, AI opt-out while the picker is open, stationary placement, host changes, active-window and enablement visibility, decorative semantics, resize-observer cleanup, and explicit image failure diagnostics.

Live verification in an isolated source-built Agents window confirmed replacement rendering, three complete switching cycles using arrow keys and Enter in the character picker, exactly one widget after each switch, no leftover Blobby button or eyes, placement after resizing, restoration after renderer reload and application restart, `/vscode-pet` hide/show without a model request, and nonanimated decorative rendering with reduced motion enabled.

The first live launch exposed missing development extension outputs; the full fast build resolved those activation failures. The isolated profile was not signed in, so unrelated authentication/provider diagnostics remained. No credentials were changed or required for this milestone. Test-controller discovery was unavailable, so validation used the repository's Electron test runner. ESLint was not installed; the repository's targeted oxlint and stylesheet checks were used instead.

## Second milestone

### What changed

The replacement now selects its idle or working image from the displayed host's `IChatModel.requestInProgress` observable. The model reports false while awaiting confirmation and after a request completes, fails, or is canceled, so those states return to the idle pose without a second request-state integration. Switching the displayed chat or host rebinds the observation and immediately derives the new pose.

The new [working artwork](../src/vs/sessions/contrib/chat/browser/media/chatPetReplacement/working.png) shares the idle image's 96-by-96 canvas, alpha mask, and body anchor. Its focused eyes and task display distinguish the stationary working pose.

### Validation results

- `pnpm run build-fast --client-only` — passed.
- `pnpm run typecheck-client` — passed.
- `pnpm run oxlint src/vs/sessions/contrib/chat/browser/chatPetReplacementWidget.ts src/vs/sessions/contrib/chat/test/browser/chatPetCharacter.test.ts` — passed.
- `./scripts/test.sh --run src/vs/sessions/contrib/chat/test/browser/chatPetCharacter.test.ts --reporter dot` — passed, 6 tests.

The focused test covers initial selection during an active request, a displayed-chat change, a transition to idle while waiting for confirmation, host replacement, and stopping observation of the previous host. VS Code test discovery did not expose this test file, so the repository's Electron test runner was used.

## Third milestone

### What changed

Enabling the pet in the Agents window now announces only that it is enabled; it no longer promises Blobby-only click or arrow-key interactions when the replacement is selected. Editor windows retain the existing Blobby interaction announcement. This keeps the shared Workbench service independent of Sessions-only character selection.

Agents-window accessibility help now documents keyboard character selection, the replacement's stationary idle/working poses, and its lack of interactions and Blobby customizations. Blobby-only movement, game, painting, achievement, and customization guidance is explicitly scoped to Blobby; editor-window help remains unchanged.

### Validation results

- `pnpm run build-fast --client-only` — passed.
- `./scripts/test.sh --run src/vs/workbench/contrib/chat/test/browser/chatPetService.test.ts --reporter dot` — passed, 2 tests.
- `pnpm run typecheck-client` — passed.
- `pnpm run oxlint src/vs/workbench/contrib/chat/browser/chatPetService.ts src/vs/workbench/contrib/chat/test/browser/chatPetService.test.ts` — passed.
- `pnpm run oxlint src/vs/workbench/contrib/chat/browser/actions/chatAccessibilityHelp.ts src/vs/workbench/contrib/chat/test/browser/accessibility/chatAccessibilityHelp.test.ts src/vs/sessions/contrib/chat/browser/sessionsChatAccessibilityHelp.ts src/vs/sessions/contrib/chat/test/browser/sessionsChatAccessibilityHelp.test.ts` — passed.
- `./scripts/test.sh --run src/vs/workbench/contrib/chat/test/browser/accessibility/chatAccessibilityHelp.test.ts --run src/vs/sessions/contrib/chat/test/browser/sessionsChatAccessibilityHelp.test.ts --reporter dot` — passed, 158 tests.

### Remaining work

- Verify actual editor/Agents window ownership handoff, chat switching, screen-reader announcements, and the complete two-pose flow in a signed-in session. Current host and visibility coverage includes focused tests, not a live multi-window session.
- Rebuild any separately packaged application before expecting it to contain these source changes.

## Artwork follow-up

The robot placeholder has been replaced with an original teal-and-copper clockwork owl, generated with Pillow. The idle pose has open eyes and a brass chest detail. The working pose lowers its brow and holds a bright task panel, distinguishing the poses by shape as well as color. Both are static art, not animations.

Both transparent sprites remain 96-by-96 and display at 48-by-48. They share the same silhouette and bottom anchor, use solid 8-by-8 logical pixels, and contain no antialiased or partial-alpha pixels. Existing request-state behavior, decorative accessibility semantics, and character selection are unchanged.

### Validation results

- Pillow checks passed for exact dimensions, binary transparency, matching alpha masks and bottom anchors, distinct poses, and uniform 8-by-8 logical-pixel blocks.
- Both poses were reviewed at enlarged and actual display sizes on light and dark backgrounds.
- `pnpm run build-fast --client-only` — passed.
- `./scripts/test.sh --run src/vs/sessions/contrib/chat/test/browser/chatPetCharacter.test.ts --run src/vs/workbench/contrib/chat/test/browser/widget/chatPetWidget.test.ts --reporter dot` — passed, 184 passing and 1 pending. VS Code test discovery did not expose either suite, so validation used the repository's Electron test runner.
- The new artwork has not been verified in a live Agents window.
