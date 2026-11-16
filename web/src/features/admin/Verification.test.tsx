import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { backend, farmProfile, user as userWith } from '../../test/server';

// Мапу (Leaflet) автотести не малюють: замість неї - підпис із координатами.
vi.mock('./MiniMap', () => ({
  default: ({ lat, lon, label }: { lat: number; lon: number; label: string }) => <div data-testid="mini-map">{`${label}: ${lat}, ${lon}`}</div>,
}));

const sokilnyky = { ...farmProfile, id: 4, name: { uk: 'Еко-ферма «Сокільники»', en: 'Sokilnyky Eco Farm' }, lat: 49.8, lon: 23.98, verified: false, documentCount: 1 };

async function asAdmin() {
  backend.user = userWith('Buyer', 'Admin');
  localStorage.setItem('farmcart.role', 'Admin');
  return renderApp('/admin', { signedIn: true });
}

beforeEach(() => {
  // jsdom не вміє blob-адрес: перегляд документа отримує просту заглушку.
  URL.createObjectURL = vi.fn(() => 'blob:document');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('Верифікація: мапа, документи, причина відхилення', () => {
  it('замість координат - мапа місця господарства', async () => {
    backend.pendingFarmers = [sokilnyky];
    await asAdmin();

    const map = await screen.findByRole('region', { name: 'Розташування: Еко-ферма «Сокільники»' });

    expect(await within(map).findByTestId('mini-map')).toHaveTextContent('49.8, 23.98');
    expect(screen.queryByText('49.8000, 23.9800')).not.toBeInTheDocument();
  });

  it('адміністратор переглядає скани документів продавця', async () => {
    backend.pendingFarmers = [sokilnyky];
    backend.documents = [{ id: 70, name: 'Органічний сертифікат', contentType: 'image/png', size: 2048, uploadedAt: '2026-09-30T12:00:00+03:00' }];
    const { user } = await asAdmin();

    const card = await screen.findByRole('listitem', { name: 'Еко-ферма «Сокільники»' });
    expect(within(card).getByText('Документів: 1')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Документи: Еко-ферма «Сокільники»' }));

    const dialog = await screen.findByRole('dialog', { name: 'Документи: Еко-ферма «Сокільники»' });
    expect(within(dialog).getByRole('button', { name: /Органічний сертифікат/ })).toBeInTheDocument();
    expect(await within(dialog).findByRole('img', { name: 'Органічний сертифікат' })).toHaveAttribute('src', 'blob:document');
  });

  it('типова причина відхилення підставляється одним натисканням', async () => {
    backend.pendingFarmers = [sokilnyky];
    const { user } = await asAdmin();

    await user.click(await screen.findByRole('button', { name: 'Відхилити заявку: Еко-ферма «Сокільники»' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Бракує витягу з реєстру (ЄДР)' }));

    expect(within(dialog).getByRole('textbox')).toHaveValue('Бракує витягу з реєстру (ЄДР)');
    await user.click(within(dialog).getByRole('button', { name: 'Відхилити' }));
    expect(await screen.findByText(/відхилено/i)).toBeInTheDocument();
  });
});
