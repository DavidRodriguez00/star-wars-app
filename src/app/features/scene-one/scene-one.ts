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
    private introScrollLocked = false;
    private introScrollY = 0;
    private introCameraTween?: gsap.core.Tween;
    private introExposureTween?: gsap.core.Tween;
    private introFadeTween?: gsap.core.Tween;
    private readonly scrollLockEventOptions: AddEventListenerOptions = {
        passive: false
    };

    private readonly preventScrollWhileIntro = (event: Event): void => {
        if (!this.introScrollLocked) return;

        event.preventDefault();
    };

    private readonly preventScrollKeysWhileIntro = (event: KeyboardEvent): void => {
        if (!this.introScrollLocked) return;

        const scrollKeys = [
            'ArrowDown',
            'ArrowUp',
            'End',
            'Home',
            'PageDown',
            'PageUp',
            ' '
        ];

        if (!scrollKeys.includes(event.key)) return;

        event.preventDefault();
    };

    // =========================================================================
    // LIFECYCLE
    // =========================================================================
    ngAfterViewInit(): void {
        this.zone.runOutsideAngular(async () => {
            this.lockIntroScroll();

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

                // 4. Lanzar Intro Cinematográfica antes de entregar el control al scroll
                this.playIntro(() => {
                    this.orchestrator.registerSceneOne(
                        this.logo.container,
                        this.engine.camera,
                        this.nebula.scene,
                    );
                    this.orchestrator.refresh();
                });

            } catch (err) {
                this.unlockIntroScroll();
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
    private playIntro(onComplete?: () => void): void {
        if (this._hasPlayedIntro) return;
        this._hasPlayedIntro = true;

        const el = this.hostRef.nativeElement;
        let cameraIntroComplete = false;
        let logoIntroComplete = false;

        const completeIntroStep = (step: 'camera' | 'logo'): void => {
            if (step === 'camera') cameraIntroComplete = true;
            if (step === 'logo') logoIntroComplete = true;

            if (!cameraIntroComplete || !logoIntroComplete) return;

            // Tras el intro, el ScrollOrchestrator maneja el estado vía ScrollTrigger
            this.unlockIntroScroll();
            onComplete?.();
            console.log('Star Wars Scene Ready');
        };

        // Fade in del contenedor UI (Adaptive Agenda style)
        this.introFadeTween = gsap.to(el, { opacity: 1, duration: 1.5 });

        // Secuencia de entrada de cámara (Z=600 a Z=150)
        // Ajustamos exposición para el efecto de "encendido" de la galaxia
        this.engine.renderer.toneMappingExposure = 0.1;
        this.engine.camera.position.z = 600;

        this.introExposureTween = gsap.to(this.engine.renderer, {
            toneMappingExposure: 1.0,
            duration: 3.2,
            ease: 'power2.inOut'
        });

        this.introCameraTween = gsap.to(this.engine.camera.position, {
            z: 150,
            duration: 4.2,
            ease: 'expo.inOut',
            onComplete: () => completeIntroStep('camera')
        });

        // Lanzar la animación interna del logo (glow y escala inicial)
        this.logo.intro(() => completeIntroStep('logo'));
    }

    private lockIntroScroll(): void {
        if (this.introScrollLocked) return;

        this.introScrollLocked = true;
        this.introScrollY = window.scrollY;

        document.documentElement.classList.add('intro-scroll-locked');
        document.body.classList.add('intro-scroll-locked');

        window.addEventListener('wheel', this.preventScrollWhileIntro, this.scrollLockEventOptions);
        window.addEventListener('touchmove', this.preventScrollWhileIntro, this.scrollLockEventOptions);
        window.addEventListener('keydown', this.preventScrollKeysWhileIntro, this.scrollLockEventOptions);
        window.scrollTo(0, this.introScrollY);
    }

    private unlockIntroScroll(): void {
        if (!this.introScrollLocked) return;

        this.introScrollLocked = false;

        document.documentElement.classList.remove('intro-scroll-locked');
        document.body.classList.remove('intro-scroll-locked');

        window.removeEventListener('wheel', this.preventScrollWhileIntro, this.scrollLockEventOptions);
        window.removeEventListener('touchmove', this.preventScrollWhileIntro, this.scrollLockEventOptions);
        window.removeEventListener('keydown', this.preventScrollKeysWhileIntro, this.scrollLockEventOptions);
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================
    ngOnDestroy(): void {
        this.unlockIntroScroll();
        this.introFadeTween?.kill();
        this.introExposureTween?.kill();
        this.introCameraTween?.kill();

        // Limpiamos recursos de Three.js para evitar fugas de memoria en la GPU
        this.nebula?.dispose();
        this.logo?.dispose();
    }
}
