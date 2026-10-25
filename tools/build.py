"""Собирает companion.html из компаньона: python3 tools/build.py <index.html компаньона>"""
import sys, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
idx = open(sys.argv[1], encoding='utf-8').read()
read = lambda n: open(os.path.join(here, n), encoding='utf-8').read()
shim, api, css = read('shim.html'), read('api.js'), read('companion.css')


def patch(old, new):
    global idx
    assert idx.count(old) == 1, 'patch target not found: ' + old[:60]
    idx = idx.replace(old, new)


# хранилище и картинки на своём сервере (server.js)
patch("const blobUrl = id => id ? '/_blob/' + id : '';", "const blobUrl = id => window.__cmpBlob(id);")
patch("live: 'сохранено в облаке'", "live: 'сохранено на сервере'")
# посты Slutify, сохранённые из чата раньше (коллекция stories), видны в окне дня
patch("caldays: [] };", "caldays: [], stories: [] };")
patch("""'<label class="fld"><span class="lab">Заметка</span>""",
      """storyHtml(s, calEd.key) + '<label class="fld"><span class="lab">Заметка</span>""")
# мини-режим и просмотр постов Slutify
patch('render(); startDb();\n})();', api + '\nrender(); startDb();\n})();')

page = ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body>\n'
        + shim + idx + '\n</body></html>')
open(os.path.join(root, 'companion.html'), 'w', encoding='utf-8').write(page)
print('ok', len(page))
