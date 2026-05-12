import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────

export interface LogoConfig {
  /** Color principal del brillo emisivo (hex). Default: 0xFFE81F */
  color: number;
  /** Intensidad base del emisivo en reposo. Default: 0.05 */
  glowBase: number;
  /** Amplitud del floating (unidades world). Default: 0.35 */
  floatAmplitude: number;
  /** Velocidad del float (multiplicador). Default: 1.0 */
  floatSpeed: number;
  /** Suavizado del parallax de ratón (0–1). Default: 0.05 */
  mouseDamping: number;
  /** Fuerza del parallax horizontal. Default: 0.25 */
  mouseStrengthX: number;
  /** Fuerza del parallax vertical. Default: 0.20 */
  mouseStrengthY: number;
}

const DEFAULT_CONFIG: LogoConfig = {
  color: 0xFFE81F,
  glowBase: 1,
  floatAmplitude: 0.35,
  floatSpeed: 1.0,
  mouseDamping: 0.05,
  mouseStrengthX: 0.20,
  mouseStrengthY: 0.20,
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'disposed';

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

/** Itera sólo sobre los Mesh de un Object3D, sin boxing extra. */
function forEachMesh(
  root: THREE.Object3D,
  cb: (mesh: THREE.Mesh) => void
): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) cb(child);
  });
}

/** Libera geometría, materiales y texturas de un Mesh para evitar memory leaks. */
function disposeMesh(mesh: THREE.Mesh): void {
  if (mesh.geometry) mesh.geometry.dispose();

  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((m) => {
    if (!m) return;
    // Liberar texturas asociadas al material
    for (const key in m) {
      const value = (m as any)[key];
      if (value && typeof value.dispose === 'function' && value instanceof THREE.Texture) {
        value.dispose();
      }
    }
    m.dispose();
  });
}

// ─────────────────────────────────────────────
//  CLASS
// ─────────────────────────────────────────────

/**
 * SpaceLogoManager
 *
 * Gestiona la carga, materiales biokinéticos, animación cinemática de entrada
 * y el loop de actualización (float + parallax + pulso) de un logo 3D GLTF.
 */
export class SpaceLogoManager {

  // ── Nodo raíz expuesto (posicionable desde fuera) ──────────────────
  public readonly container: THREE.Group = new THREE.Group();

  // ── Estado interno ─────────────────────────────────────────────────
  private state: LoadState = 'idle';
  private model: THREE.Group | null = null;
  private basePositionY: number = 0;
  private introTimeline: gsap.core.Timeline | null = null;

  // ── Infraestructura Three.js ───────────────────────────────────────
  private readonly loader = new GLTFLoader();

  // ── Configuración inmutable post-construcción ──────────────────────
  private cfg: LogoConfig;

  // ─────────────────────────────────────────────
  //  CONSTRUCTOR
  // ─────────────────────────────────────────────

