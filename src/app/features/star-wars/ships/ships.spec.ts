import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ships } from './ships';

describe('Ships', () => {
  let component: Ships;
  let fixture: ComponentFixture<Ships>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ships],
    }).compileComponents();

    fixture = TestBed.createComponent(Ships);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
