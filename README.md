# Планшет мінометника

Настільний застосунок для Arma Reforger: карта з тайлами/імпортом супутникових знімків,
мітки (міномет/ціль/точка), автовисота, балістичні розрахунки для M252 і 2Б14.

## Розробка

```bash
npm install
npm run dev
```

Відкриє Electron-вікно з hot-reload. Логи рендерера дублюються в консоль main-процесу.

## Тести

```bash
npm test          # vitest run (балістика, геометрія, тайли, висоти)
npm run typecheck # tsc --noEmit для main/preload і renderer/core
```

`scripts/check-places-local.mjs` і `scripts/test-import-module.mjs` — допоміжні
скрипти для ручної перевірки прив'язки карти й sharp-піраміди на реальних файлах
(потребують `maps/<terrain>_sat_*.png` у корені проєкту).

## Збірка

```bash
npm run dist:win    # portable .exe + NSIS-інсталятор -> dist/
npm run dist:mac    # dmg (потребує macOS)
npm run dist:linux  # AppImage + deb
```

Готові файли після `npm run dist:win`:
- `dist/Планшет мінометника 0.1.0.exe` — portable, без інсталяції.
- `dist/Планшет мінометника Setup 0.1.0.exe` — інсталятор (NSIS).

### Windows: помилка розпакування winCodeSign

Якщо збірка падає на `Cannot create symbolic link` під час завантаження
`winCodeSign` — увімкніть Режим розробника (Параметри → Конфіденційність і безпека →
Для розробників). Це потрібно лише на машині, де відбувається збірка; на роботу
готового `.exe` в кінцевих користувачів не впливає.

## Дані застосунку

Мітки, налаштування, кеш тайлів і дані висот зберігаються в
`%APPDATA%/mortar-tablet` (Windows) — не в localStorage.

## Ліцензія

Код застосунку — [MIT](LICENSE).

### Ліцензії джерел даних

- [EnfusionMapMaker](https://github.com/nickludlam/EnfusionMapMaker) (nickludlam) — APL-SA:
  назви пунктів Everon/Arland, схема онлайн-тайлів.
- [GeNeFRAG/ArmaReforger](https://github.com/GeNeFRAG/ArmaReforger) — MIT:
  балістичні таблиці M252/2Б14, розміри теренів, супутникові знімки, дані висот.

Атрибуція також показана у вкладці «Про» самого застосунку. Некомерційний проєкт.
