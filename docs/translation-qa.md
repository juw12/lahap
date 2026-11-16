# Translation check: every flag and what ships

Lahap's 13 non-English languages are machine translations. No native speaker has reviewed them.
This page lists what a second model flagged when it translated the strings back to English, and what the
app ships for each flag, so the check can be read line by line instead of taken on trust.

## How the check was done

- One model translated the English strings. A different model then read each translation next to its English
  source and flagged the ones whose meaning, grammar or placeholders looked wrong, with a suggested fix.
- Each suggestion was read before it was used. Some were used as written, some were reworded by hand, a few
  were not taken.
- After that, one term per language was fixed by hand for recurring words (for example the word for "bud"),
  and labels that did not fit a 320 px phone were shortened.

## Numbers

- Strings in the app: 837 entries in each of 13 languages, 10,881 in total.
- Back-checked: 4,823 strings in two passes (1,885, then 2,938). That is under half of the
  total. Every flag is on a string added in this release. The logs keep counts per batch, not the list of
  strings in each batch, so the strings that passed without a flag cannot be listed here.
- Flagged: 227. Of these, 161 ship the reviewer's suggestion, 60 ship a wording written by hand,
  and 6 ship unchanged.
- Changed by hand without a flag: 200 strings (148 that were in the previous release and
  52 that are new in this one).

| Language | Checked | Flagged | Suggestion used | Reworded by hand | Kept |
| --- | ---: | ---: | ---: | ---: | ---: |
| German (de) | 375 | 19 | 13 | 5 | 1 |
| Spanish (es) | 366 | 20 | 16 | 4 | 0 |
| French (fr) | 370 | 16 | 9 | 6 | 1 |
| Bahasa Indonesia (id) | 371 | 15 | 11 | 4 | 0 |
| Italian (it) | 366 | 13 | 7 | 6 | 0 |
| Japanese (ja) | 371 | 22 | 14 | 8 | 0 |
| Korean (ko) | 366 | 19 | 14 | 5 | 0 |
| Malay (ms) | 366 | 23 | 18 | 4 | 1 |
| Portuguese (Brazil) (pt-BR) | 366 | 15 | 11 | 3 | 1 |
| Thai (th) | 371 | 18 | 13 | 5 | 0 |
| Vietnamese (vi) | 366 | 14 | 9 | 5 | 0 |
| Chinese (Simplified) (zh-Hans) | 391 | 19 | 17 | 2 | 0 |
| Chinese (Traditional) (zh-Hant) | 378 | 14 | 9 | 3 | 2 |
| All | 4823 | 227 | 161 | 60 | 6 |

## What this does not show

- It is a model checking a model. A string that both models got wrong the same way is not flagged.
- A back-translation catches wrong meaning better than it catches stiff or unnatural wording.
- The "Ships now" columns are read from `i18n-strings.js` in this release. If you speak one of these
  languages and a line reads wrong, an issue with the language and the English text is enough to fix it.

## Every flag

"Before" is the first machine translation. "Suggested" is the reviewer's fix. "Ships now" is the text in the app.
`{0}` and `#` are places where the app puts a name or a number.

### German (de): 19 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # dropped | # abgesetzt | # fallen gelassen | # fallen gelassen | suggestion used |
| # popped | # aufgetaucht | # geplatzt | # geplatzt | suggestion used |
| # sliced | # Scheiben | # geschnitten | # geschnitten | suggestion used |
| +{0} with {1}. Log what you ate? | +{0} mit {1}. Was hast du gegessen? | +{0} mit {1}. Notieren, was du gegessen hast? | +{0} mit {1}. Notieren, was du gegessen hast? | suggestion used |
| All of {0} | Alle von {0} | Ganz {0} | Ganz {0} | suggestion used |
| Auto cutout off. Tap Cut out on a photo to run it once. | Auto-Ausschnitt aus. Tippe auf ein Foto auf Ausschnitt, um ihn einmal zu starten. | Auto-Ausschnitt aus. Tippe auf einem Foto auf Ausschnitt, um ihn einmal zu starten. | Auto-Ausschnitt aus. Tippe auf einem Foto auf Ausschnitt, um ihn einmal zu starten. | suggestion used |
| Last 7 days: 1 meal, variety {0}, plate score {1} {2}, {3} spent. Open Insights | Letzte 7 Tage: 1 Mahlzeit, Vielfalt {0}, Teller-Score {1} {2}, {3} ausgegeben. Einsichten öffnen | Letzte 7 Tage: 1 Mahlzeit, Vielfalt {0}, Teller-Score {1} {2}, {3} ausgegeben. Einsichten öffnen | Letzte 7 Tage: 1 Mahlzeit, Vielfalt {0}, Teller-Score {1} {2}, {3} ausgegeben. Einsichten öffnen | kept (suggestion was the same text) |
| Log a few meals and this page fills in: variety, plate score, spend and your taste profile. | Trage ein paar Mahlzeiten ein und diese Seite füllt sich: Abwechslung, Plattenscore, Ausgaben und dein Geschmacksprofil. | Trage ein paar Mahlzeiten ein und diese Seite füllt sich: Abwechslung, Tellerscore, Ausgaben und dein Geschmacksprofil. | Trage ein paar Mahlzeiten ein und diese Seite füllt sich: Abwechslung, Tellerwertung, Ausgaben und dein Geschmacksprofil. | reworded by hand |
| Log a meal in about 15 seconds: dish, place, price, and how the plate looked. Everything stays on this device. | Erfasse eine Mahlzeit in ca. 15 Sekunden: dish, Ort, Preis und wie der Teller aussah. Alles bleibt auf diesem Gerät. | Erfasse eine Mahlzeit in ca. 15 Sekunden: Gericht, Ort, Preis und wie der Teller aussah. Alles bleibt auf diesem Gerät. | Erfasse eine Mahlzeit in ca. 15 Sekunden: Gericht, Ort, Preis und wie der Teller aussah. Alles bleibt auf diesem Gerät. | suggestion used |
| Makan bud | Makan-Bud | Makan bud | Makan-Buddy | reworded by hand |
| Ordered in | Bestellt in | Bestellt | Bestellt | suggestion used |
| Plan makan and mark “We went” | Plan makan und markiere “We went” | Plan makan und markiere "Wir waren dort" | Plan makan und markiere “Wir waren da” | reworded by hand |
| Recap copied. Paste it anywhere. | Zusammenfassung kopiert. Füge sie überall ein. | Zusammenfassung kopiert. Füge sie irgendwo ein. | Zusammenfassung kopiert. Füge sie irgendwo ein. | suggestion used |
| Slipped! Try again. | Verfehlt! Nochmal. | Abgerutscht! Nochmal. | Abgerutscht! Nochmal. | suggestion used |
| Some details were blank, so these use average values. Retake the quiz from Profile any time. | Einige Angaben fehlten, daher gelten Durchschnittswerte. Den Quiz kannst du jederzeit über Profil wiederholen. | Einige Angaben fehlten, daher gelten Durchschnittswerte. Das Quiz kannst du jederzeit über Profil wiederholen. | Einige Angaben fehlten, daher gelten Durchschnittswerte. Das Quiz kannst du jederzeit über Profil wiederholen. | suggestion used |
| Tag {0}: +{1} pts, {2} to {3} | Tag {0}: +{1} Pkt., {2} bis {3} | Markiere {0}: +{1} Pkt., {2} bis {3} | Markiere {0}: +{1} Pkt., noch {2} bis {3} | reworded by hand |
| Take the one-minute quiz for daily calorie and protein targets, tips that fit your goal, and Lab recipes sized for you. | Mach den Ein-Minuten-Quiz für tägliche Kalorien- und Proteinziele, Tipps passend zu deinem Ziel und Lab-Rezepte, die auf dich zugeschnitten sind. | Mach das Ein-Minuten-Quiz für tägliche Kalorien- und Proteinziele, Tipps passend zu deinem Ziel und Lab-Rezepte, die auf dich zugeschnitten sind. | Mach das Ein-Minuten-Quiz für tägliche Kalorien- und Proteinziele, Tipps passend zu deinem Ziel und Lab-Rezepte, die auf dich zugeschnitten sind. | suggestion used |
| {0}% taste match | {0}% Geschmack Übereinstimmung | {0}% Geschmacksübereinstimmung | {0}% Geschmacksübereinstimmung | suggestion used |
| · +{0} a tag | · +{0} Tag | · +{0} pro Tag | · +{0} pro Markierung | reworded by hand |

