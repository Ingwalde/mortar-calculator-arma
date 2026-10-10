export type Lang = "uk" | "en";

type Dict = Record<string, { uk: string; en: string }>;

const DICT: Dict = {
  appTitle: { uk: "Планшет мінометника", en: "Mortar Tablet" },
  statusSaved: { uk: "Мітки збережено на цьому пристрої", en: "Marks are saved on this device" },
  langToggle: { uk: "EN", en: "UA" },

  terrainAriaLabel: { uk: "Терен", en: "Terrain" },
  markTypeAria: { uk: "Тип мітки", en: "Mark type" },
  canvasAriaLabel: {
    uk: "Карта. Перетягуйте, щоб рухати; колесо — масштаб; клік — навести приціл.",
    en: "Map. Drag to pan; wheel to zoom; click to move the crosshair."
  },
  zoomInAria: { uk: "Наблизити", en: "Zoom in" },
  zoomOutAria: { uk: "Віддалити", en: "Zoom out" },
  fitAria: { uk: "Уся карта", en: "Fit whole map" },
  placeBtn: { uk: "Поставити мітку", en: "Place mark" },
  fixPointBtn: { uk: "Зафіксувати точку {k}", en: "Fix point {k}" },
  unitM: { uk: "м", en: "m" },

  tabMarks: { uk: "Мітки", en: "Marks" },
  tabFire: { uk: "Розрахунок", en: "Solution" },
  tabLog: { uk: "Журнал", en: "Log" },
  tabSetup: { uk: "Карта", en: "Map" },

  folderLabel: { uk: "Папка / місія", en: "Folder / mission" },
  allFolders: { uk: "Усі папки", en: "All folders" },
  noFolder: { uk: "Без місії", en: "No mission" },
  addManualBtn: { uk: "Додати за координатами", en: "Add by coordinates" },
  emptyListFiltered: {
    uk: "У цій папці міток немає. Виберіть іншу або «Усі папки».",
    en: "No marks in this folder. Pick another one or “All folders”."
  },
  emptyListNone: {
    uk: "Міток ще немає. Наведіть приціл на місце на карті й натисніть «Поставити мітку».",
    en: "No marks yet. Aim the crosshair at a spot on the map and press “Place mark”."
  },
  badgeMortar: { uk: "М", en: "M" },
  badgeTarget: { uk: "Ц", en: "T" },
  badgePoint: { uk: "Т", en: "P" },
  copyBtn: { uk: "Копіювати", en: "Copy" },
  editBtn: { uk: "Змінити", en: "Edit" },
  copied: { uk: "Скопійовано", en: "Copied" },
  copyFromField: { uk: "Скопіюйте текст із поля", en: "Copy the text from the field" },

  typeMortar: { uk: "Міномет", en: "Mortar" },
  typeTarget: { uk: "Ціль", en: "Target" },
  typePoint: { uk: "Точка", en: "Point" },
  weaponM252: { uk: "M252 (США, 81 мм)", en: "M252 (US, 81 mm)" },
  weapon2B14: { uk: "2Б14 «Піднос» (82 мм)", en: "2B14 “Podnos” (82 mm)" },
  weaponShortM252: { uk: "M252", en: "M252" },
  weaponShort2B14: { uk: "2Б14", en: "2B14" },
  shellHE: { uk: "Осколково-фугасний", en: "High-Explosive" },
  shellSmoke: { uk: "Димовий", en: "Smoke" },
  shellIllumination: { uk: "Освітлювальний", en: "Illumination" },

  dlgTitleNew: { uk: "Нова мітка", en: "New mark" },
  dlgTitleEdit: { uk: "Змінити мітку", en: "Edit mark" },
  fieldName: { uk: "Назва", en: "Name" },
  fieldGrid: { uk: "Сітка (напр. 0483 1172) — заповнить X і Z", en: "Grid (e.g. 0483 1172) — fills X and Z" },
  fieldX: { uk: "X, м (схід)", en: "X, m (east)" },
  fieldZ: { uk: "Z, м (північ)", en: "Z, m (north)" },
  fieldHeight: { uk: "Висота, м", en: "Height, m" },
  heightOptional: { uk: "необов'язково", en: "optional" },
  heightDetermining: { uk: "визначається…", en: "detecting…" },
  heightUnknown: { uk: "невідомо — вкажіть вручну", en: "unknown — enter manually" },
  fieldFolder: { uk: "Папка / місія", en: "Folder / mission" },
  folderPlaceholder: { uk: "без місії", en: "no mission" },
  deleteBtn: { uk: "Видалити", en: "Delete" },
  cancelBtn: { uk: "Скасувати", en: "Cancel" },
  saveBtn: { uk: "Зберегти", en: "Save" },
  fillXZorGrid: { uk: "Вкажіть X і Z або сітку", en: "Enter X and Z, or a grid reference" },
  markDeleted: { uk: "Мітку видалено", en: "Mark deleted" },
  markSaved: { uk: "Мітку збережено", en: "Mark saved" },
  markAdded: { uk: "Мітку додано", en: "Mark added" },
  aimAndFix: { uk: "Наведіть приціл на точку {k} і натисніть кнопку під картою", en: "Aim at point {k} and press the button under the map" },
  pointFixed: { uk: "Точку {k} зафіксовано — впишіть її координати", en: "Point {k} fixed — enter its coordinates" },

  centerName: { uk: "Центр прицілу", en: "Crosshair center" },
  centerOption: { uk: "Центр прицілу на карті", en: "Crosshair center on map" },
  fireFolderMortar: { uk: "Папка мінометів", en: "Mortar folder" },
  fireFolderTarget: { uk: "Папка цілей", en: "Target folder" },
  aboutAria: { uk: "Про програму", en: "About" },
  closeBtn: { uk: "Закрити", en: "Close" },
  copyManualTitle: { uk: "Скопіюйте вручну", en: "Copy manually" },
  copyManualLabel: { uk: "Виділіть і скопіюйте текст", en: "Select and copy the text" },
  immersiveAria: { uk: "Карта на весь екран", en: "Full-screen map" },
  immersiveExitAria: { uk: "Повернути інтерфейс", en: "Show interface" },
  noMortars: { uk: "Немає мінометів", en: "No mortars" },
  fireEmpty: {
    uk: "Додайте мітку типу «Міномет» — тоді тут з'являться азимут, заряд і кут підвищення.",
    en: "Add a “Mortar”-type mark — bearing, charge and elevation will appear here."
  },
  cellAzimuthMils: { uk: "Азимут, мілі ({circle})", en: "Bearing, mils ({circle})" },
  cellElevationMilsCharge: { uk: "Підвищення, мілі (заряд {c})", en: "Elevation, mils (charge {c})" },
  cellElevationMils: { uk: "Підвищення, мілі", en: "Elevation, mils" },
  cellRange: { uk: "Дальність", en: "Range" },
  cellAzimuth: { uk: "Азимут", en: "Bearing" },
  cellHeightDiff: { uk: "Перевищення", en: "Height diff." },
  outOfRange: { uk: "Поза досяжністю {weapon} для цього снаряда: від {min} до {max} м.", en: "Out of range for {weapon} with this shell: {min} to {max} m." },
  colCharge: { uk: "Заряд", en: "Charge" },
  colTof: { uk: "Політ, с", en: "Flight, s" },
  bestChargeNote: { uk: "★ — найменший заряд, що дістає: найточніший варіант.", en: "★ — the smallest charge that reaches: the most accurate option." },
  noHeightNote: { uk: ". Без висот поправку на перевищення не враховано.", en: ". Without heights, the elevation-difference correction is not applied." },
  colRangeM: { uk: "Дальність, м", en: "Range, m" },
  colDeltaPer100: { uk: "Δ на 100 м висоти", en: "Δ per 100 m height" },
  tableCaption: { uk: "{weapon}, {shell} ({shellName}), заряд {level}. Виділено рядок, найближчий до поточної дальності.", en: "{weapon}, {shell} ({shellName}), charge {level}. Highlighted row is closest to the current range." },
  fireLabelMortar: { uk: "Міномет", en: "Mortar" },
  fireLabelTarget: { uk: "Ціль", en: "Target" },
  fireLabelShell: { uk: "Снаряд", en: "Shell" },
  fireTableSummary: { uk: "Таблиця стрільби", en: "Firing table" },
  fireLabelCharge: { uk: "Заряд", en: "Charge" },
  fireHint: {
    uk: "Кут підвищення враховує перевищення цілі, якщо в обох мітках указано висоту. Таблиці: {link}, MIT.",
    en: "Elevation accounts for target height difference when both marks have a height set. Tables: {link}, MIT."
  },

  mapImageHeading: { uk: "Зображення карти", en: "Map image" },
  mapImageHint: {
    uk: "Завантажте скріншот або супутникову карту терену. Без зображення працює порожня сітка — мітки можна ставити за координатами.",
    en: "Upload a screenshot or satellite image of the terrain. Without an image, a blank grid works fine — marks can still be placed by coordinates."
  },
  pickFileBtn: { uk: "Завантажити карту…", en: "Upload map…" },
  downloadImportBtn: { uk: "Завантажити й імпортувати", en: "Download and import" },
  clearMapBtn: { uk: "Прибрати карту", en: "Remove map" },
  showPlacesLabel: { uk: "Показувати назви пунктів", en: "Show place names" },
  placesHint: {
    uk: "Назви пунктів Everon та Arland: {link1} (APL-SA). Супутникові карти й дані висот: {link2} (MIT).",
    en: "Everon and Arland place names: {link1} (APL-SA). Satellite maps and height data: {link2} (MIT)."
  },
  delTerrainBtn: { uk: "Видалити цей терен зі списку", en: "Remove this terrain from the list" },
  coordBindingHeading: { uk: "Прив'язка координат", en: "Coordinate binding" },
  coordBindingAria: { uk: "Спосіб прив'язки", en: "Binding method" },
  modeSizeBtn: { uk: "Уся карта", en: "Whole map" },
  modePtsBtn: { uk: "Дві точки", en: "Two points" },
  sizeHint: {
    uk: "Зображення охоплює весь терен від лівого нижнього кута (0, 0). Вкажіть розмір терену в метрах.",
    en: "The image covers the whole terrain starting at the bottom-left corner (0, 0). Enter the terrain size in meters."
  },
  fieldSizeX: { uk: "Ширина X, м", en: "Width X, m" },
  fieldSizeZ: { uk: "Висота Z, м", en: "Height Z, m" },
  labelXm: { uk: "X, м", en: "X, m" },
  labelZm: { uk: "Z, м", en: "Z, m" },
  presetSizeBtn: { uk: "Стандарт", en: "Default" },
  ptsHint: {
    uk: "Наведіть приціл на точку, координати якої знаєте (перетин ліній сітки, кут квадрата), зафіксуйте її і впишіть координати. Дві точки мають бути далеко одна від одної по обох осях.",
    en: "Aim the crosshair at a point whose coordinates you know (a grid intersection, a square's corner), fix it, then enter its coordinates. The two points should be far apart on both axes."
  },
  backupHeading: { uk: "Резервна копія", en: "Backup" },
  backupHint: {
    uk: "Мітки зберігаються автоматично. Тут можна скопіювати їх як текст або вставити раніше скопійовані.",
    en: "Marks are saved automatically. Here you can copy them as text or paste previously copied ones."
  },
  jsonPlaceholder: { uk: "Вставте JSON, щоб імпортувати", en: "Paste JSON here to import" },
  copyMarksBtn: { uk: "Копіювати мітки", en: "Copy marks" },
  importBtn: { uk: "Імпортувати", en: "Import" },
  wipeBtn: { uk: "Видалити всі мітки", en: "Delete all marks" },
  importedNotMarks: { uk: "Не схоже на скопійовані мітки — перевірте текст", en: "Doesn't look like copied marks — check the text" },
  importedCount: { uk: "Імпортовано міток: {n}", en: "Marks imported: {n}" },
  wipeTitle: { uk: "Видалити всі мітки?", en: "Delete all marks?" },
  wipeText: { uk: "Буде видалено міток: {n} на терені {terrain}.", en: "{n} marks on {terrain} will be deleted." },

  sheetToggleAria: { uk: "Згорнути/розгорнути панель", en: "Collapse/expand panel" },
  lanHeading: { uk: "Перегляд з телефона", en: "Phone view" },
  lanHint: {
    uk: "ПК віддає планшет у локальній мережі: відкрийте посилання або відскануйте QR на телефоні (та сама Wi-Fi). Мітки, журнал і карта спільні; розрахунок і вибір цілі на кожному пристрої свої.",
    en: "This PC serves the tablet on your local network: open the link or scan the QR on your phone (same Wi-Fi). Marks, log and map are shared; the solution and target choice stay per-device."
  },
  lanToggleLabel: { uk: "Доступ з локальної мережі", en: "Local network access" },
  lanQrAria: { uk: "QR-код посилання", en: "Link QR code" },
  lanUrlAria: { uk: "Посилання для телефона", en: "Link for the phone" },
  lanCopyBtn: { uk: "Копіювати посилання", en: "Copy link" },
  lanCopied: { uk: "Посилання скопійовано", en: "Link copied" },
  lanRegenBtn: { uk: "Новий ключ", en: "New key" },
  lanRegenTitle: { uk: "Створити новий ключ доступу?", en: "Create a new access key?" },
  lanRegenText: { uk: "Старі посилання й QR-коди перестануть працювати — телефон треба буде підключити знову.", en: "Old links and QR codes will stop working — the phone must be connected again." },
  lanRegenDone: { uk: "Новий ключ створено", en: "New key created" },
  lanNoNetwork: { uk: "Не знайдено мережевого підключення — підключіться до Wi-Fi чи Ethernet.", en: "No network connection found — connect to Wi-Fi or Ethernet." },
  lanSecurity: {
    uk: "Будь-хто в цій мережі з посиланням бачить і змінює мітки. Не вмикайте в чужих мережах. Брандмауер Windows при першому вмиканні спитає дозвіл — оберіть «Приватні мережі».",
    en: "Anyone on this network with the link can see and edit marks. Do not enable on networks you do not trust. Windows Firewall will ask for permission the first time — choose Private networks."
  },
  lanError: { uk: "Не вдалося запустити сервер: {msg}", en: "Could not start the server: {msg}" },

  pointLabel: { uk: "Точка {k}", en: "Point {k}" },
  pointNotFixed: { uk: " — не зафіксована", en: " — not fixed" },
  refixBtn: { uk: "Перезафіксувати", en: "Re-fix" },
  aimBtn: { uk: "Навести приціл", en: "Aim crosshair" },

  groupOfficial: { uk: "Офіційні", en: "Official" },
  groupMods: { uk: "Мод-карти", en: "Mod maps" },
  groupCustom: { uk: "Мої", en: "Mine" },
  addOtherTerrain: { uk: "+ Інший терен…", en: "+ Other terrain…" },
  otherTerrainTitle: { uk: "Інший терен", en: "Other terrain" },
  otherTerrainText: { uk: "Для терену з моду. Розмір можна змінити пізніше у вкладці «Карта».", en: "For a mod terrain. The size can be changed later in the “Map” tab." },
  addBtn: { uk: "Додати", en: "Add" },
  fieldTerrainName: { uk: "Назва", en: "Name" },
  fieldTerrainSize: { uk: "Розмір, м", en: "Size, m" },
  terrainAdded: { uk: "Додано «{name}» — завантажте для нього карту", en: "Added “{name}” — upload a map for it" },
  delTerrainTitle: { uk: "Видалити терен?", en: "Delete terrain?" },
  delTerrainText: { uk: "«{name}» зникне зі списку разом з мітками і картою.", en: "“{name}” will disappear from the list along with its marks and map." },

  aboutHtml: {
    uk: `<h2>Про програму</h2>
    <p class="hint">Планшет мінометника для Arma Reforger. Некомерційний застосунок для особистого й ігрового використання.</p>
    <h2>Джерела й атрибуція</h2>
    <p class="hint"><b>EnfusionMapMaker</b> (nickludlam) — назви й координати пунктів Everon/Arland, схема онлайн-тайлів.
      Ліцензія: <a href="https://github.com/nickludlam/EnfusionMapMaker/blob/main/LICENSE" target="_blank" rel="noopener">APL-SA</a> (некомерційна, з атрибуцією).
      <a href="https://github.com/nickludlam/EnfusionMapMaker" target="_blank" rel="noopener">github.com/nickludlam/EnfusionMapMaker</a></p>
    <p class="hint"><b>GeNeFRAG/ArmaReforger</b> — балістичні таблиці M252/2Б14, розміри теренів, супутникові знімки, дані висот.
      Ліцензія: <a href="https://github.com/GeNeFRAG/ArmaReforger/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a>.
      <a href="https://github.com/GeNeFRAG/ArmaReforger" target="_blank" rel="noopener">github.com/GeNeFRAG/ArmaReforger</a></p>
    <p class="hint"><b>reforger.recoil.org</b> — джерело онлайн-тайлів Everon і Arland.</p>`,
    en: `<h2>About</h2>
    <p class="hint">A mortar tablet for Arma Reforger. Non-commercial app for personal and in-game use.</p>
    <h2>Sources and attribution</h2>
    <p class="hint"><b>EnfusionMapMaker</b> (nickludlam) — Everon/Arland place names and coordinates, the online-tile scheme.
      License: <a href="https://github.com/nickludlam/EnfusionMapMaker/blob/main/LICENSE" target="_blank" rel="noopener">APL-SA</a> (non-commercial, share-alike).
      <a href="https://github.com/nickludlam/EnfusionMapMaker" target="_blank" rel="noopener">github.com/nickludlam/EnfusionMapMaker</a></p>
    <p class="hint"><b>GeNeFRAG/ArmaReforger</b> — M252/2B14 ballistic tables, terrain sizes, satellite images, height data.
      License: <a href="https://github.com/GeNeFRAG/ArmaReforger/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a>.
      <a href="https://github.com/GeNeFRAG/ArmaReforger" target="_blank" rel="noopener">github.com/GeNeFRAG/ArmaReforger</a></p>
    <p class="hint"><b>reforger.recoil.org</b> — source of Everon and Arland online tiles.</p>`
  },

  importPhaseDownload: { uk: "Завантаження зображення", en: "Downloading image" },
  importPhaseTiling: { uk: "Нарізка на тайли", en: "Slicing into tiles" },
  importProgress: { uk: "{phase}: {pct}% ({done}/{total})", en: "{phase}: {pct}% ({done}/{total})" },
  downloading: { uk: "Завантаження…", en: "Downloading…" },
  processingMap: { uk: "Обробка карти…", en: "Processing map…" },
  downloadImportFailed: { uk: "Не вдалося завантажити й імпортувати карту «{name}»", en: "Failed to download and import map “{name}”" },
  downloadImportOk: { uk: "Карту «{name}» завантажено й імпортовано", en: "Map “{name}” downloaded and imported" },
  errorPrefix: { uk: "Помилка: {msg}", en: "Error: {msg}" },
  importCancelled: { uk: "Імпорт скасовано", en: "Import cancelled" },
  importFailed: { uk: "Не вдалося імпортувати карту", en: "Failed to import map" },
  mapImported: { uk: "Карту імпортовано", en: "Map imported" },
  importErrorPrefix: { uk: "Помилка імпорту: {msg}", en: "Import error: {msg}" },
  mapRemoved: { uk: "Карту прибрано", en: "Map removed" },

  yes: { uk: "Так", en: "Yes" },

  saveToLogBtn: { uk: "Записати в журнал", en: "Save to log" },
  savedToLog: { uk: "Записано в журнал", en: "Saved to log" },
  logEmpty: { uk: "Журнал порожній. Натисніть «Записати в журнал» на вкладці «Розрахунок».", en: "The log is empty. Press “Save to log” on the Solution tab." },
  logEntryMils: { uk: "Азимут {bearing} мілів, підвищення {elevation} мілів", en: "Bearing {bearing} mils, elevation {elevation} mils" },
  logEntryMeta: { uk: "{weapon}, {shell}, заряд {charge} • {range} м", en: "{weapon}, {shell}, charge {charge} • {range} m" },
  clearLogBtn: { uk: "Очистити журнал", en: "Clear log" },
  clearLogTitle: { uk: "Очистити журнал?", en: "Clear the log?" },
  clearLogText: { uk: "Буде видалено записів: {n} на терені {terrain}.", en: "{n} log entries on {terrain} will be deleted." }
};

let current: Lang = "uk";
const listeners: Array<() => void> = [];

export function getLang(): Lang {
  return current;
}

export function setLangSilent(l: Lang): void {
  current = l;
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  document.documentElement.lang = l;
  applyStaticTranslations();
  for (const fn of listeners) fn();
}

export function onLangChange(fn: () => void): void {
  listeners.push(fn);
}

export function t(key: keyof typeof DICT, vars?: Record<string, string | number>): string {
  const entry = DICT[key];
  let s = entry ? entry[current] : String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v));
  return s;
}

/** Проходить по [data-i18n]/[data-i18n-html]/[data-i18n-placeholder]/[data-i18n-aria-label] і підставляє переклад. */
export function applyStaticTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n as keyof typeof DICT);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml as keyof typeof DICT);
  });
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder as keyof typeof DICT);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel as keyof typeof DICT));
  });
}
