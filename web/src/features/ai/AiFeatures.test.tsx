import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem, PlannedBasket } from '../../api/types';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, farmProfile, products, user as userWith } from '../../test/server';

vi.mock('../map/FarmMapView', () => ({ default: () => <div data-testid="map" /> }));
vi.mock('../admin/MiniMap', () => ({ default: () => <div data-testid="mini-map" /> }));

const [carrots, potatoes, milk] = products as [CatalogItem, CatalogItem, CatalogItem];
const summary = { likes: { uk: 'Свіжа морква', en: 'Fresh carrots' }, complaints: { uk: 'Повільна доставка', en: 'Slow delivery' } };
const plan: PlannedBasket = { lines: [{ item: carrots, quantity: 2 }, { item: potatoes, quantity: 3 }], missing: ['сметана', 'лавровий лист'] };

function asFarmer() {
  backend.asFarmer();
  backend.aiAvailable = true;
  localStorage.setItem('farmcart.role', 'Farmer');
  return renderApp('/farmer/products', { signedIn: true });
}

function asAdmin() {
  backend.user = userWith('Buyer', 'Admin');
  backend.aiAvailable = true;
  localStorage.setItem('farmcart.role', 'Admin');
  return renderApp('/admin', { signedIn: true });
}

describe('AI-5 Підсумок відгуків', () => {
  it('сторінка товару показує, що подобається покупцям і на що вони скаржаться', async () => {
    backend.aiAvailable = true;
    backend.reviewSummaries['product:1'] = summary;
    await renderApp('/products/1');

    const card = await screen.findByRole('region', { name: 'Підсумок відгуків' });

    expect(within(card).getByText(/Свіжа морква/)).toBeInTheDocument();
    expect(within(card).getByText(/Повільна доставка/)).toBeInTheDocument();
    expect(within(card).getByText('Підсумок склав ШІ за відгуками покупців.')).toBeInTheDocument();
  });

  it('англійською підсумок без кирилиці', async () => {
    backend.aiAvailable = true;
    backend.reviewSummaries['product:1'] = { likes: summary.likes, complaints: null };
    await renderApp('/products/1', { lang: 'en' });

    const card = await screen.findByRole('region', { name: 'Review summary' });

    expect(within(card).getByText(/Fresh carrots/)).toBeInTheDocument();
    expect(CYRILLIC.test(card.textContent ?? '')).toBe(false);
  });

  it('сторінка ферми показує підсумок про ферму', async () => {
    backend.aiAvailable = true;
    backend.reviewSummaries['farm:1'] = summary;
    await renderApp('/farms/1');

    expect(await screen.findByRole('region', { name: 'Підсумок відгуків' })).toBeInTheDocument();
  });

  it('коли ШІ вимкнено, підсумку немає', async () => {
    backend.reviewSummaries['product:1'] = summary;
    await renderApp('/products/1');

    await screen.findByRole('heading', { name: 'Морква' });

    expect(screen.queryByRole('region', { name: 'Підсумок відгуків' })).not.toBeInTheDocument();
  });
});

describe('REL Часто купують разом', () => {
  it('сторінка товару пропонує супутні товари', async () => {
    backend.related = [milk];
    await renderApp('/products/1');

    const section = await screen.findByRole('region', { name: 'Часто купують разом' });

    expect(within(section).getByRole('article', { name: "Молоко коров'яче" })).toBeInTheDocument();
    expect(backend.relatedRequests).toContain('1');
  });

  it('кошик шукає супутні товари для всіх своїх позицій', async () => {
    backend.putInCart(2, 1);
    backend.putInCart(1, 1);
    backend.related = [milk];
    await renderApp('/cart', { signedIn: true });

    expect(await screen.findByRole('region', { name: 'Часто купують разом' })).toBeInTheDocument();
    expect(backend.relatedRequests).toContain('1,2');
  });

  it('якщо підказати нічого, блоку немає', async () => {
    await renderApp('/products/1');

    await screen.findByRole('heading', { name: 'Морква' });
    await waitFor(() => expect(backend.relatedRequests).toContain('1'));

    expect(screen.queryByRole('region', { name: 'Часто купують разом' })).not.toBeInTheDocument();
  });
});

