import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SkiaView, useDrawCallback, Skia, PaintStyle, StrokeCap, BlurStyle } from '@shopify/react-native-skia';
import { ObjectPoolManager } from '../managers/ObjectPoolManager';
import { Vec2 } from '../types';

interface GameViewProps {
  pool: ObjectPoolManager;
  cursor: Vec2;
  isHandVisible: boolean;
  isShieldActive: boolean;
  quality: 'LOW' | 'MEDIUM' | 'HIGH';
  gridNodes: Array<{ x: number; y: number; ox: number; oy: number }>;
  trailHistory: Vec2[];
}

export const GameView: React.FC<GameViewProps> = ({
  pool,
  cursor,
  isHandVisible,
  isShieldActive,
  quality,
  gridNodes,
  trailHistory,
}) => {
  const { width, height } = useWindowDimensions();

  // Pre-instantiate Skia Paint objects to avoid allocations in drawing loops
  const bgPaint = Skia.Paint();
  bgPaint.setColor(Skia.Color('#0a0a14'));

  const gridPaint = Skia.Paint();
  gridPaint.setColor(Skia.Color('rgba(0, 255, 255, 0.05)'));
  gridPaint.setStrokeWidth(1);
  gridPaint.setStyle(PaintStyle.Stroke);

  const trailPaint = Skia.Paint();
  trailPaint.setColor(Skia.Color('rgba(0, 255, 255, 0.25)'));
  trailPaint.setStrokeWidth(4);
  trailPaint.setStrokeCap(StrokeCap.Round);
  trailPaint.setStyle(PaintStyle.Stroke);

  const playerPaint = Skia.Paint();
  const playerGlowPaint = Skia.Paint();
  
  const collectiblePaint = Skia.Paint();
  collectiblePaint.setColor(Skia.Color('#39ff14'));
  const collectibleGlowPaint = Skia.Paint();
  collectibleGlowPaint.setColor(Skia.Color('#39ff14'));
  collectibleGlowPaint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 15, true));

  const hazardPaint = Skia.Paint();
  hazardPaint.setColor(Skia.Color('#ff003c'));
  hazardPaint.setStrokeWidth(3);
  hazardPaint.setStyle(PaintStyle.Stroke);
  const hazardGlowPaint = Skia.Paint();
  hazardGlowPaint.setColor(Skia.Color('#ff003c'));
  hazardGlowPaint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 20, true));

  const particlePaint = Skia.Paint();

  const onDraw = useDrawCallback((canvas) => {
    // 1. Draw Background
    canvas.drawRect({ x: 0, y: 0, width, height }, bgPaint);

    // 2. Draw Warp Grid lines (skip in Low quality)
    if (quality !== 'LOW' && gridNodes.length > 0) {
      const cols = 24;
      const rows = 18;
      
      // Horizontal lines
      for (let r = 0; r < rows; r++) {
        const path = Skia.Path.Make();
        for (let c = 0; c < cols; c++) { // wait, 'cx' is loop index
          const idx = r * cols + c;
          const node = gridNodes[idx];
          if (node) {
            if (c === 0) path.moveTo(node.x, node.y);
            else path.lineTo(node.x, node.y);
          }
        }
        canvas.drawPath(path, gridPaint);
      }

      // Vertical lines
      for (let c = 0; c < cols; c++) {
        const path = Skia.Path.Make();
        for (let r = 0; r < rows; r++) {
          const idx = r * cols + c;
          const node = gridNodes[idx];
          if (node) {
            if (r === 0) path.moveTo(node.x, node.y);
            else path.lineTo(node.x, node.y);
          }
        }
        canvas.drawPath(path, gridPaint);
      }
    }

    // 3. Draw Player Trail
    if (isHandVisible && trailHistory.length > 1) {
      const path = Skia.Path.Make();
      path.moveTo(trailHistory[0].x, trailHistory[0].y);
      for (let i = 1; i < trailHistory.length; i++) {
        path.lineTo(trailHistory[i].x, trailHistory[i].y);
      }
      canvas.drawPath(path, trailPaint);
    }

    // 4. Draw Collectibles
    const collectibles = pool.getCollectibles();
    for (let i = 0; i < collectibles.length; i++) {
      const c = collectibles[i];
      if (!c.active) continue;

      if (quality !== 'LOW') {
        canvas.drawCircle(c.pos.x, c.pos.y, c.size + 15, collectibleGlowPaint);
      }
      canvas.drawCircle(c.pos.x, c.pos.y, c.size, collectiblePaint);
    }

    // 5. Draw Hazards
    const hazards = pool.getHazards();
    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      if (!h.active) continue;

      canvas.save();
      canvas.translate(h.pos.x, h.pos.y);
      canvas.rotate(h.angle, 0, 0);

      if (quality !== 'LOW') {
        canvas.drawCircle(0, 0, h.size + 20, hazardGlowPaint);
      }

      // Draw the triangular obstacle
      const path = Skia.Path.Make();
      const s = h.size;
      path.moveTo(0, -s);
      path.lineTo(s * 0.86, s * 0.5);
      path.lineTo(-s * 0.86, s * 0.5);
      path.close();
      
      canvas.drawPath(path, hazardPaint);
      canvas.restore();
    }

    // 6. Draw Particles
    const particles = pool.getParticles();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;

      particlePaint.setColor(Skia.Color(p.color));
      particlePaint.setAlphaf(p.alpha);
      canvas.drawCircle(p.pos.x, p.pos.y, p.size, particlePaint);
    }

    // 7. Draw Player Orb
    if (isHandVisible) {
      const radius = isShieldActive ? 40 : 20;
      const colorHex = isShieldActive ? '#bd00ff' : '#00ffff';
      playerPaint.setColor(Skia.Color(colorHex));

      if (quality !== 'LOW') {
        playerGlowPaint.setColor(Skia.Color(colorHex));
        playerGlowPaint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, isShieldActive ? 30 : 25, true));
        canvas.drawCircle(cursor.x, cursor.y, radius + (isShieldActive ? 30 : 25), playerGlowPaint);
      }
      
      canvas.drawCircle(cursor.x, cursor.y, radius, playerPaint);
    }
  }, [pool, cursor, isHandVisible, isShieldActive, quality, gridNodes, trailHistory]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <SkiaView style={styles.canvas} onDraw={onDraw} />
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});
