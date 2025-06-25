import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Input } from '@angular/core';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-part-viewer',
  templateUrl: './part-viewer.html', // Confirmed: no .component suffix for HTML
  styleUrls: ['./part-viewer.css']   // Confirmed: no .component suffix for CSS
})
export class PartViewerComponent implements OnInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: true })
  rendererCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() stlPath: string = 'assets/models/test_part.stl'; // Default path to your test STL

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera | THREE.OrthographicCamera; // Can be either
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationId!: number; // To store the animation frame ID for cleanup
  private loadedMesh: THREE.Mesh | null = null; // To keep track of the loaded mesh
  private isWireframe: boolean = false; // Track wireframe state
  private boundingBoxHelper: THREE.BoxHelper | null = null; // Bounding box helper
  private cameraType: 'perspective' | 'orthographic' = 'perspective'; // Default camera type
  public modelColor: string = '#AAAAAA'; // NEW: Default model color in hex

  constructor() { }

  ngOnInit(): void {
    this.initThreeJs();
    this.loadModel();
    this.animate(); // Start the animation loop
  }

  ngOnDestroy(): void {
    // Clean up Three.js resources to prevent memory leaks
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
      (this.renderer.domElement as any) = null; // Clear canvas reference
    }
    if (this.scene) {
      this.scene.clear();
    }
    if (this.controls) {
      this.controls.dispose();
    }
    // Remove resize listener to prevent errors after component is destroyed
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }

  private initThreeJs(): void {
    const canvas = this.rendererCanvas.nativeElement;
    // const aspectRatio = canvas.clientWidth / canvas.clientHeight; // Aspect ratio is now handled in setCameraType and onWindowResize

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0); // Light gray background

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true // For smoother edges
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio); // Handle high-DPI screens

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Soft white light
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 0); // From top
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(0, -1, 0); // From bottom
    this.scene.add(directionalLight2);

    // Initial camera setup
    this.setCameraType(this.cameraType); // Set initial camera based on type

    // Orbit Controls (for rotation, pan, zoom)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // For smoother motion
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false; // Prevents pan from changing z-depth
    this.controls.minDistance = 1;
    this.controls.maxDistance = 50;

    // Handle window resizing
    window.addEventListener('resize', this.onWindowResize.bind(this), false);
  }

  private loadModel(): void {
    const loader = new STLLoader();

    console.log('Attempting to load STL from path:', this.stlPath);

    // Clear previous model if any
    if (this.loadedMesh) {
      this.scene.remove(this.loadedMesh);
      this.loadedMesh.geometry.dispose();
      // Dispose of material(s) if not shared
      if (Array.isArray(this.loadedMesh.material)) {
        this.loadedMesh.material.forEach(m => m.dispose());
      } else {
        this.loadedMesh.material.dispose();
      }
      this.loadedMesh = null;
    }
    // Remove previous bounding box helper if it exists
    if (this.boundingBoxHelper) {
      this.scene.remove(this.boundingBoxHelper);
      this.boundingBoxHelper.geometry.dispose();
      (this.boundingBoxHelper.material as THREE.Material).dispose(); // Cast to Material
      this.boundingBoxHelper = null;
    }

    loader.load(
      this.stlPath,
      (geometry: any) => { // Changed from THREE.BufferGeometry
        console.log('STL loaded successfully! Geometry:', geometry);

        // Center the geometry and adjust scale if needed
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox!;
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z); // Center model's origin

        // Use the current modelColor for the material
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(this.modelColor), // Use the component's modelColor
          specular: 0x111111,
          shininess: 30,
          wireframe: this.isWireframe // Apply current wireframe state on load
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        this.loadedMesh = mesh; // Store reference to the loaded mesh

        console.log('Mesh added to scene. Scene objects:', this.scene.children.length);

        // Create bounding box helper (initially hidden)
        this.boundingBoxHelper = new THREE.BoxHelper(this.loadedMesh, 0x00ff00); // Green color
        this.boundingBoxHelper.visible = false; // Initially hidden
        this.scene.add(this.boundingBoxHelper); // Add to scene but keep invisible

        // Call setView to position camera after model is loaded and centered
        this.setView('front'); // Default to front view after loading
      },
      // FIX: Using 'any' for simplicity
      (xhr: any) => { // Changed from ProgressEvent
        // Optional: Progress callback
        // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      // FIX: Using 'any' for simplicity
      (error: any) => { // Changed from ErrorEvent
        // Error callback
        console.error('Error loading STL model:', error);
      }
    );
  }

  // NEW METHOD: onColorChange
  public onColorChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.modelColor = inputElement.value; // Update component's color property
    console.log('New color selected:', this.modelColor);

    if (this.loadedMesh && this.loadedMesh.material) {
      const newColor = new THREE.Color(this.modelColor);

      if (Array.isArray(this.loadedMesh.material)) {
        // If there are multiple materials, apply to all Phong materials
        this.loadedMesh.material.forEach((m: THREE.Material) => {
          if (m instanceof THREE.MeshPhongMaterial || m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshStandardMaterial) {
            m.color.set(newColor);
          }
        });
      } else {
        // If single material, apply if it's a color-based material
        if (this.loadedMesh.material instanceof THREE.MeshPhongMaterial || this.loadedMesh.material instanceof THREE.MeshLambertMaterial || this.loadedMesh.material instanceof THREE.MeshStandardMaterial) {
          this.loadedMesh.material.color.set(newColor);
        }
      }
    }
  }

  // EXISTING METHOD: setView
  public setView(direction: 'front' | 'top' | 'side' | 'reset'): void {
    if (!this.loadedMesh) {
      console.warn('No model loaded to set view for.');
      return;
    }

    // Get the bounding box of the loaded model for correct camera positioning
    const bbox = new THREE.Box3().setFromObject(this.loadedMesh);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Calculate an appropriate distance from the model based on its size
    const fov = (this.camera instanceof THREE.PerspectiveCamera) ? this.camera.fov * (Math.PI / 180) : Math.PI / 4; // Use a default FOV for orthographic if needed
    const distance = maxDim / 2 / Math.tan(fov / 2) * 1.5; // 1.5 multiplier to give some padding

    let cameraPosition = new THREE.Vector3();

    switch (direction) {
      case 'front':
        cameraPosition.set(center.x, center.y, center.z + distance);
        break;
      case 'top':
        cameraPosition.set(center.x, center.y + distance, center.z);
        break;
      case 'side': // Let's say right side view
        cameraPosition.set(center.x + distance, center.y, center.z);
        break;
      case 'reset': // This can be used to reset to a default isometric view
      default:
        cameraPosition.set(center.x + distance * 0.7, center.y + distance * 0.7, center.z + distance * 0.7);
        break;
    }

    // Set camera position and update controls target
    this.camera.position.copy(cameraPosition);
    this.controls.target.copy(center); // Make camera look at the center of the model
    this.controls.update(); // Update controls to reflect new camera position and target
  }

  // EXISTING METHOD: toggleWireframe
  public toggleWireframe(): void {
    if (this.loadedMesh && this.loadedMesh.material) {
      this.isWireframe = !this.isWireframe;
      // Ensure material is array or single material to access wireframe property
      if (Array.isArray(this.loadedMesh.material)) {
          this.loadedMesh.material.forEach((m: THREE.Material) => {
              if ('wireframe' in m) (m as THREE.MeshPhongMaterial).wireframe = this.isWireframe;
          });
      } else {
          if ('wireframe' in this.loadedMesh.material) (this.loadedMesh.material as THREE.MeshPhongMaterial).wireframe = this.isWireframe;
      }
      console.log('Wireframe toggled:', this.isWireframe);
    }
  }

  // EXISTING METHOD: toggleBoundingBox
  public toggleBoundingBox(): void {
    if (this.boundingBoxHelper) {
      this.boundingBoxHelper.visible = !this.boundingBoxHelper.visible;
      console.log('Bounding Box toggled:', this.boundingBoxHelper.visible);
    } else {
      console.warn('No bounding box helper available.');
    }
  }

  // EXISTING METHOD: setCameraType
  public setCameraType(type: 'perspective' | 'orthographic'): void {
    if (this.cameraType === type && this.camera) {
      // No change needed or camera already set
      return;
    }

    const canvas = this.rendererCanvas.nativeElement;
    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    const currentPosition = this.camera ? this.camera.position.clone() : new THREE.Vector3(5,5,5); // Keep current pos or default
    const currentTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0,0,0); // Keep current target or default

    // Remove old camera from scene if it exists
    if (this.camera) {
      this.scene.remove(this.camera);
    }

    if (type === 'perspective') {
      this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    } else { // Orthographic
      // Adjust size based on aspect ratio for consistent view
      const size = this.loadedMesh ? new THREE.Box3().setFromObject(this.loadedMesh).getSize(new THREE.Vector3()) : new THREE.Vector3(10,10,10);
      const maxDim = Math.max(size.x, size.y, size.z);
      const orthoSize = maxDim * 1.2; // 1.2 multiplier to give some padding

      this.camera = new THREE.OrthographicCamera(
        -orthoSize * aspectRatio / 2,
        orthoSize * aspectRatio / 2,
        orthoSize / 2,
        -orthoSize / 2,
        0.1,
        1000
      );
    }

    this.camera.position.copy(currentPosition);
    this.camera.lookAt(currentTarget); // Ensure it looks at the target

    // Add new camera to scene
    this.scene.add(this.camera);
    this.cameraType = type; // Update camera type state

    // Update OrbitControls if they exist to use the new camera
    if (this.controls) {
      this.controls.object = this.camera;
      this.controls.target.copy(currentTarget);
      this.controls.update();
    }

    console.log('Camera type changed to:', type);
    // Recalculate view if model is loaded and camera type changed
    if (this.loadedMesh) {
      this.setView('reset'); // Re-position camera correctly after type change
    }
    this.onWindowResize(); // Adjust new camera to current canvas size
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update(); // Only required if controls.enableDamping or controls.autoRotate are set to true
    this.renderer.render(this.scene, this.camera); // Render the scene
  }

  private onWindowResize(): void {
    const canvas = this.rendererCanvas.nativeElement;
    // Check camera type for resize logic
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      // Recalculate orthographic camera bounds based on new aspect ratio
      const size = this.loadedMesh ? new THREE.Box3().setFromObject(this.loadedMesh).getSize(new THREE.Vector3()) : new THREE.Vector3(10,10,10);
      const maxDim = Math.max(size.x, size.y, size.z);
      const orthoSize = maxDim * 1.2;

      this.camera.left = -orthoSize * (canvas.clientWidth / canvas.clientHeight) / 2;
      this.camera.right = orthoSize * (canvas.clientWidth / canvas.clientHeight) / 2;
      this.camera.top = orthoSize / 2;
      this.camera.bottom = -orthoSize / 2;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }
}