### Spanish (es): 20 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # caught | # registradas | # atrapadas | # atrapadas | suggestion used |
| # of 6 knocked | # de 6 completadas | # de 6 derribadas | # de 6 derribadas | suggestion used |
| # popped | # anotadas | # explotadas | # explotadas | suggestion used |
| +{0} with {1}. Log what you ate? | +{0} con {1}. ¿Registraste lo que comiste? | +{0} con {1}. ¿Registrar lo que comiste? | +{0} con {1}. ¿Registrar lo que comiste? | suggestion used |
| Add a bud on Taste buds and tag them in meals. | Agrega un buda en Buds y etiquétalos en tus comidas. | Agrega un bud en Taste buds y etiquétalos en tus comidas. | Agrega un amigo en Amigos del sabor y etiquétalo en tus comidas. | reworded by hand |
| Backup saved to Downloads. Send it to your other device and Restore it there. | Copia de seguridad guardada en Descargas. Envíala a tu otro dispositivo y Restaura allí. | Copia de seguridad guardada en Descargas. Envíala a tu otro dispositivo y restáurala allí. | Copia de seguridad guardada en Descargas. Envíala a tu otro dispositivo y restáurala allí. | suggestion used |
| Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them. | ¿Borrar todas las comidas, fotos, buds y planes de este dispositivo? Exporta una copia de seguridad primero si quieres conservarlos. | ¿Borrar todas las comidas, fotos, amigos y planes de este dispositivo? Exporta una copia de seguridad primero si quieres conservarlos. | ¿Borrar todas las comidas, fotos, amigos y planes de este dispositivo? Exporta una copia de seguridad primero si quieres conservarlos. | suggestion used |
| Log it | Anotalo | Anótalo | Anótalo | suggestion used |
| Makan bud | Amigo de comida Makan | Makan bud | Amigo makan | reworded by hand |
| Ordered in | Pedido en | Pedido a domicilio | Pedido a domicilio | suggestion used |
| Remove {0} from your buds? Your past meals stay tagged, but they won't count for points anymore. | ¿Quitar a {0} de tus buds? Tus comidas pasadas conservan la etiqueta, pero ya no sumarán puntos. | ¿Quitar a {0} de tus amigos? Tus comidas pasadas conservan la etiqueta, pero ya no sumarán puntos. | ¿Quitar a {0} de tus amigos? Tus comidas pasadas conservan la etiqueta, pero ya no sumarán puntos. | suggestion used |
| Synced backup file set | Archivo de copia de seguridad sincronizado | Archivo de copia de seguridad sincronizado establecido | Archivo de copia sincronizada configurado | reworded by hand |
| Synced: {0} new, {1} updated, {2} removed | Sincronizado: {0} nuevos, {1} actualizados, {2} eliminados | Sincronizado. Nuevos: {0}, actualizados: {1}, eliminados: {2} | Sincronizado. Nuevos: {0}, actualizados: {1}, eliminados: {2} | suggestion used |
| Why {0}: {1} | ¿Por qué {0}: {1}? | Por qué {0}: {1} | Por qué {0}: {1} | suggestion used |
| Your 6 taste weights | Tus 6 sabores | Tus 6 pesos de sabor | Tus 6 pesos de sabor | suggestion used |
| {0} added to your buds | {0} agregado a tus buds | Se agregó a {0} a tus amigos | Se agregó a {0} a tus amigos | suggestion used |
| {0} game | {0} juego | Juego {0} | Juego {0} | suggestion used |
| {0} likes {1}: | {0} le gusta {1}: | A {0} le gusta {1}: | A {0} le gusta {1}: | suggestion used |
| {0} removed | {0} eliminado | Se eliminó a {0} | Se eliminó a {0} | suggestion used |
| · +{0} a tag | · +{0} una etiqueta | · +{0} por una etiqueta | · +{0} por etiqueta | reworded by hand |

### French (fr): 16 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # days ago | # jours | il y a # jours | il y a # jours | suggestion used |
| # dropped | # abandonnés | # lâchés | # tombés | reworded by hand |
| # months ago | # mois | il y a # mois | il y a # mois | suggestion used |
| # popped | # terminés | # éclatés | # éclatés | suggestion used |
| # regular | # régulier | # réguliers | # régulier | kept as it was |
| Example buds to try | Exemples de buds à essayer | Exemples de copains à essayer | Exemples d'amis à essayer | reworded by hand |
| Makan bud | Copain Makan | Makan bud | Ami makan | reworded by hand |
| most-eaten, all time | Les plus mangés, tous temps | Les plus mangés, de tous les temps | Les plus mangés, de tous les temps | suggestion used |
| Ordered in | Commandé dans | Commandé | En livraison | reworded by hand |
| somewhere new | quelque part de nouveau | un nouvel endroit | un nouvel endroit | suggestion used |
| Synced backup file set | Fichier de sauvegarde synchronisé | Fichier de sauvegarde synchronisé défini | Fichier de sauvegarde synchronisé défini | suggestion used |
| Tag {0}: +{1} pts, {2} to {3} | Étiquette {0} : +{1} pts, de {2} à {3} | Étiquette {0} : +{1} pts, encore {2} avant {3} | Identifie {0} : +{1} pts, encore {2} avant {3} | reworded by hand |
| Tap to drop the claw again | Touche pour relâcher la pince | Touche à nouveau pour relâcher la pince | Touche à nouveau pour relâcher la pince | suggestion used |
| Your priciest quarter of meals | Votre trimestre le plus coûteux | Le quart de vos repas le plus coûteux | Le quart le plus cher de vos repas | reworded by hand |
| {0} added to your buds | {0} ajouté à vos buds | {0} ajouté à vos amis | {0} ajouté à vos amis | suggestion used |
| · +{0} a tag | · +{0} un tag | · +{0} par tag | · +{0} par tag | suggestion used |

### Bahasa Indonesia (id): 15 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # popped | # muncul | # meletus | # meletus | suggestion used |
| A favourite from your diary | Favorit dari diary-mu | Favorit dari diarimu | Favorit dari jurnalmu | reworded by hand |
| Add buds on the Taste buds tab to tag them here. | Tambahkan buds di tab Taste buds untuk menandai mereka di sini. | Tambahkan teman makan di tab Taste buds untuk menandai mereka di sini. | Tambahkan teman makan di tab Teman rasa untuk menandai mereka di sini. | reworded by hand |
| Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them. | Hapus semua makanan, foto, bud, dan rencana di perangkat ini? Ekspor cadangan dulu jika ingin menyimpannya. | Hapus semua makanan, foto, teman makan, dan rencana di perangkat ini? Ekspor cadangan dulu jika ingin menyimpannya. | Hapus semua makanan, foto, teman makan, dan rencana di perangkat ini? Ekspor cadangan dulu jika ingin menyimpannya. | suggestion used |
| Log a meal in about 15 seconds: dish, place, price, and how the plate looked. Everything stays on this device. | Catat makanan dalam sekitar 15 detik: dish, place, harga, dan tampilan piring. Semua tersimpan di perangkat ini. | Catat makanan dalam sekitar 15 detik: hidangan, tempat, harga, dan tampilan piring. Semua tersimpan di perangkat ini. | Catat makanan dalam sekitar 15 detik: hidangan, tempat, harga, dan tampilan piring. Semua tersimpan di perangkat ini. | suggestion used |
| Not in your diary yet | Belum ada di diary kamu | Belum ada di diari kamu | Belum ada di jurnalmu | reworded by hand |
| Ordered in | Dipesan di | Pesan antar | Pesan antar | suggestion used |
| Plan makan and mark “We went” | Rencanakan makan dan tandai “We went” | Rencanakan makan dan tandai “Kami pergi” | Rencanakan makan dan tandai “Kami pergi” | suggestion used |
| Remove {0} sample meals | Hapus {0} makan contoh | Hapus {0} contoh makanan | Hapus {0} contoh makanan | suggestion used |
| Story copied | Story disalin | Cerita disalin | Cerita disalin | suggestion used |
| Synced backup file set | File backup tersinkron | File backup tersinkron telah ditetapkan. | File backup tersinkron sudah diatur | reworded by hand |
| you've been {0}× | kamu sudah {0}× | kamu sudah ke sini {0}× | kamu sudah ke sini {0}× | suggestion used |
| your most-visited spot | tempat favoritmu | tempat yang paling sering kamu kunjungi | tempat yang paling sering kamu kunjungi | suggestion used |
| Your priciest quarter of meals | Kuadran makan termahal kamu | Seperempat makan termahal kamu | Seperempat makan termahal kamu | suggestion used |
| · +{0} a tag | · +{0} tag | · +{0} per tag | · +{0} per tag | suggestion used |

### Italian (it): 13 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # dropped | # saltati | # caduti | # caduti | suggestion used |
| # of 6 knocked | # di 6 completati | # di 6 abbattuti | # di 6 abbattuti | suggestion used |
| +{0} with {1}. Log what you ate? | +{0} con {1}. Hai registrato cosa hai mangiato? | +{0} con {1}. Vuoi registrare cosa hai mangiato? | +{0} con {1}. Vuoi registrare cosa hai mangiato? | suggestion used |
| All of {0} | Tutto di {0} | Tutto {0} | Tutto il {0} | reworded by hand |
| Example buds to try | Buds di esempio da provare | Amici di esempio da provare | Amici di esempio da provare | suggestion used |
| Log a meal in about 15 seconds: dish, place, price, and how the plate looked. Everything stays on this device. | Registra un pasto in circa 15 secondi: dish, luogo, prezzo e come era il piatto. Tutto resta su questo dispositivo. | Registra un pasto in circa 15 secondi: piatto, luogo, prezzo e come era il piatto. Tutto resta su questo dispositivo. | Registra un pasto in circa 15 secondi: piatto, luogo, prezzo e aspetto del piatto. Tutto resta su questo dispositivo. | reworded by hand |
| Makan bud | Makan amico | Makan bud | Amico makan | reworded by hand |
| No match in your diary yet. Type the dish name. | Nessun match nel tuo diario. Digita il nome del dish. | Nessuna corrispondenza nel tuo diario. Digita il nome del dish. | Nessuna corrispondenza nel tuo diario. Digita il nome del piatto. | reworded by hand |
| Ordered in | Ordinato in | Ordinato a domicilio | Ordinato a domicilio | suggestion used |
| somewhere new | da qualche parte di nuovo | in un posto nuovo | un posto nuovo | reworded by hand |
| Your priciest quarter of meals | Il tuo trimestre di pasti più costoso | Il quarto più costoso dei tuoi pasti | Il quarto più costoso dei tuoi pasti | suggestion used |
| {0} game | {0} gioco | gioco {0} | Gioco {0} | reworded by hand |
| · +{0} a tag | · +{0} un tag | · +{0} per tag | · +{0} per tag | suggestion used |

