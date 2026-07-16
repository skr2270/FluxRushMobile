import { Platform } from 'react-native';
import Sound from 'react-native-sound';

// Enable playback in silent mode on iOS and configure background audio
Sound.setCategory('Playback', true);

export class AudioManager {
  private isBgmPlaying = false;
  private soundLibraryInitialized = false;

  private collectSound: Sound | null = null;
  private hitSound: Sound | null = null;
  private comboSound: Sound | null = null;
  private bgmSound: Sound | null = null;

  private volume = 0.3;
  private isMuted = false;

  constructor() {
    // Assets are pre-loaded on user interaction to comply with OS audio session rules
  }

  public init(): void {
    if (this.soundLibraryInitialized) return;

    try {
      console.log('Mobile Audio: Initializing SoundPool/AV players from Android assets...');
      
      const basePath = Platform.OS === 'android' ? '' : Sound.MAIN_BUNDLE;

      // Load SFX files pre-compiled inside the assets bundle with safety checks
      this.collectSound = new Sound('collect.wav', basePath, (err) => {
        if (err) {
          console.warn('Failed to load collect sound, disabling audio feedback:', err);
          this.collectSound = null;
        } else {
          this.updateSoundVolume(this.collectSound);
        }
      });
      
      this.hitSound = new Sound('hit.wav', basePath, (err) => {
        if (err) {
          console.warn('Failed to load hit sound, disabling audio feedback:', err);
          this.hitSound = null;
        } else {
          this.updateSoundVolume(this.hitSound);
        }
      });
      
      this.comboSound = new Sound('combo.wav', basePath, (err) => {
        if (err) {
          console.warn('Failed to load combo sound, disabling audio feedback:', err);
          this.comboSound = null;
        } else {
          this.updateSoundVolume(this.comboSound);
        }
      });
      
      this.bgmSound = new Sound('bgm.wav', basePath, (err) => {
        if (err) {
          console.warn('Failed to load BGM sound, disabling audio feedback:', err);
          this.bgmSound = null;
        } else {
          this.updateSoundVolume(this.bgmSound);
        }
      });

      this.soundLibraryInitialized = true;
    } catch (e) {
      console.warn('Mobile Audio: Failed to initialize sound modules.', e);
    }
  }

  public setVolume(volPct: number): void {
    this.volume = Math.max(0, Math.min(volPct / 100, 1));
    this.updateAllVolumes();
  }

  public getVolume(): number {
    return Math.round(this.volume * 100);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.updateAllVolumes();
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private updateSoundVolume(sound: Sound | null, factor = 1.0): void {
    if (!sound) return;
    const targetVol = this.isMuted ? 0 : this.volume * factor;
    sound.setVolume(targetVol);
  }

  private updateAllVolumes(): void {
    this.updateSoundVolume(this.collectSound);
    this.updateSoundVolume(this.hitSound);
    this.updateSoundVolume(this.comboSound);
    this.updateSoundVolume(this.bgmSound, 0.35); // BGM is naturally mixed lower
  }

  public playCollect(): void {
    this.init();
    if (!this.soundLibraryInitialized || !this.collectSound) return;

    this.updateSoundVolume(this.collectSound);
    // Stop and reset sound before playing to allow rapid overlapping blips
    this.collectSound.stop(() => {
      this.collectSound!.play();
    });
  }

  public playCombo(_multiplier: number): void {
    this.init();
    if (!this.soundLibraryInitialized || !this.comboSound) return;

    // Adjust volume slightly based on combo multiplier for a dynamic riser effect
    const volumeFactor = Math.min(1.0, 0.4 + _multiplier * 0.1);
    this.updateSoundVolume(this.comboSound, volumeFactor);
    
    this.comboSound.stop(() => {
      this.comboSound!.play();
    });
  }

  public playHit(): void {
    this.init();
    if (!this.soundLibraryInitialized || !this.hitSound) return;

    this.updateSoundVolume(this.hitSound);
    this.hitSound.stop(() => {
      this.hitSound!.play();
    });
  }

  public playShieldActivate(): void {
    // Mobile fallback: reuse combo sound
    this.playCombo(10);
  }

  public playShieldExpire(): void {
    // Mobile fallback: reuse collect sound
    this.playCollect();
  }

  public playEmpPulse(): void {
    // Mobile fallback: reuse hit sound
    this.playHit();
  }

  public startBgm(): void {
    if (this.isBgmPlaying) return;
    this.init();
    
    this.isBgmPlaying = true;
    if (this.bgmSound) {
      this.bgmSound.setNumberOfLoops(-1); // Infinite loop
      this.updateSoundVolume(this.bgmSound, 0.35); // Lower background drone volume
      this.bgmSound.play();
    }
  }

  public stopBgm(): void {
    if (!this.isBgmPlaying) return;
    this.isBgmPlaying = false;

    if (this.bgmSound) {
      this.bgmSound.stop();
    }
  }
}
