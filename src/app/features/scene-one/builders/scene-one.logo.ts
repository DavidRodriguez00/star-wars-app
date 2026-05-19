import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// ─────────────────────────────────────────────
//  TYPES & CONFIG
// ─────────────────────────────────────────────

export interface LogoConfig {
  /** Color principal del brillo emisivo (hex). Default: 0xFFE81F */
  color: number;
  /** Intensidad base del emisivo en reposo. Default: 1.0 */
  glowBase: number;
  /** Amplitud del floating (unidades world). Default: 0.35 */
  floatAmplitude: number;
  /** Velocidad del float (multiplicador). Default: 1.0 */
  floatSpeed: number;
  /** Suavizado del parallax de ratón (0–1). Default: 0.05 */
  mouseDamping: number;
  /** Fuerza del parallax horizontal. Default: 0.20 */
  mouseStrengthX: number;
  /** Fuerza del parallax vertical. Default: 0.20 */
  mouseStrengthY: number;
}

const DEFAULT_CONFIG: LogoConfig = {
  color: 0xFFE81F,
  glowBase: 1.0,
  floatAmplitude: 0.35,
  floatSpeed: 1.0,
  mouseDamping: 0.05,
  mouseStrengthX: 0.20,
  mouseStrengthY: 0.20,
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'disposed';

// ─────────────────────────────────────────────
//  HELPERS (Zero-allocation)
// ─────────────────────────────────────────────

function forEachMesh(root: THREE.Object3D, cb: (mesh: THREE.Mesh) => void): void {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) cb(child as THREE.Mesh);
  });
}

function disposeMesh(mesh: THREE.Mesh): void {
  if (mesh.geometry) mesh.geometry.dispose();
  if (!mesh.material) return;

  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i];
    if (!m) continue;

    // Liberar texturas del material de forma segura
    for (const key in m) {
      const value = (m as any)[key];
      if (value && value.isTexture) {
        value.dispose();
      }
    }
    m.dispose();
  }
}

// ─────────────────────────────────────────────
//  CLASS
// ─────────────────────────────────────────────

/**
 * SpaceLogoManager
 * 
 * Control térmico y cinemático de geometrías biokinéticas adaptativas.
 * Diseñado para evitar GC spikes (recolector de basura) en render loops de 120Hz.
 */
export class SpaceLogoManager {
  // Nodo raíz expuesto para manipulación de coordenadas del layout general
  public readonly container: THREE.Group = new THREE.Group();

  private state: LoadState = 'idle';
  private model: THREE.Group | null = null;
  private basePositionY: number = 0;
  private introTimeline: gsap.core.Timeline | null = null;
  private sharedMaterial: THREE.MeshStandardMaterial | null = null;

  private readonly loader = new GLTFLoader();
  private cfg: LogoConfig;

  // Reutilización de vectores en memoria estática para evitar sobrecarga de GC
  private static readonly _v3Center = new THREE.Vector3();
  private static readonly _box = new THREE.Box3();

