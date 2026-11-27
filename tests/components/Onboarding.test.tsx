import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { SCENARIOS } from '@/features/profile/scenarios';
import { createAppStores, PROFILE_KEY } from '@/features/profile/stores';
import { runAxe } from '../a11y/axe';
import {
  adviseHandler,
  airQualityHandler,
  placeSearchHandler,
  weatherHandler,
} from '../msw/handlers';
import { server } from '../msw/server';
import { at } from '../utils/at';
import { createTestQueryClient } from '../utils/render';
import { render } from '@testing-library/react';

beforeEach(() => {
  server.use(
    placeSearchHandler(() => 'geoSearchLucknow'),
    airQualityHandler('aqDelhi'),
    weatherHandler('weatherDelhi'),
    adviseHandler({ status: 502, body: { ok: false, error: 'upstream' } }),
  );
});

function setup() {
  const stores = createAppStores();
  const user = userEvent.setup();
  const view = render(<App queryClient={createTestQueryClient()} stores={stores} />);
  return { ...view, user, stores };
}

/** Presses Tab until the element with this role and name has focus (keyboard reachability). */
async function tabTo(user: UserEvent, role: string, name: string | RegExp) {
  for (let i = 0; i < 80; i++) {
    const target = screen.queryByRole(role, { name });
    if (target && target === document.activeElement) return target;
    await user.tab();
  }
  throw new Error(`Could not reach ${role} "${String(name)}" with Tab`);
}

async function chooseLucknowByKeyboard(user: UserEvent) {
  await tabTo(user, 'combobox', 'Search for a town or city in India');
  await user.keyboard('Luck');
  await screen.findByRole('option', { name: 'Lucknow, Uttar Pradesh' });
  await user.keyboard('{ArrowDown}{Enter}');
  await screen.findByText('Lucknow, Uttar Pradesh', { selector: 'span' });
}

