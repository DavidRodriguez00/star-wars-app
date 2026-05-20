import {
  Injectable,
  NgZone,
  OnDestroy,
} from '@angular/core';

import * as THREE from 'three';

@Injectable({
  providedIn: 'root',
})
export class EngineService implements OnDestroy {

  // ======================================================
  // Core Three.js
  // ======================================================

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;
  public mouse: THREE.Vector2;

  // ======================================================
  // Render & loop
  // ======================================================

  private frameId: number | null = null;

  private isRunning = false;
  private isInitialized = false;

  // ======================================================
  // Timing moderno (sin THREE.Clock)
  // ======================================================

  private previousTime = performance.now();

  public elapsedTime = 0;
  public deltaTime = 0;
  public fps = 0;
  private fpsAccumulator = 0;
  private fpsFrames = 0;

  // ======================================================
  // Configuración
  // ======================================================

  private readonly DEFAULT_FOV = 55;
  private readonly DEFAULT_NEAR = 0.1;
  private readonly DEFAULT_FAR = 5000;
  private readonly MAX_PIXEL_RATIO = 2;
  private readonly MAX_DELTA = 0.1;
  private readonly DEFAULT_CLEAR_COLOR = 0x000000;

  // ======================================================
  // Update loop
  // ======================================================

  private updateCallbacks:
    Array<(time: number, delta: number) => void> = [];

  // ======================================================
  // Eventos
  // ======================================================

  private resizeObserver?: ResizeObserver;

  // ======================================================
  // Estado viewport
  // ======================================================