### Japanese (ja): 22 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # caught | # 記録 | # 捕まえた | # 捕まえた | suggestion used |
| # dropped | # 減 | # 落とした | # 落とした | suggestion used |
| # meal together | # 一緒に食べた | # 回一緒に食べた | # 回一緒に食べた | suggestion used |
| # meals together | # 一緒に食べた | # 回一緒に食べた | # 回一緒に食べた | suggestion used |
| # popped | # 達成 | # つぶした | # 割った | reworded by hand |
| Add buds on the Taste buds tab to tag them here. | 「Taste buds」タブでbudsを追加すると、ここでタグ付けできます。 | 「Taste buds」タブで食事仲間を追加すると、ここでタグ付けできます。 | 「味覚仲間」タブで仲間を追加すると、ここでタグ付けできます。 | reworded by hand |
| Add your first bud | 最初のバッドを追加 | 最初のバディを追加 | 最初の仲間を追加 | reworded by hand |
| Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them. | この端末のすべての食事、写真、バッド、プランを削除しますか？残したい場合は先にバックアップをエクスポートしてください。 | この端末のすべての食事、写真、バディ、プランを削除しますか？残したい場合は先にバックアップをエクスポートしてください。 | この端末のすべての食事、写真、仲間、プランを削除しますか？残したい場合は先にバックアップをエクスポートしてください。 | reworded by hand |
| Filled from last time | 前回から入力しました | 前回の入力内容を反映しました | 前回の入力内容を反映しました | suggestion used |
| Full size | 全サイズ | フルサイズ | フルサイズ | suggestion used |
| Log a meal with a photo to play with your own plates. Plain discs for now. | 写真付きで食事を記録して、自分のプレートを遊ぼう。今はただの円盤。 | 写真付きで食事を記録して、自分のプレートで遊ぼう。今はただの円盤。 | 写真付きで食事を記録して、自分のプレートで遊ぼう。今はただの円盤。 | suggestion used |
| Makan bud | makanバディ | Makan bud | Makan仲間 | reworded by hand |
| No buds yet. Invite a friend, or add an example profile below to try tagging and hangouts. | まだバッドがいません。友達を招待するか、下のサンプルプロファイルを追加してタグ付けとハングアウトを試してみてください。 | まだバディがいません。友達を招待するか、下のサンプルプロファイルを追加してタグ付けとハングアウトを試してみてください。 | まだ仲間がいません。友達を招待するか、下のサンプルプロファイルを追加してタグ付けとハングアウトを試してみてください。 | reworded by hand |
| No plans yet. Add a bud first. | まだ予定がありません。先にバッドを追加してください。 | まだ予定がありません。先にバディを追加してください。 | まだ予定がありません。先に仲間を追加してください。 | reworded by hand |
| Ordered in | 注文先 | デリバリー | デリバリー | suggestion used |
| Picked from {0} dishes you rated 4 or 5, or hearted. | 4または5つ星、またはハートをつけた{0}のdishから選ばれました。 | 4または5つ星、またはハートをつけた{0}品の料理から選ばれました。 | 4または5つ星、またはハートをつけた{0}品の料理から選ばれました。 | suggestion used |
| See the card full size | カードを全サイズで見る | カードをフルサイズで見る | カードをフルサイズで見る | suggestion used |
| Synced backup file set | バックアップファイルセットを同期しました | 同期バックアップファイルを設定しました | 同期バックアップファイルを設定しました | suggestion used |
| Take the one-minute quiz for daily calorie and protein targets, tips that fit your goal, and Lab recipes sized for you. | 1分のクイズで、毎日のカロリー・タンパク質目標、目標に合ったヒント、あなたに合わせたラボのレシピを | 1分のクイズで、毎日のカロリー・タンパク質目標、目標に合ったヒント、あなたに合わせたラボのレシピが手に入ります。 | 1分のクイズで、毎日のカロリー・タンパク質目標、目標に合ったヒント、あなたに合わせたラボのレシピが手に入ります。 | suggestion used |
| they like {0} | みんな{0}が好き | この人は{0}が好き | この人は{0}が好き | suggestion used |
| {0} added to your buds | {0}をバッドに追加しました | {0}をバディに追加しました | {0}を仲間に追加しました | reworded by hand |
| · +{0} a tag | · +{0} タグ | · タグ1つにつき +{0} | · タグ1つにつき +{0} | suggestion used |

### Korean (ko): 19 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # caught | #개 | #개 잡음 | #개 잡음 | suggestion used |
| # dropped | #개 | #개 떨어뜨림 | #개 떨어뜨림 | suggestion used |
| # of 6 knocked | 6개 중 #개 | 6개 중 #개 쓰러뜨림 | 6개 중 #개 쓰러뜨림 | suggestion used |
| # popped | #개 | #개 터뜨림 | #개 터뜨림 | suggestion used |
| Makan bud | makan 친구 | Makan bud | Makan 친구 | reworded by hand |
| Ordered in | 매장 주문 | 배달 주문 | 배달 주문 | suggestion used |
| Remove {0} from your buds? Your past meals stay tagged, but they won't count for points anymore. | {0}을(를) buds에서 제거할까요? 지난 식사 태그는 유지되지만 포인트에는 반영되지 않아요. | {0}을(를) 버디에서 제거할까요? 지난 식사 태그는 유지되지만 포인트에는 반영되지 않아요. | {0}을(를) 친구 목록에서 제거할까요? 지난 식사 태그는 유지되지만 포인트에는 반영되지 않아요. | reworded by hand |
| Removed {0} sample meals. The diary is all yours now. | {0}개의 샘플 식사를 삭제했어요. 이제 다이어리는 전부 yours... | {0}개의 샘플 식사를 삭제했어요. 이제 다이어리는 온전히 회원님의 것이에요. | {0}개의 샘플 식사를 삭제했어요. 이제 다이어리는 온전히 내 것이에요. | reworded by hand |
| Tag {0}: +{1} pts, {2} to {3} | 태그 {0}: +{1}점, {2}~{3} | 태그 {0}: +{1}점, {3}까지 {2} | 태그 {0}: +{1}점, {3}까지 {2} | suggestion used |
| Try {0}: {1} | {0} 시도: {1} | {0} 먹어보기: {1} | {0} 가보기: {1} | reworded by hand |
| Why {0}: {1} | {0} 이유: {1} | {0}인 이유: {1} | {0}인 이유: {1} | suggestion used |
| Why {0}? | {0}는 왜? | {0}(은)는 왜? | 왜 {0}점일까요? | reworded by hand |
| Yes, 1 time. Last eaten {0} at {1}. | 네, 1번. 마지막에 {1}에서 {0}을(를) 먹었어요. | 네, 1번. 마지막으로 {0} {1}에서 먹었어요. | 네, 1번. 마지막으로 {0} {1}에서 먹었어요. | suggestion used |
| Yes, 1 time. Last eaten {0}. | 네, 1번. 마지막에 {0}을(를) 먹었어요. | 네, 1번. 마지막으로 {0} 먹었어요. | 네, 1번. 마지막으로 {0} 먹었어요. | suggestion used |
| Yes, {0} times. Last eaten {1} at {2}. | 네, {0}번. 마지막에 {2}에서 {1}을(를) 먹었어요. | 네, {0}번. 마지막으로 {1} {2}에서 먹었어요. | 네, {0}번. 마지막으로 {1} {2}에서 먹었어요. | suggestion used |
| Yes, {0} times. Last eaten {1}. | 네, {0}번. 마지막에 {1}을(를) 먹었어요. | 네, {0}번. 마지막으로 {1} 먹었어요. | 네, {0}번. 마지막으로 {1} 먹었어요. | suggestion used |
| {0} per meal | 식당당 {0} | 식사당 {0} | 식사당 {0} | suggestion used |
| {0} pts to {1} | {1}에게 {0}점 | {1}까지 {0}점 | {1}까지 {0}점 | suggestion used |
| {0} pts to {1}: {2} | {1}에게 {0}점: {2} | {1}까지 {0}점: {2} | {1}까지 {0}점: {2} | suggestion used |

