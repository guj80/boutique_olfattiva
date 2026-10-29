# -*- coding: utf-8 -*-
import io

base = 'C:/Users/lukag/boutique_olfattiva'
p = base + '/lib/seed-data.ts'
lines = io.open(p, encoding='utf-8').read().split('\n')

# 1) Escape unescaped apostrophes
fixed = 0
for i, ln in enumerate(lines):
    if "rimugnito in un'occa-sione" in ln:
        lines[i] = ln.replace("rimugnito in un'occa-sione", "rimugnito in un\\'occa-sione")
        fixed += 1
    if "in un'ultima salita" in ln:
        lines[i] = ln.replace("in un'ultima salita", "in un\\'ultima salita")
        fixed += 1
    if "d'ogni cosa" in ln:
        lines[i] = ln.replace("d'ogni cosa", "d\\'ogni cosa")
        fixed += 1
print("apostrophe fixes:", fixed)

# 2) Restructure array: remove '];' (idx 383) + orphan Nero object (idx 384..399),
#    insert Nero object as array entry before index 400.
assert lines[383].strip() == '];', repr(lines[383])
nero_object = [
"  {",
"    id: 'perfume-nero-di-berlina',",
"    name: 'Nero di Berlina',",
"    brand: 'Amouage',",
"    maisonId: 'maison-ex-nihilo',",
"    family: 'Musky',",
"    concentration: 'Parfum',",
"    format: 'Eau de Parfum',",
"    priceUsd: 380,",
"    imageUrl: 'https://images.unsplash.com/photo-1508516970924-817d4b98128d?w=400&h=400&fit=crop',",
"    youtubeId: null,",
"    description: 'Un cammino a proposito di passione. Il profumo di luce putrefatta in cui la natura globale è per niente ascetica, quasi una direzione di un ordine pulito.',",
"    sourceUrl: 'https://www.amouage.com/it/it/perfume/nero-di-berlina',",
"    confidence: 0.9,",
"    createdAt: new Date('2026-09-20').toISOString(),",
"    updatedAt: new Date('2026-09-20').toISOString(),",
"  },",
]
assert lines[384].strip().startswith('{ id:'), repr(lines[384])
assert lines[399].strip() == '},', repr(lines[399])
assert lines[400].strip().startswith('{'), repr(lines[400])
assert lines[401].strip() == '},', repr(lines[401])

new_lines = lines[:383] + nero_object + lines[400:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(new_lines))
print("restructured; new total lines:", len(new_lines))
