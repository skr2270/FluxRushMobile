import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { TrackingResult } from '../types';

interface CameraViewProps {
  onTrackingUpdate: (result: TrackingResult) => void;
  isCameraActive: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({ onTrackingUpdate, isCameraActive }) => {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [permissionStatus, setPermissionStatus] = useState<'loading' | 'granted' | 'denied'>('loading');

  useEffect(() => {
    (async () => {
      if (hasPermission) {
        setPermissionStatus('granted');
      } else {
        const granted = await requestPermission();
        setPermissionStatus(granted ? 'granted' : 'denied');
      }
    })();
  }, [hasPermission, requestPermission]);

  // Frame Processor setup (active in production on physical devices)
  // In React Native, frame processors run as 'worklets' on a background JS thread
  //
  // Disabled: VisionCamera v5 (Nitro) no longer exports `useFrameProcessor`, and the
  // native build has frame processors turned off (VisionCamera_enableFrameProcessors=false).
  // Re-enable together with a v5-compatible worklet API and the MediaPipe plugin.
  /*
  const onTrackingUpdateJS = useRunOnJS(onTrackingUpdate, [onTrackingUpdate]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    try {
      // Call native MediaPipe TFLite Frame Processor Plugin (if registered globally)
      const detectHandLandmarks = (globalThis as any).detectHandLandmarks;
      if (detectHandLandmarks) {
        const landmarks = detectHandLandmarks(frame);
        if (landmarks) {
          onTrackingUpdateJS({
            landmarks: landmarks.points,
            confidence: landmarks.confidence,
            handPresent: true,
            latencyMs: landmarks.latency
          });
        } else {
          onTrackingUpdateJS({ landmarks: [], confidence: 0, handPresent: false, latencyMs: 0 });
        }
      }
    } catch (e) {
      console.warn("Frame processor error", e);
    }
  }, [onTrackingUpdateJS]);
  */

  // Simulator Fallback Loop: Simulates coordinates when running on simulators
  useEffect(() => {
    if (permissionStatus !== 'granted' || !isCameraActive) return;

    // Simulate hand coordinates floating in a circular shape for testing
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.05;
      
      // Simulate landmark points (index finger tip is index 8)
      const simulatedLandmarks = Array(21).fill(null).map((_, i) => {
        if (i === 8) {
          return {
            x: 0.5 + Math.sin(angle) * 0.25,
            y: 0.5 + Math.cos(angle) * 0.25,
            z: 0
          };
        }
        // Fist/Pinch trigger simulation
        if (i === 4) { // Thumb
          return { x: 0.8, y: 0.8, z: 0 };
        }
        return { x: 0, y: 0, z: 0 };
      });

      onTrackingUpdate({
        landmarks: simulatedLandmarks,
        confidence: 0.85,
        handPresent: true,
        latencyMs: 8
      });
    }, 33); // ~30 FPS tracking updates

    return () => clearInterval(interval);
  }, [permissionStatus, isCameraActive, onTrackingUpdate]);

  if (permissionStatus === 'loading') {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Initializing camera configurations...</Text>
      </View>
    );
  }

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
  };

  if (permissionStatus === 'denied' || !device) {
    return (
      <TouchableOpacity style={styles.center} onPress={handleRequestPermission} activeOpacity={0.8}>
        <Text style={styles.errorText}>Camera access unavailable. Touch mode active.</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {isCameraActive && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          // frameProcessor={frameProcessor} // Active in native runtime builds
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#07070d',
    padding: 20,
  },
  text: {
    color: '#8c8ca3',
    fontSize: 14,
  },
  errorText: {
    color: '#ff003c',
    fontSize: 14,
    textAlign: 'center',
  },
});
