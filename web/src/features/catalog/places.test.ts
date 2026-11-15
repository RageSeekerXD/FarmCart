import { describe, expect, it } from 'vitest';
import { LVIV_CENTER } from './filters';
import { placeOf } from './places';

describe('назва місця покупця', () => {
  it('у Львові - місто й мікрорайон', () => {
    expect(placeOf({ lat: 49.7962, lon: 24.0578 })).toEqual({ name: { uk: 'Львів, Сихів', en: 'Lviv, Sykhiv' }, near: false });
    expect(placeOf(LVIV_CENTER)?.name.uk).toBe('Львів, центр');
    expect(placeOf({ lat: 49.8745, lon: 23.951 })?.name.en).toBe('Lviv, Riasne');
  });

  it('у передмісті - назва міста чи села', () => {
    expect(placeOf({ lat: 49.818, lon: 24.132 })).toEqual({ name: { uk: 'Винники', en: 'Vynnyky' }, near: false });
    expect(placeOf({ lat: 50.055, lon: 23.97 })?.name.uk).toBe('Жовква');
  });

  it('між населеними пунктами - найближчий з позначкою «околиці»', () => {
    expect(placeOf({ lat: 49.33, lon: 23.7 })).toEqual({ name: { uk: 'Стрий', en: 'Stryi' }, near: true });
  });

  it('обласні центри України теж упізнаються', () => {
    expect(placeOf({ lat: 50.45, lon: 30.52 })?.name.en).toBe('Kyiv');
  });

  it('далеко від усіх відомих місць назви немає', () => {
    expect(placeOf({ lat: 52.23, lon: 21.01 })).toBeNull();
  });
});
