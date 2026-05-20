// core/animations/scroll-orchestrator.service.ts

import {
  Injectable,
  OnDestroy
} from '@angular/core';

import gsap from 'gsap';

import { ScrollTrigger } from 'gsap/ScrollTrigger';

import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger);

@Injectable({
  providedIn: 'root'
})
export class ScrollOrchestratorService implements OnDestroy {

  // ======================================================
  // Core
  // ======================================================

  private masterTimeline!: gsap.core.Timeline;

  private timelines = new Map<string, gsap.core.Timeline>();

  private triggers: ScrollTrigger[] = [];

  private isInitialized = false;

  // ======================================================
  // Config global
  // ======================================================

  private readonly DEFAULT_SCRUB = 1.5;

  private readonly DEFAULT_EASE = 'none';

  constructor() {
    this.initialize();
  }

  // ======================================================
  // Init
  // ======================================================

  private initialize(): void {

    if (this.isInitialized) return;

    // Configuración global GSAP
    ScrollTrigger.config({
      ignoreMobileResize: true
    });

    this.masterTimeline = gsap.timeline({
      paused: true
    });

    this.isInitialized = true;
  }

  // ======================================================
  // Escena principal
  // ======================================================

  /**
   * Registra la primera escena cinematográfica
   */
  public registerSceneOne(
    logo: THREE.Group,
    camera: THREE.PerspectiveCamera,
    nebula?: THREE.Object3D
  ): gsap.core.Timeline {

    // Evitar duplicados
    this.killTimeline('scene-one');
    const logoMaterials = this.collectObjectMaterials(logo);

    logoMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 1;
      material.needsUpdate = true;
    });

    const timeline = gsap.timeline({
      defaults: {
        ease: 'power3.inOut',
        duration: 1.4
      },
      scrollTrigger: {
        id: 'scene-one',
        trigger: '#trigger-scene-one',
        start: 'top+=1 top',
        end: '55% top',
        scrub: this.DEFAULT_SCRUB,
        invalidateOnRefresh: true,
        fastScrollEnd: true
      }
    });

    // ==================================================
    // Coreografía principal
    // ==================================================

    timeline

      // Cámara
      .to(camera.position, {
        z: 310
      }, 0)

      // Escala logo
      .to(logo.scale, {
        x: 0.35,
        y: 0.35,
        z: 0.35
      }, 0)

      // Movimiento flotante
      .to(logo.position, {
        y: 25
      }, 0)

      // Desaparición del logo
      .to(logoMaterials, {
        opacity: 0,
        duration: 1.1
      }, 0.2);

    // Nebulosa opcional
    if (nebula) {

      timeline.to(nebula.rotation, {
        y: Math.PI * 0.25,
        z: Math.PI * 0.1
      }, 0);

      timeline.to(nebula.position, {
        z: -50
      }, 0);
    }

    this.storeTimeline('scene-one', timeline);

    return timeline;
  }

  private collectObjectMaterials(object: THREE.Object3D): THREE.Material[] {

    const materials = new Set<THREE.Material>();

    object.traverse((child) => {

      if (!(child instanceof THREE.Mesh)) return;

      const meshMaterials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      meshMaterials.forEach((material) => {
        if (material) materials.add(material);
      });
    });

    return Array.from(materials);
  }

  // ======================================================
  // API genérica para escenas
  // ======================================================

  /**
   * Crea una escena scroll reutilizable
   */
  public createScene(
    id: string,
    config: {
      trigger: string;
      start?: string;
      end?: string;
      scrub?: number | boolean;
      pin?: boolean;
      markers?: boolean;
      anticipatePin?: number;
    }
  ): gsap.core.Timeline {

    this.killTimeline(id);

    const timeline = gsap.timeline({

      defaults: {
        ease: this.DEFAULT_EASE
      },

      scrollTrigger: {
        id,

        trigger: config.trigger,

        start: config.start ?? 'top center',

        end: config.end ?? 'bottom center',

        scrub: config.scrub ?? this.DEFAULT_SCRUB,

        pin: config.pin ?? false,

        markers: config.markers ?? false,

        anticipatePin: config.anticipatePin ?? 1,

        invalidateOnRefresh: true,

        fastScrollEnd: true
      }
    });

    this.storeTimeline(id, timeline);

    return timeline;
  }

  // ======================================================
  // Animaciones helper THREE.js
  // ======================================================

  public animatePosition(
    timeline: gsap.core.Timeline,
    object: THREE.Object3D,
    values: Partial<THREE.Vector3>,
    at = 0
  ): void {

    timeline.to(object.position, {
      ...values
    }, at);
  }

  public animateRotation(
    timeline: gsap.core.Timeline,
    object: THREE.Object3D,
    values: Partial<THREE.Euler>,
    at = 0
  ): void {

    timeline.to(object.rotation, {
      ...values
    }, at);
  }

  public animateScale(
    timeline: gsap.core.Timeline,
    object: THREE.Object3D,
    values: Partial<THREE.Vector3>,
    at = 0
  ): void {

    timeline.to(object.scale, {
      ...values
    }, at);
  }

  public animateMaterial(
    timeline: gsap.core.Timeline,
    material: THREE.Material & any,
    values: any,
    at = 0
  ): void {

    timeline.to(material, values, at);
  }

  // ======================================================
  // Timeline management
  // ======================================================

  private storeTimeline(
    id: string,
    timeline: gsap.core.Timeline
  ): void {

    this.timelines.set(id, timeline);

    const trigger = timeline.scrollTrigger;

    if (trigger) {
      this.triggers.push(trigger);
    }
  }

  public getTimeline(
    id: string
  ): gsap.core.Timeline | undefined {

    return this.timelines.get(id);
  }

  public hasTimeline(id: string): boolean {

    return this.timelines.has(id);
  }

  public killTimeline(id: string): void {

    const timeline = this.timelines.get(id);

    if (!timeline) return;

    timeline.scrollTrigger?.kill();

    timeline.kill();

    this.timelines.delete(id);
  }

  public killAll(): void {

    this.timelines.forEach((timeline) => {

      timeline.scrollTrigger?.kill();

      timeline.kill();
    });

    this.timelines.clear();

    this.triggers = [];
  }

  // ======================================================
  // ScrollTrigger helpers
  // ======================================================

  public refresh(): void {
    ScrollTrigger.refresh();
  }

  public enableAll(): void {
    ScrollTrigger.enable();
  }

  public disableAll(): void {
    ScrollTrigger.disable();
  }

  public pauseAll(): void {

    this.timelines.forEach(tl => tl.pause());
  }

  public resumeAll(): void {

    this.timelines.forEach(tl => tl.resume());
  }

  // ======================================================
  // Cinematic camera helpers
  // ======================================================

  public createCameraDolly(
    timeline: gsap.core.Timeline,
    camera: THREE.Camera,
    config: {
      z?: number;
      x?: number;
      y?: number;
      lookAt?: THREE.Vector3;
    },
    at = 0
  ): void {

    timeline.to(camera.position, {
      x: config.x,
      y: config.y,
      z: config.z
    }, at);

    if (config.lookAt) {

      const proxy = {
        x: 0,
        y: 0,
        z: 0
      };

      timeline.to(proxy, {

        x: config.lookAt.x,
        y: config.lookAt.y,
        z: config.lookAt.z,

        onUpdate: () => {
          camera.lookAt(
            proxy.x,
            proxy.y,
            proxy.z
          );
        }

      }, at);
    }
  }

  // ======================================================
  // Scroll Reset
  // ======================================================

  public resetScroll(): void {
    // Scroll to top with a small delay to ensure page is ready
    setTimeout(() => {
      window.scrollTo(0, 0);
      // Refresh after scrolling to ensure triggers are properly positioned
      ScrollTrigger.refresh();
    }, 100);
  }

  // ======================================================
  // Debug
  // ======================================================

  public getDebugInfo() {

    return {
      totalTimelines: this.timelines.size,
      totalTriggers: this.triggers.length,
      activeTriggers: ScrollTrigger.getAll().length
    };
  }

  // ======================================================
  // Destroy
  // ======================================================

  public ngOnDestroy(): void {

    this.killAll();

    ScrollTrigger.killAll();
  }
}
