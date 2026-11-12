import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { session } from '../api/client';
import type { Lang } from '../api/types';
import { AppRoutes, Providers } from '../App';
import i18n from '../i18n';
import { TOKEN } from './server';

interface Options {
  lang?: Lang;
  /** Користувач уже увійшов: у сховищі лежить токен сесії. */
  signedIn?: boolean;
}

/** Увесь застосунок на маршруті route - тести працюють з ним так, як користувач. */
export async function renderApp(route = '/', { lang = 'uk', signedIn = false }: Options = {}) {
  if (signedIn) {
    session.token = TOKEN;
  }

  await i18n.changeLanguage(lang);
  const view = render(
    <Providers>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  return { ...view, user: userEvent.setup() };
}

export const CYRILLIC = /[Ѐ-ӿ]/;
