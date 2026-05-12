import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IntroLogo } from './intro-logo';

describe('IntroLogo', () => {
  let component: IntroLogo;
  let fixture: ComponentFixture<IntroLogo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntroLogo],
    }).compileComponents();

    fixture = TestBed.createComponent(IntroLogo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
