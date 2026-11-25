import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { runAxe } from '../a11y/axe';

describe('App shell', () => {
  it('renders landmarks, one h1, a skip link and data attribution (smoke)', () => {
    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skipLink).toHaveAttribute('href', `#${main.id}`);
    expect(main).toHaveAttribute('tabindex', '-1');

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(
      'Contains modified Copernicus Atmosphere Monitoring Service information.',
    );
    expect(footer).toHaveTextContent('General guidance, not medical advice.');
    for (const link of within(footer).getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('has no axe violations', async () => {
    const { container } = render(<App />);

    expect(await runAxe(container)).toHaveNoViolations();
  });
});