describe('AI-7 Кошик за рецептом', () => {
  async function openPlanner() {
    backend.aiAvailable = true;
    backend.basketPlan = plan;
    const { user } = await renderApp('/', { signedIn: true });
    await user.click(await screen.findByRole('button', { name: 'Кошик за рецептом' }));
    return { user, dialog: await screen.findByRole('dialog', { name: 'Зібрати кошик за рецептом' }) };
  }

  it('гість кнопки не бачить', async () => {
    backend.aiAvailable = true;
    await renderApp('/');

    await screen.findByRole('article', { name: 'Морква' });

    expect(screen.queryByRole('button', { name: 'Кошик за рецептом' })).not.toBeInTheDocument();
  });

  it('покупець обирає товари й кількість; до кошика потрапляє лише обране', async () => {
    const { user, dialog } = await openPlanner();
    await user.type(within(dialog).getByLabelText('Що готуємо?'), 'борщ на шістьох{Enter}');

    expect(await within(dialog).findByText('Немає в каталозі: сметана, лавровий лист')).toBeInTheDocument();
    expect(backend.basketRequests).toEqual([{ request: 'борщ на шістьох', lang: 'uk' }]);
    expect(backend.cart.lines).toHaveLength(0);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Додати до кошика: Картопля' }));
    await user.click(within(dialog).getByRole('button', { name: 'Збільшити кількість: Морква' }));
    await user.click(within(dialog).getByRole('button', { name: 'Додати до кошика: 1' }));

    expect(await screen.findByText('Додано до кошика товарів: 1')).toBeInTheDocument();
    expect(backend.cart.lines.map((line) => [line.productId, line.quantity])).toEqual([[1, 3]]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Зібрати кошик за рецептом' })).not.toBeInTheDocument());
  });

  it('нічого не знайдено - покупець бачить пояснення', async () => {
    const { user, dialog } = await openPlanner();
    backend.basketPlan = { lines: [], missing: [] };

    await user.type(within(dialog).getByLabelText('Що готуємо?'), 'камінці{Enter}');

    expect(await within(dialog).findByText(/ШІ не знайшов відповідних товарів/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Додати до кошика: 0' })).toBeDisabled();
  });

  it('помилка ШІ показується мовою інтерфейсу', async () => {
    const { user, dialog } = await openPlanner();
    backend.aiError = 'ai_failed';

    await user.type(within(dialog).getByLabelText('Що готуємо?'), 'борщ{Enter}');

    expect(await within(dialog).findByText('ШІ зараз не відповідає. Спробуйте ще раз пізніше.')).toBeInTheDocument();
  });
});

describe('AI-6 Чернетка товару за фото', () => {
  const photo = new File(['photo'], 'honey.png', { type: 'image/png' });

  async function newProduct() {
    const { user } = await asFarmer();
    await user.click(await screen.findByRole('button', { name: 'Додати товар' }));
    return { user, dialog: await screen.findByRole('dialog', { name: 'Новий товар' }) };
  }

  it('заповнює порожні поля, не змінює введене й просить перевірити результат', async () => {
    const { user, dialog } = await newProduct();
    await user.click(within(dialog).getByLabelText(/Назва товару українською/));
    await user.paste('Мій мед');

    await user.upload(await within(dialog).findByLabelText('Заповнити за фото'), photo);

    expect(await within(dialog).findByText(/ШІ заповнив порожні поля/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Назва товару українською/)).toHaveValue('Мій мед');
    expect(within(dialog).getByLabelText(/Назва товару англійською/)).toHaveValue('Linden honey');
    expect(within(dialog).getByLabelText('Опис українською')).toHaveValue('Світлий мед');
    expect(within(dialog).getByRole('combobox', { name: /Категорія/ })).toHaveTextContent('Мед');
    expect(within(dialog).getByLabelText(/Склад \(українською\)/)).toHaveValue('');
    expect(backend.productRequests).toHaveLength(0);
  });

  it('невпізнане фото лишає форму порожньою', async () => {
    const { user, dialog } = await newProduct();
    backend.suggestion = { understood: false, name: null, category: null, description: null };

    await user.upload(await within(dialog).findByLabelText('Заповнити за фото'), photo);

    expect(await within(dialog).findByText(/ШІ не впізнав товар/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Назва товару англійською/)).toHaveValue('');
  });

  it('помилка показується у формі', async () => {
    const { user, dialog } = await newProduct();
    backend.aiError = 'ai_limit';

    await user.upload(await within(dialog).findByLabelText('Заповнити за фото'), photo);

    expect(await within(dialog).findByText(/Забагато запитів до ШІ/)).toBeInTheDocument();
  });

  it('під час редагування наявного товару кнопки немає', async () => {
    const { user } = await asFarmer();
    await user.click(await screen.findByRole('button', { name: 'Змінити товар: Морква' }));
    const dialog = await screen.findByRole('dialog', { name: 'Зміна товару' });

    expect(within(dialog).queryByLabelText('Заповнити за фото')).not.toBeInTheDocument();
  });
});

describe('AI-11 Переклад історії ферми', () => {
  it('заповнює другу мову й просить перевірити текст', async () => {
    backend.translationAvailable = true;
    const { user } = await asFarmer();
    await user.click(await screen.findByRole('button', { name: 'Профіль ферми' }));
    const dialog = await screen.findByRole('dialog', { name: 'Профіль ферми для покупців' });
    const translate = await within(dialog).findByRole('button', { name: 'Перекласти' });
    expect(translate).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Історія ферми українською'), 'Ферма з 2009 року');
    await user.click(translate);

    expect(await within(dialog).findByText('Переклав ШІ. Перевірте текст перед збереженням.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Історія ферми англійською')).toHaveValue('en: Ферма з 2009 року');
    expect(backend.translationRequests).toEqual([[{ field: 'story', targetLang: 'en', text: 'Ферма з 2009 року' }]]);
  });

  it('помилка перекладу показується у формі', async () => {
    backend.translationAvailable = true;
    backend.translationError = 'translation_failed';
    const { user } = await asFarmer();
    await user.click(await screen.findByRole('button', { name: 'Профіль ферми' }));
    const dialog = await screen.findByRole('dialog', { name: 'Профіль ферми для покупців' });

    await user.type(within(dialog).getByLabelText('Історія ферми англійською'), 'A farm');
    await user.click(await within(dialog).findByRole('button', { name: 'Перекласти' }));

    expect(await within(dialog).findByText(/Не вдалося перекласти текст/)).toBeInTheDocument();
  });
});

describe('AI-8 Допомога модератору', () => {
  it('позначає підозрілий відгук, а причина підставляється, але рішення за адміністратором', async () => {
    backend.addFarmReview(5, 'Чудова ферма');
    const spam = backend.addFarmReview(1, 'Купуйте на example.com');
    backend.reviewCheck = { flagged: [{ reviewId: spam.id, category: 'spam', reason: { uk: 'Реклама стороннього сайту', en: 'Third-party advertising' } }], remaining: 2 };
    const { user } = await asAdmin();
    await user.click(await screen.findByRole('tab', { name: 'Відгуки' }));

    await user.click(await screen.findByRole('button', { name: 'Перевірити відгуки з ШІ' }));

    const card = await screen.findByRole('listitem', { name: `Відгук #${spam.id}` });
    expect(await within(card).findByText(/Реклама стороннього сайту/)).toBeInTheDocument();
    expect(within(card).getByText('Спам:')).toBeInTheDocument();
    expect(screen.getByText(/ШІ позначив відгуків: 1\. Ще чекають перевірки: 2/)).toBeInTheDocument();
    expect(within(card).queryByText('Приховано')).not.toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: `Приховати відгук #${spam.id}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Приховати відгук?' });

    expect(within(dialog).getByLabelText(/Причина/)).toHaveValue('Реклама стороннього сайту');
  });

  it('помилка перевірки показується мовою інтерфейсу', async () => {
    backend.addFarmReview(5, 'Чудова ферма');
    backend.aiError = 'ai_failed';
    const { user } = await asAdmin();
    await user.click(await screen.findByRole('tab', { name: 'Відгуки' }));

    await user.click(await screen.findByRole('button', { name: 'Перевірити відгуки з ШІ' }));

    expect(await screen.findByText('ШІ зараз не відповідає. Спробуйте ще раз пізніше.')).toBeInTheDocument();
  });
});

describe('AI-9 Попередня перевірка документа', () => {
  const farmer = { ...farmProfile, id: 4, name: { uk: 'Еко-ферма «Сокільники»', en: 'Sokilnyky Eco Farm' }, verified: false, documentCount: 1 };
  const certificate = { id: 70, name: 'Сертифікат.pdf', contentType: 'application/pdf', size: 1024, uploadedAt: '2026-10-01T09:00:00+03:00' };

  async function openDocuments() {
    backend.pendingFarmers = [farmer];
    backend.documents = [certificate];
    const { user } = await asAdmin();
    await user.click(await screen.findByRole('button', { name: 'Документи: Еко-ферма «Сокільники»' }));
    return { user, dialog: await screen.findByRole('dialog') };
  }

  it('документ іде до ШІ лише після натискання, а результат - це підказка', async () => {
    const { user, dialog } = await openDocuments();

    const check = await within(dialog).findByRole('button', { name: 'Перевірити з ШІ' });
    expect(within(dialog).getByText(/лише після натискання кнопки/)).toBeInTheDocument();
    expect(backend.documentChecks).toEqual([]);
    await user.click(check);

    expect(await within(dialog).findByText('Назва не збігається')).toBeInTheDocument();
    expect(within(dialog).getByText('UA-77')).toBeInTheDocument();
    expect(within(dialog).getByText('Не вдалося прочитати')).toBeInTheDocument();
    expect(within(dialog).getByText('Це лише підказка. Рішення про верифікацію приймаєте ви.')).toBeInTheDocument();
    expect(backend.documentChecks).toEqual([70]);
  });

  it('без зауважень ШІ так і каже', async () => {
    const { user, dialog } = await openDocuments();
    backend.documentCheck = { ...backend.documentCheck, concerns: [] };

    await user.click(await within(dialog).findByRole('button', { name: 'Перевірити з ШІ' }));

    expect(await within(dialog).findByText('ШІ не знайшов зауважень.')).toBeInTheDocument();
  });

  it('помилка перевірки показується', async () => {
    const { user, dialog } = await openDocuments();
    backend.aiError = 'ai_invalid';

    await user.click(await within(dialog).findByRole('button', { name: 'Перевірити з ШІ' }));

    expect(await within(dialog).findByText(/Запит не можна опрацювати/)).toBeInTheDocument();
  });
});
