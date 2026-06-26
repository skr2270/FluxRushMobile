// AudioManager.ts for React Native mobile
// Adapts procedural audio to native sound modules (e.g., react-native-sound)

export class AudioManager {
  private isBgmPlaying = false;
  private soundLibraryInitialized = false;

  constructor() {
    // Initialized on user interaction
  }

  public init(): void {
    if (this.soundLibraryInitialized) return;

    try {
      console.log('Mobile Audio: Initializing SoundPool/AV players...');
      // In production: pre-load local audio files
      // Sound.setCategory('Ambient');
      // this.collectSound = new Sound('collect.wav', Sound.MAIN_BUNDLE, ...);
      this.soundLibraryInitialized = true;
    } catch (e) {
      console.warn('Mobile Audio: Failed to initialize sound modules.', e);
    }
  }

  public playCollect(): void {
    this.init();
    if (!this.soundLibraryInitialized) return;

    // In production: play pre-loaded audio file
    // this.collectSound.play();
    console.log('Mobile Audio: Play Collect SFX');
  }

  public playCombo(_multiplier: number): void {
    this.init();
    if (!this.soundLibraryInitialized) return;

    // In production: play combo sound depending on multiplier
    console.log(`Mobile Audio: Play Combo SFX (x${_multiplier})`);
  }

  public playHit(): void {
    this.init();
    if (!this.soundLibraryInitialized) return;

    // In production: play explosion sound
    console.log('Mobile Audio: Play Hit SFX');
  }

  public startBgm(): void {
    if (this.isBgmPlaying) return;
    this.init();
    if (!this.soundLibraryInitialized) return;

    this.isBgmPlaying = true;
    // In production: loop BGM ambient drone
    console.log('Mobile Audio: Play looping BGM');
  }

  public stopBgm(): void {
    if (!this.isBgmPlaying) return;
    this.isBgmPlaying = false;

    // In production: stop BGM loop
    console.log('Mobile Audio: Stop BGM');
  }
}
