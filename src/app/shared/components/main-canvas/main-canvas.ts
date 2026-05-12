import { Component, ElementRef, ViewChild, AfterViewInit, inject } from '@angular/core';
import { EngineService } from '../../../core/engine/engine';

@Component({
  selector: 'app-main-canvas',
  standalone: true,
  templateUrl: './main-canvas.html',
  styleUrl: './main-canvas.scss'
})
export class MainCanvasComponent implements AfterViewInit {
  // Pillamos el canvas del HTML
  @ViewChild('rendererCanvas', { static: true }) 
  public canvas!: ElementRef<HTMLCanvasElement>;

  private engine = inject(EngineService);

  ngAfterViewInit(): void {
    // Le pasamos el elemento real al motor
    this.engine.init(this.canvas.nativeElement);
  }
}