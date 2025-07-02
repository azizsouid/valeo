import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Input } from '@angular/core';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-part-viewer',
  templateUrl: './part-viewer.html',
  imports: [CommonModule],
  styleUrls: ['./part-viewer.css']
})
export class PartViewerComponent implements OnInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: true })
  rendererCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() stlPath: string = 'assets/models/test_part.stl';

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationId!: number;
  private loadedMesh: THREE.Mesh | null = null;
  private isWireframe: boolean = false;
  private boundingBoxHelper: THREE.BoxHelper | null = null;
  public cameraType: 'perspective' | 'orthographic' = 'perspective';
  public modelColor: string = '#AAAAAA';

  // Dimension properties
  public dimensions: { width: number; height: number; depth: number } = { width: 0, height: 0, depth: 0 };
  public showDimensions: boolean = false;
  public dimensionUnit: string = 'mm';
  private dimensionLabels: THREE.Sprite[] = [];
  private dimensionLines: THREE.Line[] = [];

  // NEW: Demolding direction properties
  public demoldingDirection: 'X' | 'Y' | 'Z' = 'Z';
  public showDemoldingDirection: boolean = true;
  private demoldingArrow: THREE.Group | null = null;
  private axisHelper: THREE.AxesHelper | null = null;

  constructor() { }

  ngOnInit(): void {
    this.initThreeJs();
    this.loadModel();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
      (this.renderer.domElement as any) = null;
    }
    if (this.scene) {
      this.scene.clear();
    }
    if (this.controls) {
      this.controls.dispose();
    }
    this.clearDimensionVisuals();
    this.clearDemoldingVisuals();
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }

  private initThreeJs(): void {
    const canvas = this.rendererCanvas.nativeElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 0);
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(0, -1, 0);
    this.scene.add(directionalLight2);

    this.setCameraType(this.cameraType);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 50;

    window.addEventListener('resize', this.onWindowResize.bind(this), false);
  }

  private loadModel(): void {
    const loader = new STLLoader();

    console.log('Attempting to load STL from path:', this.stlPath);

    if (this.loadedMesh) {
      this.scene.remove(this.loadedMesh);
      this.loadedMesh.geometry.dispose();
      if (Array.isArray(this.loadedMesh.material)) {
        this.loadedMesh.material.forEach(m => m.dispose());
      } else {
        this.loadedMesh.material.dispose();
      }
      this.loadedMesh = null;
    }

    if (this.boundingBoxHelper) {
      this.scene.remove(this.boundingBoxHelper);
      this.boundingBoxHelper.geometry.dispose();
      (this.boundingBoxHelper.material as THREE.Material).dispose();
      this.boundingBoxHelper = null;
    }

    // Clear previous visuals
    this.clearDimensionVisuals();
    this.clearDemoldingVisuals();

    loader.load(
      this.stlPath,
      (geometry: any) => {
        console.log('STL loaded successfully! Geometry:', geometry);

        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox!;
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(this.modelColor),
          specular: 0x111111,
          shininess: 30,
          wireframe: this.isWireframe
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        this.loadedMesh = mesh;

        console.log('Mesh added to scene. Scene objects:', this.scene.children.length);

        this.boundingBoxHelper = new THREE.BoxHelper(this.loadedMesh, 0x00ff00);
        this.boundingBoxHelper.visible = false;
        this.scene.add(this.boundingBoxHelper);

        // Calculate and store dimensions
        this.calculateDimensions();
        
        // Create visuals if they should be shown
        if (this.showDimensions) {
          this.createDimensionVisuals();
        }

        // NEW: Create demolding direction visuals
        if (this.showDemoldingDirection) {
          this.createDemoldingVisuals();
        }

        this.setView('front');
      },
      (xhr: any) => {
        // Progress callback
      },
      (error: any) => {
        console.error('Error loading STL model:', error);
      }
    );
  }

  // NEW: Create demolding direction visual indicators
  private createDemoldingVisuals(): void {
    if (!this.loadedMesh) return;

    this.clearDemoldingVisuals();

    const bbox = new THREE.Box3().setFromObject(this.loadedMesh);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    // Create axis helper
    this.axisHelper = new THREE.AxesHelper(Math.max(size.x, size.y, size.z) * 0.7);
    this.axisHelper.position.copy(center);
    this.scene.add(this.axisHelper);

    // Create demolding arrow
    this.demoldingArrow = this.createDemoldingArrow(size, center);
    this.scene.add(this.demoldingArrow);

    console.log('Demolding visuals created for direction:', this.demoldingDirection);
  }

  // NEW: Create the actual demolding arrow
  private createDemoldingArrow(size: THREE.Vector3, center: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    
    // Arrow dimensions based on model size
    const maxDim = Math.max(size.x, size.y, size.z);
    const arrowLength = maxDim * 1.2;
    const arrowHeadLength = arrowLength * 0.2;
    const shaftRadius = maxDim * 0.02;
    const headRadius = shaftRadius * 3;

    // Arrow colors for each direction
    const colors = {
      'X': 0xff0000, // Red
      'Y': 0x00ff00, // Green  
      'Z': 0x0000ff  // Blue
    };

    // Create arrow shaft (cylinder)
    const shaftGeometry = new THREE.CylinderGeometry(shaftRadius, shaftRadius, arrowLength - arrowHeadLength);
    const shaftMaterial = new THREE.MeshPhongMaterial({ 
      color: colors[this.demoldingDirection],
      transparent: true,
      opacity: 0.8
    });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);

    // Create arrow head (cone)
    const headGeometry = new THREE.ConeGeometry(headRadius, arrowHeadLength);
    const headMaterial = new THREE.MeshPhongMaterial({ 
      color: colors[this.demoldingDirection],
      transparent: true,
      opacity: 0.8
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);

    // Position and orient based on demolding direction
    let arrowPosition = center.clone();
    let shaftPosition, headPosition;
    
    switch (this.demoldingDirection) {
      case 'X':
        // Arrow pointing in positive X direction
        shaft.rotation.z = -Math.PI / 2;
        head.rotation.z = -Math.PI / 2;
        
        shaftPosition = arrowPosition.clone();
        shaftPosition.x += (arrowLength - arrowHeadLength) / 2;
        
        headPosition = arrowPosition.clone();
        headPosition.x += arrowLength - arrowHeadLength / 2;
        break;
        
      case 'Y':
        // Arrow pointing in positive Y direction (default orientation)
        shaftPosition = arrowPosition.clone();
        shaftPosition.y += (arrowLength - arrowHeadLength) / 2;
        
        headPosition = arrowPosition.clone();
        headPosition.y += arrowLength - arrowHeadLength / 2;
        break;
        
      case 'Z':
        // Arrow pointing in positive Z direction
        shaft.rotation.x = Math.PI / 2;
        head.rotation.x = Math.PI / 2;
        
        shaftPosition = arrowPosition.clone();
        shaftPosition.z += (arrowLength - arrowHeadLength) / 2;
        
        headPosition = arrowPosition.clone();
        headPosition.z += arrowLength - arrowHeadLength / 2;
        break;
    }

    shaft.position.copy(shaftPosition);
    head.position.copy(headPosition);

    group.add(shaft);
    group.add(head);

    // Add text label
    const label = this.createTextSprite(`Demolding: ${this.demoldingDirection}+`, colors[this.demoldingDirection]);
    const labelPosition = headPosition.clone();
    
    // Offset label based on direction
    switch (this.demoldingDirection) {
      case 'X':
        labelPosition.x += arrowHeadLength;
        labelPosition.y += headRadius;
        break;
      case 'Y':
        labelPosition.y += arrowHeadLength;
        labelPosition.x += headRadius;
        break;
      case 'Z':
        labelPosition.z += arrowHeadLength;
        labelPosition.y += headRadius;
        break;
    }
    
    label.position.copy(labelPosition);
    group.add(label);

    return group;
  }

  // NEW: Clear demolding visual elements
  private clearDemoldingVisuals(): void {
    if (this.demoldingArrow) {
      this.scene.remove(this.demoldingArrow);
      this.demoldingArrow.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        } else if (child instanceof THREE.Sprite) {
          if (child.material.map) {
            child.material.map.dispose();
          }
          child.material.dispose();
        }
      });
      this.demoldingArrow = null;
    }

    if (this.axisHelper) {
      this.scene.remove(this.axisHelper);
      this.axisHelper.dispose();
      this.axisHelper = null;
    }
  }

  // NEW: Set demolding direction
  public setDemoldingDirection(direction: 'X' | 'Y' | 'Z'): void {
    this.demoldingDirection = direction;
    console.log('Demolding direction changed to:', direction);
    
    if (this.showDemoldingDirection && this.loadedMesh) {
      this.createDemoldingVisuals();
    }
  }

  // NEW: Toggle demolding direction display
  public toggleDemoldingDirection(): void {
    this.showDemoldingDirection = !this.showDemoldingDirection;
    
    if (this.showDemoldingDirection && this.loadedMesh) {
      this.createDemoldingVisuals();
    } else {
      this.clearDemoldingVisuals();
    }
    
    console.log('Demolding direction display toggled:', this.showDemoldingDirection);
  }

  // Calculate dimensions from the loaded model
  private calculateDimensions(): void {
    if (!this.loadedMesh) {
      this.dimensions = { width: 0, height: 0, depth: 0 };
      return;
    }

    const bbox = new THREE.Box3().setFromObject(this.loadedMesh);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Round to 2 decimal places for display
    this.dimensions = {
      width: Math.round(size.x * 100) / 100,
      height: Math.round(size.y * 100) / 100,
      depth: Math.round(size.z * 100) / 100
    };

    console.log('Calculated dimensions:', this.dimensions);
  }

  // Create visual dimension indicators in 3D space
  private createDimensionVisuals(): void {
    if (!this.loadedMesh) return;

    this.clearDimensionVisuals();

    const bbox = new THREE.Box3().setFromObject(this.loadedMesh);
    const min = bbox.min;
    const max = bbox.max;
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    // Create dimension lines and labels
    this.createDimensionLine(
      new THREE.Vector3(min.x, min.y - 0.5, min.z),
      new THREE.Vector3(max.x, min.y - 0.5, min.z),
      `${this.dimensions.width} ${this.dimensionUnit}`,
      'width'
    );

    this.createDimensionLine(
      new THREE.Vector3(min.x - 0.5, min.y, min.z),
      new THREE.Vector3(min.x - 0.5, max.y, min.z),
      `${this.dimensions.height} ${this.dimensionUnit}`,
      'height'
    );

    this.createDimensionLine(
      new THREE.Vector3(max.x + 0.5, min.y, min.z),
      new THREE.Vector3(max.x + 0.5, min.y, max.z),
      `${this.dimensions.depth} ${this.dimensionUnit}`,
      'depth'
    );
  }

  // Create individual dimension line with label
  private createDimensionLine(start: THREE.Vector3, end: THREE.Vector3, text: string, dimension: string): void {
    // Create line geometry
    const points = [start, end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    
    this.scene.add(line);
    this.dimensionLines.push(line);

    // Create text sprite for dimension label
    const sprite = this.createTextSprite(text);
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Offset label slightly based on dimension type
    switch (dimension) {
      case 'width':
        midPoint.y -= 0.3;
        break;
      case 'height':
        midPoint.x -= 0.3;
        break;
      case 'depth':
        midPoint.x += 0.3;
        break;
    }
    
    sprite.position.copy(midPoint);
    this.scene.add(sprite);
    this.dimensionLabels.push(sprite);

    // Add end caps (small perpendicular lines)
    this.createEndCap(start, end, dimension);
    this.createEndCap(end, start, dimension);
  }

  // Create end caps for dimension lines
  private createEndCap(point: THREE.Vector3, otherPoint: THREE.Vector3, dimension: string): void {
    const capLength = 0.2;
    let capStart, capEnd;

    switch (dimension) {
      case 'width':
        capStart = new THREE.Vector3(point.x, point.y - capLength/2, point.z);
        capEnd = new THREE.Vector3(point.x, point.y + capLength/2, point.z);
        break;
      case 'height':
        capStart = new THREE.Vector3(point.x - capLength/2, point.y, point.z);
        capEnd = new THREE.Vector3(point.x + capLength/2, point.y, point.z);
        break;
      case 'depth':
        capStart = new THREE.Vector3(point.x, point.y - capLength/2, point.z);
        capEnd = new THREE.Vector3(point.x, point.y + capLength/2, point.z);
        break;
      default:
        return;
    }

    const points = [capStart, capEnd];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    
    this.scene.add(line);
    this.dimensionLines.push(line);
  }

  // Create text sprite for labels - UPDATED to support color parameter
  private createTextSprite(text: string, textColor?: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    // Set canvas size
    canvas.width = 256;
    canvas.height = 64;
    
    // Configure text styling
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Convert THREE color to CSS color if provided
    let fillColor = 'black';
    if (textColor !== undefined) {
      const color = new THREE.Color(textColor);
      fillColor = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
    }
    
    context.fillStyle = fillColor;
    context.font = 'bold 20px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    
    // Scale sprite appropriately
    sprite.scale.set(1, 0.25, 1);
    
    return sprite;
  }

  // Clear all dimension visual elements
  private clearDimensionVisuals(): void {
    // Remove dimension lines
    this.dimensionLines.forEach(line => {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.dimensionLines = [];

    // Remove dimension labels
    this.dimensionLabels.forEach(sprite => {
      this.scene.remove(sprite);
      if (sprite.material.map) {
        sprite.material.map.dispose();
      }
      sprite.material.dispose();
    });
    this.dimensionLabels = [];
  }

  // Toggle dimension display
  public toggleDimensions(): void {
    this.showDimensions = !this.showDimensions;
    
    if (this.showDimensions && this.loadedMesh) {
      this.createDimensionVisuals();
    } else {
      this.clearDimensionVisuals();
    }
    
    console.log('Dimensions toggled:', this.showDimensions);
  }

  // Update dimension unit
  public onUnitChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.dimensionUnit = selectElement.value;
    
    // Recalculate and update visuals if dimensions are shown
    if (this.showDimensions && this.loadedMesh) {
      this.createDimensionVisuals();
    }
  }

  // EXISTING METHODS (unchanged)
  public onColorChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.modelColor = inputElement.value;
    console.log('New color selected:', this.modelColor);

    if (this.loadedMesh && this.loadedMesh.material) {
      const newColor = new THREE.Color(this.modelColor);

      if (Array.isArray(this.loadedMesh.material)) {
        this.loadedMesh.material.forEach((m: THREE.Material) => {
          if (m instanceof THREE.MeshPhongMaterial || m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshStandardMaterial) {
            m.color.set(newColor);
          }
        });
      } else {
        if (this.loadedMesh.material instanceof THREE.MeshPhongMaterial || this.loadedMesh.material instanceof THREE.MeshLambertMaterial || this.loadedMesh.material instanceof THREE.MeshStandardMaterial) {
          this.loadedMesh.material.color.set(newColor);
        }
      }
    }
  }

  public setView(direction: 'front' | 'top' | 'side' | 'reset'): void {
    if (!this.loadedMesh) {
      console.warn('No model loaded to set view for.');
      return;
    }

    const bbox = new THREE.Box3().setFromObject(this.loadedMesh);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = (this.camera instanceof THREE.PerspectiveCamera) ? this.camera.fov * (Math.PI / 180) : Math.PI / 4;
    const distance = maxDim / 2 / Math.tan(fov / 2) * 1.5;

    let cameraPosition = new THREE.Vector3();

    switch (direction) {
      case 'front':
        cameraPosition.set(center.x, center.y, center.z + distance);
        break;
      case 'top':
        cameraPosition.set(center.x, center.y + distance, center.z);
        break;
      case 'side':
        cameraPosition.set(center.x + distance, center.y, center.z);
        break;
      case 'reset':
      default:
        cameraPosition.set(center.x + distance * 0.7, center.y + distance * 0.7, center.z + distance * 0.7);
        break;
    }

    this.camera.position.copy(cameraPosition);
    this.controls.target.copy(center);
    this.controls.update();
  }

  public toggleWireframe(): void {
    if (this.loadedMesh && this.loadedMesh.material) {
      this.isWireframe = !this.isWireframe;
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

  public toggleBoundingBox(): void {
    if (this.boundingBoxHelper) {
      this.boundingBoxHelper.visible = !this.boundingBoxHelper.visible;
      console.log('Bounding Box toggled:', this.boundingBoxHelper.visible);
    } else {
      console.warn('No bounding box helper available.');
    }
  }

  public setCameraType(type: 'perspective' | 'orthographic'): void {
    if (this.cameraType === type && this.camera) {
      return;
    }

    const canvas = this.rendererCanvas.nativeElement;
    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    const currentPosition = this.camera ? this.camera.position.clone() : new THREE.Vector3(5,5,5);
    const currentTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0,0,0);

    if (this.camera) {
      this.scene.remove(this.camera);
    }

    if (type === 'perspective') {
      this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    } else {
      const size = this.loadedMesh ? new THREE.Box3().setFromObject(this.loadedMesh).getSize(new THREE.Vector3()) : new THREE.Vector3(10,10,10);
      const maxDim = Math.max(size.x, size.y, size.z);
      const orthoSize = maxDim * 1.2;

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
    this.camera.lookAt(currentTarget);

    this.scene.add(this.camera);
    this.cameraType = type;

    if (this.controls) {
      this.controls.object = this.camera;
      this.controls.target.copy(currentTarget);
      this.controls.update();
    }

    console.log('Camera type changed to:', type);
    if (this.loadedMesh) {
      this.setView('reset');
    }
    this.onWindowResize();
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    const canvas = this.rendererCanvas.nativeElement;
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    } else if (this.camera instanceof THREE.OrthographicCamera) {
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