  constructor(
    private readonly scene: THREE.Scene,
    config: Partial<LogoConfig> = {}
  ) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.scene.add(this.container);
  }

  get isReady(): boolean { return this.state === 'ready'; }
  get isLoading(): boolean { return this.state === 'loading'; }
  get hasError(): boolean { return this.state === 'error'; }

  // ─────────────────────────────────────────────
  //  LOAD & ORCHESTRATION
  // ─────────────────────────────────────────────

  async load(path: string): Promise<void> {
    if (this.state === 'loading') throw new Error('SpaceLogoManager: Carga en progreso.');
    if (this.state === 'disposed') throw new Error('SpaceLogoManager: Instancia destruida.');

    this.state = 'loading';

    try {
      const gltf = await this.loader.loadAsync(path);
      this.model = gltf.scene;

      // Centrado del pivote geométrico (Uso de memoria estática sin New Vector3)
      SpaceLogoManager._box.setFromObject(this.model);
      SpaceLogoManager._box.getCenter(SpaceLogoManager._v3Center);
      this.model.position.sub(SpaceLogoManager._v3Center);

      // Inyección de material cinético unificado
      this.applyBiokineticMaterial();
      this.container.add(this.model);

      // Reset de escala previo a la intro del motor gráfico
      this.container.scale.setScalar(0);
      this.state = 'ready';
    } catch (error) {
      this.state = 'error';
      console.error(`SpaceLogoManager: Error crítico cargando asset: [${path}]`, error);
      throw error;
    }
  }

  /**
   * Modifica propiedades del motor en caliente reduciendo los draws a GPU.
   */
  updateConfig(newConfig: Partial<LogoConfig>): void {
    this.cfg = { ...this.cfg, ...newConfig };

    if (!this.sharedMaterial) return;

    // Mutación directa de uniformes reactivos sin recrear instancias de materiales
    if (newConfig.color !== undefined) this.sharedMaterial.emissive.setHex(this.cfg.color);
    if (newConfig.glowBase !== undefined) this.sharedMaterial.emissiveIntensity = this.cfg.glowBase;
  }

  // ─────────────────────────────────────────────
  //  MATERIAL ENGINE
  // ─────────────────────────────────────────────

  private applyBiokineticMaterial(): void {
    if (!this.model) return;

    // Instanciamos un único material compartido para el lote de mallas (Batching optimizado)
    if (this.sharedMaterial) {
      this.sharedMaterial.dispose();
    }

    this.sharedMaterial = new THREE.MeshStandardMaterial({
      color: 0x0A0A0C, // Base absorbente profunda
      emissive: this.cfg.color,
      emissiveIntensity: this.cfg.glowBase,
      roughness: 0.4,   // Ligera dispersión micro-superficial para ganar volumen espacial
      metalness: 0.9,   // Conducción cinética reflectiva
    });

    forEachMesh(this.model, (mesh) => {
      disposeMesh(mesh); // Prevenir fugas de materiales por defecto del archivo GLTF
      mesh.material = this.sharedMaterial!;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }

  // ─────────────────────────────────────────────
  //  KINEMATICS (GSAP)
  // ─────────────────────────────────────────────

  intro(onComplete?: () => void): gsap.core.Timeline {
    if (!this.isReady) {
      console.warn('SpaceLogoManager.intro(): Transición abortada. El modelo no se encuentra listo.');
      return gsap.timeline();
    }

    if (this.introTimeline) this.introTimeline.kill();

    this.introTimeline = gsap.timeline({ delay: 0.2, onComplete });

    // Animación cinemática fluida integrada con los presets del HUB
    this.introTimeline.to(this.container.scale, {
      x: 2.2, y: 2.2, z: 2.2,
      duration: 2.4,
      ease: 'expo.inOut',
    });

    this.introTimeline.from(this.container.position, {
      z: -50,
      duration: 3.2,
      ease: 'power4.out',
    }, '<');

    return this.introTimeline;
  }

  // ─────────────────────────────────────────────
  //  FRAME LOOP (120Hz Optimized)
  // ─────────────────────────────────────────────

  public update(t: number, mouse: THREE.Vector2): void {
    if (this.state !== 'ready') return;

    // Submódulo 1: Parallax rotacional amortiguado
    const targetY = mouse.x * this.cfg.mouseStrengthX;
    const targetX = -mouse.y * this.cfg.mouseStrengthY;

    this.container.rotation.y += (targetY - this.container.rotation.y) * this.cfg.mouseDamping;
    this.container.rotation.x += (targetX - this.container.rotation.x) * this.cfg.mouseDamping;

    // Submódulo 2: Desplazamiento orgánico vertical (Flotación armónica)
    this.container.position.y = this.basePositionY + (Math.sin(t * this.cfg.floatSpeed) * this.cfg.floatAmplitude);
  }

  public setBasePositionY(y: number): void {
    this.basePositionY = y;
  }

  // ─────────────────────────────────────────────
  //  DESTRUCTOR
  // ─────────────────────────────────────────────

  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';

    if (this.introTimeline) {
      this.introTimeline.kill();
      this.introTimeline = null;
    }

    // Desvincular loops reactivos de GSAP del contenedor
    gsap.killTweensOf(this.container.scale);
    gsap.killTweensOf(this.container.position);

    // Limpieza profunda de texturas y buffers geométricos en la GPU
    if (this.model) {
      forEachMesh(this.model, disposeMesh);
      this.model = null;
    }

    if (this.sharedMaterial) {
      this.sharedMaterial.dispose();
      this.sharedMaterial = null;
    }

    if (this.container.parent) {
      this.container.parent.remove(this.container);
    } else {
      this.scene.remove(this.container);
    }
  }
}