Сторонні матеріали, ліцензії та подяки
======================================

Планшет мінометника — некомерційний фанатський інструмент для гри Arma Reforger. Він не пов'язаний з Bohemia Interactive і не схвалений нею.
Arma, Arma Reforger і Enfusion — торгові марки Bohemia Interactive a.s.

Код застосунку — MIT (файл LICENSE). Нижче — матеріали, що походять від інших авторів.


1. Дані й карти для гри
-----------------------

EnfusionMapMaker, автор nickludlam (https://github.com/nickludlam/EnfusionMapMaker)
Ліцензія: Arma Public License Share Alike, APL-SA (https://www.bohemia.net/community/licenses/arma-public-license-share-alike).
Використано: назви й координати пунктів Everon і Arland, схему онлайн-тайлів карти. Матеріал змінено: пункти переведено у формат застосунку
й доповнено рангами важливості (файли src/core/terrains.ts і src/core/terrains-data.json). Ці дані поширюються на тих самих умовах APL-SA:
лише некомерційне використання й лише для ігор серії Arma; жодних додаткових обмежень для одержувачів.
Тайли Everon, Arland і Kolguyev створені цим проєктом і розміщені на reforger.recoil.org; частина їх копій постачається разом із вебверсією й Android-застосунком.

GeNeFRAG/ArmaReforger (https://github.com/GeNeFRAG/ArmaReforger)
Використано: балістичні таблиці M252 і 2Б14, розміри теренів, супутникові знімки, дані висот. Ліцензія MIT:

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

Файли гри Arma Reforger (Bohemia Interactive): контури будівель, назви пунктів і дані про розкид снарядів прочитано з файлів гри для некомерційного
використання в межах гри.

Моди Arma Reforger Workshop: Gogland (Temppa), Bad Orb (Aphex26), Bystrany, Iron Hold Castle, Chernorus_Kirovograd і Mogadishu (KIOK),
Novyinovka - Russia (Itzz Coach). З файлів модів прочитано розмір терену, назви пунктів і висоти; для Novyinovka постачається також карта.
Усі права на моди належать їхнім авторам.


2. Програмні бібліотеки
-----------------------

У застосунок і його пакунки входять (повні тексти ліцензій лежать у пакетах бібліотек; для ПК-версії також у файлах
LICENSE.electron.txt і LICENSES.chromium.html поруч зі застосунком):

- Electron і Chromium — MIT та ліцензії складових Chromium (LICENSES.chromium.html).
- sharp — Apache-2.0; вбудована libvips — LGPL-3.0-or-later (https://github.com/lovell/sharp-libvips), використовується лише в ПК-версії для нарізання карт.
- node-forge — використано на умовах BSD-3-Clause, Copyright (c) 2010, Digital Bazaar, Inc.
- qrcode — MIT, Copyright (c) 2012 Ryan Day; dijkstrajs — MIT, Copyright (C) 2008 Wyatt Baldwin.
- nosleep.js — MIT, Copyright (c) Rich Tibbett.
- electron-updater і builder-util-runtime — MIT, Copyright (c) 2015 Loopline Systems.
- Capacitor (core, app, browser) — MIT, Copyright (c) 2017-present Drifty Co. і 2020-present Ionic.
- Android-застосунок використовує бібліотеки AndroidX на умовах Apache-2.0.

Ліцензія MIT (стосується позначених вище MIT-бібліотек):

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
    (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify,
    merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished
    to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
    INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
    SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT
    OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