### Malay (ms): 23 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # caught | # direkod | # ditangkap | # ditangkap | suggestion used |
| # dropped | # turun | # terjatuh | # terjatuh | suggestion used |
| # of 6 knocked | # daripada 6 dicapai | # daripada 6 dijatuhkan | # daripada 6 dijatuhkan | suggestion used |
| # popped | # muncul | # pecah | # pecah | suggestion used |
| Add buds on the Taste buds tab to tag them here. | Tambah buds pada tab Taste buds untuk tag mereka di sini. | Tambah rakan makan pada tab Taste buds untuk tag mereka di sini. | Tambah rakan makan pada tab Rakan rasa untuk tag mereka di sini. | reworded by hand |
| Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them. | Padam semua makanan, gambar, bud dan rancangan pada peranti ini? Eksport sandaran dahulu jika mahu simpan. | Padam semua makanan, gambar, kawan makan dan rancangan pada peranti ini? Eksport sandaran dahulu jika mahu simpan. | Padam semua makanan, gambar, rakan makan dan rancangan pada peranti ini? Eksport sandaran dahulu jika mahu simpan. | reworded by hand |
| Example buds to try | Contoh buds untuk cuba | Contoh kawan makan untuk cuba | Contoh rakan makan untuk dicuba | reworded by hand |
| Example · what one logged meal looks like | Contoh · macam mana satu hidangan yang direkodkan | Contoh · macam mana rupa satu hidangan yang direkodkan | Contoh · macam mana rupa satu hidangan yang direkodkan | suggestion used |
| Name the dish first | Beri nama dish dahulu | Beri nama hidangan dahulu | Beri nama hidangan dahulu | suggestion used |
| Picked from {0} dishes you rated 4 or 5, or hearted. | Dipilih daripada {0} dish yang anda nilai 4 atau 5, atau beri hati. | Dipilih daripada {0} hidangan yang anda nilai 4 atau 5, atau beri hati. | Dipilih daripada {0} hidangan yang anda nilai 4 atau 5, atau beri hati. | suggestion used |
| planned | direncanakan | dirancang | dirancang | suggestion used |
| Planned: {0}. Mark “We went” after for +{1}. | Direncanakan: {0}. Tandai “Kami pergi” selepas itu untuk +{1}. | Dirancang: {0}. Tandai “Kami pergi” selepas itu untuk +{1}. | Direncanakan: {0}. Tandai “Kami pergi” selepas itu untuk +{1}. | kept as it was |
| Resep no. {0} | Resep no. {0} | Resepi no. {0} | Resepi no. {0} | suggestion used |
| Some details were blank, so these use average values. Retake the quiz from Profile any time. | Beberapa butiran kosong, jadi ini menggunakan nilai purata. Ulang kuis dari Profil bila-bila masa. | Beberapa butiran kosong, jadi ini menggunakan nilai purata. Ulang kuiz dari Profil bila-bila masa. | Beberapa butiran kosong, jadi ini menggunakan nilai purata. Ulang kuiz dari Profil bila-bila masa. | suggestion used |
| Swipe through the tossed plates. | Usik melalui pinggan yang dilempar. | Leret melalui pinggan yang dilempar. | Leret melalui pinggan yang dilempar. | suggestion used |
| Synced file on: Lahap writes it after every change. | Fail disegerakkan: Lahap menulisnya selepas setiap perubahan. | Fail disegerakkan pada: Lahap menulisnya selepas setiap perubahan. | Fail segerak aktif: Lahap menulisnya selepas setiap perubahan. | reworded by hand |
| Take the one-minute quiz for daily calorie and protein targets, tips that fit your goal, and Lab recipes sized for you. | Jawab kuis satu minit untuk sasaran kalori dan protein harian, tips yang sesuai dengan sasaran anda, dan resipi Lab yang disuaikan untuk anda. | Jawab kuiz satu minit untuk sasaran kalori dan protein harian, tips yang sesuai dengan sasaran anda, dan resipi Lab yang disuaikan untuk anda. | Jawab kuiz satu minit untuk sasaran kalori dan protein harian, tips yang sesuai dengan sasaran anda, dan resipi Lab yang disuaikan untuk anda. | suggestion used |
| Take the quiz | Jawab kuis | Jawab kuiz | Jawab kuiz | suggestion used |
| Undo | Batal | Buat asal | Buat asal | suggestion used |
| you've been {0}× | anda sudah {0}× | anda sudah pergi {0}× | anda sudah pergi {0}× | suggestion used |
| {0} added to your buds | {0} ditambah ke rakan makanan anda | {0} ditambah ke rakan makan anda | {0} ditambah ke rakan makan anda | suggestion used |
| {0} game | {0} permainan | Permainan {0} | Permainan {0} | suggestion used |
| · +{0} a tag | · +{0} tag | · +{0} setiap tag | · +{0} setiap tag | suggestion used |

### Portuguese (Brazil) (pt-BR): 15 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # caught | # registradas | # capturadas | # capturadas | suggestion used |
| # of 6 knocked | # de 6 conquistadas | # de 6 derrubadas | # de 6 derrubadas | suggestion used |
| # popped | # apareceram | # estouradas | # estouradas | suggestion used |
| cooks {0} min | cozina {0} min | cozinha {0} min | cozinha {0} min | suggestion used |
| Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them. | Apagar todas as refeições, fotos, buds e planos deste dispositivo? Exporte um backup primeiro, se quiser mantê-los. | Apagar todas as refeições, fotos, amigos e planos deste dispositivo? Exporte um backup primeiro, se quiser mantê-los. | Apagar todas as refeições, fotos, amigos e planos deste dispositivo? Exporte um backup primeiro, se quiser mantê-los. | suggestion used |
| Example buds to try | Buds de exemplo para testar | Amigos de exemplo para experimentar | Amigos de exemplo para experimentar | suggestion used |
| Makan bud | Amigo Makan | Makan bud | Amigo Makan | kept as it was |
| Ordered in | Pedido em | Pedido em casa | Delivery | reworded by hand |
| Remove {0} from your buds? Your past meals stay tagged, but they won't count for points anymore. | Remover {0} dos seus buds? Suas refeições passadas continuam marcadas, mas não contam mais pontos. | Remover {0} dos seus amigos? Suas refeições passadas continuam marcadas, mas não contam mais pontos. | Remover {0} dos seus amigos? Suas refeições passadas continuam marcadas, mas não contam mais pontos. | suggestion used |
| Synced backup file set | Arquivo de backup sincronizado | Arquivo de backup sincronizado definido | Arquivo de backup sincronizado definido | suggestion used |
| Tag {0}: +{1} pts, {2} to {3} | Etiqueta {0}: +{1} pts, {2} a {3} | Etiqueta {0}: +{1} pts, {2} para {3} | Marque {0}: +{1} pts, faltam {2} para {3} | reworded by hand |
| {0} added to your buds | {0} adicionado aos seus amigos de comida | Adicionamos {0} aos seus amigos de comida | Adicionamos {0} aos seus amigos | reworded by hand |
| {0} game | {0} jogo | Jogo {0} | Jogo {0} | suggestion used |
| {0} removed | {0} removido | Removemos {0} | Removemos {0} | suggestion used |
| · +{0} a tag | · +{0} uma tag | · +{0} por tag | · +{0} por tag | suggestion used |

### Thai (th): 18 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # dropped | # ตัดออก | # ตก | # ตก | suggestion used |
| # of 6 knocked | # จาก 6 | # จาก 6 ที่โดนตี | ล้มแล้ว # จาก 6 | reworded by hand |
| # popped | # โผล่ | # ป๊อป | # แตก | reworded by hand |
| # won | # ครั้ง | # ครั้งที่ชนะ | ได้ # ชิ้น | reworded by hand |
| Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them. | ลบทุกมื้ออาหาร รูปถ่าย bud และแผนบนเครื่องนี้ไหม? หากต้องการเก็บไว้ ให้ส่งออกสำรองก่อน | ลบทุกมื้ออาหาร รูปถ่าย เพื่อนกิน และแผนบนเครื่องนี้ไหม? หากต้องการเก็บไว้ ให้ส่งออกสำรองก่อน | ลบทุกมื้ออาหาร รูปถ่าย เพื่อนกิน และแผนบนเครื่องนี้ไหม? หากต้องการเก็บไว้ ให้ส่งออกสำรองก่อน | suggestion used |
| No buds yet. Invite a friend, or add an example profile below to try tagging and hangouts. | ยังไม่มีเพื่อนกิน. เชิญเพื่อน หรือเพิ่มโปรไฟล์ตัวอย่างด้านล่างเพื่อลองแท็กและนัดพบ | ยังไม่มีเพื่อนกิน เชิญเพื่อน หรือเพิ่มโปรไฟล์ตัวอย่างด้านล่างเพื่อลองแท็กและนัดพบ | ยังไม่มีเพื่อนกิน เชิญเพื่อน หรือเพิ่มโปรไฟล์ตัวอย่างด้านล่างเพื่อลองแท็กและนัดพบ | suggestion used |
| No meals in this period. | ไม่มีมื้ออาหารในช่วงนี้. | ไม่มีมื้ออาหารในช่วงนี้ | ไม่มีมื้ออาหารในช่วงนี้ | suggestion used |
| No meals match these filters. | ไม่พบมื้อที่ตรงกับตัวกรองเหล่านี้. | ไม่พบมื้อที่ตรงกับตัวกรองเหล่านี้ | ไม่พบมื้อที่ตรงกับตัวกรองเหล่านี้ | suggestion used |
| No places yet. | ยังไม่มีสถานที่. | ยังไม่มีสถานที่ | ยังไม่มีสถานที่ | suggestion used |
| No plans yet. Add a bud first. | ยังไม่มีแผน. เพิ่มเพื่อนกินก่อน | ยังไม่มีแผน เพิ่มเพื่อนกินก่อน | ยังไม่มีแผน เพิ่มเพื่อนกินก่อน | suggestion used |
| Ordered in | สั่งกินที่ร้าน | สั่งส่ง | สั่งเดลิเวอรี | reworded by hand |
| Since the 1st | ตั้งแต่ 1 ค.ม. | ตั้งแต่วันที่ 1 | ตั้งแต่วันที่ 1 | suggestion used |
| You added everyone. Nice. | เพิ่มครบทุกคนแล้ว. เยี่ยม | เพิ่มครบทุกคนแล้ว เยี่ยม | เพิ่มครบทุกคนแล้ว เยี่ยม | suggestion used |
| Your priciest quarter of meals | ไตรมาสที่แพงที่สุดของคุณ | ไตรมาสของมื้ออาหารที่แพงที่สุดของคุณ | 25% ของมื้อที่แพงที่สุดของคุณ | reworded by hand |
| Your spots | ที่ของคุณ | สถานที่ของคุณ | สถานที่ของคุณ | suggestion used |
| {0} pts to {1} | {0} คะแนนให้ {1} | {0} คะแนนถึง {1} | {0} คะแนนถึง {1} | suggestion used |
| {0} pts to {1}: {2} | {0} คะแนนให้ {1}: {2} | {0} คะแนนถึง {1}: {2} | {0} คะแนนถึง {1}: {2} | suggestion used |
| {0} spent at home | {0} ที่บ้าน | ใช้จ่าย {0} ที่บ้าน | ใช้จ่าย {0} ที่บ้าน | suggestion used |

