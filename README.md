# FluxRush Mobile

FluxRush Mobile is a production-quality, low-latency, GPU-accelerated mobile finger-tracking arcade game built using **React Native**, **Expo/Bare Workflow**, **Shopify React Native Skia**, and **React Native Vision Camera**.

This application is part of the **FluxRush** project ecosystem, living as a sister project to the standalone web application.

---

## Technical Stack & Architecture

1. **High-Performance Graphic Rendering**: Powered by `@shopify/react-native-skia`, bypassing React Native's bridge rendering to perform direct C++ drawing on native GPU-backed contexts at 60–120 FPS.
2. **NPU/GPU Hand Tracking**: Integrates `react-native-vision-camera` to stream high-frame-rate feeds to machine learning frame processors, yielding real-time landmark coordinates with `<50ms` input latency.
3. **Optimized Math Filter Stack**: Reuses our custom state-estimation modules:
   * **Kalman Filter**: 2D coordinate stabilizer.
   * **Adaptive Smoother**: Dynamic moving average smoothing based on velocity.
   * **Velocity Predictor**: Kinematic dead-reckoning extrapolation.
   * **Spatial Hash Grid**: $O(1)$ collision partitioning for particles, hazards, and items.
4. **Zero Garbage Collection Stutter**: Relies on a ring-buffer object pool manager to prevent runtime memory allocations and sweep delays.

---

## Directory Structure

```
FluxRushMobile/
├── package.json                   # Project dependencies (Vision Camera, Skia, Worklets)
├── tsconfig.json                  # Strict TypeScript configuration
├── App.tsx                        # Root layout, Camera permissions, coordinate bindings
└── src/
    ├── types/
    │   └── index.ts               # Shared game types
    ├── utils/
    │   ├── KalmanFilter.ts        # 2D state-estimation filter
    │   ├── AdaptiveSmoother.ts    # Speed-dependent exponential filter
    │   ├── VelocityPredictor.ts   # Kinematic extrapolation
    │   └── SpatialHash.ts         # Collision partitioning grid
    ├── components/
    │   ├── CameraView.tsx         # Vision Camera Frame Processor container
    │   └── GameView.tsx           # React Native Skia Canvas viewport
    └── managers/
        ├── InputManager.ts        # Coordinate transformation & gesture parser
        ├── ObjectPoolManager.ts   # pre-allocated entity pools
        ├── GameManager.ts         # Main game loop state, EMP logic, scoring
        ├── AudioManager.ts        # Audio stubs for native mobile playback
        └── PerformanceMonitor.ts  # Budget monitor & adaptive quality engine
```

---

## Running Locally

### Prerequisites
- Node.js (v18+)
- Yarn v4 (enabled via Corepack)
- iOS: macOS with Xcode installed
- Android: Android SDK & Android Studio installed

### Getting Started

1. **Install Dependencies**:
   ```bash
   yarn install
   ```
2. **Start Metro Bundler**:
   ```bash
   yarn start
   ```
3. **Run on iOS**:
   ```bash
   yarn ios
   ```
4. **Run on Android**:
   ```bash
   yarn android
   ```

---

## Verification & Type Checks
To verify that the codebase compiles with zero TypeScript errors:
```bash
yarn ts:check
```
