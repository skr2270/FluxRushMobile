import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Canvas, Picture, createPicture, Skia, PaintStyle, StrokeCap } from '@shopify/react-native-skia';
import { Vec3 } from '../types';

interface HandPreviewProps {
  landmarks: Vec3[];
  handPresent: boolean;
  width: number;
  height: number;
}

const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm outline
  [5, 9], [9, 13], [13, 17],
];

const INDEX_TIP = 8;

export const HandPreview: React.FC<HandPreviewProps> = ({
  landmarks,
  handPresent,
  width,
  height,
}) => {
  // Memoize Skia Paint objects to avoid allocations on every frame draw
  const { bgPaint, bonePaint, jointPaint, tipPaint } = React.useMemo(() => {
    const bg = Skia.Paint();
    bg.setColor(Skia.Color('#0a0a14'));

    const bone = Skia.Paint();
    bone.setColor(Skia.Color('rgba(0, 255, 255, 0.6)'));
    bone.setStrokeWidth(1.5);
    bone.setStrokeCap(StrokeCap.Round);
    bone.setStyle(PaintStyle.Stroke);

    const joint = Skia.Paint();
    joint.setColor(Skia.Color('#00ffff'));
    joint.setStyle(PaintStyle.Fill);

    const tip = Skia.Paint();
    tip.setColor(Skia.Color('#39ff14'));
    tip.setStyle(PaintStyle.Fill);

    return { bgPaint: bg, bonePaint: bone, jointPaint: joint, tipPaint: tip };
  }, []);

  const picture = React.useMemo(() => createPicture((canvas) => {
    // 1. Draw dark background
    canvas.drawRect({ x: 0, y: 0, width, height }, bgPaint);

    if (!handPresent || landmarks.length < 21) {
      return; // "No hand detected" text will be rendered by the overlay View
    }

    // 2. Draw bone lines
    const path = Skia.Path.Make();
    for (const [a, b] of HAND_CONNECTIONS) {
      const la = landmarks[a];
      const lb = landmarks[b];

      if (la && lb) {
        // Mirror X because front camera coordinates are mirrored
        const ax = (1.0 - la.x) * width;
        const ay = la.y * height;
        const bx = (1.0 - lb.x) * width;
        const by = lb.y * height;

        path.moveTo(ax, ay);
        path.lineTo(bx, by);
      }
    }
    canvas.drawPath(path, bonePaint);

    // 3. Draw joints
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (!lm) continue;

      const x = (1.0 - lm.x) * width;
      const y = lm.y * height;

      if (i === INDEX_TIP) {
        canvas.drawCircle(x, y, 4, tipPaint);
      } else {
        canvas.drawCircle(x, y, 2, jointPaint);
      }
    }
  }), [landmarks, handPresent, width, height, bgPaint, bonePaint, jointPaint, tipPaint]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Canvas style={styles.canvas}>
        <Picture picture={picture} />
      </Canvas>
      {(!handPresent || landmarks.length < 21) && (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>No hand detected</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  placeholderText: {
    color: '#8c8ca3',
    fontSize: 9,
    fontFamily: 'System',
    textAlign: 'center',
  },
});
