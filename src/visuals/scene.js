// ─── Three.js scene setup ─────────────────────────────────────────────────────
// THREE is loaded as a global from the CDN <script> tag in index.html.

export const scene    = new THREE.Scene();
export const camera   = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
export const renderer = new THREE.WebGLRenderer({ antialias: true });
export const clock    = new THREE.Clock();

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0a0a0f);
document.getElementById('three-container').appendChild(renderer.domElement);

scene.fog = new THREE.FogExp2(0x0a0a0f, 0.022);

camera.position.set(0, 1.5, 7);
camera.lookAt(0, 0, 0);

// ─── Resize — debounced, handles orientation change ───────────────────────────
let resizeTimer;
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onResize, 150);
});
// orientationchange fires before the browser reports new dimensions
window.addEventListener('orientationchange', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onResize, 300);
});