describe('onboarding', () => {
  it('can be completed with the keyboard only', async () => {
    const { user, stores } = setup();
    expect(screen.getByText('Step 1 of 3')).toBeVisible();

    await chooseLucknowByKeyboard(user);
    await tabTo(user, 'button', "Next: who's at home");
    await user.keyboard('{Enter}');

    const step2 = await screen.findByRole('heading', { name: "Who's at home?" });
    expect(step2).toHaveFocus();
    expect(screen.getByText('Step 2 of 3')).toBeVisible();

    await tabTo(user, 'checkbox', 'Parent or carer');
    await user.keyboard(' ');
    await tabTo(user, 'textbox', /Name or nickname/);
    await user.keyboard('Asha');
    await tabTo(user, 'combobox', 'Age group');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Age group' }), 'adult_18_59');
    await tabTo(user, 'button', 'Next: your day & home');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Your day & home' })).toHaveFocus();
    expect(screen.getByText('Step 3 of 3')).toBeVisible();
    await tabTo(user, 'button', 'Finish');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('button', { name: 'Household' })).toBeVisible();
    expect(stores.profile.get()).toMatchObject({
      personas: ['parent'],
      members: [{ label: 'Asha', ageBand: 'adult_18_59' }],
      language: 'en',
    });
    expect(stores.location.get()).toMatchObject({ label: 'Lucknow, Uttar Pradesh' });
  });

  it('asks for a location before step 2', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: "Next: who's at home" }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a location to continue');
    expect(screen.getByRole('button', { name: "Next: who's at home" })).toHaveAccessibleDescription(
      /Choose a location to continue/,
    );
    expect(screen.getByText('Step 1 of 3')).toBeVisible();
  });

  it('shows linked validation errors and focuses the first invalid field', async () => {
    const { user, stores } = setup();
    stores.setLocation(at(SCENARIOS, 0).location);
    await user.click(await screen.findByRole('button', { name: "Next: who's at home" }));
    await user.click(screen.getByRole('button', { name: 'Next: your day & home' }));

    expect(await screen.findByText('3 fields need attention.')).toBeVisible();
    const label = screen.getByRole('textbox', { name: /Name or nickname/ });
    expect(label).toHaveAttribute('aria-invalid', 'true');
    expect(label).toHaveAccessibleDescription(/Enter a name or nickname\./);
    expect(screen.getByRole('combobox', { name: 'Age group' })).toHaveAccessibleDescription(
      /Choose an age group\./,
    );
    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Who is this plan for?' })).toHaveFocus();
    });
    expect(screen.getByText('Step 2 of 3')).toBeVisible();
  });

  it('rejects labels over 30 characters', async () => {
    const { user, stores } = setup();
    stores.setLocation(at(SCENARIOS, 0).location);
    await user.click(await screen.findByRole('button', { name: "Next: who's at home" }));
    await user.type(screen.getByRole('textbox', { name: /Name or nickname/ }), 'x'.repeat(31));
    await user.click(screen.getByRole('button', { name: 'Next: your day & home' }));
    expect(await screen.findByText('Use 30 characters or fewer.')).toBeVisible();
  });

  it('"Skip for now" finishes with household only', async () => {
    const { user, stores } = setup();
    stores.setLocation(at(SCENARIOS, 0).location);
    await user.click(await screen.findByRole('button', { name: "Next: who's at home" }));
    await user.click(screen.getByRole('checkbox', { name: 'Commuter' }));
    await user.type(screen.getByRole('textbox', { name: /Name or nickname/ }), 'Me');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Age group' }), 'adult_18_59');
    await user.click(screen.getByRole('button', { name: 'Next: your day & home' }));
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Usual way to work or school' }),
      'bus',
    );
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(stores.profile.get()).toEqual({
      personas: ['commuter'],
      members: [{ id: 'm1', label: 'Me', ageBand: 'adult_18_59', conditions: [] }],
      masks: [],
      language: 'en',
    });
  });

  it('step 2 says details stay in this browser and links to About & privacy', async () => {
    const { user, stores } = setup();
    stores.setLocation(at(SCENARIOS, 0).location);
    await user.click(await screen.findByRole('button', { name: "Next: who's at home" }));
    expect(screen.getByText(/household and health details stay in this browser/)).toBeVisible();
    const link = screen.getByRole('button', { name: 'About & privacy' });
    await user.click(link);
    const dialog = await screen.findByRole('dialog', { name: 'About & privacy' });
    expect(within(dialog).getByText(/no accounts and no tracking/)).toBeVisible();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(link).toHaveFocus();
    });
  });

  it.each([0, 1, 2])('step %i has no axe violations', async (stepIndex) => {
    const { user, stores, container } = setup();
    stores.setLocation(at(SCENARIOS, 0).location);
    if (stepIndex >= 1)
      await user.click(await screen.findByRole('button', { name: "Next: who's at home" }));
    if (stepIndex === 2) {
      await user.click(screen.getByRole('checkbox', { name: 'Student' }));
      await user.type(screen.getByRole('textbox', { name: /Name or nickname/ }), 'Me');
      await user.selectOptions(screen.getByRole('combobox', { name: 'Age group' }), 'adult_18_59');
      await user.click(screen.getByRole('button', { name: 'Next: your day & home' }));
      await screen.findByRole('heading', { name: 'Your day & home' });
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Usual way to work or school' }),
        'car_petrol',
      );
    }
    expect(await runAxe(container)).toHaveNoViolations();
  });
});

describe('sample households', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    'loads %s as a profile and location only',
    async (_id, scenario) => {
      const { user, stores } = setup();
      const trigger = screen.getByRole('button', { name: 'Try a sample household' });
      await user.click(trigger);
      const dialog = await screen.findByRole('dialog', { name: 'Try a sample household' });
      await user.click(
        within(dialog).getByRole('button', { name: new RegExp(`^${scenario.id} ·`) }),
      );

      expect(stores.profile.get()).toEqual(scenario.profile);
      expect(stores.location.get()).toEqual(scenario.location);
      expect(await screen.findByRole('heading', { name: scenario.location.label })).toBeVisible();
    },
  );
});

describe('stored data', () => {
  it('resets a corrupt stored profile and shows onboarding instead of crashing', () => {
    localStorage.setItem(PROFILE_KEY, '{"members":42');
    setup();
    expect(screen.getByText('Step 1 of 3')).toBeVisible();
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it('persists the profile across a reload', () => {
    createAppStores().profile.set(at(SCENARIOS, 2).profile);
    createAppStores().setLocation(at(SCENARIOS, 2).location);
    setup();
    expect(screen.getByRole('button', { name: 'Household' })).toBeVisible();
  });
});
