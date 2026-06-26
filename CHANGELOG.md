# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
