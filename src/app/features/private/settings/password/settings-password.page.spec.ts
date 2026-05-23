import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FeedbackService } from '../../../../core/ui/feedback.service';
import { UsersApiService } from '../../../users/users-api.service';
import { SettingsPasswordPage } from './settings-password.page';

describe('SettingsPasswordPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPasswordPage],
      providers: [
        {
          provide: UsersApiService,
          useValue: {
            changePassword: () => of({}),
          },
        },
        {
          provide: FeedbackService,
          useValue: {
            success: () => undefined,
            error: () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  it('marks the form invalid when passwords do not match', () => {
    const fixture = TestBed.createComponent(SettingsPasswordPage);
    const component = fixture.componentInstance;

    component.form.setValue({
      currentPassword: 'current-password',
      newPassword: 'new-password',
      confirmPassword: 'different-password',
    });

    expect(component.form.hasError('passwordMismatch')).toBe(true);
    expect(component.form.valid).toBe(false);
  });
});
