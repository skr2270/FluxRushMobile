import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { TrackingResult } from '../types';

interface CameraViewProps {
  isCameraActive: boolean;
  onTrackingUpdate: (result: TrackingResult) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ isCameraActive, onTrackingUpdate }) => {
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

  // Wrap the callback in useRunOnJS hook to hop back to the JS thread safely from the worklet
  const onTrackingUpdateJS = useRunOnJS(onTrackingUpdate, [onTrackingUpdate]);

  // Frame Processor setup (active in production on physical devices)
  // In React Native, frame processors run as 'worklets' on a background JS thread
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
          frameProcessor={frameProcessor} // Active in native runtime builds
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
