import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EngineService } from '../../../core/engine/engine';

gsap.registerPlugin(ScrollTrigger);

export class StarWarsCrawlManager {
    public container: THREE.Group;
    private engine: EngineService;

    // Almacenamos las referencias para poder destruirlas correctamente en el dispose
    private geometry?: THREE.PlaneGeometry;
    private texture?: THREE.CanvasTexture;
    private planeMaterial?: THREE.MeshBasicMaterial;

    private timeline?: gsap.core.Timeline;

    // Constantes de diseño para la perspectiva de la cámara
    private readonly START_Z = -180;
    private readonly FADE_END_Z = -700;

    constructor(engineService: EngineService) {
        this.engine = engineService;
        this.container = new THREE.Group();
    }

    public start(): void {
        // 1. Configuración inicial del contenedor
        this.container.rotation.x = -Math.PI / 4.0;
        this.container.position.set(0, -90, this.START_Z);
        this.container.visible = false;

        // 2. Anclaje seguro a la cámara
        if (!this.engine.camera.parent) {
            this.engine.scene.add(this.engine.camera);
        }
        this.engine.camera.add(this.container);

        // 3. Generación de Textura optimizada
        // Dentro de tu método start():

        const canvas = this.createCrawlCanvas();
        this.texture = new THREE.CanvasTexture(canvas);

        // Mipmapping de alta calidad: Crucial para pantallas de alta resolución cuando el plano se aleja en el eje Z
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        // Anisotropía: El arma secreta para textos en perspectiva. 
        // Evita que el texto se vuelva borroso en ángulos oblicuos (como la inclinación de Star Wars)
        const maxAnisotropy = this.engine.renderer.capabilities.getMaxAnisotropy();
        this.texture.anisotropy = Math.min(maxAnisotropy, 8); // 8 es un excelente balance rendimiento/calidad

        this.texture.colorSpace = THREE.SRGBColorSpace;

        // 4. Construcción del Mesh
        this.geometry = new THREE.PlaneGeometry(160, 320);
        this.planeMaterial = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: false
        });
        this.planeMaterial.opacity = 0;

        const crawlMesh = new THREE.Mesh(this.geometry, this.planeMaterial);
        crawlMesh.renderOrder = 100;
        this.container.add(crawlMesh);

        // 5. Inicializar Timeline con ScrollTrigger integrado
        this.createScrollTimeline();
    }

    private createScrollTimeline(): void {
        const material = this.planeMaterial;
        if (!material) return;

        // Creamos la timeline vinculada al scroll
        this.timeline = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
                trigger: '#trigger-scene-one',
                start: '45% top',
                end: 'bottom top',
                scrub: 1.2,
                markers: false,
                invalidateOnRefresh: true
            }
        });

        // Controlamos la visibilidad mediante estados en la timeline para evitar glitches de scroll rápido
        this.timeline.set(this.container, { visible: true }, 0);

        // Animación: Despegue de opacidad inicial
        this.timeline.to(material, { opacity: 1, duration: 0.18 }, 0);

        // Animación: Movimiento en el eje Y y alejamiento en Z (Efecto Star Wars)
        this.timeline.to(this.container.position, {
            y: 180,
            z: this.FADE_END_Z,
            duration: 1
        }, 0);

        // Animación: Desvanecimiento final antes de desaparecer
        this.timeline.to(material, { opacity: 0, duration: 0.25 }, 0.75);

        // Ocultamos el contenedor al terminar la secuencia
        this.timeline.set(this.container, { visible: false }, 1);
    }

    public dispose(): void {
        // 1. Matar animaciones y ScrollTriggers de raíz
        if (this.timeline) {
            this.timeline.scrollTrigger?.kill();
            this.timeline.kill();
        }

        // 2. Limpieza estricta de WebGL (VRAM)
        if (this.texture) this.texture.dispose();
        if (this.geometry) this.geometry.dispose();
        if (this.planeMaterial) this.planeMaterial.dispose();

        // 3. Desvincular de la escena y la cámara
        if (this.container) {
            this.engine.camera.remove(this.container);
            this.engine.disposeObject(this.container);
        }
    }

    private createCrawlCanvas(): HTMLCanvasElement {
        const canvas = document.createElement('canvas');

        // 1. Detectar el pixel ratio de la pantalla actual (limmitado a un máximo razonable como 2.5)
        // Pantallas 4K/Retina suelen tener un ratio de 2 o más.
        const pixelRatio = Math.min(window.devicePixelRatio, 2.5);

        // Base de diseño estática (sobre la que calculamos las fuentes originales)
        const baseWidth = 1024;
        const baseHeight = 2048;

        // Escalamos el tamaño real del Canvas por el ratio de píxeles
        canvas.width = baseWidth * pixelRatio;
        canvas.height = baseHeight * pixelRatio;

        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        // 2. Escalamos todo el contexto de dibujo para mantener intactas tus coordenadas originales
        ctx.scale(pixelRatio, pixelRatio);

        // --- A partir de aquí tu código de dibujo permanece idéntico ---
        ctx.clearRect(0, 0, baseWidth, baseHeight);
        ctx.fillStyle = '#FFE81F';
        ctx.textAlign = 'center';

        ctx.font = 'bold 46px "Franklin Gothic Medium", "Arial Black", sans-serif';
        ctx.fillText("EPISODIO IV", baseWidth / 2, 140);

        ctx.font = 'bold 58px "Franklin Gothic Medium", "Arial Black", sans-serif';
        ctx.fillText("UNA NUEVA ESPERANZA", baseWidth / 2, 240);

        ctx.font = 'bold 38px "Franklin Gothic Medium", Arial, sans-serif';
        const lines = [
            "Es un período de guerra civil. Naves",
            "espaciales rebeldes, atacando desde",
            "una base oculta, han ganado su primera",
            "victoria contra el malvado",
            "Imperio Galáctico.",
            "",
            "Durante la batalla, los espías rebeldes",
            "lograron robar los planos secretos del",
            "arma definitiva del Imperio, la ESTRELLA",
            "DE LA MUERTE, una estación espacial",
            "blindada con suficiente potencia para",
            "destruir un planeta entero.",
            "",
            "Perseguida por los siniestros agentes",
            "del Imperio, la Princesa Leia vuela hacia",
            "su hogar a bordo de su nave estelar,",
            "custodia de los planos robados que",
            "pueden salvar a su pueblo y devolver",
            "la libertad a la galaxia...."
        ];

        let yOffset = 380;
        lines.forEach(line => {
            ctx.fillText(line, baseWidth / 2, yOffset);
            yOffset += 56;
        });

        return canvas;
    }
}