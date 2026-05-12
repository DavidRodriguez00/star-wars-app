import * as THREE from 'three';
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/examples/jsm/postprocessing/OutputPass.js';

export type SpectralType = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

/**
 * DATOS ESPECTRALES REALISTAS
 * Basado en temperaturas de cuerpo negro y pesos de masa inicial (IMF).
 */
const STAR_COLORS: Record<SpectralType, THREE.Color[]> = {
    O: [new THREE.Color(0.55, 0.70, 1.20), new THREE.Color(0.45, 0.60, 1.10)],
    B: [new THREE.Color(0.60, 0.75, 1.10), new THREE.Color(0.50, 0.65, 1.00)],
    A: [new THREE.Color(0.90, 0.92, 1.00), new THREE.Color(0.85, 0.88, 0.98)],
    F: [new THREE.Color(1.00, 0.96, 0.82), new THREE.Color(0.98, 0.93, 0.78)],
    G: [new THREE.Color(1.00, 0.88, 0.55), new THREE.Color(0.98, 0.84, 0.48)],
    K: [new THREE.Color(1.00, 0.62, 0.25), new THREE.Color(0.98, 0.55, 0.20)],
    M: [new THREE.Color(1.00, 0.28, 0.12), new THREE.Color(0.95, 0.22, 0.09)],
};

const NEB_COLORS = {
    halpha:     [[1.0, 0.08, 0.15], [0.85, 0.04, 0.10]] as [number,number,number][],
    oiii:       [[0.05, 0.80, 0.90], [0.04, 0.65, 0.78]] as [number,number,number][],
    reflection: [[0.12, 0.22, 0.95], [0.08, 0.16, 0.80]] as [number,number,number][],
};

const STAR_SHADER = {
    vertex: /* glsl */`
        attribute float aSize;
        attribute vec3  aColor;
        attribute float aPhase;
        attribute float aScintAmp;
        attribute float aLuminosity;
        
        uniform float uTime;
        
        varying vec3  vColor;
        varying float vAlpha;
        varying float vSize;
        varying float vLum;
        varying float vDistance;

        void main() {
            vColor = aColor;
            vLum   = aLuminosity;
            
            // Centelleo de alta frecuencia (atmosférico/óptico)
            float s = aScintAmp * (0.6 * sin(uTime * 13.0 + aPhase) + 0.4 * sin(uTime * 7.5 + aPhase * 2.1));
            vAlpha = clamp(0.85 + s, 0.0, 1.0);
            
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vDistance = -mvPos.z;
            
            // Atenuación de tamaño física con límite de visibilidad
            vSize = aSize * (400.0 / max(vDistance, 1.0));
            gl_PointSize = clamp(vSize, 1.0, 15.0);
            gl_Position  = projectionMatrix * mvPos;
        }
    `,
    fragment: /* glsl */`
        varying vec3  vColor;
        varying float vAlpha;
        varying float vSize;
        varying float vLum;
        varying float vDistance;

        void main() {
            vec2  uv = gl_PointCoord - 0.5;
            float r  = length(uv);
            if (r > 0.5) discard;
            
            // Núcleo Gaussiano
            float core  = exp(-r * r * 40.0);
            float halo  = exp(-r * r * 6.5) * 0.25;
            
            // Picos de difracción (Solo para estrellas brillantes y cercanas)
            float spike = 0.0;
            if (vSize > 3.5 && vLum > 0.6) {
                float angle = atan(uv.y, uv.x);
                // Cruz de difracción de 4 puntos
                float cross = max(exp(-abs(sin(angle))*90.0), exp(-abs(cos(angle))*90.0));
                // Atenuación del pico según distancia y radio
                spike = cross * max(0.0, 0.5 - r) * 0.4 * min(1.0, (vSize-3.5)/6.0);
            }
            
            vec3 finalColor = vColor * (core + halo + spike);
            gl_FragColor = vec4(finalColor, (core + halo) * vAlpha);
        }
    `
};

