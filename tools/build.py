"""Собирает companion.html из компаньона: python3 tools/build.py <index.html компаньона>"""
import sys, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
idx = open(sys.argv[1], encoding='utf-8').read()
shim = open(os.path.join(here, 'shim.html'), encoding='utf-8').read()
api = open(os.path.join(here, 'api.js'), encoding='utf-8').read()
old_blob = "const blobUrl = id => id ? '/_blob/' + id : '';"
assert idx.count(old_blob) == 1, 'blobUrl not found'
idx = idx.replace(old_blob, "const blobUrl = id => window.__cmpBlob(id);")
idx = idx.replace("live: 'сохранено в облаке'", "live: 'сохранено в ST'")
tail = 'render(); startDb();\n})();'
assert idx.count(tail) == 1, 'main script tail not found'
idx = idx.replace(tail, api + '\nrender(); startDb();\n})();')
page = ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n'
        + shim + idx + '\n</body></html>')
open(os.path.join(root, 'companion.html'), 'w', encoding='utf-8').write(page)
print('ok', len(page))
