import { TestBed } from '@angular/core/testing';

import { EngineService } from './engine';

describe('EngineService', () => {
  let service: EngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EngineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
