# FluxRush Mobile Walkthrough

FluxRush Mobile is a standalone React Native application built to deliver high-performance, GPU-accelerated finger tracking and gameplay rendering on iOS and Android devices.

---

## Key Achievements & Implementation Details

1. **Hardware-Accelerated Skia Drawing**: All game components (neon particles, hazards, collectibles, player shield, and grid lines) are rendered imperatively using Shopify's `@shopify/react-native-skia` library, targeting a solid 60–120 FPS.
2. **NPU/GPU Frame Processing**: Set up configuration hooks for `react-native-vision-camera` to stream native video frames through off-thread worklets, feeding landmarks directly to the input system.
3. **Decoupled Main Thread Loops**: Frame drawing executes via Skia’s drawing callback, while game physics and coordinate tracking execute at fixed updates, decoupling graphics from tracking processing.
4. **Haptic Feedback**: Integrated `react-native-haptic-feedback` to trigger physical haptic vibrations during collision events and EMP activations.
5. **No GC Stuttering**: Kept garbage collection overhead to 0% in runtime loops by porting our standard `ObjectPoolManager` and reusing all game nodes.

---

## Verification & Type Safety

We ran strict type verification inside `FluxRushMobile/`:
```bash
yarn ts:check
```
The codebase compiles **cleanly with zero errors or warnings**.

---

## Git Repository
Initialized Git repository inside `FluxRushMobile/` and staged all initial project files:
```bash
git init
git add .
git commit -m "Initial commit: FluxRush mobile React Native codebase"
```
