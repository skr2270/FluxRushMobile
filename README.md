# FluxRush Mobile

FluxRush Mobile is a production-quality, low-latency, GPU-accelerated mobile finger-tracking arcade game built using **React Native**, **Expo/Bare Workflow**, **Shopify React Native Skia**, and **React Native Vision Camera**.

This application is part of the **FluxRush** project ecosystem, living as a sister project to the standalone web application.

---

## Technical Stack & Architecture

1. **High-Performance Graphic Rendering**: Powered by `@shopify/react-native-skia`, bypassing React Native's bridge rendering to perform direct C++ drawing on native GPU-backed contexts at 60–120 FPS.
2. **NPU/GPU Hand Tracking**: Integrates `react-native-vision-camera` to stream high-frame-rate feeds to machine learning frame processors, yielding real-time landmark coordinates with `<50ms` input latency.
3. **Approaching Hazard Alerts & Colorblind mode**: Visual offscreen arrow indicators draw on screen edges to signal nearby obstacles. Colorblind-safe mode alternates green/red palettes to blue/orange and renders "+" and "X" overlays for deuteranopia/protanopia compatibility.
4. **Volume Levels & Haptics Feedback Settings**: Supports 4-state cycling volume states and native haptics feedback via `react-native-haptic-feedback` with mock fallbacks for simulator testing.
5. **Autopause & AppState Hooks**: Monitors mobile application state (foreground/background) to auto-suspend ticks and pause BGM music.
6. **Optimized Math Filter Stack**: Reuses our custom state-estimation modules:
   * **Kalman Filter**: 2D coordinate stabilizer.
   * **Adaptive Smoother**: Dynamic moving average smoothing based on velocity.
   * **Velocity Predictor**: Kinematic dead-reckoning extrapolation.
   * **Spatial Hash Grid**: $O(1)$ collision partitioning for particles, hazards, and items.
7. **Zero Garbage Collection Stutter**: Relies on a ring-buffer object pool manager to prevent runtime memory allocations and sweep delays. All Skia Paint, color maps, and MaskFilters are memoized in `useMemo` to eliminate GPU memory leaks.

---

## Directory Structure

```
FluxRushMobile/
├── package.json                   # Project scripts and dependencies (React Native 0.87, Skia, Vision Camera)
├── package-lock.json              # Lockfile for reproducible npm installs
├── tsconfig.json                  # TypeScript configuration extending @react-native/typescript-config
├── App.tsx                        # Root layout, Camera permissions, coordinate bindings, pause & HUD
├── android/                       # Native Android project (Kotlin MainActivity/MainApplication, Gradle)
├── ios/                           # Native iOS project (Swift AppDelegate, Podfile, Xcode workspace)
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
    │   ├── CameraPreviewArea.tsx  # PIP preview container with skeleton wireframe toggle
    │   ├── HandPreview.tsx        # Skia-based neon skeleton wireframe renderer
    │   └── GameView.tsx           # React Native Skia Canvas viewport
    └── managers/
        ├── InputManager.ts        # Coordinate transformation & gesture parser
        ├── ObjectPoolManager.ts   # Pre-allocated entity pools (GC-free)
        ├── GameManager.ts         # Main game loop state, EMP logic, scoring
        ├── AudioManager.ts        # Audio manager with native asset loading & guards
        └── PerformanceMonitor.ts  # Budget monitor & adaptive quality engine
```

---

## Running Locally

### Prerequisites
- Node.js (>= 22.11.0 recommended)
- npm or Yarn
- iOS: macOS with Xcode and CocoaPods (`bundle exec pod install`)
- Android: Android SDK & Android Studio

### Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **iOS Pods Setup (macOS only)**:
   ```bash
   npm run pods
   ```

3. **Start Metro Bundler**:
   ```bash
   npm start
   ```

4. **Run on Android**:
   ```bash
   npm run android
   ```

5. **Run on iOS**:
   ```bash
   npm run ios
   ```

---

## Build & Release Scripts

| Command | Purpose |
|---|---|
| `npm run ts:check` | Strict TypeScript verification (`tsc --noEmit`) |
| `npm run clean` | Clean Android build artifacts (`./gradlew clean`) |
| `npm run pods` | Install iOS CocoaPods dependencies |
| `npm run build:dev-apk` | Bundle assets & assemble debug Android APK |
| `npm run build:apk` | Assemble release Android APK (`assembleRelease`) |
| `npm run build:aab` | Generate release Android App Bundle (`bundleRelease`) |
| `npm run android:signingReport` | Inspect Android signing keys |
| `npm run release:android` | Build and run Android in release mode |
| `npm run release:ios` | Build and run iOS in Release configuration |
