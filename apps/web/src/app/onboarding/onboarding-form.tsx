'use client';

import { useActionState } from 'react';
import { ArrowRight } from 'lucide-react';
import { OrganisationFields } from '@/components/organisation-fields';
import { SubmitButton } from '@/components/submit-button';
import { createWorkspace, type OnboardingState } from './actions';

const initialState: OnboardingState = {
  error: '',
  values: { name: '', currency: 'GBP', timezone: 'Europe/London' },
};

export function OnboardingForm() {
  // The permalink also supports ordinary form POSTs before JavaScript loads.
  const [state, action] = useActionState(createWorkspace, initialState, '/onboarding');
  return (
    <form action={action} className="stack-form">
      {state.error && (
        <div className="notice error" role="alert">
          {state.error}
        </div>
      )}
      <OrganisationFields values={state.values} />
      <SubmitButton>
        Create workspace <ArrowRight size={17} />
      </SubmitButton>
    </form>
  );
}
