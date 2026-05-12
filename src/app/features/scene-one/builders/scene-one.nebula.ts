import * as THREE from 'three';
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OrbitControls }   from 'three/examples/jsm/controls/OrbitControls.js';

export type SpectralType = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

const STAR_DATA: Record<SpectralType, { color: THREE.Color, weight: number }> = {
    O: { color: new THREE.Color(0.6, 0.7, 2.5), weight: 0.0003 }, 
    B: { color: new THREE.Color(0.7, 0.8, 2.0), weight: 0.0013 },
    A: { color: new THREE.Color(1.0, 1.0, 1.5), weight: 0.006 },
    F: { color: new THREE.Color(1.2, 1.2, 1.0), weight: 0.03 },
    G: { color: new THREE.Color(1.4, 1.3, 1.0), weight: 0.076 },
    K: { color: new THREE.Color(1.5, 0.9, 0.5), weight: 0.121 },
    M: { color: new THREE.Color(1.5, 0.4, 0.2), weight: 0.7645 },
};

const SHADERS = {
    stars: {
        vertex: /* glsl */`
            attribute float aSize;
            attribute vec3  aColor;
            attribute float aPhase;
            attribute float aLuminosity;
            
            uniform float uTime;
            uniform float uPixelRatio;
            uniform float uSpeed;
            
            varying vec3  vColor;
            varying float vAlpha;

            void main() {
                vColor = aColor;
                float blink = 0.8 + 0.2 * sin(uTime * (0.5 + aPhase * 0.1) + aPhase);
                vAlpha = aLuminosity * blink;
                
                vec3 pos = position;
                float dist = length(pos.xz);
                // Las estrellas del bulbo rotan más rápido que las externas (ley de Kepler simplificada)
                float angularVelocity = 180.0 / (dist + 60.0); 
                float angle = atan(pos.z, pos.x) + (uTime * uSpeed * angularVelocity);
                
                pos.x = cos(angle) * dist;
                pos.z = sin(angle) * dist;
                
                vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = aSize * (500.0 / -mvPos.z) * uPixelRatio;
                gl_Position  = projectionMatrix * mvPos;
            }
        `,
        fragment: /* glsl */`
            varying vec3  vColor;
            varying float vAlpha;

            void main() {
                float r = length(gl_PointCoord - 0.5);
                if (r > 0.5) discard;
                float strength = pow(1.0 - r * 2.0, 4.0);
                vec3 coreColor = mix(vColor, vec3(1.0), strength * 0.5);
                gl_FragColor = vec4(coreColor, strength * vAlpha);
            }
        `
    },
    dust: {
        vertex: /* glsl */`
            attribute float aSize;
            uniform float uTime;
            uniform float uSpeed;
            uniform float uPixelRatio;
            varying float vAlpha;

            void main() {
                vec3 pos = position;
                float dist = length(pos.xz);
                float angularVelocity = 120.0 / (dist + 50.0);
                float angle = atan(pos.z, pos.x) + (uTime * uSpeed * angularVelocity);
                pos.x = cos(angle) * dist;
                pos.z = sin(angle) * dist;
                vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
                vAlpha = 0.04 + 0.02 * sin(uTime * 0.2 + dist * 0.01);
                gl_PointSize = aSize * (700.0 / -mvPos.z) * uPixelRatio;
                gl_Position  = projectionMatrix * mvPos;
            }
        `,
        fragment: /* glsl */`
            varying float vAlpha;
            void main() {
                float r = length(gl_PointCoord - 0.5);
                if (r > 0.5) discard;
                float strength = pow(1.0 - r * 2.0, 2.5);
                gl_FragColor = vec4(vec3(0.04, 0.08, 0.2), strength * vAlpha);
            }
        `
    }
};

export class NebulaEngine {
    public scene:    THREE.Scene;
    // public camera:   THREE.PerspectiveCamera;
    public renderer!: THREE.WebGLRenderer;
    private composer!: EffectComposer;
    private controls!: OrbitControls;
    private clock:    THREE.Timer = new THREE.Timer();
    
    private starField: THREE.Points | null = null;
    private dustField: THREE.Points | null = null;

    private config = {
        totalStars: 40000,
        dustCount: 25000,
        galaxyRadius: 5000,
        bulboRadius: 200,   // El tamaño del núcleo 3D
        arms: 4,
        armSpin: 5.0,        // Cuánto girar los brazos (más alto = más espiral)
        timeScale: 0.008
    };

