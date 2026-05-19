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
import { StarWarsCrawlManager } from './builders/scene-one.crawl';
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
    private zone = inject(NgZone);
    private hostRef = inject(ElementRef);
    private engine = inject(EngineService);
    private orchestrator = inject(ScrollOrchestratorService);

    private nebula!: NebulaEngine;
    private logo!: SpaceLogoManager;
    private crawlManager?: StarWarsCrawlManager; // 2. Instancia del manager externo

    private _hasPlayedIntro = false;
    private introScrollLocked = false;
    private introScrollY = 0;
    private introCameraTween?: gsap.core.Tween;
    private introExposureTween?: gsap.core.Tween;
    private introFadeTween?: gsap.core.Tween;

    private readonly scrollLockEventOptions: AddEventListenerOptions = { passive: false };

    private readonly preventScrollWhileIntro = (event: Event): void => {
        if (!this.introScrollLocked) return;
        event.preventDefault();
    };

    private readonly preventScrollKeysWhileIntro = (event: KeyboardEvent): void => {
        if (!this.introScrollLocked) return;
        const scrollKeys = ['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '];
        if (!scrollKeys.includes(event.key)) return;
        event.preventDefault();
    };

    ngAfterViewInit(): void {
        this.zone.runOutsideAngular(async () => {
            this.lockIntroScroll();

            this.nebula = new NebulaEngine(this.engine.scene);
            this.logo = new SpaceLogoManager(this.engine.scene);

            try {
                await this.logo.load('assets/models/starwars.glb');
                this.logo.container.position.set(0, 0, 140);

                this.engine.addToUpdateLoop((time) => {
                    this.nebula.update(time);
                    this.logo.update(time, this.engine.mouse);

                    animateSpace(
                        this.engine.camera,
                        null as any,
                        this.logo.container,
                        time,
                        this.engine.mouse
                    );
                });

                // 1. Lanzamos el intro cinemático inicial
                this.playIntro();

            } catch (err) {
                this.unlockIntroScroll();
                console.error('Error inicializando SceneOne:', err);
            }
        });
    }

    private playIntro(): void {
        if (this._hasPlayedIntro) return;
        this._hasPlayedIntro = true;

        const el = this.hostRef.nativeElement;
        let cameraIntroComplete = false;
        let logoIntroComplete = false;

        const completeIntroStep = (step: 'camera' | 'logo'): void => {
            if (step === 'camera') cameraIntroComplete = true;
            if (step === 'logo') logoIntroComplete = true;

            if (!cameraIntroComplete || !logoIntroComplete) return;

            // Desbloqueamos interacción
            this.unlockIntroScroll();

            // Inicializamos el orquestador de scroll CON el callback para el crawl
            this.orchestrator.registerSceneOne(
                this.logo.container,
                this.engine.camera,
                this.nebula.scene
            );
            this.createScrollCrawl();
            this.orchestrator.refresh();
        };

        // Tweens iniciales de la intro cinemática
        this.introFadeTween = gsap.to(el, { opacity: 1, duration: 1.5 });
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

        this.logo.intro(() => completeIntroStep('logo'));
    }

    private createScrollCrawl(): void {
        if (this.crawlManager) return;

        // El crawl queda preparado e invisible; ScrollTrigger lo muestra sólo con scroll.
        this.crawlManager = new StarWarsCrawlManager(this.engine);
        this.crawlManager.start();
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

    ngOnDestroy(): void {
        this.unlockIntroScroll();
        this.introFadeTween?.kill();
        this.introExposureTween?.kill();
        this.introCameraTween?.kill();

        // Limpieza del archivo externo
        if (this.crawlManager) {
            this.crawlManager.dispose();
        }

        this.nebula?.dispose();
        this.logo?.dispose();
    }
}
