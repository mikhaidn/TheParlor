"""End-to-end check in a real browser (Playwright).

  python3 -m http.server 8765 &        # from the repo root
  pip install playwright && playwright install chromium
  python3 tests/e2e.py                 # BASE defaults to http://localhost:8765/site/

Plays a full FreeCell deal and today's Daily through the UI (taps, drags, undo,
reload-resume), then checks offline play through the service worker and the share card.
"""
import asyncio, base64, json, os
from playwright.async_api import async_playwright
BASE = os.environ.get('BASE', 'http://localhost:8765/site/')
CHROME = os.environ.get('CHROME')  # optional path to a Chrome binary

async def get_solution(pg, deal):
    return await pg.evaluate("""async (deal) => {
      const { solve } = await import('/tools/solver.js');
      return solve(window.Parlor, deal).moves.filter(m => !m.auto);
    }""", deal)

async def card_el(pg, pid, index):
    pile = pg.locator(f'[data-pile="{pid}"]')
    cls = await pile.get_attribute('class')
    if 'pl-card' in cls: return pile
    return pile.locator(':scope > .pl-card').nth(index)

async def tap_move(pg, m):
    src = await card_el(pg, m['from'], m['index'])
    await src.click(position={'x': 10, 'y': 8})
    await pg.locator(f'[data-pile="{m["to"]}"]').click(position={'x': 10, 'y': 8})

async def drag_move(pg, m):
    src = await card_el(pg, m['from'], m['index'])
    sb = await src.bounding_box()
    db = await pg.locator(f'[data-pile="{m["to"]}"]').bounding_box()
    await pg.mouse.move(sb['x']+10, sb['y']+8); await pg.mouse.down()
    await pg.mouse.move(sb['x']+30, sb['y']+30, steps=3)
    await pg.mouse.move(db['x']+db['width']/2, db['y']+20, steps=8)
    await pg.mouse.up()

async def play():
    async with async_playwright() as p:
        b = (await p.chromium.launch(executable_path=CHROME)) if CHROME else (await p.chromium.launch())
        ctx = await b.new_context(viewport={'width':1280,'height':900})
        pg = await ctx.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)

        # ---- FreeCell deal 1: taps for most moves, drag for some, undo once, reload mid-game ----
        await pg.goto(BASE+'freecell/?deal=1'); await pg.wait_for_timeout(400)
        sol = await get_solution(pg, 1)
        print('deal 1 user moves', len(sol))
        for i, m in enumerate(sol):
            if i == 10:
                await pg.reload(); await pg.wait_for_timeout(500)
                saved = await pg.evaluate("JSON.parse(localStorage.getItem('parlor.game.freecell'))")
                print('resumed with', len(saved['moves']), 'moves, deal', saved['deal'])
            if i == 12:
                # undo then redo the same move
                await tap_move(pg, m); await pg.wait_for_timeout(250)
                await pg.get_by_role('button', name='Undo').click(); await pg.wait_for_timeout(250)
            if i % 3 == 1: await drag_move(pg, m)
            else: await tap_move(pg, m)
            await pg.wait_for_timeout(230)
        await pg.wait_for_timeout(800)
        win = await pg.locator('.pl-win').count()
        print('win dialog shown:', win == 1, await pg.locator('.pl-win-line').text_content() if win else '')
        await pg.screenshot(path=os.path.join(os.environ.get('OUT', '/tmp'), 'shot-win.png'))
        stats = await pg.evaluate("JSON.parse(localStorage.getItem('parlor.stats.freecell'))")
        print('stats', stats)

        # ---- Daily ----
        await pg.goto(BASE+'daily/'); await pg.wait_for_timeout(400)
        await pg.get_by_text('Play today’s deal').click(); await pg.wait_for_timeout(400)
        deal = await pg.evaluate("import(new URL('../js/daily.js', document.baseURI).href).then(m => m.dealFor(m.dailyNumber()))")
        sol = await get_solution(pg, deal)
        print('daily deal', deal, 'user moves', len(sol))
        # hint + keyboard sanity
        await pg.get_by_role('button', name='Hint').click(); await pg.wait_for_timeout(200)
        print('hint glow count', await pg.locator('.is-hint').count())
        for i, m in enumerate(sol):
            if i % 4 == 2: await drag_move(pg, m)
            else: await tap_move(pg, m)
            await pg.wait_for_timeout(200)
        await pg.wait_for_timeout(1200)
        print('url after win', pg.url)
        await pg.screenshot(path=os.path.join(os.environ.get('OUT', '/tmp'), 'shot-solved.png'), full_page=True)
        rec = await pg.evaluate("JSON.parse(localStorage.getItem('parlor.daily.v1'))")
        print('daily record', json.dumps(rec)[:300])
        await pg.goto(BASE+'daily/'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=os.path.join(os.environ.get('OUT', '/tmp'), 'shot-today-done.png'), full_page=True)
        ev = await pg.evaluate("JSON.parse(localStorage.getItem('parlor.events.v1')).map(e=>e.name)")
        print('events', ev)
        print('errors', errs)
        await b.close()

