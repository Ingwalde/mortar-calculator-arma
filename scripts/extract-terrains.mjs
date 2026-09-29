// Джерела:
//  - Планшет-мінометника.html (прототип): id/name/size/sizeZ/tiles/mod/places для кожного терену.
//  - GeNeFRAG/ArmaReforger, maps_core/all_arma_maps.json (MIT): resources.map_image (те саме,
//    що й "sat" у прототипі — звірено побайтово) і resources.height_data (лише 10 із 23 теренів).
//    https://github.com/GeNeFRAG/ArmaReforger/blob/main/maps_core/all_arma_maps.json
//  - EnfusionMapMaker, Web/everon/everon-locations.js і Web/arland/arland-locations.js (APL-SA):
//    назви й координати пунктів Everon/Arland — перенесено з прототипу (уже містив ці дані).
//
// Прототипів id "kolguyev" немає в репозиторії GeNeFRAG (там namespace "kolguev", без "y") —
// зіставлення нижче враховує цю розбіжність написання.
//
// УВАГА: reforger.recoil.org з часу написання прототипу змінив структуру сайту (SvelteKit).
// Стара схема "{terrain}/LODS/{lod}/{x}/{y}/tile.jpg" тепер віддає 404 (SPA-фолбек).
// Перевірено вручну через мережеві запити реальної сторінки: чинна схема —
// "map-tiles/{terrain}/{lod}/{x}/{y}/tile.jpg", і Arland тепер теж має maxLod=5 (не 4,
// як було зафіксовано в прототипі й у завданні) — на сайті знайдено тайли lod 1..5 для Arland,
// lod 0..5 для Everon. Розмір тайла в пікселях також змінився (не 256, а ~542px), але це не
// впливає на математику SPAN0 (вона про метри світу на тайл, а не про роздільність файлу).
import { writeFileSync } from "node:fs";

const ALL_MAPS_URL =
  "https://raw.githubusercontent.com/GeNeFRAG/ArmaReforger/main/maps_core/all_arma_maps.json";

// Терени з каталогу GeNeFRAG (є супутниковий знімок і, для деяких, дані висот).
// 1:1 перенесено з масиву PRESETS у прототипі, звужено до вибраних користувачем мап.
const BASE = [
  {
    id: "everon", name: "Everon", sizeX: 12800, sizeZ: 12800, official: true,
    tiles: { base: "https://reforger.recoil.org/map-tiles/everon/", maxLod: 5 },
    places: [["Airport",4893,11801],["St Phillipe",4501,10776],["Power Plant",5827,9787],["St Pierre",9689,1558],["Meaux",4518,9468],["Tyrone",4949,9076],["Andres Beacon",6844,8191],["Gravette",4128,7792],["Villeneuve",2847,6340],["Morton",5137,4010],["Lamentin",1281,5947],["Chotain",7088,6012],["Montignac",4776,7087],["Provins",5488,6083],["Figari",5256,5341],["Camurac",6594,3117],["Quarry",8787,3913],["Regina",7188,2312],["Durras",8826,2746],["Farm",5010,9964],["Gorey",4845,8089],["Sawmill",3114,5222],["Chotain Industrial",6456,6487],["Hillside",6918,4450],["Coastal Base Chotain",7444,6698],["Military Base Levie",7477,4302],["Military Hospital",3905,8450],["Coastal Base Lamentin",1063,6048],["Coastal Base Morton",4957,3876]]
  },
  {
    id: "arland", name: "Arland", sizeX: 4095, sizeZ: 4095, official: true,
    tiles: { base: "https://reforger.recoil.org/map-tiles/arland/", maxLod: 5 },
    places: [["Beauregard",3169,2796],["Farm",2209,2909],["Airport Base",947,2896],["Military Training Base",1413,1858],["Arleville",2777,1624],["Moss Hill",2293,1224],["Signal Hill",2507,2267]]
  },
  {
    id: "kolguyev", name: "Kolguyev", sizeX: 12800, sizeZ: 12800, official: true,
    // reforger.recoil.org тримає Kolguyev під внутрішнім кодовим ім'ям "cain" (перевірено
    // мережевими запитами реальної сторінки /kolguyev — не "kolguyev"/"kolguev"). Онлайн-тайли
    // тут візуально чистіші за 2.4 ГБ PNG з GeNeFRAG (той має видимий шов різної експозиції
    // між знімками — перевірено складанням тайлів піраміди напряму з диска).
    tiles: { base: "https://reforger.recoil.org/map-tiles/cain/", maxLod: 5 }
  },
  { id: "badorb", name: "Bad Orb", sizeX: 5120, sizeZ: 5120, official: false },
  { id: "gogland", name: "Gogland", sizeX: 12286, sizeZ: 12286, official: false }
];

