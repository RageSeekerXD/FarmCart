import type { LocalizedText } from '../../api/types';
import { distanceKm } from '../map/geo';
import type { GeoPoint } from './filters';

/**
 * Назва місця для точки покупця: «Львів, Сихів», «Винники» або «Стрий (околиці)».
 * Довідник вбудований у клієнт: координати покупця нікуди не надсилаються (FarmCart рахує відстані сам),
 * а точності району вистачає, щоб зрозуміти, від якої точки рахується відстань до ферм.
 */
interface Place {
  uk: string;
  en: string;
  lat: number;
  lon: number;
}

/** Райони й мікрорайони Львова. */
const LVIV: readonly Place[] = [
  { uk: 'центр', en: 'city centre', lat: 49.8419, lon: 24.0315 },
  { uk: 'Сихів', en: 'Sykhiv', lat: 49.7955, lon: 24.0565 },
  { uk: 'Левандівка', en: 'Levandivka', lat: 49.8455, lon: 23.9655 },
  { uk: 'Рясне', en: 'Riasne', lat: 49.8735, lon: 23.9505 },
  { uk: 'Збоїща', en: 'Zboishcha', lat: 49.8765, lon: 24.0345 },
  { uk: 'Голоско', en: 'Holosko', lat: 49.8835, lon: 24.0045 },
  { uk: 'Підзамче', en: 'Pidzamche', lat: 49.8545, lon: 24.0395 },
  { uk: 'Знесіння', en: 'Znesinnia', lat: 49.8505, lon: 24.0655 },
  { uk: 'Личаків', en: 'Lychakiv', lat: 49.8355, lon: 24.0605 },
  { uk: 'Новий Львів', en: 'Novyi Lviv', lat: 49.8255, lon: 23.9855 },
  { uk: 'Кульпарків', en: 'Kulparkiv', lat: 49.8095, lon: 23.9955 },
  { uk: 'Кастелівка', en: 'Kastelivka', lat: 49.8285, lon: 24.0195 },
  { uk: 'Боднарівка', en: 'Bodnarivka', lat: 49.8115, lon: 24.0115 },
  { uk: 'Привокзальна', en: 'Pryvokzalna', lat: 49.8395, lon: 23.9955 },
  { uk: 'Білогорща', en: 'Bilohorshcha', lat: 49.8305, lon: 23.9505 },
  { uk: 'Скнилів', en: 'Sknyliv', lat: 49.8155, lon: 23.9555 },
  { uk: 'Погулянка', en: 'Pohulianka', lat: 49.8285, lon: 24.0565 },
];