### Vietnamese (vi): 14 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # of 6 knocked | # / 6 đã đạt | # / 6 đã hạ | # / 6 đã hạ | suggestion used |
| # popped | # bật lên | # đã nổ | # đã nổ | suggestion used |
| # regular | # quen | # người quen | # quán quen | reworded by hand |
| # regulars | # bữa quen | # người quen | # quán quen | reworded by hand |
| # sliced | # món thái | # món đã thái | # món đã thái | suggestion used |
| Add a bud on Taste buds and tag them in meals. | Thêm buddy trong Buddy và gắn thẻ họ trong bữa ăn. | Thêm buddy trong Taste buds và gắn thẻ họ trong bữa ăn. | Thêm bạn ăn trong Bạn đồng vị và gắn thẻ họ trong bữa ăn. | reworded by hand |
| Add buds on the Taste buds tab to tag them here. | Thêm buddy ở tab Hương vị để gắn thẻ ở đây. | Thêm bạn ăn cùng ở tab Hương vị để gắn thẻ ở đây. | Thêm bạn ăn ở tab Bạn đồng vị để gắn thẻ ở đây. | reworded by hand |
| Full size | Toàn bộ | Kích thước đầy đủ | Kích thước đầy đủ | suggestion used |
| Ordered in | Ăn tại chỗ | Đặt giao tận nơi | Đặt giao tận nơi | suggestion used |
| Synced backup file set | Đã đồng bộ bộ tệp sao lưu | Đã đặt tệp sao lưu đồng bộ | Đã đặt tệp sao lưu đồng bộ | suggestion used |
| {0} added to your buds | Đã thêm {0} vào buddy của bạn | Đã thêm {0} vào danh sách bạn cùng ăn của bạn | Đã thêm {0} vào danh sách bạn ăn | reworded by hand |
| {0} game | {0} trò chơi | Trò chơi {0} | Trò chơi {0} | suggestion used |
| {0} spent at home | {0} ở nhà | Đã tiêu {0} ở nhà | Đã tiêu {0} ở nhà | suggestion used |
| · +{0} a tag | · +{0} thẻ | · +{0} mỗi thẻ | · +{0} mỗi thẻ | suggestion used |

### Chinese (Simplified) (zh-Hans): 19 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # caught | # 已记录 | # 已接住 | # 已接住 | suggestion used |
| # dropped | # 已中断 | # 已掉落 | # 已掉落 | suggestion used |
| # popped | # 已弹出 | # 已戳破 | # 已戳破 | suggestion used |
| # regulars | # 常规餐 | # 常客 | # 家常去的店 | reworded by hand |
| # sliced | # 份 | # 已切 | # 已切 | suggestion used |
| # won | # 次 | # 胜 | 抓到 # 个 | reworded by hand |
| (downloads a 15 MB model once; turn off if your phone reloads) | （首次下载 15 MB 模型；若手机重启请关闭） | （首次下载 15 MB 模型；若手机重新加载请关闭） | （首次下载 15 MB 模型；若手机重新加载请关闭） | suggestion used |
| Ordered in | 下单于 | 点外卖 | 点外卖 | suggestion used |
| Pen colour {0} | 笔颜色 {0} | 笔的颜色 {0} | 笔的颜色 {0} | suggestion used |
| Plan makan and mark “We went” | 计划 makan 并标记“We went” | 计划 makan 并标记“我们去了” | 计划 makan 并标记“我们去了” | suggestion used |
| Pop the plates as they rise. | 餐盘升起时，为它们喝彩。 | 餐盘升起时，把它们戳破。 | 餐盘升起时，把它们戳破。 | suggestion used |
| Synced backup file set | 已同步备份文件 | 已设置同步备份文件 | 已设置同步备份文件 | suggestion used |
| Tag {0}: +{1} pts, {2} to {3} | 标签 {0}：+{1} 分，{2} 到 {3} | 标记 {0}：+{1} 分，{2} 到 {3} | 标记 {0}：+{1} 分，{2} 到 {3} | suggestion used |
| Yes, 1 time. Last eaten {0} at {1}. | 是的，1次。上次在{1}吃了{0}。 | 是的，1次。上次{0}在{1}吃过。 | 是的，1次。上次{0}在{1}吃过。 | suggestion used |
| Yes, 1 time. Last eaten {0}. | 是的，1次。上次吃了{0}。 | 是的，1次。上次吃是{0}。 | 是的，1次。上次吃是{0}。 | suggestion used |
| Yes, {0} times. Last eaten {1} at {2}. | 是的，{0}次。上次在{2}吃了{1}。 | 是的，{0}次。上次吃是{1}，在{2}。 | 是的，{0}次。上次吃是{1}，在{2}。 | suggestion used |
| Yes, {0} times. Last eaten {1}. | 是的，{0}次。上次吃了{1}。 | 是的，{0}次。上次吃是{1}。 | 是的，{0}次。上次吃是{1}。 | suggestion used |
| {0} ({1} new) | {0}（{1} 新） | {0}（新增 {1}） | {0}（新增 {1}） | suggestion used |
| · +{0} a tag | · +{0} 标签 | · 每个标签 +{0} | · 每个标签 +{0} | suggestion used |

### Chinese (Traditional) (zh-Hant): 14 flags

| English | Before | Suggested | Ships now | Result |
| --- | --- | --- | --- | --- |
| # regulars | # 常規 | # 常客 | # 家常去的店 | reworded by hand |
| # sliced | # 切片 | # 已切片 | # 已切片 | suggestion used |
| Add buds on the Taste buds tab to tag them here. | 在 Taste buds 分頁加入 buds，就能在這裡標記他們。 | 在 Taste buds 分頁加入飯友，就能在這裡標記他們。 | 在「味覺夥伴」分頁加入飯友，就能在這裡標記他們。 | reworded by hand |
| All of {0} | 所有 {0} | 整個 {0} | {0} 全年 | reworded by hand |
| Auto cutout off. Tap Cut out on a photo to run it once. | 自動裁切已關閉。點按照片上的「裁切」即可執行一次。 | 自動去背已關閉。點按照片上的「去背」即可執行一次。 | 自動裁切已關閉。點按照片上的「裁切」即可執行一次。 | kept as it was |
| Have I eaten this? Try “bakso” | 我吃过这个吗？試試「bakso」 | 我吃過這個嗎？試試「bakso」 | 我吃過這個嗎？試試「bakso」 | suggestion used |
| Not on the map yet | 還沒在地图上 | 還沒在地圖上 | 還沒在地圖上 | suggestion used |
| Photos will be cut out automatically | 照片會自動裁切 | 照片會自動去背 | 照片會自動裁切 | kept as it was |
| Yes, 1 time. Last eaten {0} at {1}. | 有，1 次。上次在 {1} 吃了 {0}。 | 有，1 次。上次 {0} 在 {1} 吃過。 | 有，1 次。上次 {0} 在 {1} 吃過。 | suggestion used |
| Yes, 1 time. Last eaten {0}. | 有，1 次。上次吃了 {0}。 | 有，1 次。上次 {0} 吃過。 | 有，1 次。上次 {0} 吃過。 | suggestion used |
| Yes, {0} times. Last eaten {1} at {2}. | 有，{0} 次。上次在 {2} 吃了 {1}。 | 有，{0} 次。上次 {1} 在 {2} 吃過。 | 有，{0} 次。上次 {1} 在 {2} 吃過。 | suggestion used |
| Yes, {0} times. Last eaten {1}. | 有，{0} 次。上次吃了 {1}。 | 有，{0} 次。上次 {1} 吃過。 | 有，{0} 次。上次 {1} 吃過。 | suggestion used |
| {0} spent at home | {0} 在家攝取 | 在家花費 {0} | 在家花費 {0} | suggestion used |
| · +{0} a tag | · +{0} 標籤 | · 每個標籤 +{0} | · 每個標籤 +{0} | suggestion used |

## Changed by hand without a flag

These strings were not flagged. They were changed to keep one term per language, to fit a small phone, or
because a hand read found a better word.

### German (de): 20 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add your first bud | Füge deinen ersten Bud hinzu | Füge deinen ersten Buddy hinzu | new in this release |
| Buds | Knospen | Buddies | in the previous release |
| Drag back and let go at the stack | Zurückziehen und am Stapel loslassen | Zurückziehen und auf den Stapel loslassen | in the previous release |
| Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them. | Alle Mahlzeiten, Fotos, Buds und Pläne auf diesem Gerät löschen? Exportiere zuerst ein Backup, falls du sie aufbewahren möchtest. | Alle Mahlzeiten, Fotos, Buddies und Pläne auf diesem Gerät löschen? Exportiere zuerst ein Backup, falls du sie aufbewahren möchtest. | new in this release |
| Example buds to try | Beispiel-Buds zum Ausprobieren | Beispiel-Buddies zum Ausprobieren | new in this release |
| Makan buddy | Makan, Kumpel | Makan-Buddy | in the previous release |
| Move the tray, catch what falls | Bewege das Tablett, fang, was fällt | Bewege das Tablett und fang, was fällt | in the previous release |
| No buds yet. Invite a friend, or add an example profile below to try tagging and hangouts. | Noch keine Buds. Lade einen Freund ein oder füge unten ein Beispielprofil hinzu, um Tagging und Treffen auszuprobieren. | Noch keine Buddies. Lade einen Freund ein oder füge unten ein Beispielprofil hinzu, um Tagging und Treffen auszuprobieren. | new in this release |
| No gravity. Fling them about | Keine Schwerkraft. Wirf sie umher | Keine Schwerkraft. Wirf sie herum | in the previous release |
| No match in your diary yet. Type the dish name. | Noch keine Übereinstimmung in deinem Tagebuch. Gib den dish-Namen ein. | Noch keine Übereinstimmung in deinem Tagebuch. Gib den Namen des Gerichts ein. | new in this release |
| No plans yet. Add a bud first. | Noch keine Pläne. Füge zuerst einen Bud hinzu. | Noch keine Pläne. Füge zuerst einen Buddy hinzu. | new in this release |
| Only one dish in this cut-out. | Nur ein dish in diesem Ausschnitt. | Nur ein Gericht in diesem Ausschnitt. | new in this release |
| Pop the plates as they rise | Tippe die Teller, wenn sie hochkommen | Lass die Teller platzen, während sie aufsteigen | in the previous release |
| Progress to Makan buddy | Fortschritt zum Essen-Buddy | Fortschritt zum Makan-Buddy | in the previous release |
| Swipe through the tossed plates | Wische durch die geworfenen Platten | Wische durch die hochgeworfenen Teller | in the previous release |
| Tap each plate before it hides | Tippe jede Platte, bevor sie sich versteckt | Tippe jeden Teller an, bevor er verschwindet | in the previous release |
| Tap to drop the claw, win a plate | Tippen, um den Greifer zu senken und eine Platte zu gewinnen | Tippen, um den Greifer zu senken und einen Teller zu gewinnen | in the previous release |
| Tap to drop your plates into a pile | Tippen, um deine Platten in einen Haufen zu werfen | Tippen, um deine Teller auf einen Haufen zu werfen | in the previous release |
| These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet. | Das sind Beispielprofile, damit du Matching, Tagging und Hangouts ausprobieren kannst. Lahap hat noch keinen Server: Geschmacksknospen und Punkte bleiben auf diesem Gerät, und Einladungen werden über WhatsApp oder die Freigabe deines Telefons gesendet. | Das sind Beispielprofile, damit du Matching, Tagging und Treffen ausprobieren kannst. Lahap hat noch keinen Server: Geschmacksknospen und Punkte bleiben auf diesem Gerät, und Einladungen werden über WhatsApp oder die Freigabe deines Telefons gesendet. | in the previous release |
| · Kangkung and tofu stir-fry | · Kangkung und Tofu gebraten | · Kangkung and tofu stir-fry | in the previous release |

