import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { CameraView } from './CameraView';
import { HandPreview } from './HandPreview';
import { TrackingResult, Vec3 } from '../types';

interface CameraPreviewAreaProps {
  isCameraActive: boolean;
  onTrackingUpdate: (result: TrackingResult) => void;
}

type PreviewMode = 'skeleton' | 'video';

export const CameraPreviewArea: React.FC<CameraPreviewAreaProps> = ({
  isCameraActive,
  onTrackingUpdate,
}) => {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('skeleton');
  const [landmarks, setLandmarks] = useState<Vec3[]>([]);
  const [handPresent, setHandPresent] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const noticeTimeoutRef = useRef<any>(null);

  const handleTrackingUpdate = (res: TrackingResult) => {
    // 1. Pass tracking result to main game manager
    onTrackingUpdate(res);

    // 2. Update local state for skeleton renderer (only need to trigger re-render if skeleton is active)
    if (previewMode === 'skeleton') {
      setLandmarks(res.landmarks);
      setHandPresent(res.handPresent);
    }
  };

  const toggleMode = () => {
    if (previewMode === 'skeleton') {
      setPreviewMode('video');
      setShowPrivacyNotice(true);

      // Dismiss privacy notice after 4 seconds
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = setTimeout(() => {
        setShowPrivacyNotice(false);
      }, 4000);
    } else {
      setPreviewMode('skeleton');
      setShowPrivacyNotice(false);
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = null;
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* 1. Underlying Camera Feed (Runs in background to process frames) */}
      <CameraView
        onTrackingUpdate={handleTrackingUpdate}
        isCameraActive={isCameraActive}
      />

      {/* 2. Overlaid Skeleton Wireframe */}
      {previewMode === 'skeleton' && (
        <HandPreview
          landmarks={landmarks}
          handPresent={handPresent}
          width={100}
          height={75}
        />
      )}

      {/* 3. Privacy warning banner */}
      {previewMode === 'video' && showPrivacyNotice && (
        <View style={styles.privacyNotice}>
          <Text style={styles.privacyText}>Camera feed visible — face & room shown</Text>
        </View>
      )}

      {/* 4. Small absolute toggle button */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={toggleMode}
        activeOpacity={0.7}
      >
        <Text style={styles.toggleText}>
          {previewMode === 'skeleton' ? '👁' : '🦴'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 15, 30, 0.85)',
    borderWidth: 1,
    borderColor: '#00ffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
  },
  toggleText: {
    color: '#00ffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  privacyNotice: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 0, 60, 0.9)',
    paddingVertical: 3,
    paddingHorizontal: 5,
    zIndex: 20,
  },
  privacyText: {
    color: '#fff',
    fontSize: 7,
    fontFamily: 'System',
    textAlign: 'center',
    lineHeight: 9,
  },
});
