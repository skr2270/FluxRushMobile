import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { CameraPreviewArea } from './src/components/CameraPreviewArea';
import { GameView } from './src/components/GameView';
import { ObjectPoolManager } from './src/managers/ObjectPoolManager';
import { InputManager } from './src/managers/InputManager';
import { AudioManager } from './src/managers/AudioManager';
import { EffectsManager } from './src/managers/EffectsManager';
import { PerformanceMonitor } from './src/managers/PerformanceMonitor';
import { GameManager } from './src/managers/GameManager';
import { TrackingResult } from './src/types';

// Safe wrapper for haptic triggers
const triggerHaptic = (type: 'impactLight' | 'impactHeavy' | 'notificationSuccess') => {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };
  try {
    ReactNativeHapticFeedback.trigger(type, options);
  } catch (e) {
    // Silently ignore if not running in native app wrapper
  }
};

export default function App() {
  const { width, height } = useWindowDimensions();

  // 1. Memoize Managers to persist across renders
  const pool = useMemo(() => new ObjectPoolManager(), []);
  const input = useMemo(() => new InputManager(), []);
  const audio = useMemo(() => new AudioManager(), []);
  const effects = useMemo(() => new EffectsManager(), []);
  
  const [qualityText, setQualityText] = useState('HIGH');
  const perf = useMemo(() => new PerformanceMonitor((q) => {
    setQualityText(q);
  }), []);

  const game = useMemo(() => new GameManager(pool, input, audio, effects), [pool, input, audio, effects]);

  // Synchronized HUD state
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAMEOVER'>('MENU');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [highScore, setHighScore] = useState(0);
  const [fps, setFps] = useState(60);
  const [controlMode, setControlMode] = useState<'hand' | 'touch'>('hand');

  const handleSetControlMode = (mode: 'hand' | 'touch') => {
    setControlMode(mode);
    input.setControlMode(mode);
  };

  // Animation loop refs
  const lastTimeRef = useRef(performance.now());
  const loopActiveRef = useRef(false);
  const prevHealthRef = useRef(100);
  const prevScoreRef = useRef(0);

  // Sync window dimensions on resize
  useEffect(() => {
    input.resize(width, height);
    effects.resize(width, height);
    game.resize(width, height);
  }, [width, height, input, effects, game]);

  // Run the core gameplay loop (60/120 FPS)
  useEffect(() => {
    loopActiveRef.current = gameState === 'PLAYING';
    
    let frameId: number;
    const tick = (timestamp: number) => {
      if (!loopActiveRef.current) return;
      frameId = requestAnimationFrame(tick);

      const dt = Math.min((timestamp - lastTimeRef.current) / 1000.0, 0.1);
      lastTimeRef.current = timestamp;

      const start = performance.now();

      // Update controllers
      input.tick(dt);
      game.tick(dt);

      const quality = perf.getQuality();
      effects.update(input.getCursor().x, input.getCursor().y, dt, input.isHandVisible(), quality);

      const jsTime = performance.now() - start;

      // Throttle HUD state synchronization to prevent JS thread bottleneck
      const currentScore = game.getScore();
      const currentHealth = game.getHealth();
      
      if (currentScore !== prevScoreRef.current) {
        setScore(currentScore);
        // Trigger haptic buzz on collection
        triggerHaptic('impactLight');
        prevScoreRef.current = currentScore;
      }
      
      if (currentHealth !== prevHealthRef.current) {
        setHealth(currentHealth);
        // Trigger heavy haptic shock when hit
        if (currentHealth < prevHealthRef.current) {
          triggerHaptic('impactHeavy');
        }
        prevHealthRef.current = currentHealth;
      }

      // Check game over
      if (game.getGameState() === 'GAMEOVER') {
        setHighScore(game.getHighScore());
        setGameState('GAMEOVER');
        loopActiveRef.current = false;
        triggerHaptic('notificationSuccess');
      }

      // Record performance parameters
      perf.recordFrame(dt * 1000, jsTime, 1.0); // Estimate average draw overhead as 1ms
      const stats = perf.getStats();
      setFps(stats.fps);
    };

    if (gameState === 'PLAYING') {
      lastTimeRef.current = performance.now();
      frameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frameId);
  }, [gameState, game, input, effects, perf]);

  const handleStartGame = () => {
    audio.init();
    setScore(0);
    setHealth(100);
    prevScoreRef.current = 0;
    prevHealthRef.current = 100;
    
    game.startGame();
    setGameState('PLAYING');
    triggerHaptic('impactLight');
  };

  // Touch controls fallback
  const handleTouchInput = (e: any) => {
    if (gameState !== 'PLAYING') return;
    const { locationX, locationY } = e.nativeEvent;
    input.setTouchFallback(locationX, locationY);
  };

  const isHandVisible = input.isHandVisible();

  return (
    <View 
      style={styles.container} 
      onTouchStart={handleTouchInput} 
      onTouchMove={handleTouchInput}
    >
      {/* 1. Underlying Camera Feed / Hand Tracker */}
      {controlMode === 'hand' && (
        <View style={styles.cameraContainer}>
          <CameraPreviewArea 
            controlMode={controlMode}
            onTrackingUpdate={(res: TrackingResult) => input.updateTracking(res)} 
            isCameraActive={gameState === 'PLAYING'} 
          />
        </View>
      )}

      {/* 2. Overlaid Hardware-Accelerated Skia Graphics */}
      <GameView
        pool={pool}
        cursor={input.getCursor()}
        isHandVisible={isHandVisible}
        isShieldActive={game.isShieldActive()}
        quality={perf.getQuality()}
        gridNodes={effects.gridNodes}
        trailHistory={effects.trailHistory}
      />

      {/* 3. absolute HUD panel overlay */}
      {gameState === 'PLAYING' && (
        <View style={styles.hudOverlay} pointerEvents="box-none">
          <View style={styles.hudRow}>
            <View style={styles.hudBadge}>
              <Text style={styles.hudText}>SCORE: {score.toString().padStart(5, '0')}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.hudBadge, { borderColor: '#bd00ff' }]} 
              onPress={() => handleSetControlMode(controlMode === 'hand' ? 'touch' : 'hand')}
              activeOpacity={0.7}
            >
              <Text style={[styles.hudText, { color: '#bd00ff' }]}>
                MODE: {controlMode === 'hand' ? 'GESTURE' : 'TOUCH'}
              </Text>
            </TouchableOpacity>
            <View style={styles.hudBadge}>
              <Text style={styles.hudText}>HEALTH: {health}%</Text>
            </View>
          </View>
          <View style={styles.statsPanel}>
            <Text style={styles.statsText}>FPS: {fps} | QUALITY: {qualityText}</Text>
          </View>
        </View>
      )}

      {/* Touch Action Buttons for fallback gestures */}
      {gameState === 'PLAYING' && controlMode === 'touch' && (
        <View style={styles.touchActionsPanel}>
          <TouchableOpacity 
            style={[styles.actionButton, { borderColor: '#bd00ff' }]} 
            onPress={() => input.triggerTouchShield()}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, { color: '#bd00ff' }]}>SHIELD</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { borderColor: '#00ffff' }]} 
            onPress={() => input.triggerTouchEMP()}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, { color: '#00ffff' }]}>EMP PULSE</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Start Screen Overlay */}
      {gameState === 'MENU' && (
        <View style={styles.overlayScreen}>
          <View style={styles.glassPanel}>
            <Text style={styles.title}>FLUXRUSH</Text>
            <Text style={styles.subtitle}>
              Control the neon orb using your index finger.{'\n'}
              Collect green particles, avoid red spikes.{'\n'}
              Make a fist for a shield, pinch to trigger EMP pulse.
            </Text>

            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>CONTROL:</Text>
              <TouchableOpacity 
                style={styles.settingsToggle} 
                onPress={() => handleSetControlMode(controlMode === 'hand' ? 'touch' : 'hand')}
                activeOpacity={0.7}
              >
                <Text style={styles.settingsToggleText}>
                  {controlMode === 'hand' ? 'GESTURE (CAMERA)' : 'TOUCH SCREEN'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleStartGame}>
              <Text style={styles.buttonText}>START GAME</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. Game Over Screen Overlay */}
      {gameState === 'GAMEOVER' && (
        <View style={styles.overlayScreen}>
          <View style={styles.glassPanel}>
            <Text style={[styles.title, { color: '#ff003c' }]}>FLUX COLLAPSE</Text>
            <Text style={styles.gameOverText}>SYSTEM TERMINATED</Text>
            <Text style={styles.finalScore}>SCORE: {score}</Text>
            <Text style={styles.highScore}>HIGH SCORE: {highScore}</Text>

            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>CONTROL:</Text>
              <TouchableOpacity 
                style={styles.settingsToggle} 
                onPress={() => handleSetControlMode(controlMode === 'hand' ? 'touch' : 'hand')}
                activeOpacity={0.7}
              >
                <Text style={styles.settingsToggleText}>
                  {controlMode === 'hand' ? 'GESTURE (CAMERA)' : 'TOUCH SCREEN'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.button, { borderColor: '#bd00ff' }]} onPress={handleStartGame}>
              <Text style={[styles.buttonText, { color: '#bd00ff' }]}>REINITIALIZE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070d',
  },
  cameraContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 100,
    height: 75,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    zIndex: 10,
  },
  hudOverlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 15,
  },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudBadge: {
    backgroundColor: 'rgba(15, 15, 30, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hudText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statsPanel: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  statsText: {
    color: '#8c8ca3',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  overlayScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 7, 13, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    padding: 20,
  },
  glassPanel: {
    backgroundColor: 'rgba(15, 15, 30, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 420,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#8c8ca3',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  button: {
    borderWidth: 2,
    borderColor: '#00ffff',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonText: {
    color: '#00ffff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  gameOverText: {
    color: '#8c8ca3',
    fontSize: 14,
    marginBottom: 16,
  },
  finalScore: {
    color: '#00ffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  highScore: {
    color: '#8c8ca3',
    fontSize: 14,
    marginBottom: 24,
  },
  touchActionsPanel: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -125 }], // centered (width of panel is 250px)
    width: 250,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 15,
  },
  actionButton: {
    borderWidth: 2,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(15, 15, 30, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  settingsLabel: {
    fontSize: 13,
    color: '#8c8ca3',
    marginRight: 10,
    fontWeight: 'bold',
  },
  settingsToggle: {
    borderWidth: 1.5,
    borderColor: '#00ffff',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  settingsToggleText: {
    color: '#00ffff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