### Spanish (es): 14 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add buds on the Taste buds tab to tag them here. | Agrega amigos en la pestaña Taste buds para etiquetarlos aquí. | Agrega amigos en la pestaña Amigos del sabor para etiquetarlos aquí. | new in this release |
| Brown sugar boba | Boba de azúcar morena | Brown sugar boba | in the previous release |
| Buds | Compañeros | Amigos | in the previous release |
| Chicken caesar wrap | Wrap César de pollo | Chicken caesar wrap | in the previous release |
| Chinese | Chino | China | in the previous release |
| Find buds | Encuentra buds | Encuentra amigos | new in this release |
| Indonesian | Indonesio | Indonesia | in the previous release |
| Japanese | Japonés | Japonesa | in the previous release |
| Kangkung and tofu stir-fry | Salteado de kangkung y tofu | Kangkung and tofu stir-fry | in the previous release |
| Kimchi fried rice | Arroz frito con kimchi | Kimchi fried rice | in the previous release |
| Malay | Malayo | Malaya | in the previous release |
| When your friend opens it, Lahap adds you as each other's bud and shows how close your tastes are. | Cuando tu amigo lo abra, Lahap los agregará como buds y mostrará qué tan parecidos son sus gustos. | Cuando tu amigo lo abra, Lahap los agregará como amigos y mostrará qué tan parecidos son sus gustos. | in the previous release |
| Your buds | Tus buds | Tus amigos | in the previous release |
| · Kangkung and tofu stir-fry | · Salteado de kangkung y tofu | · Kangkung and tofu stir-fry | in the previous release |

### French (fr): 16 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| # pts to Makan buddy | # pts pour copain Makan | # pts pour Makan buddy | in the previous release |
| Add a bud on Taste buds and tag them in meals. | Ajoutez un bud sur Taste buds et étiquetez-le dans vos repas. | Ajoutez un ami dans Amis du goût et étiquetez-le dans vos repas. | new in this release |
| Chinese | Chinois | Chinoise | in the previous release |
| Dessert & drinks | Desserts & boissons | Desserts et boissons | in the previous release |
| Find buds | Trouver des buds | Trouver des amis | new in this release |
| Indonesian | Indonésien | Indonésienne | in the previous release |
| Japanese | Japonais | Japonaise | in the previous release |
| Log a meal in about 15 seconds: dish, place, price, and how the plate looked. Everything stays on this device. | Enregistrez un repas en 15 secondes environ : dish, lieu, prix et l'aspect de l'assiette. Tout reste sur cet appareil. | Enregistrez un repas en 15 secondes environ : plat, lieu, prix et l'aspect de l'assiette. Tout reste sur cet appareil. | new in this release |
| Malay | Malaisien | Malaise | in the previous release |
| Tag a bud in a meal | Étiquetez un bud dans un repas | Étiquetez un ami dans un repas | in the previous release |
| Taste buds | Buds du goût | Amis du goût | in the previous release |
| Tell Lahap what is in your kitchen and get home recipes sized for your goal. Cooked one? Log it to your Diary in one tap, plate and calories already filled in. | Dites à Lahap ce qu'il y a dans votre cuisine et obtenez des recettes maison adaptées à votre objectif. Cuisiné l'une ? Enregistrez-la dans votre Diary en un tap, assiette et calories déjà remplies. | Dites à Lahap ce qu'il y a dans votre cuisine et obtenez des recettes maison adaptées à votre objectif. Vous en avez cuisiné une ? Enregistrez-la dans votre Journal en un tap, assiette et calories déjà remplies. | in the previous release |
| These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet. | Ce sont des profils d'exemple pour que vous puissiez essayer le matching, l'étiquetage et les sorties. Lahap n'a pas encore de serveur : les buds et les points restent sur cet appareil, et les invitations partent via WhatsApp ou la feuille de partage de votre téléphone. | Ce sont des profils d'exemple pour que vous puissiez essayer le matching, l'étiquetage et les sorties. Lahap n'a pas encore de serveur : les amis et les points restent sur cet appareil, et les invitations partent via WhatsApp ou la feuille de partage de votre téléphone. | in the previous release |
| Western | Occidental | Occidentale | in the previous release |
| Your buds | Tes copains | Vos amis | in the previous release |
| · Kangkung and tofu stir-fry | · Kangkung et tofu sautés | · Kangkung and tofu stir-fry | in the previous release |

### Bahasa Indonesia (id): 16 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add a bud on Taste buds and tag them in meals. | Tambahkan bud di Taste buds dan tag mereka di makanan. | Tambahkan teman makan di Teman rasa dan tandai mereka di makananmu. | new in this release |
| Add your first bud | Tambahkan bud pertamamu | Tambahkan teman makan pertamamu | new in this release |
| Delete this meal? | Hapus makan ini? | Hapus makanan ini? | new in this release |
| Find buds | Cari bud | Cari teman makan | new in this release |
| Log 3 meals to see your match. | Catat 3 makan untuk melihat match-mu. | Catat 3 makanan untuk melihat kecocokanmu. | new in this release |
| Name the dish first | Beri nama dish dulu | Beri nama hidangannya dulu | new in this release |
| No buds yet. Invite a friend, or add an example profile below to try tagging and hangouts. | Belum ada bud. Undang teman, atau tambahkan profil contoh di bawah untuk mencoba tagging dan hangout. | Belum ada teman makan. Undang teman, atau tambahkan profil contoh di bawah untuk mencoba menandai dan makan bareng. | new in this release |
| No match in your diary yet. Type the dish name. | Belum ada yang cocok di jurnal kamu. Ketik nama dish. | Belum ada yang cocok di jurnalmu. Ketik nama hidangannya. | new in this release |
| No plans yet. Add a bud first. | Belum ada rencana. Tambahkan bud dulu. | Belum ada rencana. Tambahkan teman makan dulu. | new in this release |
| Only one dish in this cut-out. | Hanya satu dish di potongan ini. | Hanya satu hidangan di potongan ini. | new in this release |
| Picked from {0} dishes you rated 4 or 5, or hearted. | Dipilih dari {0} dish yang kamu beri rating 4 atau 5, atau disukai. | Dipilih dari {0} hidangan yang kamu beri nilai 4 atau 5, atau kamu sukai. | new in this release |
| Remove {0} from your buds? Your past meals stay tagged, but they won't count for points anymore. | Hapus {0} dari bud-mu? Makanan masa lalumu tetap bertanda, tapi tidak akan dihitung untuk poin lagi. | Hapus {0} dari teman makanmu? Makanan lamamu tetap bertanda, tapi tidak lagi dihitung untuk poin. | new in this release |
| Tell Lahap what is in your kitchen and get home recipes sized for your goal. Cooked one? Log it to your Diary in one tap, plate and calories already filled in. | Katakan ke Lahap apa yang ada di dapurmu dan dapatkan resep rumahan sesuai targetmu. Sudah masak? Catat ke Diary-mu dalam satu ketuk, piring dan kalori sudah terisi. | Katakan ke Lahap apa yang ada di dapurmu dan dapatkan resep rumahan sesuai targetmu. Sudah masak? Catat ke Jurnalmu dalam satu ketuk, piring dan kalori sudah terisi. | in the previous release |
| These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet. | Ini profil contoh agar kamu bisa mencoba matching, tagging, dan hangout. Lahap belum punya server: teman dan poin tetap di perangkat ini, dan undangan dikirim melalui WhatsApp atau share sheet ponselmu. | Ini profil contoh agar kamu bisa mencoba pencocokan, penandaan, dan makan bareng. Lahap belum punya server: teman makan dan poin tetap di perangkat ini, dan undangan dikirim melalui WhatsApp atau menu bagikan ponselmu. | in the previous release |
| When your friend opens it, Lahap adds you as each other's bud and shows how close your tastes are. | Saat temanmu membukanya, Lahap menambahkan kalian sebagai bud satu sama lain dan menunjukkan seberapa dekat selera kalian. | Saat temanmu membukanya, Lahap menambahkan kalian sebagai teman makan satu sama lain dan menunjukkan seberapa dekat selera kalian. | in the previous release |
| Your buds | Bud-mu | Teman makanmu | in the previous release |