export class SpaceEngine {
    public readonly scene:    THREE.Scene;
    public readonly camera:   THREE.PerspectiveCamera;
    public readonly renderer: THREE.WebGLRenderer;
    public readonly composer: EffectComposer;
    private clock:   THREE.Timer = new THREE.Timer();
    private disposed = false;

    private starField: THREE.Points | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000005); // Negro profundo espacial

        this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.camera.position.set(0, 400, 600);

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true,
            logarithmicDepthBuffer: true // Vital para evitar Z-fighting en escalas galácticas
        });
        
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        const bloom = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.6, 0.5, 0.15
        );
        this.composer.addPass(bloom);
        this.composer.addPass(new OutputPass());

        this._initScene();
    }

    private _initScene(): void {
        this._buildGalaxy(70000);
    }

    private _buildGalaxy(count: number): void {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const siz = new Float32Array(count);
        const pha = new Float32Array(count);
        const sci = new Float32Array(count);
        const lum = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            
            // Lógica de Brazos Espirales (Logarítmica)
            const radius = Math.pow(Math.random(), 1.6) * 4000;
            const spin = radius * 0.015;
            const armOffset = (i % 3 === 0 ? 0 : Math.PI); // 2 brazos principales
            const angle = Math.random() * Math.PI * 0.5 + spin + armOffset;
            
            // Dispersión Gausiana en los brazos
            const spread = 80 / (radius * 0.01 + 1.0);
            pos[i3]   = Math.cos(angle) * radius + (Math.random() - 0.5) * spread * 2.0;
            pos[i3+1] = (Math.random() - 0.5) * (spread * 8); // Grosor del disco
            pos[i3+2] = Math.sin(angle) * radius + (Math.random() - 0.5) * spread * 2.0;

            const type = this._sampleSpectralType();
            const color = STAR_COLORS[type][Math.floor(Math.random() * 2)];
            col[i3] = color.r; col[i3+1] = color.g; col[i3+2] = color.b;

            // Diferenciación de brillo (Población estelar)
            const isGiant = Math.random() < 0.08;
            siz[i] = isGiant ? 2.5 + Math.random() * 2.0 : 0.4 + Math.random() * 0.6;
            lum[i] = isGiant ? 1.0 : 0.2;
            pha[i] = Math.random() * Math.PI * 2;
            sci[i] = 0.05 + Math.random() * 0.1;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
        geo.setAttribute('aScintAmp', new THREE.BufferAttribute(sci, 1));
        geo.setAttribute('aLuminosity', new THREE.BufferAttribute(lum, 1));

        const mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: STAR_SHADER.vertex,
            fragmentShader: STAR_SHADER.fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.starField = new THREE.Points(geo, mat);
        this.scene.add(this.starField);
    }

    private _sampleSpectralType(): SpectralType {
        const r = Math.random();
        // Distribución real (muchas más estrellas M que O)
        if (r < 0.76) return 'M';
        if (r < 0.88) return 'K';
        if (r < 0.95) return 'G';
        if (r < 0.98) return 'F';
        if (r < 0.992) return 'A';
        if (r < 0.998) return 'B';
        return 'O';
    }

    public update(time: number): void {
        if (this.disposed) return;
        if (this.starField) {
            const mat = this.starField.material as THREE.ShaderMaterial;
            if (mat.uniforms) mat.uniforms['uTime'].value = time;
            // Rotación diferencial galáctica
            this.starField.rotation.y += 0.00008;
        }
    }

    public render(): void {
        if (this.disposed) return;
        this.renderer.clear();
        this.composer.render();
    }

    public setExposure(v: number): void {
        this.renderer.toneMappingExposure = THREE.MathUtils.clamp(v, 0.0, 4.0);
    }

    public onResize(): void {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
    }

    public dispose(): void {
        this.disposed = true;
        this.scene.traverse(obj => {
            if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
                obj.geometry.dispose();
                (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
            }
        });
        this.renderer.dispose();
    }
}