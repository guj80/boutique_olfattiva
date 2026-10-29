import io

p = 'C:/Users/lukag/boutique_olfattiva/lib/seed-data.ts'
lines = io.open(p, encoding='utf-8').read().split('\n')

# 1) Escape unescaped apostrophes
assert "rimugnito in un'occa-sione" in lines[78]
lines[78] = lines[78].replace("rimugnito in un'occa-sione", "rimugnito in un\\'occa-sione")
assert "in un'ultima salita" in lines[83]
lines[83] = lines[83].replace("in un'ultima salita", "in un\\'ultima salita")

# 2) Remove the duplicate '  },' (index 399) that follows the Nero object's closing
assert lines[399].strip() == '},', repr(lines[399])
del lines[399]

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('fixed seed-data.ts: 2 apostrophes escaped, duplicate array entry removed')