### Italian (it): 13 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add a bud on Taste buds and tag them in meals. | Aggiungi un bud su Gusti e taggalo nei pasti. | Aggiungi un amico in Amici del gusto e taggalo nei pasti. | new in this release |
| Add buds on the Taste buds tab to tag them here. | Aggiungi buds nella scheda Taste buds per taggarli qui. | Aggiungi amici nella scheda Amici del gusto per taggarli qui. | new in this release |
| Find buds | Trova i bud | Trova amici | new in this release |
| Indonesian | Indonesiano | Indonesiana | in the previous release |
| Only one dish in this cut-out. | Solo un dish in questo ritaglio. | Solo un piatto in questo ritaglio. | new in this release |
| Tag a bud in a meal | Tagga un bud in un pasto | Tagga un amico in un pasto | in the previous release |
| Taste buds | Bud del gusto | Amici del gusto | in the previous release |
| The Lab leaves these out of every recipe. | The Lab li esclude da ogni ricetta. | Il Lab li esclude da ogni ricetta. | new in this release |
| These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet. | Questi sono profili di esempio per provare matching, tagging e hangout. Lahap non ha ancora un server: bud e punti restano su questo dispositivo, e gli inviti partono tramite WhatsApp o la scheda di condivisione del telefono. | Questi sono profili di esempio per provare abbinamenti, tag e uscite. Lahap non ha ancora un server: amici e punti restano su questo dispositivo, e gli inviti partono tramite WhatsApp o la scheda di condivisione del telefono. | in the previous release |
| When your friend opens it, Lahap adds you as each other's bud and shows how close your tastes are. | Quando il tuo amico lo apre, Lahap vi aggiunge come buddy e mostra quanto sono simili i vostri gusti. | Quando il tuo amico lo apre, Lahap vi aggiunge come amici e mostra quanto sono simili i vostri gusti. | in the previous release |
| Your buds | I tuoi buddy | I tuoi amici | in the previous release |
| {0} added to your buds | {0} aggiunto ai tuoi buds | {0} aggiunto ai tuoi amici | new in this release |
| · Kangkung and tofu stir-fry | · Kangkung e tofu saltati | · Kangkung and tofu stir-fry | in the previous release |

### Japanese (ja): 11 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| All insights | すべてのインサイト | すべての分析 | in the previous release |
| Indonesian | インドネシア | インドネシア料理 | in the previous release |
| Insights | インサイト | 分析 | in the previous release |
| Japanese | 日本語 | 和食 | in the previous release |
| Kangkung and tofu stir-fry | Kangkungと豆腐の炒め物 | Kangkung and tofu stir-fry | in the previous release |
| Kimchi fried rice | キムチチャーハン | Kimchi fried rice | in the previous release |
| Malay | マレー | マレー料理 | in the previous release |
| Remove {0} from your buds? Your past meals stay tagged, but they won't count for points anymore. | {0}をバッドから削除しますか？過去の記録はタグが残りますが、ポイントにはカウントされなくなります。 | {0}を仲間から削除しますか？過去の記録はタグが残りますが、ポイントにはカウントされなくなります。 | new in this release |
| When your friend opens it, Lahap adds you as each other's bud and shows how close your tastes are. | 友達が開くと、Lahapが互いをバディとして追加し、味の相性を表示します。 | 友達が開くと、Lahapが互いを仲間として追加し、味の相性を表示します。 | in the previous release |
| Your buds | あなたのバディ | あなたの仲間 | in the previous release |
| · Kangkung and tofu stir-fry | · Kangkungと豆腐の炒め物 | · Kangkung and tofu stir-fry | in the previous release |

### Korean (ko): 16 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| # pts to Makan buddy | # pts Makan 버디까지 | Makan buddy까지 #점 | in the previous release |
| Drag back and let go at the stack | 뒤로 드래그해서 스택에 놓기 | 뒤로 당겼다가 놓아 더미를 맞히세요 | in the previous release |
| Hold to pull them to your finger | 누르고 있으면 손가락으로 끌어올 수 있어요 | 길게 누르면 손가락 쪽으로 끌려와요 | in the previous release |
| Indonesian | 인도네시아어 | 인도네시아 음식 | in the previous release |
| Japanese | 일본어 | 일식 | in the previous release |
| Malay | 말레이어 | 말레이 음식 | in the previous release |
| No gravity. Fling them about | 중력 없음. 던져보세요 | 중력 없음. 마음껏 던져보세요 | in the previous release |
| Pop the plates as they rise | 접시가 올라오면 터뜨리세요 | 접시가 떠오르면 터뜨리세요 | in the previous release |
| Swipe through the tossed plates | 던져진 플레이트를 스와이프하세요 | 던져진 접시를 스와이프로 베세요 | in the previous release |
| Tap each plate before it hides | 플레이트가 숨기기 전에 각각 탭하세요 | 접시가 숨기 전에 하나씩 탭하세요 | in the previous release |
| Tap to drop the claw, win a plate | 탭해서 클로를 내리고 플레이트를 획득하세요 | 탭해서 집게를 내리고 접시를 뽑으세요 | in the previous release |
| Tap to drop your plates into a pile | 탭해서 플레이트를 쌓으세요 | 탭해서 접시를 쌓으세요 | in the previous release |
| Western | 서양 | 양식 | in the previous release |
| When your friend opens it, Lahap adds you as each other's bud and shows how close your tastes are. | 친구가 열면 Lahap이 서로를 버디로 추가하고 취향 유사도를 보여줘. | 친구가 열면 Lahap이 서로를 맛친구로 추가하고 취향 유사도를 보여줘. | in the previous release |
| Your buds | 내 버디 | 내 친구 | in the previous release |
| · Kangkung and tofu stir-fry | · Kangkung 두부 볶음 | · Kangkung and tofu stir-fry | in the previous release |

### Malay (ms): 11 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add a bud on Taste buds and tag them in meals. | Tambah bud di Bud Rasa dan tag mereka dalam hidangan. | Tambah rakan makan di Rakan rasa dan tag mereka dalam hidangan. | new in this release |
| Buds | Tunas | Rakan | in the previous release |
| Dessert & drinks | Penutup & minuman | Pencuci mulut & minuman | in the previous release |
| Find buds | Cari bud | Cari rakan makan | new in this release |
| Retake the quiz | Ulang kuis | Ulang kuiz | in the previous release |
| Tag a bud in a meal | Tag seorang bud dalam makanan | Tag seorang rakan makan dalam hidangan | in the previous release |
| Taste buds | Bud rasa | Rakan rasa | in the previous release |
| Tell Lahap what is in your kitchen and get home recipes sized for your goal. Cooked one? Log it to your Diary in one tap, plate and calories already filled in. | Beri tahu Lahap apa yang ada di dapur anda dan dapatkan resipi rumah mengikut sasaran anda. Sudah masak? Catat ke Diary anda dengan satu ketikan, pinggan dan kalori sudah diisi. | Beri tahu Lahap apa yang ada di dapur anda dan dapatkan resipi rumah mengikut sasaran anda. Sudah masak? Catat ke Jurnal anda dengan satu ketikan, pinggan dan kalori sudah diisi. | in the previous release |
| These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet. | Ini adalah profil contoh supaya anda boleh cuba padanan, tag dan hangout. Lahap belum ada pelayan: bud dan mata kekal pada peranti ini, dan jemputan dihantar melalui WhatsApp atau lembaran kongsi telefon anda. | Ini adalah profil contoh supaya anda boleh cuba padanan, tag dan makan bersama. Lahap belum ada pelayan: rakan makan dan mata kekal pada peranti ini, dan jemputan dihantar melalui WhatsApp atau lembaran kongsi telefon anda. | in the previous release |
| When your friend opens it, Lahap adds you as each other's bud and shows how close your tastes are. | Apabila rakan anda membukanya, Lahap tambah anda sebagai bud satu sama lain dan tunjukkan betapa dekatnya cita rasa anda. | Apabila rakan anda membukanya, Lahap tambah anda sebagai rakan makan satu sama lain dan tunjukkan betapa dekatnya cita rasa anda. | in the previous release |
| Your buds | Bud anda | Rakan makan anda | in the previous release |

### Portuguese (Brazil) (pt-BR): 17 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add a bud on Taste buds and tag them in meals. | Adicione um bud em Taste buds e marque nas refeições. | Adicione um amigo em Amigos de sabor e marque-o nas refeições. | new in this release |
| Add buds on the Taste buds tab to tag them here. | Adicione buds na aba Taste buds para marcá-los aqui. | Adicione amigos na aba Amigos de sabor para marcá-los aqui. | new in this release |
| Dessert & drinks | Sobremesas & bebidas | Sobremesas e bebidas | in the previous release |
| Find buds | Encontrar buds | Encontrar amigos | new in this release |
| Indonesian | Indonésio | Indonésia | in the previous release |
| Japanese | Japonês | Japonesa | in the previous release |
| Kangkung and tofu stir-fry | Refogado de kangkung e tofu | Kangkung and tofu stir-fry | in the previous release |
| Kimchi fried rice | Arroz frito com kimchi | Kimchi fried rice | in the previous release |
| Makan buddy | Parceiro de makan | Makan buddy | in the previous release |
| Malay | Malaio | Malaia | in the previous release |
| Picked from {0} dishes you rated 4 or 5, or hearted. | Escolhido de {0} dish que você avaliou com 4 ou 5, ou favoritou. | Escolhido entre {0} pratos que você avaliou com 4 ou 5, ou favoritou. | new in this release |
| Tag a bud in a meal | Marque um bud em uma refeição | Marque um amigo em uma refeição | in the previous release |
| Taste buds | Buds de sabor | Amigos de sabor | in the previous release |
| These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet. | Estes são perfis de exemplo para você testar compatibilidade, marcação e encontros. O Lahap ainda não tem servidor: buds e pontos ficam neste dispositivo, e convites saem pelo WhatsApp ou pela folha de compartilhamento do seu celular. | Estes são perfis de exemplo para você testar compatibilidade, marcação e encontros. O Lahap ainda não tem servidor: amigos e pontos ficam neste dispositivo, e convites saem pelo WhatsApp ou pela folha de compartilhamento do seu celular. | in the previous release |
| When your friend opens it, Lahap adds you as each other's bud and shows how close your tastes are. | Quando seu amigo abrir, o Lahap adiciona vocês como buds e mostra o quão parecidos são seus gostos. | Quando seu amigo abrir, o Lahap adiciona vocês como amigos e mostra o quão parecidos são seus gostos. | in the previous release |
| Your buds | Seus buds | Seus amigos | in the previous release |
| · Kangkung and tofu stir-fry | · Kangkung e tofu refogados | · Kangkung and tofu stir-fry | in the previous release |

