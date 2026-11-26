import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LocationSearch } from '@/features/location/LocationSearch';
import { runAxe } from '../a11y/axe';
import { createRequestLog, placeSearchHandler } from '../msw/handlers';
import { server } from '../msw/server';
import { renderWithQuery } from '../utils/render';

function setup() {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  const view = renderWithQuery(<LocationSearch onSelect={onSelect} />);
  const input = screen.getByRole('combobox', { name: 'Search for a town or city in India' });
  return { ...view, onSelect, user, input };
}

function useSearchFixtures() {
  const log = createRequestLog();
  server.use(
    placeSearchHandler(
      (name) =>
        name.toLowerCase().startsWith('pun')
          ? 'geoSearchPun'
          : name.toLowerCase().startsWith('luck')
            ? 'geoSearchLucknow'
            : 'geoSearchNoMatch',
      log,
    ),
  );
  return log;
}

describe('LocationSearch', () => {
  it('debounces typing into a single request for the final text', async () => {
    const log = useSearchFixtures();
    const { user, input } = setup();

    await user.type(input, 'Pun');

    expect(await screen.findAllByRole('option')).toHaveLength(8);
    expect(log.urls).toHaveLength(1);
    expect(log.urls[0]?.searchParams.get('name')).toBe('Pun');
    expect(log.urls[0]?.searchParams.get('countryCode')).toBe('IN');
    expect(screen.getByText('8 places found. Use the up and down arrows to choose.')).toBeVisible();
  });

  it('does not search with fewer than 2 characters', async () => {
    const log = useSearchFixtures();
    const { user, input } = setup();

    await user.type(input, 'P');
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(log.urls).toHaveLength(0);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('is operable with the keyboard: arrows move, Enter selects', async () => {
    useSearchFixtures();
    const { user, input, onSelect } = setup();
    await user.type(input, 'Pun');
    const options = await screen.findAllByRole('option');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{ArrowDown}');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);

    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', options[7]?.id); // wraps to last

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ name: 'Pune', state: 'Maharashtra' });
    expect(input).toHaveValue('Pune, Maharashtra');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();
  });

  it('does not search again for the label it filled in', async () => {
    const log = useSearchFixtures();
    const { user, input } = setup();
    await user.type(input, 'Luck');
    await screen.findByRole('option', { name: 'Lucknow, Uttar Pradesh' });

    await user.keyboard('{ArrowDown}{Enter}');
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(log.urls).toHaveLength(1);
  });

  it('Escape closes the list, then clears the input', async () => {
    useSearchFixtures();
    const { user, input } = setup();
    await user.type(input, 'Pun');
    await screen.findAllByRole('option');

    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('Pun');

    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('selects an option with a pointer', async () => {
    useSearchFixtures();
    const { user, input, onSelect } = setup();
    await user.type(input, 'Luck');

    await user.click(await screen.findByRole('option', { name: 'Lucknow, Uttar Pradesh' }));

    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ name: 'Lucknow' });
    expect(input).toHaveValue('Lucknow, Uttar Pradesh');
  });

  it('says so when nothing matches', async () => {
    useSearchFixtures();
    const { user, input } = setup();

    await user.type(input, 'Qzxqzxq');

    expect(await screen.findByText('No places in India match “Qzxqzxq”.')).toBeVisible();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows an error with a retry that recovers', async () => {
    server.use(placeSearchHandler(() => ({ status: 500 })));
    const { user, input } = setup();

    await user.type(input, 'Pun');
    expect(
      await screen.findByText(
        'Search is unavailable right now. Check your connection and try again.',
      ),
    ).toBeVisible();

    useSearchFixtures();
    await user.click(screen.getByRole('button', { name: 'Try the search again' }));

    expect(await screen.findAllByRole('option')).toHaveLength(8);
  });

  it('links the hint and status to the input and has no axe violations', async () => {
    useSearchFixtures();
    const { user, input, container } = setup();
    await user.type(input, 'Pun');
    await screen.findAllByRole('option');

    expect(input).toHaveAccessibleDescription(/Type at least 2 letters\..*8 places found/);
    await waitFor(async () => {
      expect(await runAxe(container)).toHaveNoViolations();
    });
  });
});
