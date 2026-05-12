import * as THREE from 'three';
import { SpaceLogoManager } from '../builders/scene-one.logo';

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────

export interface ScrollConfig {
  /** Posición Z de la cámara en progress=0. Default: 150 */
  camZStart: number;
  /** Posición Z de la cámara en progress=1. Default: 400 */
  camZEnd: number;
  /** FOV base de la cámara. Default: 50 */
  fovBase: number;
  /** Incremento de FOV al llegar a progress=1. Default: 20 */
  fovDelta: number;
  /** Posición Y del logo en progress=0. Default: 5 */
  logoYStart: number;
  /** Posición Y del logo en progress=1. Default: -25 */
  logoYEnd: number;
  /** Escala del logo en progress=0. Default: 1.0 */
  logoScaleStart: number;
  /** Escala del logo en progress=1. Default: 0.4 */
  logoScaleEnd: number;
  /** Ángulo de rotación Y total a lo largo del scroll (rad). Default: Math.PI * 2 */
  logoRotationY: number;
  /** Ángulo máximo de pitch (rotación X) al final del scroll. Default: 0.3 */
  logoMaxPitchX: number;
}

const DEFAULT_CONFIG: ScrollConfig = {
  camZStart:      150,
  camZEnd:        400,
  fovBase:        50,
  fovDelta:       25,
  logoYStart:     5,
  logoYEnd:       -25,
  logoScaleStart: 1.0,
  logoScaleEnd:   0.35,
  logoRotationY:  Math.PI * 2,
  logoMaxPitchX:  0.3
};

// ─────────────────────────────────────────────
//  HELPER MATH
// ─────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const sanitizeProgress = (p: number): number => {
  if (isNaN(p) || !isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
};

/**
 * Gestiona la coreografía de la Escena 1 basada en el progreso del scroll.
 * Sincroniza la cámara de PerspectiveCamera y el contenedor del Logo.
 */
export class SpaceScrollHandler {
  private cfg: ScrollConfig;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private logoContainer: THREE.Group,
    private logoManager: SpaceLogoManager,
    config: Partial<ScrollConfig> = {}
  ) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────
  //  API PÚBLICA
  // ─────────────────────────────────────────────

  /**
   * Aplica el estado de la escena correspondiente a `progress`.
   * @param progress Valor normalizado [0, 1] que viene del ScrollService.
   */
  updateByProgress(progress: number): void {
    const p = sanitizeProgress(progress);

    this.updateCamera(p);
    this.updateLogo(p);
  }

  // ─────────────────────────────────────────────
  //  SUBMÓDULOS DE COREOGRAFÍA
  // ─────────────────────────────────────────────

  /** Mueve la cámara en Z y ajusta el FOV cinemático. */
  private updateCamera(p: number): void {
    this.camera.position.z = lerp(this.cfg.camZStart, this.cfg.camZEnd, p);
    this.camera.fov         = this.cfg.fovBase + p * this.cfg.fovDelta;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Controla posición, escala y rotación del logo.
   */
  private updateLogo(p: number): void {
    // Posición vertical (flujo de la agenda)
    const targetY = lerp(this.cfg.logoYStart, this.cfg.logoYEnd, p);
    this.logoContainer.position.y = targetY;


    // Escala adaptativa para que el logo se aleje
    this.logoContainer.scale.setScalar(
      lerp(this.cfg.logoScaleStart, this.cfg.logoScaleEnd, p)
    );

    // Rotación de autor en Y (giro completo)
    this.logoContainer.rotation.y = p * this.cfg.logoRotationY;

    // Pitch (inclinación) progresiva en X
    this.logoContainer.rotation.x = p * this.cfg.logoMaxPitchX;
  }
}