import {
    Component,
    ElementRef,
    AfterViewInit,
    inject,
    NgZone,
    OnDestroy
} from '@angular/core';
import * as THREE from 'three';
import gsap from 'gsap';

import { NebulaEngine } from './builders/scene-one.nebula';
import { SpaceLogoManager } from './builders/scene-one.logo';
import { animateSpace } from './services/scene-one.animations';
import { EngineService } from '../../core/engine/engine';
import { ScrollOrchestratorService } from '../../core/animations/scroll-orchestrator';

@Component({
    selector: 'app-scene-one',
    templateUrl: './scene-one.html',
    styleUrls: ['./scene-one.css'],
    standalone: true
})
export class SceneOneComponent implements AfterViewInit, OnDestroy {
    // =========================================================================
    // INJECTIONS
    // =========================================================================
    private zone = inject(NgZone);
    private hostRef = inject(ElementRef);
    private engine = inject(EngineService);
    private orchestrator = inject(ScrollOrchestratorService);

    // =========================================================================
    // ENGINES & STATE
    // =========================================================================
    private nebula!: NebulaEngine;
    private logo!: SpaceLogoManager;
    private _hasPlayedIntro = false;

    // =========================================================================
    // LIFECYCLE
    // =========================================================================
    ngAfterViewInit(): void {
        this.zone.runOutsideAngular(async () => {
            // 1. Inicializamos motores usando la escena y cámara del EngineService global
            this.nebula = new NebulaEngine(this.engine.scene);
            this.logo = new SpaceLogoManager(this.engine.scene);

            // 2. Carga de assets
            try {
                await this.logo.load('assets/models/starwars.glb');
                this.logo.container.position.set(0, 0, 140); // Posición inicial
                
                // 3. Registrar en el Loop Global del Engine
                this.engine.addToUpdateLoop((time) => {
                    this.nebula.update(time);
                    this.logo.update(time, this.engine.mouse);
                    
                    // Ejecutamos las animaciones de parallax y respiración (biokinetic engine)
                    animateSpace(
                        this.engine.camera,
                        null as any, 
                        this.logo.container,
                        time,
                        this.engine.mouse
                    );
                });

                // 4. Registrar coreografía en el Orquestador de Scroll
                // Pasamos las referencias necesarias al servicio de GSAP
                this.orchestrator.registerSceneOne(
                    this.logo.container,
                    this.engine.camera,
                    this.nebula.scene,
                );

                // 5. Lanzar Intro Cinematográfica
                this.playIntro();

            } catch (err) {
                console.error('Error inicializando SceneOne:', err);
            }
        });
    }

    // =========================================================================
    // TRANSICIONES CINEMÁTICAS
    // =========================================================================
    /**
     * Secuencia de entrada inicial que precede al control por scroll.
     */
    private playIntro(): void {
        if (this._hasPlayedIntro) return;
        this._hasPlayedIntro = true;

        const el = this.hostRef.nativeElement;

        // Fade in del contenedor UI (Adaptive Agenda style)
        gsap.to(el, { opacity: 1, duration: 1.5 });

        // Secuencia de entrada de cámara (Z=600 a Z=150)
        // Ajustamos exposición para el efecto de "encendido" de la galaxia
        this.engine.renderer.toneMappingExposure = 0.1;

        gsap.to(this.engine.renderer, {
            toneMappingExposure: 1.0,
            duration: 3.2,
            ease: 'power2.inOut'
        });

        gsap.to(this.engine.camera.position, {
            z: 150,
            duration: 4.2,
            ease: 'expo.inOut',
            onComplete: () => {
                // Tras el intro, el ScrollOrchestrator maneja el estado vía ScrollTrigger
                console.log('Star Wars Scene Ready');
            }
        });

        // Lanzar la animación interna del logo (glow y escala inicial)
        this.logo.intro();
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================
    ngOnDestroy(): void {
        // Limpiamos recursos de Three.js para evitar fugas de memoria en la GPU
        this.nebula?.dispose();
        this.logo?.dispose();
    }
}