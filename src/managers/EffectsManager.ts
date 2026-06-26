import { Vec2 } from '../types';

interface GridNode {
  x: number; y: number;
  vx: number; vy: number;
  ox: number; oy: number;
}

export class EffectsManager {
  public gridNodes: GridNode[] = [];
  public trailHistory: Vec2[] = [];
  public width = 800;
  public height = 600;
  
  private gridCols = 24;
  private gridRows = 18;
  private springK = 35;
  private damping = 2.0;

  private maxTrailLen = 40;
  
  // Screen shake variables
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;

  constructor() {
    this.resize(800, 600);
  }

  public resize(w: number, h: number): void {
    this.width = w;
    this.height = h;

    this.gridNodes = [];
    const colStep = w / (this.gridCols - 1);
    const rowStep = h / (this.gridRows - 1);

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const ox = c * colStep;
        const oy = r * rowStep;
        this.gridNodes.push({ x: ox, y: oy, vx: 0, vy: 0, ox, oy });
      }
    }
  }

  public triggerShake(durationMs: number, intensity: number): void {
    this.shakeDuration = durationMs;
    this.shakeTime = durationMs;
    this.shakeIntensity = intensity;
  }

  public getShakeOffsets(): Vec2 {
    if (this.shakeTime <= 0) {
      return { x: 0, y: 0 };
    }
    const factor = this.shakeTime / this.shakeDuration;
    return {
      x: (Math.random() - 0.5) * this.shakeIntensity * factor,
      y: (Math.random() - 0.5) * this.shakeIntensity * factor,
    };
  }

  public update(cursorX: number, cursorY: number, dt: number, isHandVisible: boolean, quality: 'LOW' | 'MEDIUM' | 'HIGH'): void {
    // 1. Decelerate shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt * 1000;
    }

    // 2. Trail length adjustment
    this.maxTrailLen = quality === 'HIGH' ? 40 : quality === 'MEDIUM' ? 20 : 8;

    if (isHandVisible) {
      this.trailHistory.push({ x: cursorX, y: cursorY });
      if (this.trailHistory.length > this.maxTrailLen) {
        this.trailHistory.shift();
      }
    } else if (this.trailHistory.length > 0) {
      this.trailHistory.shift();
    }

    // 3. Grid updates (skipped in Low quality)
    if (quality === 'LOW') return;

    const cursorForceRadius = 160;
    const cursorForce = -600;

    const len = this.gridNodes.length;
    for (let i = 0; i < len; i++) {
      const node = this.gridNodes[i];

      const ax = (node.ox - node.x) * this.springK - node.vx * this.damping;
      const ay = (node.oy - node.y) * this.springK - node.vy * this.damping;

      node.vx += ax * dt;
      node.vy += ay * dt;

      if (isHandVisible) {
        const dx = node.x - cursorX;
        const dy = node.y - cursorY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < cursorForceRadius && dist > 10) {
          const factor = (1.0 - dist / cursorForceRadius);
          const pushForce = factor * cursorForce * dt;
          node.vx += (dx / dist) * pushForce;
          node.vy += (dy / dist) * pushForce;
        }
      }

      node.x += node.vx * dt;
      node.y += node.vy * dt;
    }
  }
}
