import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';

const background = () => getComputedStyle(document.body).backgroundColor;

describe('темна тема', () => {
  it('перемикач у шапці вмикає темну тему й запам’ятовує вибір', async () => {
    const { user } = await renderApp('/');
    const toggle = await screen.findByRole('button', { name: 'Темна тема' });
    const light = background();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Темна тема' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('farmcart.mode')).toBe('dark');
    expect(background()).not.toBe(light);
  });

  it('збережений вибір діє з першого відкриття', async () => {
    localStorage.setItem('farmcart.mode', 'dark');
    await renderApp('/');

    expect(await screen.findByRole('button', { name: 'Темна тема' })).toHaveAttribute('aria-pressed', 'true');
  });
});
