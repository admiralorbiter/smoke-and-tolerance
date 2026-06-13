import { ShotFrame } from '../types';

export class Timeline {
  private frames: ShotFrame[] = [];
  private currentFrameIndex: number = 0;
  public isPlaying: boolean = false;
  private playIntervalId: number | null = null;
  private onRenderFrameCallback: (frame: ShotFrame, index: number, frames: ShotFrame[]) => void;
  private onCleanBoreCallback: () => void;

  // DOM Elements
  private slider = document.getElementById('timeline-slider') as HTMLInputElement;
  private btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
  private playIcon = document.getElementById('play-icon') as HTMLSpanElement;
  private playText = document.getElementById('play-text') as HTMLSpanElement;
  private btnCleanBore = document.getElementById('btn-clear-soot') as HTMLButtonElement;

  // Stat boxes
  private statStage = document.getElementById('stat-stage') as HTMLSpanElement;
  private statPressure = document.getElementById('stat-pressure') as HTMLSpanElement;
  private statStress = document.getElementById('stat-stress') as HTMLSpanElement;
  private statVelocity = document.getElementById('stat-velocity') as HTMLSpanElement;

  constructor(
    onRender: (frame: ShotFrame, index: number, frames: ShotFrame[]) => void,
    onCleanBore: () => void
  ) {
    this.onRenderFrameCallback = onRender;
    this.onCleanBoreCallback = onCleanBore;
    this.initEventListeners();
  }

  private initEventListeners() {
    // Scrub timeline
    this.slider.addEventListener('input', () => {
      this.pause();
      this.currentFrameIndex = parseInt(this.slider.value);
      this.renderCurrentFrame();
    });

    // Play/Pause toggle
    this.btnPlay.addEventListener('click', () => {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    });

    // Clean Bore click
    this.btnCleanBore.addEventListener('click', () => {
      this.onCleanBoreCallback();
      this.btnCleanBore.textContent = '🧹 BORE CLEANED!';
      setTimeout(() => {
        this.btnCleanBore.textContent = '🧹 CLEAN BORE';
      }, 1500);
    });
  }

  public setFrames(newFrames: ShotFrame[]) {
    this.pause();
    this.frames = newFrames;
    this.currentFrameIndex = 0;
    this.slider.max = (this.frames.length - 1).toString();
    this.slider.value = '0';
    this.renderCurrentFrame();
  }

  public play() {
    if (this.frames.length === 0) return;
    this.isPlaying = true;
    this.playIcon.textContent = '⏸';
    this.playText.textContent = 'PAUSE';

    // Loop through frames
    const stepDurationMs = 50; // visual speed of frame steps
    
    if (this.playIntervalId !== null) {
      clearInterval(this.playIntervalId);
    }

    this.playIntervalId = window.setInterval(() => {
      if (this.currentFrameIndex >= this.frames.length - 1) {
        this.pause();
        return;
      }
      this.currentFrameIndex++;
      this.slider.value = this.currentFrameIndex.toString();
      this.renderCurrentFrame();
    }, stepDurationMs);
  }

  public pause() {
    this.isPlaying = false;
    this.playIcon.textContent = '▶';
    this.playText.textContent = 'PLAY';
    if (this.playIntervalId !== null) {
      clearInterval(this.playIntervalId);
      this.playIntervalId = null;
    }
  }

  private renderCurrentFrame() {
    const frame = this.frames[this.currentFrameIndex];
    if (!frame) return;

    // Render stats
    this.statStage.textContent = frame.stage.toUpperCase();
    this.statPressure.textContent = `${frame.pressure.toFixed(1)} MPa`;
    this.statStress.textContent = `${frame.barrelStress.toFixed(1)} MPa`;
    this.statVelocity.textContent = `${frame.projectileVelocity.toFixed(1)} m/s`;

    // Fire canvas render callback
    this.onRenderFrameCallback(frame, this.currentFrameIndex, this.frames);
  }
}