    constructor(arg1: HTMLCanvasElement | THREE.Scene) {
        if (arg1 instanceof THREE.Scene) {
            this.scene = arg1;
            // this.camera = arg2;
        } else {
            const canvas = arg1 as HTMLCanvasElement;
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x000003);
            // this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 50000);
            // this.camera.position.set(0, 800, 1800);

            this.renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: false,
                powerPreference: 'high-performance',
                logarithmicDepthBuffer: true
            });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.setSize(window.innerWidth, window.innerHeight);

            // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;

            this.composer = new EffectComposer(this.renderer);
            // this.composer.addPass(new RenderPass(this.scene, this.camera));
            
            const bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight), 
                0.85, // Un poco más de fuerza para el resplandor del bulbo
                0.5,  // Radio medio
                0.85  // Umbral
            );
            this.composer.addPass(bloom);
            this.composer.addPass(new OutputPass());
        }

        this._buildGalaxy();
    }

    private _buildGalaxy(): void {
        const count = this.config.totalStars;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);
        const luminosities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            
            // Decidimos si es estrella de Brazo o de Bulbo (30% bulbo)
            const isBulge = Math.random() < 0.35;
            let radius, angle, x, y, z;

            if (isBulge) {
                // DISTRIBUCIÓN ESFÉRICA PARA EL NÚCLEO (SpaceEngine Style)
                radius = Math.pow(Math.random(), 1.2) * this.config.bulboRadius;
                const phi = Math.acos(2.0 * Math.random() - 1.0);
                const theta = 2.0 * Math.PI * Math.random();
                
                x = radius * Math.sin(phi) * Math.cos(theta);
                y = radius * Math.cos(phi) * 0.8; // Ligeramente achatado
                z = radius * Math.sin(phi) * Math.sin(theta);
            } else {
                // DISTRIBUCIÓN DE DISCO Y BRAZOS
                radius = this.config.bulboRadius + Math.pow(Math.random(), 1.5) * (this.config.galaxyRadius - this.config.bulboRadius);
                const armIndex = i % this.config.arms;
                angle = (armIndex * ((Math.PI * 2) / this.config.arms)) + (radius / this.config.galaxyRadius) * this.config.armSpin;
                
                const spread = Math.pow(Math.random(), 2.0) * 300 * (Math.random() < 0.5 ? 1 : -1);
                x = Math.cos(angle) * radius + (Math.random() - 0.5) * spread;
                y = (Math.random() - 0.5) * (150 * Math.exp(-radius / 500)); 
                z = Math.sin(angle) * radius + (Math.random() - 0.5) * spread;
            }

            positions[i3] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;

            // COLOR: El bulbo es más viejo/amarillo, los brazos más azules
            let type: SpectralType;
            if (isBulge) {
                // Mayor probabilidad de estrellas tipo K y M en el centro
                const rBulge = Math.random();
                type = rBulge < 0.7 ? (Math.random() < 0.5 ? 'K' : 'M') : 'G';
            } else {
                type = this._sampleSpectralType();
            }

            const data = STAR_DATA[type];
            colors[i3] = data.color.r; 
            colors[i3+1] = data.color.g; 
            colors[i3+2] = data.color.b;

            const isHot = type === 'O' || type === 'B';
            sizes[i] = isHot ? 2.5 + Math.random() * 3.5 : 0.5 + Math.random() * 1.2;
            luminosities[i] = isHot ? 1.3 : 0.7; 
            phases[i] = Math.random() * 100;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
        geo.setAttribute('aLuminosity', new THREE.BufferAttribute(luminosities, 1));

        this.starField = new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: { 
                uTime: { value: 0 },
                uSpeed: { value: this.config.timeScale },
                uPixelRatio: { value: window.devicePixelRatio }
            },
            vertexShader: SHADERS.stars.vertex,
            fragmentShader: SHADERS.stars.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }));
        this.scene.add(this.starField);
        this._buildDust(this.config.dustCount);
    }

    private _buildDust(count: number): void {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const radius = 100 + Math.pow(Math.random(), 1.2) * (this.config.galaxyRadius * 1.2); 
            const armIndex = i % this.config.arms;
            const angle = (armIndex * ((Math.PI * 2) / this.config.arms)) + (radius / this.config.galaxyRadius) * this.config.armSpin - 0.25;
            
            const spread = Math.pow(Math.random(), 2) * 500;
            positions[i3]     = Math.cos(angle) * radius + (Math.random() - 0.5) * spread;
            positions[i3 + 1] = (Math.random() - 0.5) * 80;
            positions[i3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * spread;
            sizes[i] = 15.0 + Math.random() * 40.0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

        this.dustField = new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: { 
                uTime: { value: 0 }, uSpeed: { value: this.config.timeScale }, uPixelRatio: { value: window.devicePixelRatio }
            },
            vertexShader: SHADERS.dust.vertex,
            fragmentShader: SHADERS.dust.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }));
        this.scene.add(this.dustField);
    }

    private _sampleSpectralType(): SpectralType {
        const r = Math.random();
        let cumulative = 0;
        for (const [type, data] of Object.entries(STAR_DATA)) {
            cumulative += data.weight;
            if (r < cumulative) return type as SpectralType;
        }
        return 'M';
    }

    public update(externalTime?: number): void {
        const elapsed = externalTime !== undefined ? externalTime : this.clock.getElapsed();
        if (this.starField) (this.starField.material as THREE.ShaderMaterial).uniforms['uTime'].value = elapsed;
        if (this.dustField) (this.dustField.material as THREE.ShaderMaterial).uniforms['uTime'].value = elapsed;
        if (this.composer) {
            this.controls?.update();
            this.composer.render();
        }
    }

    public onResize(): void {
        if (!this.renderer) return;
        const w = window.innerWidth, h = window.innerHeight;
        // this.camera.aspect = w / h;
        // this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer?.setSize(w, h);
    }

    public dispose(): void {
        this.renderer?.dispose();
        this.composer?.dispose();
        this.controls?.dispose();
    }
}