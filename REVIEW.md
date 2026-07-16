# Release Review — FluxRush Mobile (React Native App)

_Reviewed: 2026-07-16 — Reviewer: AI Code Review_

---

## STATUS: CONDITIONALLY APPROVED

The mobile app successfully ports the core FluxRush gameplay to React Native with Skia rendering and haptic feedback. The architecture is sound, but there are several issues specific to the mobile platform that must be addressed before app store submission.

---

## 🐛 Bugs & Issues

### P0 — Critical (Must Fix Before Release)

1. **Camera tracking uses simulated landmarks, not real hand detection.**
   - `CameraPreviewArea.tsx` L39–66 runs a `setInterval` that generates _fake_ circular-motion landmarks (`Math.sin(angle)`, `Math.cos(angle)`) and feeds them into `onTrackingUpdate()`. This means the "GESTURE" mode is a simulation demo, not actual hand tracking. The `CameraView` component is mounted but its real frame processing output is never connected to the game's input pipeline.
   - **Impact:** Gesture mode is non-functional. Players think they are controlling the game with their hand, but the cursor moves in a fixed circular pattern regardless of hand position.

2. **Combo timer, level, and shield cooldown not shown in HUD.**
   - Same as web: `getComboTimerRatio()`, `getLevel()`, and `getShieldTimerRatio()` are exposed by `GameManager.ts` but never rendered in `App.tsx`. Players have zero visibility into these core mechanics.
   - **Impact:** Core gameplay systems are invisible to the player.

3. **`isHandVisible` read outside of the render cycle is stale.**
   - In `App.tsx` L174, `const isHandVisible = input.isHandVisible()` is read at the top level of the component function. This value is only recalculated when a state change triggers a re-render. Between re-renders, the `GameView` receives a potentially stale `isHandVisible` prop, causing the cursor to flicker or disappear during rapid tracking transitions.
   - **Impact:** Cursor may not render even though hand is being tracked.

### P1 — High (Should Fix Before Release)

4. **Touch input coordinates use raw `locationX`/`locationY` without safe area offset.**
   - In `App.tsx` L170–171, `handleTouchInput` reads `e.nativeEvent.locationX/Y` directly. On devices with notches, rounded corners, or navigation bars, these coordinates may not align with the Skia canvas coordinate space. The `input.resize(width, height)` call uses `useWindowDimensions` which includes safe area insets on some devices.
   - **Impact:** Touch tracking is offset on notched devices (iPhone 14+, Pixel 7+).

5. **No landscape orientation lock.**
   - The app does not enforce landscape orientation. In portrait mode, the game canvas is tall and narrow, making gameplay impractical. The web version shows a "LANDSCAPE REQUIRED" notice, but the mobile app has no equivalent.
   - **Impact:** Unplayable in portrait mode.

6. **Sound assets (`collect.wav`, `hit.wav`, `combo.wav`, `bgm.wav`) existence not verified.**
   - `AudioManager.ts` loads WAV files from the native asset bundle. If any file is missing from `android/app/src/main/assets/` or the iOS bundle, the `Sound` constructor will log a warning but gameplay will proceed in silence.
   - **Impact:** Players may experience a silent game with no audio feedback.

7. **No pause/resume functionality.**
   - Same as web. There is no way to pause during gameplay. If the player receives a phone call, notification, or switches apps, the game continues ticking (and the `requestAnimationFrame` loop may even stall, causing a large `dt` spike on resume).
   - **Impact:** Guaranteed death on any interruption.

8. **Performance recording runs every frame regardless of game state.**
   - In `App.tsx` L131, `perf.recordFrame()` is called unconditionally during the `PLAYING` loop. Unlike the web fix that guards this call, the mobile version has no equivalent guard. However, since the loop only runs during `PLAYING`, this is less severe. The real issue is that the `paintDurationMs` parameter is hardcoded to `1.0` (L131), making the performance monitor's paint time metric meaningless.
   - **Impact:** Quality degradation decisions are based on inaccurate paint timing data.

### P2 — Medium (Should Fix Post-Launch)

