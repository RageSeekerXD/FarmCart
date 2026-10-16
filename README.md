# FarmCart 1.0 - ядро платформи замовлення продуктів від локальних фермерів

Лабораторна робота № 2 з дисципліни «Методології розробки програмного забезпечення»: командна розробка
за стратегією екстремального програмування (XP). Продукт - проєкт B «FarmCart» з ЛР1 (вимоги B-FR-01…B-FR-13).

Реліз 1 охоплює серверну частину (REST API) для застосунків покупця, фермера, кур'єра й адміністратора:
вхід за кодом із SMS, верифікацію продавців, каталог фермера, пошук із фільтрами, кошик, оформлення з
промокодом, оплату токеном платіжного провайдера, обробку замовлення фермером, відстеження статусів із
push-сповіщеннями, вручення кур'єром за кодом, відгуки й журнал аудиту.

## Вимоги до середовища

- .NET SDK 10.0 (перевірено з 10.0.401): `dotnet --list-sdks`.
- Windows PowerShell 5.1 або PowerShell 7 - для скриптів `ci.cmd` і `demo.cmd`.

## Запуск

| Дія | Команда |
|---|---|
| Безперервна інтеграція: стандарт кодування, збірка без попереджень, усі тести, покриття ≥ 70 % | `ci.cmd` |
| Протокол роботи програми: сервер із демонстраційними даними + наскрізний сценарій | `demo.cmd` (результат у `docs/protocol`) |
| Лише тести | `dotnet test -c Release` |
| API з демонстраційними даними | `dotnet run --project src/FarmCart.Api -c Release`, далі http://localhost:5080/api/health |

Якщо Windows Smart App Control блокує щойно зібрану DLL (помилка `0x800711C7`), запускайте конфігурацію
Release (скрипти роблять це самі) або перезберіть рішення.

## Структура рішення

| Шлях | Призначення |
|---|---|
| `src/FarmCart.Core` | Доменна логіка: сервіси історій користувачів, сховище в пам'яті, тестові двійники зовнішніх сервісів |
| `src/FarmCart.Api` | ASP.NET Core Minimal API, проміжне ПЗ (журнал запитів, помилки, захист від номерів карток), демонстраційні дані |
| `tests/FarmCart.Core.Tests` | Модульні тести (xUnit), написані за TDD |
| `tests/FarmCart.AcceptanceTests` | Приймальні тести замовника: по класу на історію, через HTTP API (`WebApplicationFactory`) |
| `tools/FarmCart.Demo` | Демонстраційний клієнт, що проходить сценарій релізу й друкує протокол |
| `ci.ps1` / `ci.cmd` | Скрипт безперервної інтеграції |
| `coverage.runsettings` | Покриття Microsoft Code Coverage з динамічною інструментацією (без переписування збірок на диску) |
| `demo.ps1` / `demo.cmd` | Отримання протоколу роботи програми |
| `docs/evidence` | Артефакти XP: цикли TDD, дефекти, рефакторинг, журнали CI |

## Основні маршрути API

| Метод і шлях | Історія | Хто викликає |
|---|---|---|
| `POST /api/auth/code`, `POST /api/auth/verify` | US-01 | усі |
| `POST /api/farmers`, `GET/POST /api/farmer/products`, `PATCH /api/farmer/products/{id}` | US-02, US-03 | фермер |
| `GET /api/catalog?category=&certified=&lat=&lon=&maxKm=&minPrice=&maxPrice=&sort=` | US-04 | покупець |
| `GET /api/cart`, `POST /api/cart/items`, `GET /api/slots`, `POST /api/orders` (`Idempotency-Key`) | US-05, US-06 | покупець |
| `GET /api/farmer/orders`, `POST /api/farmer/orders/{id}/accept`, `.../reject` | US-07 | фермер |
| `.../assemble`, `.../handover`, `GET /api/me/notifications` | US-08 | фермер, покупець |
| `GET /api/courier/deliveries`, `POST /api/courier/deliveries/{id}/confirm` | US-09 | кур'єр |
| `POST /api/orders/{id}/review`, `GET /api/farmers/{id}/reviews` | US-10 | покупець |
| `GET /api/admin/farmers/pending`, `POST /api/admin/...`, `GET /api/admin/audit` | US-02, B-FR-12 | адміністратор |

## Демонстраційні облікові записи (режим розробки)

| Телефон | Роль |
|---|---|
| +380500000001 | адміністратор |
| +380671110001 | фермер «Зелений Гай» |
| +380671110002 | сироварня «Карпатська бринза» |
| +380671110003 | пасіка «Медовий шлях» |
| +380671110004 | «Еко-ферма «Сокільники»» (ще не верифікована) |
| +380631230001 | кур'єр |

У режимі розробки `POST /api/auth/code` повертає код у полі `devCode`, бо SMS не надсилаються.
Платіжні токени пісочниці: `tok_visa`, `tok_mastercard`, `tok_applepay`, `tok_googlepay` - успіх;
`tok_declined` - відмова банку. Промокод `FARM10`: -10 % від 300 грн.