### Thai (th): 6 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add a bud on Taste buds and tag them in meals. | เพิ่มบัดใน Taste buds แล้วแท็กในมื้ออาหาร. | เพิ่มเพื่อนกินใน เพื่อนชิม แล้วแท็กในมื้ออาหาร | new in this release |
| Add buds on the Taste buds tab to tag them here. | เพิ่มบัดในแท็บ Taste buds เพื่อแท็กที่นี่ | เพิ่มเพื่อนกินในแท็บ เพื่อนชิม เพื่อแท็กที่นี่ | new in this release |
| Buds | เพื่อนลิ้น | เพื่อนกิน | in the previous release |
| Dessert & drinks | ของหวาน & เครื่องดื่ม | ของหวานและเครื่องดื่ม | in the previous release |
| Your buds | บัดดี้ของคุณ | เพื่อนกินของคุณ | in the previous release |
| · Kangkung and tofu stir-fry | · ผัด Kangkung กับเต้าหู้ | · Kangkung and tofu stir-fry | in the previous release |

### Vietnamese (vi): 20 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add Arif as a bud on this device | Thêm Arif làm bạn đồng hành trên thiết bị này | Thêm Arif làm bạn ăn trên thiết bị này | in the previous release |
| Add bud | Thêm bạn đồng hành | Thêm bạn ăn | in the previous release |
| Add Dewi as a bud on this device | Thêm Dewi làm bạn đồng hành trên thiết bị này | Thêm Dewi làm bạn ăn trên thiết bị này | in the previous release |
| Add Jonas as a bud on this device | Thêm Jonas làm bạn đồng hành trên thiết bị này | Thêm Jonas làm bạn ăn trên thiết bị này | in the previous release |
| Add Mei Lin as a bud on this device | Thêm Mei Lin làm bạn đồng hành trên thiết bị này | Thêm Mei Lin làm bạn ăn trên thiết bị này | in the previous release |
| Admit one · taste bud | Vào một người · bạn đồng hành | Vào một người · bạn ăn | in the previous release |
| Buds | Bạn đồng hành | Bạn ăn | in the previous release |
| Find buds | Tìm buddy | Tìm bạn ăn | new in this release |
| Indonesian | Tiếng Indonesia | Indonesia | in the previous release |
| Japanese | Tiếng Nhật | Nhật Bản | in the previous release |
| Makan bud | Bạn đồng ăn Makan | Bạn ăn Makan | new in this release |
| Malay | Tiếng Mã Lai | Mã Lai | in the previous release |
| No match in your diary yet. Type the dish name. | Chưa có gì khớp trong nhật ký. Gõ tên dish. | Chưa có gì khớp trong nhật ký. Gõ tên món. | new in this release |
| One pick from the dishes you already love | Một lựa chọn từ những dish bạn đã yêu thích | Một lựa chọn từ những món bạn đã yêu thích | new in this release |
| Only one dish in this cut-out. | Chỉ có một dish trong khung này. | Chỉ có một món trong ảnh cắt này. | new in this release |
| Plan makan and mark “We went” | Lên kế hoạch ăn và đánh dấu “Mình đã đi” | Lên kế hoạch ăn và đánh dấu “Đã đi” | in the previous release |
| Remove {0} from your buds? Your past meals stay tagged, but they won't count for points anymore. | Gỡ {0} khỏi buddy của bạn? Các bữa trước vẫn giữ nhãn, nhưng không còn tính điểm nữa. | Gỡ {0} khỏi danh sách bạn ăn? Các bữa trước vẫn giữ nhãn, nhưng không còn tính điểm nữa. | new in this release |
| Skip the quiz | Bỏ qua bài quiz | Bỏ qua bài kiểm tra | new in this release |
| Western | Tây | Phương Tây | in the previous release |
| · Kangkung and tofu stir-fry | · Xào kangkung đậu phụ | · Kangkung and tofu stir-fry | in the previous release |

### Chinese (Simplified) (zh-Hans): 21 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Add a bud on Taste buds and tag them in meals. | 在味蕾中添加好友，并在餐食中标记他们。 | 在「味蕾伙伴」页添加饭搭子，并在餐食中标记他们。 | new in this release |
| Add Arif as a bud on this device | 在本设备添加 Arif 为味蕾伙伴 | 在本设备添加 Arif 为饭搭子 | in the previous release |
| Add bud | 添加味蕾伙伴 | 添加饭搭子 | in the previous release |
| Add buds on the Taste buds tab to tag them here. | 在「饭搭子」页添加，就能在这里标记了。 | 在「味蕾伙伴」页添加饭搭子，就能在这里标记了。 | new in this release |
| Add Dewi as a bud on this device | 在本设备添加 Dewi 为味蕾伙伴 | 在本设备添加 Dewi 为饭搭子 | in the previous release |
| Add Jonas as a bud on this device | 在本设备添加 Jonas 为味蕾伙伴 | 在本设备添加 Jonas 为饭搭子 | in the previous release |
| Add Mei Lin as a bud on this device | 在本设备添加 Mei Lin 为味蕾伙伴 | 在本设备添加 Mei Lin 为饭搭子 | in the previous release |
| Admit one · taste bud | 一人入场 · 味蕾伙伴 | 一人入场 · 饭搭子 | in the previous release |
| Buds | 味蕾伙伴 | 饭搭子 | in the previous release |
| Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them. | 确定要删除此设备上的所有餐食、照片、伙伴和计划吗？如果想保留，请先导出备份。 | 确定要删除此设备上的所有餐食、照片、饭搭子和计划吗？如果想保留，请先导出备份。 | new in this release |
| Find buds | 寻找好友 | 寻找饭搭子 | new in this release |
| Indonesian | 印尼语 | 印尼菜 | in the previous release |
| Japanese | 日式 | 日本料理 | in the previous release |
| Makan buddy | 开饭啦，伙伴 | Makan 搭子 | in the previous release |
| Malay | 马来语 | 马来菜 | in the previous release |
| Progress to Makan buddy | 距离Makan搭子的进度 | 距离 Makan 搭子的进度 | in the previous release |
| Tag a bud in a meal | 在餐食中标记好友 | 在餐食中标记饭搭子 | in the previous release |
| Taste buds | 味蕾 | 味蕾伙伴 | in the previous release |
| These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet. | 这些是示例档案，供你体验匹配、标记和聚会功能。Lahap 尚无服务器：好友和积分保存在此设备上，邀请通过 WhatsApp 或手机分享面板发出。 | 这些是示例档案，供你体验匹配、标记和聚会功能。Lahap 尚无服务器：饭搭子和积分保存在此设备上，邀请通过 WhatsApp 或手机分享面板发出。 | in the previous release |
| When your friend opens it, Lahap adds you as each other's bud and shows how close your tastes are. | 当你的朋友打开时，Lahap 会将你们互加为美食搭子，并展示你们的口味有多接近。 | 当你的朋友打开时，Lahap 会将你们互加为饭搭子，并展示你们的口味有多接近。 | in the previous release |
| Your buds | 你的美食搭子 | 你的饭搭子 | in the previous release |

### Chinese (Traditional) (zh-Hant): 19 strings

| English | Before | Ships now | The string was |
| --- | --- | --- | --- |
| Buds | 味蕾好友 | 飯友 | in the previous release |
| Chinese | 中式 | 中式料理 | in the previous release |
| Drag back and let go at the stack | 拖回堆疊處放開 | 往後拉再放開，射向那疊餐盤 | in the previous release |
| Hold to pull them to your finger | 長按並拉到手指處 | 長按把它們吸到手指旁 | in the previous release |
| Indonesian | 印尼語 | 印尼料理 | in the previous release |
| Japanese | 日語 | 日式料理 | in the previous release |
| Makan bud | Makan 食友 | Makan 飯友 | new in this release |
| Makan buddy | 飯搭子 | Makan 搭檔 | in the previous release |
| Malay | 馬來語 | 馬來料理 | in the previous release |
| No gravity. Fling them about | 無重力。隨意丟擲吧 | 沒有重力。隨意甩動吧 | in the previous release |
| Only one dish in this cut-out. | 這個截圖只有一道菜。 | 這張裁切圖只有一道菜。 | new in this release |
| Pop the plates as they rise | 餐盤升起時點擊 | 趁餐盤上升時戳破它 | in the previous release |
| Swipe through the tossed plates | 滑動翻閱丟出的盤子 | 滑過拋起的餐盤 | in the previous release |
| Tap each plate before it hides | 在盤子消失前輕觸它 | 在餐盤躲起來前輕觸它 | in the previous release |
| Tap to drop the claw, win a plate | 輕觸放下鉤爪，贏取一盤 | 輕觸放下夾子，贏取餐盤 | in the previous release |
| Tap to drop your plates into a pile | 輕觸將盤子丟入堆中 | 輕觸把餐盤丟成一堆 | in the previous release |
| Western | 西式 | 西式料理 | in the previous release |
| Your buds | 你的美食搭檔 | 你的飯友 | in the previous release |
| · Kangkung and tofu stir-fry | · Kangkung 炒豆腐 | · Kangkung and tofu stir-fry | in the previous release |
