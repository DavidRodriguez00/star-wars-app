import * as THREE from 'three';

const CONFIG = {
    CAMERA_PARALLAX_X: 2.5,
    CAMERA_PARALLAX_Y: 2.0,
    CAMERA_LERP:       0.035,
    BREATHE_AMP_X:  0.6,
    BREATHE_AMP_Y:  0.4,
    BREATHE_FREQ_X: 0.18,
    BREATHE_FREQ_Y: 0.11,
    FLOAT_AMP:      0.8,
    FLOAT_FREQ:     0.38,
};

/**
 * Controla el parallax de cámara al mouse y micro-movimientos de respiración.
 */
export const animateSpace = (
    camera:      THREE.PerspectiveCamera,
    stars:       THREE.Points,
    logoGroup:   THREE.Group,
    time:        number,
    mouse:       THREE.Vector2 | { x: number; y: number } = { x: 0, y: 0 }
): void => {

    // 1. Capa de estrellas (rotación sutil)
    if (stars) {
        stars.rotation.y = time * 0.004;
        stars.rotation.z = Math.sin(time * 0.07) * 0.012;
    }

    // 2. Cámara: Parallax + Respiración
    const breathX = Math.sin(time * CONFIG.BREATHE_FREQ_X) * CONFIG.BREATHE_AMP_X;
    const breathY = Math.cos(time * CONFIG.BREATHE_FREQ_Y) * CONFIG.BREATHE_AMP_Y;

    const targetX = mouse.x * CONFIG.CAMERA_PARALLAX_X + breathX;
    const targetY = mouse.y * CONFIG.CAMERA_PARALLAX_Y + breathY;

    // Suavizado de la posición de la cámara (Lerp)
    camera.position.x += (targetX - camera.position.x) * CONFIG.CAMERA_LERP;
    camera.position.y += (targetY - camera.position.y) * CONFIG.CAMERA_LERP;
    
    // Siempre mirar al centro ligeramente inclinado
    camera.lookAt(0, 0, 0);
};