/** Міста й села довкола Львова, міста області та обласні центри України. */
const TOWNS: readonly Place[] = [
  { uk: 'Винники', en: 'Vynnyky', lat: 49.816, lon: 24.13 },
  { uk: 'Брюховичі', en: 'Briukhovychi', lat: 49.905, lon: 23.955 },
  { uk: 'Сокільники', en: 'Sokilnyky', lat: 49.791, lon: 23.979 },
  { uk: 'Зимна Вода', en: 'Zymna Voda', lat: 49.818, lon: 23.907 },
  { uk: 'Солонка', en: 'Solonka', lat: 49.771, lon: 23.958 },
  { uk: 'Давидів', en: 'Davydiv', lat: 49.756, lon: 24.128 },
  { uk: 'Дубляни', en: 'Dubliany', lat: 49.906, lon: 24.083 },
  { uk: 'Рудно', en: 'Rudno', lat: 49.857, lon: 23.874 },
  { uk: 'Оброшине', en: 'Obroshyne', lat: 49.787, lon: 23.877 },
  { uk: 'Пустомити', en: 'Pustomyty', lat: 49.716, lon: 23.905 },
  { uk: 'Жовква', en: 'Zhovkva', lat: 50.054, lon: 23.971 },
  { uk: 'Городок', en: 'Horodok', lat: 49.786, lon: 23.645 },
  { uk: 'Яворів', en: 'Yavoriv', lat: 49.938, lon: 23.383 },
  { uk: 'Новояворівськ', en: 'Novoiavorivsk', lat: 49.931, lon: 23.573 },
  { uk: 'Мостиська', en: 'Mostyska', lat: 49.795, lon: 23.15 },
  { uk: 'Самбір', en: 'Sambir', lat: 49.519, lon: 23.198 },
  { uk: 'Дрогобич', en: 'Drohobych', lat: 49.349, lon: 23.507 },
  { uk: 'Трускавець', en: 'Truskavets', lat: 49.278, lon: 23.506 },
  { uk: 'Стрий', en: 'Stryi', lat: 49.256, lon: 23.851 },
  { uk: 'Моршин', en: 'Morshyn', lat: 49.155, lon: 23.873 },
  { uk: 'Сколе', en: 'Skole', lat: 49.038, lon: 23.513 },
  { uk: 'Миколаїв', en: 'Mykolaiv', lat: 49.524, lon: 23.982 },
  { uk: 'Новий Розділ', en: 'Novyi Rozdil', lat: 49.471, lon: 24.137 },
  { uk: 'Жидачів', en: 'Zhydachiv', lat: 49.385, lon: 24.141 },
  { uk: 'Ходорів', en: 'Khodoriv', lat: 49.41, lon: 24.311 },
  { uk: 'Бібрка', en: 'Bibrka', lat: 49.64, lon: 24.288 },
  { uk: 'Перемишляни', en: 'Peremyshliany', lat: 49.669, lon: 24.556 },
  { uk: 'Глиняни', en: 'Hlyniany', lat: 49.823, lon: 24.507 },
  { uk: 'Золочів', en: 'Zolochiv', lat: 49.807, lon: 24.903 },
  { uk: 'Буськ', en: 'Busk', lat: 49.966, lon: 24.61 },
  { uk: 'Кам’янка-Бузька', en: 'Kamianka-Buzka', lat: 50.101, lon: 24.351 },
  { uk: 'Броди', en: 'Brody', lat: 50.083, lon: 25.147 },
  { uk: 'Радехів', en: 'Radekhiv', lat: 50.28, lon: 24.637 },
  { uk: 'Рава-Руська', en: 'Rava-Ruska', lat: 50.229, lon: 23.623 },
  { uk: 'Шептицький', en: 'Sheptytskyi', lat: 50.386, lon: 24.229 },
  { uk: 'Сокаль', en: 'Sokal', lat: 50.483, lon: 24.279 },
  { uk: 'Турка', en: 'Turka', lat: 49.153, lon: 23.031 },
  { uk: 'Київ', en: 'Kyiv', lat: 50.4501, lon: 30.5234 },
  { uk: 'Тернопіль', en: 'Ternopil', lat: 49.5535, lon: 25.5948 },
  { uk: 'Івано-Франківськ', en: 'Ivano-Frankivsk', lat: 48.9226, lon: 24.7111 },
  { uk: 'Луцьк', en: 'Lutsk', lat: 50.7472, lon: 25.3254 },
  { uk: 'Рівне', en: 'Rivne', lat: 50.6199, lon: 26.2516 },
  { uk: 'Ужгород', en: 'Uzhhorod', lat: 48.6208, lon: 22.2879 },
  { uk: 'Мукачево', en: 'Mukachevo', lat: 48.4392, lon: 22.7178 },
  { uk: 'Чернівці', en: 'Chernivtsi', lat: 48.2921, lon: 25.9358 },
  { uk: 'Хмельницький', en: 'Khmelnytskyi', lat: 49.4229, lon: 26.9871 },
  { uk: 'Вінниця', en: 'Vinnytsia', lat: 49.2331, lon: 28.4682 },
  { uk: 'Житомир', en: 'Zhytomyr', lat: 50.2547, lon: 28.6587 },
  { uk: 'Чернігів', en: 'Chernihiv', lat: 51.4982, lon: 31.2893 },
  { uk: 'Суми', en: 'Sumy', lat: 50.9077, lon: 34.7981 },
  { uk: 'Полтава', en: 'Poltava', lat: 49.5883, lon: 34.5514 },
  { uk: 'Черкаси', en: 'Cherkasy', lat: 49.4444, lon: 32.0598 },
  { uk: 'Кропивницький', en: 'Kropyvnytskyi', lat: 48.5079, lon: 32.2623 },
  { uk: 'Харків', en: 'Kharkiv', lat: 49.9935, lon: 36.2304 },
  { uk: 'Дніпро', en: 'Dnipro', lat: 48.4647, lon: 35.0462 },
  { uk: 'Запоріжжя', en: 'Zaporizhzhia', lat: 47.8388, lon: 35.1396 },
  { uk: 'Кривий Ріг', en: 'Kryvyi Rih', lat: 47.9105, lon: 33.3918 },
  { uk: 'Одеса', en: 'Odesa', lat: 46.4825, lon: 30.7233 },
  { uk: 'Миколаїв', en: 'Mykolaiv', lat: 46.975, lon: 31.9946 },
  { uk: 'Херсон', en: 'Kherson', lat: 46.6354, lon: 32.6169 },
];

/** Межі: мікрорайон Львова - до 3,5 км від його центру, місто чи село - до 7 км, «околиці» - до 40 км. */
const LVIV_KM = 3.5;
const TOWN_KM = 7;
const AREA_KM = 40;

export interface PlaceName {
  /** Назва обома мовами: «Львів, Сихів» / «Lviv, Sykhiv». */
  name: LocalizedText;
  /** Точка лише поблизу населеного пункту: інтерфейс показує «Стрий (околиці)». */
  near: boolean;
}

function nearest(places: readonly Place[], point: GeoPoint): { place: Place; km: number } {
  return places
    .map((place) => ({ place, km: distanceKm(point, place) }))
    .reduce((best, next) => (next.km < best.km ? next : best));
}

/** Найближчий район Львова чи населений пункт; null - точка далеко від усіх відомих місць. */
export function placeOf(point: GeoPoint): PlaceName | null {
  const district = nearest(LVIV, point);
  const town = nearest(TOWNS, point);
  if (district.km <= LVIV_KM && district.km <= town.km) {
    return { name: { uk: `Львів, ${district.place.uk}`, en: `Lviv, ${district.place.en}` }, near: false };
  }

  if (town.km <= TOWN_KM) {
    return { name: { uk: town.place.uk, en: town.place.en }, near: false };
  }

  // Околиця Львова поза його мікрорайонами - теж «Львів (околиці)».
  const closest = district.km < town.km ? { uk: 'Львів', en: 'Lviv', km: district.km } : { ...town.place, km: town.km };
  return closest.km <= AREA_KM ? { name: { uk: closest.uk, en: closest.en }, near: true } : null;
}