  public viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    aspect: window.innerWidth / window.innerHeight,
    pixelRatio: Math.min(
      window.devicePixelRatio,
      this.MAX_PIXEL_RATIO
    ),
  };

  constructor(
    private ngZone: NgZone
  ) {

    this.scene = new THREE.Scene();
    this.mouse = new THREE.Vector2();

    // Cámara cinematográfica
    this.camera = new THREE.PerspectiveCamera(
      this.DEFAULT_FOV,
      this.viewport.aspect,
      this.DEFAULT_NEAR,
      this.DEFAULT_FAR,
    );

    this.camera.position.set(0, 0, 150);
  }

  // ======================================================
  // Inicialización
  // ======================================================

  public init(
    canvas: HTMLCanvasElement
  ): void {

    if (this.isInitialized) return;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
    });

    this.configureRenderer();
    this.updateRendererSize();
    this.listenToEvents(canvas);
    this.startLoop();
    this.isInitialized = true;
  }

  // ======================================================
  // Renderer config
  // ======================================================

  private configureRenderer(): void {

    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;
    this.renderer.toneMapping =
      THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    this.renderer.setClearColor(
      this.DEFAULT_CLEAR_COLOR,
      0
    );

    this.renderer.setPixelRatio(
      this.viewport.pixelRatio
    );

    this.renderer.info.autoReset = true;
  }

  // ======================================================
  // Loop principal
  // ======================================================

  private startLoop(): void {

    if (this.isRunning) return;

    this.isRunning = true;
    this.previousTime = performance.now();
    this.ngZone.runOutsideAngular(() => {

      const render = () => {
        if (!this.isRunning) return;
        const currentTime = performance.now();
        // Delta en segundos
        this.deltaTime = Math.min(
          (currentTime - this.previousTime) / 1000,
          this.MAX_DELTA
        );

        this.previousTime = currentTime;
        this.elapsedTime += this.deltaTime;
        this.calculateFPS();

        // Ejecutar callbacks
        for (const callback of this.updateCallbacks) {

          callback(
            this.elapsedTime,
            this.deltaTime
          );
        }

        // Render
        this.renderer.render(
          this.scene,
          this.camera
        );
        this.frameId =
          requestAnimationFrame(render);
      };
      this.frameId =
        requestAnimationFrame(render);
    });
  }

  public stopLoop(): void {
    this.isRunning = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  public resumeLoop(): void {
    if (this.isRunning) return;
    this.previousTime = performance.now();
    this.startLoop();
  }

  // ======================================================
  // Update loop API
  // ======================================================

  /**
   * Añade lógica personalizada al loop.
   * Devuelve cleanup automático.
   */
  public addToUpdateLoop(
    callback: (
      time: number,
      delta: number
    ) => void
  ): () => void {

    this.updateCallbacks.push(callback);

    return () => {
      this.removeFromUpdateLoop(callback);
    };
  }

  public removeFromUpdateLoop(
    callback: (
      time: number,
      delta: number
    ) => void
  ): void {

    this.updateCallbacks =
      this.updateCallbacks.filter(
        cb => cb !== callback
      );
  }

  public clearUpdateLoop(): void {
    this.updateCallbacks = [];
  }

  // ======================================================
  // Scene helpers
  // ======================================================

  public add(
    ...objects: THREE.Object3D[]
  ): void {
    this.scene.add(...objects);
  }

  public remove(
    ...objects: THREE.Object3D[]
  ): void {
    this.scene.remove(...objects);
  }

  // ======================================================
  // Camera helpers
  // ======================================================

  public setCameraPosition(
    x: number,
    y: number,
    z: number
  ): void {

    this.camera.position.set(x, y, z);
  }

  public setCameraRotation(
    x: number,
    y: number,
    z: number
  ): void {

    this.camera.rotation.set(x, y, z);
  }

  public lookAt(
    x: number,
    y: number,
    z: number
  ): void {

    this.camera.lookAt(x, y, z);
  }

  public updateCameraFov(
    fov: number
  ): void {

    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  // ======================================================
  // Resize
  // ======================================================

  private updateRendererSize(): void {

    this.viewport.width = window.innerWidth;
    this.viewport.height = window.innerHeight;

    this.viewport.aspect =
      this.viewport.width /
      this.viewport.height;

    this.viewport.pixelRatio = Math.min(
      window.devicePixelRatio,
      this.MAX_PIXEL_RATIO
    );

    this.camera.aspect =
      this.viewport.aspect;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      this.viewport.width,
      this.viewport.height,
      false
    );

    this.renderer.setPixelRatio(
      this.viewport.pixelRatio
    );
  }

  // ======================================================
  // Eventos
  // ======================================================

  private listenToEvents(
    canvas: HTMLCanvasElement
  ): void {

    window.addEventListener(
      'resize',
      this.handleResize,
      { passive: true }
    );

    window.addEventListener(
      'mousemove',
      this.handleMouseMove,
      { passive: true }
    );

    window.addEventListener(
      'touchmove',
      this.handleTouchMove,
      { passive: true }
    );

    document.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange
    );

    this.resizeObserver =
      new ResizeObserver(() => {

        this.updateRendererSize();
      });
    this.resizeObserver.observe(canvas);
  }

  private handleResize = (): void => {
    this.updateRendererSize();
  };

  private handleMouseMove = (
    event: MouseEvent
  ): void => {

    this.mouse.x =
      (event.clientX / this.viewport.width)
      * 2 - 1;

    this.mouse.y =
      -(event.clientY / this.viewport.height)
      * 2 + 1;
  };

  private handleTouchMove = (
    event: TouchEvent
  ): void => {

    if (!event.touches.length) return;

    const touch = event.touches[0];

    this.mouse.x =
      (touch.clientX / this.viewport.width)
      * 2 - 1;

    this.mouse.y =
      -(touch.clientY / this.viewport.height)
      * 2 + 1;
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stopLoop();
    } else {
      this.resumeLoop();
    }
  };

  // ======================================================
  // Performance
  // ======================================================

  private calculateFPS(): void {

    this.fpsAccumulator += this.deltaTime;
    this.fpsFrames++;

    if (this.fpsAccumulator >= 1) {
      this.fps = Math.round(
        this.fpsFrames /
        this.fpsAccumulator
      );
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
    }
  }

  public getRendererInfo() {

    return {
      fps: this.fps,
      memory: this.renderer.info.memory,
      render: this.renderer.info.render,
      programs:
        this.renderer.info.programs?.length ?? 0,
    };
  }

  // ======================================================
  // Utilidades renderer
  // ======================================================

  public setBackgroundColor(
    color: THREE.ColorRepresentation,
    alpha = 1
  ): void {

    this.renderer.setClearColor(
      color,
      alpha
    );
  }

  public setToneMappingExposure(
    exposure: number
  ): void {

    this.renderer.toneMappingExposure =
      exposure;
  }

  public enableShadows(
    enabled = true
  ): void {

    this.renderer.shadowMap.enabled =
      enabled;
  }

  // ======================================================
  // Cleanup helpers
  // ======================================================

  /**
   * Limpia geometrías/materiales/texturas
   */
  public disposeObject(
    object: THREE.Object3D
  ): void {

    object.traverse((child: any) => {

      // Geometry
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Material
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(
            (material: THREE.Material) => {
              material.dispose();
            }
          );
        } else {
          child.material.dispose();
        }
      }

      // Texture maps
      const material = child.material;

      if (material) {
        Object.keys(material).forEach(key => {
          const value = material[key];
          if (
            value &&
            value.isTexture
          ) {
            value.dispose();
          }
        });
      }
    });
  }

  /**
   * Limpia completamente la escena
   */
  public clearScene(): void {
    while (this.scene.children.length > 0) {
      const child =
        this.scene.children[0];

      this.disposeObject(child);
      this.scene.remove(child);
    }
  }

  // ======================================================
  // Destroy
  // ======================================================

  public ngOnDestroy(): void {

    this.stopLoop();

    window.removeEventListener(
      'resize',
      this.handleResize
    );

    window.removeEventListener(
      'mousemove',
      this.handleMouseMove
    );

    window.removeEventListener(
      'touchmove',
      this.handleTouchMove
    );

    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange
    );

    this.resizeObserver?.disconnect();
    this.clearUpdateLoop();
    this.clearScene();
    this.renderer?.dispose();
  }
}