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

  constructor() {
    // Assets are pre-loaded on user interaction to comply with OS audio session rules
  }

  public init(): void {
    if (this.soundLibraryInitialized) return;

    try {
      console.log('Mobile Audio: Initializing SoundPool/AV players from Android assets...');
      
      const basePath = Platform.OS === 'android' ? '' : Sound.MAIN_BUNDLE;

      // Load SFX files pre-compiled inside the assets bundle
      this.collectSound = new Sound('collect.wav', basePath, (err) => {
        if (err) console.warn('Failed to load collect sound', err);
      });
      
      this.hitSound = new Sound('hit.wav', basePath, (err) => {
        if (err) console.warn('Failed to load hit sound', err);
      });
      
      this.comboSound = new Sound('combo.wav', basePath, (err) => {
        if (err) console.warn('Failed to load combo sound', err);
      });
      
      this.bgmSound = new Sound('bgm.wav', basePath, (err) => {
        if (err) console.warn('Failed to load BGM sound', err);
      });

      this.soundLibraryInitialized = true;
    } catch (e) {
      console.warn('Mobile Audio: Failed to initialize sound modules.', e);
    }
  }

  public playCollect(): void {
    this.init();
    if (!this.soundLibraryInitialized || !this.collectSound) return;

    // Stop and reset sound before playing to allow rapid overlapping blips
    this.collectSound.stop(() => {
      this.collectSound!.play();
    });
  }

  public playCombo(_multiplier: number): void {
    this.init();
    if (!this.soundLibraryInitialized || !this.comboSound) return;

    // Adjust volume slightly based on combo multiplier for a dynamic riser effect
    const volume = Math.min(1.0, 0.4 + _multiplier * 0.1);
    this.comboSound.setVolume(volume);
    
    this.comboSound.stop(() => {
      this.comboSound!.play();
    });
  }

  public playHit(): void {
    this.init();
    if (!this.soundLibraryInitialized || !this.hitSound) return;

    this.hitSound.stop(() => {
      this.hitSound!.play();
    });
  }

  public startBgm(): void {
    if (this.isBgmPlaying) return;
    this.init();
    
    this.isBgmPlaying = true;
    if (this.bgmSound) {
      this.bgmSound.setNumberOfLoops(-1); // Infinite loop
      this.bgmSound.setVolume(0.35); // Lower background drone volume
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