async def pwa():
    async with async_playwright() as p:
        b = (await p.chromium.launch(executable_path=CHROME)) if CHROME else (await p.chromium.launch())
        ctx = await b.new_context(viewport={'width':390,'height':844})
        pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); 
        await pg.evaluate("navigator.serviceWorker.ready.then(()=>1)")
        await pg.wait_for_timeout(1500)
        print('sw controller', await pg.evaluate("!!navigator.serviceWorker.controller"))
        keys = await pg.evaluate("caches.keys().then(async ks => { const c = await caches.open(ks[0]); return [ks, (await c.keys()).length]; })")
        print('caches', keys)
        man = await pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json()).then(m=>[m.start_url, m.scope, m.icons.length])")
        print('manifest', man)
        await ctx.set_offline(True)
        for path in ['', 'freecell/?deal=617', 'daily/', 'daily/?ref=share']:
            await pg.goto(BASE+path); await pg.wait_for_timeout(600)
            n = await pg.locator('.pl-card, .pl-tile').count()
            print('offline', path or '/', 'cards/tiles:', n)
        await ctx.set_offline(False)
        await pg.goto(BASE); await pg.wait_for_timeout(300)
        # share card image
        data = await pg.evaluate("""async () => {
          const { drawShareCard } = await import(new URL('js/share.js', location.href).href);
          const grid = {spades:[0,0,0,1,1,1,2,2,3,3,3,3,3],hearts:[0,0,1,1,1,2,2,2,2,3,3,3,3],diamonds:[0,1,1,1,2,2,2,3,3,3,3,3,3],clubs:[0,0,0,0,1,1,2,2,2,3,3,3,3]};
          const blob = await drawShareCard({ n: 1, rec: { time: 221000, moves: 92, grid }, streak: 4, dateLabel: 'Wednesday, Nov 25', linkLabel: 'mikhaidn.github.io/TheParlor/daily/' });
          const buf = new Uint8Array(await blob.arrayBuffer()); let s=''; for (const c of buf) s += String.fromCharCode(c); return btoa(s);
        }""")
        open(os.path.join(os.environ.get('OUT', '/tmp'), 'share-card.png'),'wb').write(base64.b64decode(data))
        text = await pg.evaluate("""import(new URL('js/daily.js', location.href).href).then(m => m.shareText(1, {time:221000, moves:92, grid:{spades:[0,0,0,1,1,1,2,2,3,3,3,3,3],hearts:[0,0,1,1,1,2,2,2,2,3,3,3,3],diamonds:[0,1,1,1,2,2,2,3,3,3,3,3,3],clubs:[0,0,0,0,1,1,2,2,2,3,3,3,3]}}, 'https://mikhaidn.github.io/TheParlor/daily/?ref=share'))""")
        print(text)
        print('errors', errs)
        await b.close()

async def main():
    await play()
    await pwa()

asyncio.run(main())