  constructor(
    private readonly scene: THREE.Scene,
    config: Partial<LogoConfig> = {}
  ) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.scene.add(this.container);
  }

  // ─────────────────────────────────────────────
  //  GETTERS PÚBLICOS (read-only)
  // ─────────────────────────────────────────────

  get isReady(): boolean { return this.state === 'ready'; }
  get isLoading(): boolean { return this.state === 'loading'; }
  get hasError(): boolean { return this.state === 'error'; }

  // ─────────────────────────────────────────────
  //  LOAD & CONFIG
  // ─────────────────────────────────────────────

  /**
   * Carga el GLTF, centra su pivote y prepara materiales.
   */
  async load(path: string): Promise<void> {
    if (this.state === 'loading') throw new Error('SpaceLogoManager: load already in progress.');
    if (this.state === 'disposed') throw new Error('SpaceLogoManager: cannot load after dispose.');

    this.state = 'loading';

    try {
      const gltf = await this.loader.loadAsync(path);
      this.model = gltf.scene;

      // ─────────────────────────────────────────────
      //  CORRECCIÓN DE PIVOTE (Centrado geométrico)
      // ─────────────────────────────────────────────
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());

      this.model.position.sub(center); // Forma más elegante de restar el centro
      // ─────────────────────────────────────────────

      this.applyBiokineticMaterial();
      this.container.add(this.model);

      // Escala cero para la intro cinemática
      this.container.scale.setScalar(0);

      this.state = 'ready';
    } catch (error) {
      this.state = 'error';
      console.error(`SpaceLogoManager: Error loading model from ${path}`, error);
      throw error;
    }
  }

  /**
   * Permite actualizar la configuración en tiempo real (ej: cambiar el color dinámicamente).
   */
  updateConfig(newConfig: Partial<LogoConfig>): void {
    this.cfg = { ...this.cfg, ...newConfig };

    // Actualizar color de la luz si cambió
    if (newConfig.color !== undefined) {
      this.applyBiokineticMaterial();
    }
  }

  // ─────────────────────────────────────────────
  //  MATERIAL BIOKINÉTICO
  // ─────────────────────────────────────────────

  applyBiokineticMaterial(): void {
    if (!this.model) return;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: this.cfg.color,
      emissiveIntensity: this.cfg.glowBase,
      roughness: 1,
      metalness: 2,
    });

    forEachMesh(this.model, (mesh) => {
      if (mesh.material instanceof THREE.Material) {
        disposeMesh(mesh); // Aseguramos limpieza antes de reasignar
      }

      mesh.material = mat.clone();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    mat.dispose();
  }

  // ─────────────────────────────────────────────
  //  INTRO CINEMÁTICA
  // ─────────────────────────────────────────────

  intro(onComplete?: () => void): gsap.core.Timeline {
    if (!this.isReady) {
      console.warn('SpaceLogoManager.intro(): model not ready.');
      return gsap.timeline();
    }

    // Matamos la animación anterior si se llama a intro() múltiples veces
    if (this.introTimeline) this.introTimeline.kill();

    this.introTimeline = gsap.timeline({ delay: 0.4, onComplete });

    this.introTimeline.to(this.container.scale, {
      x: 2.2, y: 2.2, z: 2.2,
      duration: 2.6,
      ease: 'expo.inOut',
    });

    this.introTimeline.from(this.container.position, {
      z: -70,
      duration: 4,
      ease: 'power3.out',
    }, '<');

    return this.introTimeline;
  }

  // ─────────────────────────────────────────────
  //  UPDATE LOOP
  // ─────────────────────────────────────────────

  update(t: number, mouse: THREE.Vector2): void {
    if (!this.isReady) return;

    this.updateMouseParallax(mouse);
    this.updateFloat(t); // Integrado el efecto de flotación
  }

  setBasePositionY(y: number): void {
    this.basePositionY = y;
  }

  // ─────────────────────────────────────────────
  //  SUBMÓDULOS DE ANIMACIÓN
  // ─────────────────────────────────────────────

  private updateMouseParallax(mouse: THREE.Vector2): void {
    const { mouseDamping: k, mouseStrengthX: sx, mouseStrengthY: sy } = this.cfg;
    const targetY = mouse.x * sx;
    const targetX = -mouse.y * sy;

    this.container.rotation.y += (targetY - this.container.rotation.y) * k;
    this.container.rotation.x += (targetX - this.container.rotation.x) * k;
  }

  /** Lógica de flotación basada en ondas senoidales */
  private updateFloat(t: number): void {
    const floatOffset = Math.sin(t * this.cfg.floatSpeed) * this.cfg.floatAmplitude;
    // Combinamos la posición base controlada por scroll con el offset orgánico
    this.container.position.y = this.basePositionY + floatOffset;
  }

  // ─────────────────────────────────────────────
  //  DISPOSE
  // ─────────────────────────────────────────────

  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';

    // Limpieza de GSAP
    if (this.introTimeline) this.introTimeline.kill();
    gsap.killTweensOf(this.container.scale);
    gsap.killTweensOf(this.container.position);

    // Limpieza de Three.js
    if (this.model) {
      forEachMesh(this.model, disposeMesh);
    }

    this.scene.remove(this.container);
  }
}