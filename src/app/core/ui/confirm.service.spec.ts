import { TestBed } from '@angular/core/testing';

import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let service: ConfirmService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmService);
  });

  it('should resolve true when approved', async () => {
    const pending = service.confirm({
      title: 'Delete post',
      message: 'This cannot be undone.',
      tone: 'danger',
    });

    expect(service.dialog()?.title).toBe('Delete post');

    service.approve();

    await expect(pending).resolves.toBe(true);
    expect(service.dialog()).toBeNull();
  });

  it('should resolve the previous dialog as false when replaced', async () => {
    const first = service.confirm({ title: 'First', message: 'First message' });
    const second = service.confirm({ title: 'Second', message: 'Second message' });

    await expect(first).resolves.toBe(false);
    expect(service.dialog()?.title).toBe('Second');

    service.cancel();

    await expect(second).resolves.toBe(false);
  });
});
