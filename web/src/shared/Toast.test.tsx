import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '../App';
import i18n from '../i18n';
import { useToast } from './Toast';

function Trigger({ onOpen }: { onOpen?: () => void }) {
  const toast = useToast();
  const next = useRef(1);
  return (
    <>
      <button type="button" onClick={() => toast.show(`Повідомлення ${next.current++}`)}>
        Показати
      </button>
      <button
        type="button"
        onClick={() => toast.show('Замовлення №7: В дорозі', 'info', { title: 'Нове сповіщення', action: { label: 'Відкрити', onClick: () => onOpen?.() } })}
      >
        Подія
      </button>
    </>
  );
}

async function setup(onOpen?: () => void) {
  await i18n.changeLanguage('uk');
  render(
    <Providers>
      <Trigger onOpen={onOpen} />
    </Providers>,
  );
  return userEvent.setup();
}

describe('спливні повідомлення', () => {
  it('тости складаються в стос, видно не більше чотирьох - найстаріший іде', async () => {
    const user = await setup();

    for (let index = 0; index < 5; index++) {
      await user.click(screen.getByRole('button', { name: 'Показати' }));
    }

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(4));
    expect(screen.queryByText('Повідомлення 1')).not.toBeInTheDocument();
    expect(screen.getByText('Повідомлення 5')).toBeInTheDocument();
  });

  it('тост із заголовком і дією: натискання виконує дію й закриває тост', async () => {
    const onOpen = vi.fn();
    const user = await setup(onOpen);

    await user.click(screen.getByRole('button', { name: 'Подія' }));
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('Нове сповіщення');
    expect(toast).toHaveTextContent('Замовлення №7: В дорозі');

    await user.click(within(toast).getByRole('button', { name: 'Відкрити' }));

    expect(onOpen).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('кнопка «Закрити» прибирає тост', async () => {
    const user = await setup();

    await user.click(screen.getByRole('button', { name: 'Показати' }));
    await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Закрити' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
