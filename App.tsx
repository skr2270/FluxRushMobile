import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useWindowDimensions, Platform, AppState, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraPreviewArea } from './src/components/CameraPreviewArea';
import { GameView } from './src/components/GameView';
import { ObjectPoolManager } from './src/managers/ObjectPoolManager';
import { InputManager } from './src/managers/InputManager';
import { AudioManager } from './src/managers/AudioManager';
import { EffectsManager } from './src/managers/EffectsManager';
import { PerformanceMonitor } from './src/managers/PerformanceMonitor';
import { GameManager } from './src/managers/GameManager';
import { TrackingResult } from './src/types';

// Safe wrapper for haptic triggers to prevent crash if not running in native app wrapper
let ReactNativeHapticFeedback: any = null;
try {
  ReactNativeHapticFeedback = require('react-native-haptic-feedback').default;
} catch (e) {
  console.warn('Mobile Haptics module not linked, bypassing feedback triggers.');
}

const triggerHaptic = (type: 'impactLight' | 'impactHeavy' | 'notificationSuccess') => {
  if (!ReactNativeHapticFeedback) return;
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };
  try {
    ReactNativeHapticFeedback.trigger(type, options);
  } catch (e) {
    // Silently ignore
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
  const [handPresentState, setHandPresentState] = useState(false);

  // New states
  const [level, setLevel] = useState(1);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [comboRatio, setComboRatio] = useState(0);
  const [shieldStatus, setShieldStatus] = useState('READY');
  const [shieldRatio, setShieldRatio] = useState(0);
  const [shieldCooldownRatio, setShieldCooldownRatio] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [colorblindMode, setColorblindMode] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<'MUTED' | 'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  const handleSetControlMode = (mode: 'hand' | 'touch') => {
    setControlMode(mode);
    input.setControlMode(mode);
    triggerHaptic('impactLight');
  };

  // Animation loop refs
  const lastTimeRef = useRef(performance.now());
  const loopActiveRef = useRef(false);
  const prevHealthRef = useRef(100);
  const prevScoreRef = useRef(0);
  const prevFpsRef = useRef(60);
  const prevHandVisibleRef = useRef(false);
  const lastFrameTimestampRef = useRef(performance.now());

  // Load persisted high score and first play flag on mount
  useEffect(() => {
    game.loadHighScore().then(() => {
      setHighScore(game.getHighScore());
    });
    AsyncStorage.getItem('fluxrush_first_play').then((val) => {
      if (val !== 'false') {
        setShowTutorial(true);
      }
    });
  }, [game]);

  // Sync window dimensions on resize
  useEffect(() => {
    input.resize(width, height);
    effects.resize(width, height);
    game.resize(width, height);
  }, [width, height, input, effects, game]);

  // Handle AppState auto-pause on background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState.match(/inactive|background/) && loopActiveRef.current && !isPaused) {
        setIsPaused(true);
        audio.stopBgm();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [audio]);

  // Run the core gameplay loop (60/120 FPS)
  useEffect(() => {
    loopActiveRef.current = gameState === 'PLAYING' && !isPaused;
    
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
        triggerHaptic('impactLight');
        prevScoreRef.current = currentScore;
      }
      
      if (currentHealth !== prevHealthRef.current) {
        setHealth(currentHealth);
        if (currentHealth < prevHealthRef.current) {
          triggerHaptic('impactHeavy');
        }
        prevHealthRef.current = currentHealth;
      }

      // Sync Level, Combo, Shield
      setLevel(game.getLevel());
      setComboMultiplier(game.getComboMultiplier());
      setComboRatio(game.getComboTimerRatio());
      setShieldStatus(game.getShieldStatusText());
      setShieldRatio(game.getShieldTimerRatio());
      setShieldCooldownRatio(game.getShieldCooldownRatio());

      // Check game over
      if (game.getGameState() === 'GAMEOVER') {
        setHighScore(game.getHighScore());
        setGameState('GAMEOVER');
        loopActiveRef.current = false;
        triggerHaptic('notificationSuccess');
      }

      // Record performance parameters (measuring actual paint time)
      const now = performance.now();
      const totalFrameTime = now - lastFrameTimestampRef.current;
      lastFrameTimestampRef.current = now;
      const paintTimeEstimate = Math.max(0.5, totalFrameTime - jsTime);

      perf.recordFrame(dt * 1000, jsTime, paintTimeEstimate);
      const stats = perf.getStats();
      const currentFps = stats.fps;
      if (currentFps !== prevFpsRef.current) {
        setFps(currentFps);
        prevFpsRef.current = currentFps;
      }

      // Record hand presence transitions to trigger HUD re-renders cleanly
      const isHandVisibleNow = input.isHandVisible();
      if (isHandVisibleNow !== prevHandVisibleRef.current) {
        setHandPresentState(isHandVisibleNow);
        prevHandVisibleRef.current = isHandVisibleNow;
      }
    };

    if (gameState === 'PLAYING' && !isPaused) {
      lastTimeRef.current = performance.now();
      lastFrameTimestampRef.current = performance.now();
      frameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frameId);
  }, [gameState, isPaused, game, input, effects, perf]);

  const handleStartGame = () => {
    audio.init();
    setScore(0);
    setHealth(100);
    prevScoreRef.current = 0;
    prevHealthRef.current = 100;
    setIsPaused(false);
    
    game.startGame();
    setGameState('PLAYING');
    triggerHaptic('impactLight');
  };

  const handleDismissTutorial = () => {
    AsyncStorage.setItem('fluxrush_first_play', 'false').catch(() => {});
    setShowTutorial(false);
    handleStartGame();
  };

  const handleStartClick = () => {
    audio.init();
    handleStartGame();
  };

  // Touch controls fallback (uses raw page bounds relative to screen size)
  const handleTouchInput = (e: any) => {
    if (gameState !== 'PLAYING' || isPaused) return;
    const { pageX, pageY } = e.nativeEvent;
    input.setTouchFallback(pageX, pageY);
  };

  const cycleVolume = () => {
    let next: 'MUTED' | 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (volumeLevel === 'MUTED') {
      next = 'LOW';
      audio.setVolume(30);
      if (audio.getMuted()) audio.toggleMute();
    } else if (volumeLevel === 'LOW') {
      next = 'MEDIUM';
      audio.setVolume(60);
    } else if (volumeLevel === 'MEDIUM') {
      next = 'HIGH';
      audio.setVolume(100);
    } else {
      next = 'MUTED';
      audio.toggleMute();
    }
    setVolumeLevel(next);
    triggerHaptic('impactLight');
  };

  const toggleColorblind = () => {
    setColorblindMode(!colorblindMode);
    triggerHaptic('impactLight');
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      audio.startBgm();
    } else {
      setIsPaused(true);
      audio.stopBgm();
    }
    triggerHaptic('impactLight');
  };

  const handleShareScore = async () => {
    try {
      await Share.share({
        message: `I just scored ${score} points in FluxRush Mobile, a real-time finger-tracking neon arcade game! Can you beat my score?`,
      });
    } catch (e) {
      console.warn('Share failed:', e);
    }
  };

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
            isCameraActive={gameState === 'PLAYING' && !isPaused} 
          />
        </View>
      )}

      {/* 2. Overlaid Hardware-Accelerated Skia Graphics */}
      <GameView
        pool={pool}
        cursor={input.getCursor()}
        isHandVisible={handPresentState}
        isShieldActive={game.isShieldActive()}
        quality={perf.getQuality()}
        gridNodes={effects.gridNodes}
        trailHistory={effects.trailHistory}
        colorblindMode={colorblindMode}
      />

      {/* 3. Absolute HUD Panel Overlay */}
      {gameState === 'PLAYING' && (
        <View style={styles.hudOverlay} pointerEvents="box-none">
          <View style={styles.hudRow}>
            <View style={styles.hudBadge}>
              <Text style={styles.hudText}>SCORE: {score.toString().padStart(5, '0')}</Text>
            </View>
            <View style={styles.hudBadge}>
              <Text style={styles.hudText}>LVL: {level}</Text>
            </View>
            <View style={[styles.hudBadge, { minWidth: 90 }]}>
              <Text style={styles.hudText}>COMBO: x{comboMultiplier}</Text>
              <View style={styles.barBg}>
                <View style={[styles.comboBarFill, { width: `${comboRatio * 100}%` }]} />
              </View>
            </View>
            <View style={[styles.hudBadge, { minWidth: 90 }]}>
              <Text style={[styles.hudText, { color: '#bd00ff' }]}>SHIELD: {shieldStatus}</Text>
              <View style={styles.barBg}>
                <View style={[
                  styles.shieldBarFill, 
                  { 
                    width: `${(game.isShieldActive() ? shieldRatio : shieldCooldownRatio) * 100}%`,
                    backgroundColor: game.isShieldActive() ? '#bd00ff' : '#8c8ca3'
                  }
                ]} />
              </View>
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
            <TouchableOpacity 
              style={[styles.hudBadge, { borderColor: '#00ffff' }]} 
              onPress={togglePause}
              activeOpacity={0.7}
            >
              <Text style={[styles.hudText, { color: '#00ffff' }]}>PAUSE</Text>
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
      {gameState === 'PLAYING' && controlMode === 'touch' && !isPaused && (
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

            <View style={styles.settingsBox}>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>VOLUME:</Text>
                <TouchableOpacity style={styles.settingsToggle} onPress={cycleVolume} activeOpacity={0.7}>
                  <Text style={styles.settingsToggleText}>{volumeLevel}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.settingsRow, { marginBottom: 0 }]}>
                <Text style={styles.settingsLabel}>COLORBLIND:</Text>
                <TouchableOpacity style={styles.settingsToggle} onPress={toggleColorblind} activeOpacity={0.7}>
                  <Text style={styles.settingsToggleText}>{colorblindMode ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleStartClick}>
              <Text style={styles.buttonText}>START GAME</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Pause screen overlay */}
      {gameState === 'PLAYING' && isPaused && (
        <View style={styles.overlayScreen}>
          <View style={styles.glassPanel}>
            <Text style={styles.title}>PAUSED</Text>
            <Text style={styles.subtitle}>SYSTEM SUSPENDED</Text>

            <View style={styles.settingsBox}>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>VOLUME:</Text>
                <TouchableOpacity style={styles.settingsToggle} onPress={cycleVolume} activeOpacity={0.7}>
                  <Text style={styles.settingsToggleText}>{volumeLevel}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.settingsRow, { marginBottom: 0 }]}>
                <Text style={styles.settingsLabel}>COLORBLIND:</Text>
                <TouchableOpacity style={styles.settingsToggle} onPress={toggleColorblind} activeOpacity={0.7}>
                  <Text style={styles.settingsToggleText}>{colorblindMode ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.button, { borderColor: '#bd00ff' }]} onPress={togglePause}>
              <Text style={[styles.buttonText, { color: '#bd00ff' }]}>RESUME GAME</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tutorial screen overlay */}
      {showTutorial && (
        <View style={styles.tutorialScreen}>
          <View style={styles.glassPanel}>
            <Text style={styles.tutorialTitle}>SYSTEM OVERVIEW</Text>
            
            <View style={styles.tutorialItem}>
              <Text style={styles.tutorialEmoji}>☝️</Text>
              <View style={styles.tutorialTextContainer}>
                <Text style={styles.tutorialTextTitle}>INDEX FINGER: Move Cursor</Text>
                <Text style={styles.tutorialTextDesc}>Point at the camera to control the neon orb. Collect energy.</Text>
              </View>
            </View>

            <View style={styles.tutorialItem}>
              <Text style={styles.tutorialEmoji}>✊</Text>
              <View style={styles.tutorialTextContainer}>
                <Text style={styles.tutorialTextTitle}>FIST GESTURE: Shield</Text>
                <Text style={styles.tutorialTextDesc}>Make a fist to activate a shield and deflect critical impacts.</Text>
              </View>
            </View>

            <View style={styles.tutorialItem}>
              <Text style={styles.tutorialEmoji}>👌</Text>
              <View style={styles.tutorialTextContainer}>
                <Text style={styles.tutorialTextTitle}>PINCH GESTURE: EMP Pulse</Text>
                <Text style={styles.tutorialTextDesc}>Pinch your thumb and index finger to blast nearby obstacles (costs 5 combo).</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleDismissTutorial}>
              <Text style={styles.buttonText}>INITIALIZE SYSTEM</Text>
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

            <View style={styles.gameOverButtons}>
              <TouchableOpacity style={[styles.button, { borderColor: '#bd00ff' }]} onPress={handleStartGame}>
                <Text style={[styles.buttonText, { color: '#bd00ff' }]}>REINITIALIZE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { borderColor: '#00ffff', marginLeft: 15 }]} onPress={handleShareScore}>
                <Text style={[styles.buttonText, { color: '#00ffff' }]}>SHARE SCORE</Text>
              </TouchableOpacity>
            </View>
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
    left: 15,
    right: 15,
    zIndex: 15,
  },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudBadge: {
    backgroundColor: 'rgba(15, 15, 30, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  hudText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  barBg: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1.5,
    marginTop: 3,
    overflow: 'hidden',
  },
  comboBarFill: {
    height: '100%',
    backgroundColor: '#39ff14',
  },
  shieldBarFill: {
    height: '100%',
  },
  statsPanel: {
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  statsText: {
    color: '#8c8ca3',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  overlayScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 7, 13, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    padding: 20,
  },
  tutorialScreen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 7, 13, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    padding: 20,
  },
  glassPanel: {
    backgroundColor: 'rgba(15, 15, 30, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 440,
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
    marginBottom: 20,
  },
  button: {
    borderWidth: 2,
    borderColor: '#00ffff',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 15,
  },
  buttonText: {
    color: '#00ffff',
    fontSize: 14,
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
    marginBottom: 20,
  },
  touchActionsPanel: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -125 }],
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
    marginBottom: 15,
  },
  settingsLabel: {
    fontSize: 12,
    color: '#8c8ca3',
    marginRight: 10,
    fontWeight: 'bold',
  },
  settingsToggle: {
    borderWidth: 1.5,
    borderColor: '#00ffff',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  settingsToggleText: {
    color: '#00ffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  settingsBox: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    width: '100%',
  },
  tutorialTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#00ffff',
    letterSpacing: 1.5,
    marginBottom: 20,
    textAlign: 'center',
  },
  tutorialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  tutorialEmoji: {
    fontSize: 28,
    marginRight: 15,
  },
  tutorialTextContainer: {
    flex: 1,
  },
  tutorialTextTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  tutorialTextDesc: {
    fontSize: 11,
    color: '#8c8ca3',
    lineHeight: 15,
  },
  gameOverButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
});
