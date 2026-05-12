import { TestBed } from '@angular/core/testing';

import { ScrollOrchestratorService } from './scroll-orchestrator';

describe('ScrollOrchestratorService', () => {
  let service: ScrollOrchestratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScrollOrchestratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
