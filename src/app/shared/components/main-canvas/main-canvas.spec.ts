import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EngineService } from '../../../core/engine/engine';
import { MainCanvasComponent } from './main-canvas';

describe('MainCanvasComponent', () => {
  let component: MainCanvasComponent;
  let fixture: ComponentFixture<MainCanvasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainCanvasComponent],
      providers: [
        {
          provide: EngineService,
          useValue: {
            init: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainCanvasComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