9. **`Skia.Color()` called inside the `onDraw` callback for every particle.**
   - In `GameView.tsx` L208, `particlePaint.setColor(Skia.Color(p.color))` parses a CSS color string into a Skia color on every particle, every frame. With 600 particles in the pool, this is up to 600 string-to-color conversions per frame.
   - **Impact:** Unnecessary CPU overhead; should cache color lookups.

10. **`playerGlowPaint.setMaskFilter()` called every frame.**
    - In `GameView.tsx` L221, a new `MaskFilter` is created every frame when the player is visible. `MaskFilter.MakeBlur()` allocates native Skia resources that should be memoized.
    - **Impact:** Potential native memory churn.

11. **App crashes if `react-native-haptic-feedback` is not linked.**
    - The `try/catch` in `triggerHaptic` (L20–24) catches errors, but if the native module is not linked at all, the `import` at L3 will throw at module load time, crashing the app before it renders.
    - **Impact:** Build failure on platforms without haptic support.

12. **No app icon, splash screen, or store listing assets.**
    - The project has no app icon, adaptive icon, splash screen, or store screenshot assets. These are required for Play Store and App Store submission.

---

## 💡 Suggested Improvements for Best Gameplay Experience

### Gameplay & Engagement

1. **Connect real camera hand tracking to the game input pipeline** — The `CameraView` component processes camera frames via `react-native-vision-camera` worklets. Wire the actual detected landmarks from the vision frame processor into `onTrackingUpdate()` instead of the current simulated circular motion. This is the single most important improvement since gesture control is the game's core differentiator.

2. **Add combo meter bar, level indicator, and shield cooldown UI** — Render an animated progress bar below the HUD that shows the combo timer. Display the current level as a badge. Show a cooldown arc around the player orb for the shield.

3. **Implement pause/resume** — Detect `AppState` changes (`react-native` `AppState` API) to automatically pause on background. Add a pause button overlay during gameplay.

4. **Lock screen orientation to landscape** — Set `android:screenOrientation="landscape"` in `AndroidManifest.xml` and configure `UIInterfaceOrientationLandscapeLeft/Right` in `Info.plist`.

5. **Add an invincibility grace period** — Same as web: prevent multi-hit deaths by adding a 500ms invincibility window after taking damage.

6. **Add edge-of-screen hazard warnings** — Show pulsing red indicators on screen edges when hazards approach from off-screen.

### Audio & Feedback

7. **Use pre-loaded sound pool pattern** — Pre-load all sounds at app startup rather than on first `init()` call. This avoids the first-play audio delay.

8. **Add haptic patterns for shield activation and EMP** — Currently only `impactLight` and `impactHeavy` are used. Add `selection` for shield and a custom pattern for EMP.

9. **Add volume controls** — Allow users to adjust SFX and BGM volume independently via a settings screen.

### Accessibility

10. **Add colorblind-safe mode** — Use shape and pattern differentiation alongside color (e.g., circles with icons for collectibles, spiky outlines for hazards).

11. **Support Dynamic Type / font scaling** — HUD text should respect the system font size accessibility setting.

12. **Add a tutorial overlay for first-time players** — Animate hand gesture demonstrations (fist, pinch, point) overlaid on the game screen during the first play session.

### Performance & Technical

13. **Cache `Skia.Color()` conversions** — Pre-compute a color lookup map for the 4–5 colors used (`#39ff14`, `#ff003c`, `#bd00ff`, `#00ffff`, `#0a0a14`) and reference the cached Skia color objects inside `onDraw`.

14. **Memoize `MaskFilter.MakeBlur()` calls** — Create the blur mask filters once in `useMemo` and reuse them. Do not re-create them every frame.

15. **Profile `requestAnimationFrame` vs Skia's built-in animation loop** — Consider using `@shopify/react-native-skia`'s declarative animation APIs (e.g., `useSharedValueEffect`) instead of manual `requestAnimationFrame` to leverage native Skia timing.

16. **Add crash reporting** — Integrate a crash reporter (Sentry, Bugsnag, or Firebase Crashlytics) before market release to catch native crashes in production.

17. **Add store listing assets** — Generate an app icon, adaptive icon, splash screen, and at least 3 store screenshots for Play Store / App Store submission.

18. **Test on low-end devices** — The Skia `MaskFilter.MakeBlur()` glow effects may be expensive on budget Android devices. Ensure the `LOW` quality tier disables all blur effects.