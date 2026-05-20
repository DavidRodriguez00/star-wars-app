import { Component, OnInit, signal } from '@angular/core';
import { MainCanvasComponent } from "./shared/components/main-canvas/main-canvas";
import { SceneOneComponent } from "./features/scene-one/scene-one";
import { ScrollOrchestratorService } from './core/animations/scroll-orchestrator';

@Component({
  selector: 'app-root',
  imports: [ MainCanvasComponent, SceneOneComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('star-wars-app');

  constructor(private scrollOrchestrator: ScrollOrchestratorService) {}

  ngOnInit(): void {
    this.scrollOrchestrator.resetScroll();
  }
}
