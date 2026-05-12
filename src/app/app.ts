import { Component, signal } from '@angular/core';
import { MainCanvasComponent } from "./shared/components/main-canvas/main-canvas";
import { SceneOneComponent } from "./features/scene-one/scene-one";

@Component({
  selector: 'app-root',
  imports: [ MainCanvasComponent, SceneOneComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('star-wars-app');
}