// Мод-карти поза каталогом GeNeFRAG — немає ні супутникового знімка, ні даних висот, ні
// підтвердженого точного розміру. Перевірено вручну (браузер, вересень 2026): жодна з цих
// чотирьох воркшоп-сторінок не публікує top-down супутниковий знімок терену — лише один
// рекламний 3D-скріншот під кутом, непридатний для прив'язки координатної сітки. Розміри
// нижче — НАЙКРАЩА ОЦІНКА, позначена як така; користувач має звірити й поправити в вкладці
// «Карта» (поле розміру чи прив'язка по двох точках), перш ніж довіряти сітці координат.
// Карту зображення треба буде завантажити вручну («Завантажити карту», власний скріншот
// зверху з редактора чи гри) — автоімпорту з мережі для цих теренів нема.
const MANUAL = [
  {
    id: "bystrany", name: "Bystrany", sizeX: 5000, sizeZ: 5000, official: false
    // https://reforger.armaplatform.com/workshop/6626CB89B6B9C913 — офіційний опис каже
    // "~25 км² завершеної площі" (перевірено); 5000x5000 м = 25 км² при припущенні
    // квадратної форми (форма терену не квадратна, тож це наближення).
  },
  {
    id: "ironholdcastle", name: "Iron Hold Castle", sizeX: 10240, sizeZ: 10240, official: false
    // https://reforger.armaplatform.com/workshop/697F774C5FD21619-IronHoldCastle (автор
    // WoodyCracudo) — маленька острівна фортеця-архіпелаг ("ancient ocean fortress"), пакунок
    // лише 12.93 МБ. Це натякає на терен значно менший за 10240x10240 (100 км²!), але розмір
    // архіву не є надійним доказом розміру терену (текстури/матеріали можуть братися з
    // базової гри) — 10240 лишено як недоведену заглушку, ОБОВ'ЯЗКОВО поправити вручну.
  },
  {
    id: "kirovograd", name: "Kirovograd", sizeX: 10240, sizeZ: 10240, official: false
    // Реальна назва на воркшопі — "Chernorus_Kirovograd" (автор knisez, ID 6608D15676B2EACC,
    // https://reforger.armaplatform.com/workshop/6608D15676B2EACC-Chernorus_Kirovograd) —
    // регіон реального Чернаруса (Kirovograd, північ від Приморська), ще не завершений.
    // Розмір на сторінці не вказано (не повний Чернарус, лише його частина) — 10240 недоведено.
  }
];

const NAMESPACE_OVERRIDE = { kolguyev: "kolguev" };

const res = await fetch(ALL_MAPS_URL);
if (!res.ok) throw new Error(`Не вдалося завантажити ${ALL_MAPS_URL}: ${res.status}`);
const allMaps = await res.json();
const byNamespace = new Map(allMaps.map((m) => [m.namespace, m]));

const fromCatalog = BASE.map((t) => {
  const ns = NAMESPACE_OVERRIDE[t.id] ?? t.id;
  const src = byNamespace.get(ns);
  if (!src) throw new Error(`Терен "${t.id}" (namespace "${ns}") відсутній у all_arma_maps.json`);
  if (src.size[0] !== t.sizeX || src.size[1] !== t.sizeZ) {
    throw new Error(
      `Розмір "${t.id}" розходиться з all_arma_maps.json: маю ${t.sizeX}x${t.sizeZ}, там ${src.size[0]}x${src.size[1]}`
    );
  }
  return {
    ...t,
    mapImage: src.resources.map_image,
    heightData: src.resources.height_data ?? null
  };
});

const out = [...fromCatalog, ...MANUAL];

writeFileSync(
  new URL("../src/core/terrains-data.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n"
);
console.log(`Записано src/core/terrains-data.json: ${out.length} теренів.`);
