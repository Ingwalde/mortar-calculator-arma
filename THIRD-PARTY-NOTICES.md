Сторонні матеріали, ліцензії та подяки
======================================

Планшет мінометника — некомерційний фанатський інструмент для гри Arma Reforger. Він не пов'язаний з Bohemia Interactive і не схвалений нею.
Arma, Arma Reforger і Enfusion — торгові марки Bohemia Interactive a.s.

Авторські частини застосунку — Mortar Tablet Noncommercial License 1.0 (файл LICENSE).
Ця ліцензія дозволяє лише некомерційне використання авторських частин і не змінює умов сторонніх матеріалів нижче.
Сторонній код, бібліотеки, карти й дані зберігають власні ліцензії; попередні права, видані під MIT, не скасовуються.


1. Дані й карти для гри
-----------------------

EnfusionMapMaker, автор nickludlam (https://github.com/nickludlam/EnfusionMapMaker)
Ліцензія: Arma Public License Share Alike, APL-SA (https://www.bohemia.net/community/licenses/arma-public-license-share-alike).
Використано: назви й координати пунктів Everon і Arland, схему онлайн-тайлів карти. Матеріал змінено: пункти переведено у формат застосунку
й доповнено рангами важливості (файли src/core/terrains.ts і src/core/terrains-data.json). Ці дані поширюються на тих самих умовах APL-SA:
лише некомерційне використання й лише для ігор серії Arma; жодних додаткових обмежень для одержувачів.
Тайли Everon, Arland і Kolguyev розміщені на reforger.recoil.org. Вебверсія й Android завантажують їх із цього сервера;
ПК-версія підтримує локальний кеш. Походження матеріалів і невирішені питання прав зафіксовано в legal/ASSET-PROVENANCE.md.

GeNeFRAG/ArmaReforger (https://github.com/GeNeFRAG/ArmaReforger)
Використано: код розрахунків, балістичні таблиці M252 і 2Б14, каталог теренів, посилання на зображення й дані висот.
Репозиторій заявляє MIT. Це не підтверджує права на першоджерела зображень і витягнутих ігрових даних;
для них потрібна окрема перевірка походження (legal/ASSET-PROVENANCE.md). Ліцензія запозиченого коду:

    MIT License

    Copyright (c) 2025 Gerhard Fröhlich

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

Файли гри Arma Reforger (Bohemia Interactive): контури будівель, назви пунктів і окремі параметри розкиду прочитано з файлів гри.
Некомерційне призначення застосунку саме по собі не є дозволом на поширення цих матеріалів; статус перевірки — у legal/ASSET-PROVENANCE.md.

Моди Arma Reforger Workshop (автори й ліцензії за публічними сторінками, перевірено 2026-10-20):
- Gogland — Temppa, APL: https://reforger.armaplatform.com/workshop/623EEDF242F6265E
- Bad Orb 5.0 — Aphex26, APL: https://reforger.armaplatform.com/workshop/64A51967EC407267
- Bystrany — Der alte Benni, APL: https://reforger.armaplatform.com/workshop/6626CB89B6B9C913
- Chernorus_Kirovograd — knisez, APL: https://reforger.armaplatform.com/workshop/6608D15676B2EACC
- Mogadishu — KIOK, APL: https://reforger.armaplatform.com/workshop/5F1D02080409E128
- Novyinovka - Russia — Itzz Coach, APL: https://reforger.armaplatform.com/workshop/689E376275A6AF90
- Iron Hold Castle — WoodyCracudo, APL (версія 1.0.3, сторінку прочитано 2026-10-20): https://reforger.armaplatform.com/workshop/697F774C5FD21619

Текст APL: https://www.bohemia.net/en/licenses/arma-public-license
З файлів модів прочитано розміри теренів, назви пунктів і висоти; для частини карт — контури будівель.
Назви/координати переведено у формат застосунку, висоти перетворено на стиснуті сітки,
контури будівель — на бінарні модулі. Для Novyinovka постачається також піраміда тайлів WebP.
Права на матеріали модів і їхні залежності належать відповідним правовласникам.
Моди мають залежності з іншими ліцензіями (зокрема APL-ND, APL-SA, CC BY-NC-SA 4.0); їхній перелік і статус перевірки — у legal/ASSET-PROVENANCE.md.
Карта Novyinovka — перетворене (змінене за розміром і нарізане) 2D-зображення з цього мода. На ній зображено траншеї із залежності Ukraine Trenches (Piano_Man, APL-ND); чи є це матеріалом цієї залежності, не вирішено, питання лишається відкритим.


2. Програмні бібліотеки
-----------------------

Повідомлення встановлених npm-залежностей збираються scripts/collect-third-party-licenses.mjs
у resources/legal/npm-notices.txt і відображаються в застосунку. Це не повний аудит нативних бібліотек.
ПК-пакування зберігає LICENSE/COPYING/NOTICE та README залежностей; Electron/Chromium потребують
також LICENSE.electron.txt і LICENSES.chromium.html із відповідного дистрибутива Electron.

- Electron і Chromium — MIT та ліцензії складових Chromium (LICENSES.chromium.html).
- sharp — Apache-2.0; вбудована libvips — LGPL-3.0-or-later (https://github.com/lovell/sharp-libvips), використовується лише в ПК-версії для нарізання карт.
- node-forge — використано на умовах BSD-3-Clause, Copyright (c) 2010, Digital Bazaar, Inc.
- qrcode — MIT, Copyright (c) 2012 Ryan Day; dijkstrajs — MIT, Copyright (C) 2008 Wyatt Baldwin.
- nosleep.js — MIT, Copyright (c) Rich Tibbett.
- electron-updater і builder-util-runtime — MIT, Copyright (c) 2015 Loopline Systems.
- Capacitor (core, app, browser) — MIT, Copyright (c) 2017-present Drifty Co. і 2020-present Ionic.
- Android-застосунок використовує бібліотеки AndroidX на умовах Apache-2.0.

Нативний комплект sharp містить також MPL-1.1, BSD, MIT, LGPL та спеціальні ліцензії кодеків і шрифтів.
Версії, джерела та невиконані вимоги до релізу наведено в legal/NATIVE-COMPONENTS.md.
Наявність цього повідомлення не означає завершеної перевірки прав на всі матеріали.

Ліцензія MIT (стосується позначених вище MIT-бібліотек):

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
    (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify,
    merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished
    to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
    INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
    SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT
    OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
