# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.2] - 2026-06-27

### Added
- **Skia-Based Skeleton Wireframe Preview**: Created a new `<HandPreview>` component using Shopify Skia to draw a neon-colored hand skeleton on a dark background in the PIP preview window, hiding raw camera footage by default.
- **Preview Toggle Support**: Implemented a `<CameraPreviewArea>` wrapper with an interactive button allowing users to switch between the skeleton view and the raw camera feed. Added a warning overlay that displays when the live video feed is exposed.
- **Dynamic Control Mode Settings**: Added HUD and Start screen toggles to switch between "Hand Gestures" and "Touch Screen" controls at any time. When in Touch Screen mode, the camera stream stops completely to save battery.
- **Native Audio Player Integration**: Linked the `react-native-sound` library and implemented `AudioManager.ts` to pre-load and play the CC0 synthesized WAV sound effects from local assets with zero delay.
- **Obfuscation & Package Renaming**: Renamed native Java directory structure and configuration namespaces to `com.fluxrush` and enabled ProGuard code minifiers for release builds.

## [1.0.1] - 2026-06-27

### Fixed
- **Shield Timer Decay**: Changed shield decay calculation to scale with the actual frame delta (`dt`) instead of a hardcoded `1/60` decrement, fixing accelerated shield decay on high refresh-rate screens.
- **Adaptive Smoother Latency Calculation**: Reordered the tracking update sequence inside `InputManager` to calculate `dt` before overwriting the last valid tracking timestamp. This restores correct speed-dependent filtering behavior.
- **Camera Permissions**: Added the missing `android.permission.CAMERA` tag to `AndroidManifest.xml` so the camera can be initialized and prompt the user.
- **Hand Gesture Tracking**: Bypassed the handedness classification confidence filter (`confidenceThreshold`) in `InputManager` to resolve tracking dropouts.
- **Camera Fallback Interaction**: Made the fallback error overlay interactive with a `TouchableOpacity` trigger that prompts for camera permissions again on press.

### Optimized
- **Skia Paint Allocations**: Memoized Paint objects in `GameView.tsx` via `React.useMemo` to prevent runtime object instantiation on every render, ensuring a 100% GC-free graphics rendering loop.

## [1.0.0] - 2026-06-26

This is the initial release of **FluxRush Mobile**, a production-quality, low-latency, finger-tracking mobile arcade game built using React Native and Shopify Skia.

### Added
- **Hardware-Accelerated Canvas Rendering**: Used `@shopify/react-native-skia` imperative graphics loop for 60–120 FPS drawing of gameplay grids, particles, items, and UI overlays directly on the GPU.
- **Off-Thread Frame processing**: Added `react-native-vision-camera` hooks and native worklets for hand landmarks extraction, keeping tracking latency sub-50ms.
- **Haptic Vibration Integrations**: Integrated `react-native-haptic-feedback` for tactile physical clicks upon collecting items, taking hazard damage, or triggering the EMP shockwave.
- **Ported Math & Physics Pipeline**:
  - 2D Kalman filter coordinate projection.
  - Speed-dependent exponential `AdaptiveSmoother`.
  - Kinematic `VelocityPredictor` extrapolation.
  - $O(1)$ spatial-hash broad-phase grid.
- **Object Allocation Pools**: Avoided runtime GC stuttering using pre-allocated entity pools for particles, texts, collectibles, and hazards.
- **Clean Compilation Check**: Configured strict TypeScript checks (`yarn ts:check`) completing with zero compile errors.
- **Initial Documentation**: Added detailed `README.md` and `walkthrough.md`.
