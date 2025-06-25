import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartViewerComponent } from './part-viewer';

describe('PartViewer', () => {
  let component: PartViewerComponent;
  let fixture: ComponentFixture<PartViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
