using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Демонстраційні дані (режим розробки): фермери Львівщини, товари, слоти, промокод, кур'єр і адміністратор.</summary>
public static class DemoData
{
    public static void Seed(IServiceProvider services)
    {
        var store = services.GetRequiredService<InMemoryStore>();
        var farmers = services.GetRequiredService<FarmerService>();
        var now = services.GetRequiredService<IClock>().Now;

        store.AddUser("+380500000001", "Адміністратор FarmCart", Role.Admin);
        store.AddUser("+380631230001", "Андрій Шевчук", Role.Courier);

        var green = Farm("+380671110001", "Олена Коваль", "Ферма «Зелений Гай»", new GeoPoint(49.8160, 24.1300), certified: true);
        var cheese = Farm("+380671110002", "Іван Гуцуляк", "Сироварня «Карпатська бринза»", new GeoPoint(49.9000, 23.9600), certified: false);
        var honey = Farm("+380671110003", "Марія Бойко", "Пасіка «Медовий шлях»", new GeoPoint(49.7170, 23.9100), certified: true);
        Farm("+380671110004", "Тарас Мельник", "Еко-ферма «Сокільники»", new GeoPoint(49.8000, 23.9800), certified: true, verified: false);

        // Сценарій замовлення (demo.cmd) купує лише цілорічні товари, тож проходить у будь-який день року (DEF-03).
        // Сезонні яблука (серпень-березень) і полуниця (травень-липень) показують правило сезонності:
        // у кожному місяці щонайменше один із них поза сезоном і прихований у каталозі.
        Product(green, "Яблука «Голден»", "Фрукти", "кг", 32m, 150, 8, 9, 10, 11, 12, 1, 2, 3);
        Product(green, "Картопля", "Овочі", "кг", 18m, 300);
        Product(green, "Морква", "Овочі", "кг", 16m, 200);
        Product(green, "Полуниця", "Ягоди", "кошик 0,5 кг", 95m, 40, 5, 6, 7);
        Product(cheese, "Бринза овеча", "Молочні продукти", "0,5 кг", 165m, 30);
        Product(cheese, "Молоко коров'яче", "Молочні продукти", "л", 38m, 60);
        Product(cheese, "Сир «Гірський»", "Молочні продукти", "0,3 кг", 210m, 25);
        Product(honey, "Мед липовий", "Мед", "л", 290m, 20);
        Product(honey, "Мед гречаний", "Мед", "банка 0,5 л", 170m, 15);

        var tomorrow = new DateTimeOffset(now.Date.AddDays(1), now.Offset);
        Slot(tomorrow.AddHours(10), capacity: 3);
        Slot(tomorrow.AddHours(12), capacity: 3);
        Slot(tomorrow.AddHours(18), capacity: 2);
        store.PromoCodes.Add("FARM10", new PromoCode("FARM10", 10, 300m, now.AddDays(30)));

        User Farm(string phone, string owner, string farmName, GeoPoint location, bool certified, bool verified = true)
        {
            var user = store.AddUser(phone, owner);
            farmers.Register(user, farmName, location, certified, documents: $"docs/{phone}.pdf").Verified = verified;
            return user;
        }

        void Product(User farmer, string name, string category, string unit, decimal price, int stock, params int[] season) =>
            farmers.AddProduct(farmer, new ProductDraft(name, category, unit, price, stock, season));

        void Slot(DateTimeOffset start, int capacity)
        {
            var slot = new DeliverySlot(store.NextId<DeliverySlot>(), start, start.AddHours(2), capacity);
            store.Slots.Add(slot.Id, slot);
        }
    }
}
