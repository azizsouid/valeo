// frontend/src/app/app.ts
import { Component, PLATFORM_ID, inject, OnInit } from '@angular/core'; // ADDED PLATFORM_ID, inject, OnInit
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser, CommonModule } from '@angular/common'; // ADDED isPlatformBrowser, CommonModule

// Keep this import for the PartViewerComponent
import { PartViewerComponent } from './part-viewer/part-viewer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule, // ADDED CommonModule for *ngIf
    PartViewerComponent // Keep this in imports, but render conditionally in HTML
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit { // IMPLEMENT OnInit
  protected title = 'frontend';
  protected showPartViewer = false; // NEW: Property to control PartViewerComponent visibility

  private platformId = inject(PLATFORM_ID); // NEW: Inject PLATFORM_ID

  ngOnInit(): void {
    // NEW: This code will only run in the browser environment
    if (isPlatformBrowser(this.platformId)) {
      this.showPartViewer = true;
    }
  }
}