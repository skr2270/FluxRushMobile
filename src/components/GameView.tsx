import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SkiaView, useDrawCallback, Skia, PaintStyle, StrokeCap, BlurStyle, matchFont } from '@shopify/react-native-skia';
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
  colorblindMode: boolean;
}

export const GameView: React.FC<GameViewProps> = ({
  pool,
  cursor,
  isHandVisible,
  isShieldActive,
  quality,
  gridNodes,
  trailHistory,
  colorblindMode,
}) => {
  const { width, height } = useWindowDimensions();

  // Matched System Font for text drawing
  const font = React.useMemo(() => {
    return matchFont({
      fontFamily: 'System',
      fontSize: 18,
      fontWeight: 'bold',
    });
  }, []);

  // Memoize Skia Paint and Path objects to avoid allocations on every render
  const {
    bgPaint,
    gridPaint,
    trailPaint,
    playerPaint,
    playerGlowPaint,
    collectiblePaint,
    collectibleGlowPaint,
    hazardPaint,
    hazardGlowPaint,
    particlePaint,
    textPaint,
    reusablePath,
    colors,
    maskFilters,
  } = React.useMemo(() => {
    // Cache Skia Colors
    const colorCache = {
      bg: Skia.Color('#0a0a14'),
      grid: Skia.Color('rgba(0, 255, 255, 0.05)'),
      trail: Skia.Color('rgba(0, 255, 255, 0.25)'),
      playerCyan: Skia.Color('#00ffff'),
      shieldPurple: Skia.Color('#bd00ff'),
      collectibleGreen: Skia.Color('#39ff14'),
      collectibleBlue: Skia.Color('#56b4e9'),
      hazardRed: Skia.Color('#ff003c'),
      hazardOrange: Skia.Color('#e69f00'),
      white: Skia.Color('#ffffff'),
      textGray: Skia.Color('#8c8ca3'),
    };

    // Pre-create Mask Filters
    const blurFilters = {
      player: Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 25, true),
      shield: Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 30, true),
      collectible: Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 15, true),
      hazard: Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 20, true),
    };

    const bg = Skia.Paint();
    bg.setColor(colorCache.bg);

    const grid = Skia.Paint();
    grid.setColor(colorCache.grid);
    grid.setStrokeWidth(1);
    grid.setStyle(PaintStyle.Stroke);

    const trail = Skia.Paint();
    trail.setColor(colorCache.trail);
    trail.setStrokeWidth(4);
    trail.setStrokeCap(StrokeCap.Round);
    trail.setStyle(PaintStyle.Stroke);

    const player = Skia.Paint();
    const playerGlow = Skia.Paint();

    const collectible = Skia.Paint();
    const collectibleGlow = Skia.Paint();

    const hazard = Skia.Paint();
    hazard.setStrokeWidth(3);
    hazard.setStyle(PaintStyle.Stroke);
    const hazardGlow = Skia.Paint();

    const particle = Skia.Paint();

    const text = Skia.Paint();
    text.setStyle(PaintStyle.Fill);

    const path = Skia.Path.Make();

    return {
      bgPaint: bg,
      gridPaint: grid,
      trailPaint: trail,
      playerPaint: player,
      playerGlowPaint: playerGlow,
      collectiblePaint: collectible,
      collectibleGlowPaint: collectibleGlow,
      hazardPaint: hazard,
      hazardGlowPaint: hazardGlow,
      particlePaint: particle,
      textPaint: text,
      reusablePath: path,
      colors: colorCache,
      maskFilters: blurFilters,
    };
  }, []);

  const onDraw = useDrawCallback((canvas) => {
    // 1. Draw Background
    canvas.drawRect({ x: 0, y: 0, width, height }, bgPaint);

    // 2. Draw Warp Grid lines (skip in Low quality)
    if (quality !== 'LOW' && gridNodes.length > 0) {
      const cols = 24;
      const rows = 18;
      
      // Horizontal lines
      for (let r = 0; r < rows; r++) {
        reusablePath.reset();
        let first = true;
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const node = gridNodes[idx];
          if (node) {
            if (first) {
              reusablePath.moveTo(node.x, node.y);
              first = false;
            } else {
              reusablePath.lineTo(node.x, node.y);
            }
          }
        }
        canvas.drawPath(reusablePath, gridPaint);
      }

      // Vertical lines
      for (let c = 0; c < cols; c++) {
        reusablePath.reset();
        let first = true;
        for (let r = 0; r < rows; r++) {
          const idx = r * cols + c;
          const node = gridNodes[idx];
          if (node) {
            if (first) {
              reusablePath.moveTo(node.x, node.y);
              first = false;
            } else {
              reusablePath.lineTo(node.x, node.y);
            }
          }
        }
        canvas.drawPath(reusablePath, gridPaint);
      }
    }

    // 3. Draw Player Trail
    if (isHandVisible && trailHistory.length > 1) {
      reusablePath.reset();
      reusablePath.moveTo(trailHistory[0].x, trailHistory[0].y);
      for (let i = 1; i < trailHistory.length; i++) {
        reusablePath.lineTo(trailHistory[i].x, trailHistory[i].y);
      }
      canvas.drawPath(reusablePath, trailPaint);
    }

    // 4. Draw Collectibles
    const collectibles = pool.getCollectibles();
    const activeCollectColor = colorblindMode ? colors.collectibleBlue : colors.collectibleGreen;
    collectiblePaint.setColor(activeCollectColor);
    collectibleGlowPaint.setColor(activeCollectColor);
    collectibleGlowPaint.setMaskFilter(maskFilters.collectible);

    for (let i = 0; i < collectibles.length; i++) {
      const c = collectibles[i];
      if (!c.active) continue;

      if (quality !== 'LOW') {
        canvas.drawCircle(c.pos.x, c.pos.y, c.size + 15, collectibleGlowPaint);
      }
      canvas.drawCircle(c.pos.x, c.pos.y, c.size, collectiblePaint);

      // If colorblind mode is ON, draw "+" symbol in center
      if (colorblindMode) {
        reusablePath.reset();
        reusablePath.moveTo(c.pos.x - 4, c.pos.y);
        reusablePath.lineTo(c.pos.x + 4, c.pos.y);
        reusablePath.moveTo(c.pos.x, c.pos.y - 4);
        reusablePath.lineTo(c.pos.x, c.pos.y + 4);
        
        trailPaint.setColor(colors.white);
        trailPaint.setStrokeWidth(2.5);
        canvas.drawPath(reusablePath, trailPaint);
        trailPaint.setStrokeWidth(4); // restore width
        trailPaint.setColor(colors.trail); // restore color
      }
    }

    // 5. Draw Hazards
    const hazards = pool.getHazards();
    const activeHazardColor = colorblindMode ? colors.hazardOrange : colors.hazardRed;
    hazardPaint.setColor(activeHazardColor);
    hazardGlowPaint.setColor(activeHazardColor);
    hazardGlowPaint.setMaskFilter(maskFilters.hazard);

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
      reusablePath.reset();
      const s = h.size;
      reusablePath.moveTo(0, -s);
      reusablePath.lineTo(s * 0.86, s * 0.5);
      reusablePath.lineTo(-s * 0.86, s * 0.5);
      reusablePath.close();
      
      canvas.drawPath(reusablePath, hazardPaint);

      // If colorblind mode is ON, draw "X" in center
      if (colorblindMode) {
        reusablePath.reset();
        reusablePath.moveTo(-3, -3);
        reusablePath.lineTo(3, 3);
        reusablePath.moveTo(3, -3);
        reusablePath.lineTo(-3, 3);
        
        trailPaint.setColor(colors.white);
        trailPaint.setStrokeWidth(2.5);
        canvas.drawPath(reusablePath, trailPaint);
        trailPaint.setStrokeWidth(4); // restore width
        trailPaint.setColor(colors.trail); // restore color
      }

      canvas.restore();
    }

    // 6. Draw Edge Warnings for off-screen hazards
    const margin = 25;
    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      if (!h.active) continue;

      const isOffLeft = h.pos.x < 0;
      const isOffRight = h.pos.x > width;
      const isOffTop = h.pos.y < 0;
      const isOffBottom = h.pos.y > height;

      if (isOffLeft || isOffRight || isOffTop || isOffBottom) {
        const cx = Math.max(margin, Math.min(h.pos.x, width - margin));
        const cy = Math.max(margin, Math.min(h.pos.y, height - margin));

        // Draw warning circle
        const warningColor = colorblindMode ? colors.hazardOrange : colors.hazardRed;
        hazardGlowPaint.setColor(warningColor);
        canvas.drawCircle(cx, cy, 10, hazardGlowPaint);

        // Draw warning arrow pointing to the hazard's actual location
        canvas.save();
        canvas.translate(cx, cy);
        const angle = Math.atan2(h.pos.y - cy, h.pos.x - cx);
        canvas.rotate(angle, 0, 0);

        reusablePath.reset();
        reusablePath.moveTo(4, 0);
        reusablePath.lineTo(-6, -5);
        reusablePath.lineTo(-3, 0);
        reusablePath.lineTo(-6, 5);
        reusablePath.close();

        hazardPaint.setColor(warningColor);
        hazardPaint.setStyle(PaintStyle.Fill);
        canvas.drawPath(reusablePath, hazardPaint);
        hazardPaint.setStyle(PaintStyle.Stroke); // Restore stroke
        canvas.restore();
      }
    }

    // 7. Draw Particles
    const particles = pool.getParticles();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;

      let pColor = Skia.Color(p.color);
      if (colorblindMode) {
        if (p.color === '#39ff14') pColor = colors.collectibleBlue;
        else if (p.color === '#ff003c') pColor = colors.hazardOrange;
      }

      particlePaint.setColor(pColor);
      particlePaint.setAlphaf(p.alpha);
      canvas.drawCircle(p.pos.x, p.pos.y, p.size, particlePaint);
    }

    // 8. Draw Player Orb
    if (isHandVisible) {
      const radius = isShieldActive ? 40 : 20;
      const colorHex = isShieldActive ? colors.shieldPurple : colors.playerCyan;
      playerPaint.setColor(colorHex);

      if (quality !== 'LOW') {
        playerGlowPaint.setColor(colorHex);
        playerGlowPaint.setMaskFilter(isShieldActive ? maskFilters.shield : maskFilters.player);
        canvas.drawCircle(cursor.x, cursor.y, radius + (isShieldActive ? 30 : 25), playerGlowPaint);
      }
      
      canvas.drawCircle(cursor.x, cursor.y, radius, playerPaint);
    }

    // 9. Draw Floating Texts
    const texts = pool.getFloatingTexts();
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (!t.active) continue;

      textPaint.setColor(Skia.Color(t.color));
      textPaint.setAlphaf(t.alpha);
      canvas.drawText(t.text, t.pos.x, t.pos.y, textPaint, font);
    }
  }, [pool, cursor, isHandVisible, isShieldActive, quality, gridNodes, trailHistory, colorblindMode]);

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
