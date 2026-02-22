import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))

def analyze(name, fp):
    with open(fp) as f:
        data = json.load(f)

    print(f'\n{"="*70}')
    print(f'  {name.upper()}')
    print(f'{"="*70}')
    print(f'Total positions: {len(data)}')

    open_pos = [p for p in data if str(p.get("redeemable","")).lower() != "true"]
    settled = [p for p in data if str(p.get("redeemable","")).lower() == "true"]
    print(f'Open: {len(open_pos)} | Settled: {len(settled)}')

    cats = {}
    horizons = {}
    both = {}

    for p in data:
        title = p.get('title', '')
        outcome = p.get('outcome', '')
        size = float(p.get('size', 0))
        cash_pnl = float(p.get('cashPnl', 0) or 0)
        cur_val = float(p.get('currentValue', 0) or 0)
        init_val = float(p.get('initialValue', 0) or 0)
        redeem = str(p.get('redeemable','')).lower() == 'true'

        horizon = 'unknown'
        for h in ['1-minute', '5-minute', '15-minute', '30-minute', '1-hour', '4-hour', '12-hour', '1-day']:
            if h in title.lower():
                horizon = h
                break
        horizons[horizon] = horizons.get(horizon, 0) + 1

        asset = 'other'
        tl = title.lower()
        for a, k in [('BTC','bitcoin'), ('BTC','btc'), ('ETH','ethereum'), ('ETH','eth'), ('SOL','solana'), ('SOL','sol'), ('XRP','xrp'), ('DOGE','doge')]:
            if k in tl:
                asset = a
                break

        if 'up or down' in tl:
            mt = f'{asset} Up/Down'
        else:
            mt = f'Other: {title[:40]}'

        cats.setdefault(mt, {'n':0,'cost':0,'val':0,'pnl':0,'out':{},'op':0,'st':0})
        c = cats[mt]
        c['n'] += 1
        c['cost'] += init_val
        c['val'] += cur_val
        c['pnl'] += cash_pnl
        c['out'][outcome] = c['out'].get(outcome, 0) + 1
        if redeem:
            c['st'] += 1
        else:
            c['op'] += 1

        both.setdefault(title, set()).add(outcome)

    print(f'\n--- Market Types ---')
    for mt, i in sorted(cats.items(), key=lambda x: -x[1]['n']):
        outs = ', '.join(f'{k}:{v}' for k,v in sorted(i['out'].items()))
        print(f'  {mt}: {i["n"]} ({i["op"]} open, {i["st"]} settled)')
        print(f'    Cost: ${i["cost"]:,.0f} | Val: ${i["val"]:,.0f} | PnL: ${i["pnl"]:+,.0f}')
        print(f'    Outcomes: {outs}')

    print(f'\n--- Time Horizons ---')
    for h, n in sorted(horizons.items(), key=lambda x: -x[1]):
        print(f'  {h}: {n}')

    bc = sum(1 for m, o in both.items() if len(o) > 1)
    sc = sum(1 for m, o in both.items() if len(o) == 1)
    print(f'\n--- Hedging ---')
    print(f'  Both sides: {bc} markets | Single side: {sc} markets')

    # Show some both-sides examples
    if bc > 0:
        print(f'  Examples of both-sides markets:')
        count = 0
        for m, o in both.items():
            if len(o) > 1 and count < 5:
                print(f'    "{m}" -> {o}')
                count += 1

    wins = [p for p in settled if float(p.get('cashPnl',0) or 0) > 0]
    losses = [p for p in settled if float(p.get('cashPnl',0) or 0) < 0]
    even = [p for p in settled if float(p.get('cashPnl',0) or 0) == 0]
    wt = sum(float(p.get('cashPnl',0) or 0) for p in wins)
    lt = sum(float(p.get('cashPnl',0) or 0) for p in losses)
    print(f'\n--- Win/Loss (Settled) ---')
    print(f'  Wins: {len(wins)} (+${wt:,.0f}) | Losses: {len(losses)} (${lt:,.0f}) | Even: {len(even)}')
    if wins or losses:
        total = len(wins) + len(losses)
        wr = len(wins)/total*100 if total else 0
        print(f'  Win rate: {wr:.1f}%')
        if wins:
            print(f'  Avg win: +${wt/len(wins):,.2f}')
        if losses:
            print(f'  Avg loss: ${lt/len(losses):,.2f}')
        print(f'  Net PnL (settled): ${wt+lt:+,.0f}')

    # Avg position size
    all_sizes = [float(p.get('size',0)) for p in data if float(p.get('size',0)) > 0]
    all_costs = [float(p.get('initialValue',0) or 0) for p in data if float(p.get('initialValue',0) or 0) > 0]
    if all_sizes:
        print(f'\n--- Position Sizing ---')
        print(f'  Avg size: {sum(all_sizes)/len(all_sizes):,.0f} shares')
        print(f'  Median size: {sorted(all_sizes)[len(all_sizes)//2]:,.0f} shares')
        print(f'  Max size: {max(all_sizes):,.0f} shares')
        if all_costs:
            print(f'  Avg cost: ${sum(all_costs)/len(all_costs):,.2f}')
            print(f'  Max cost: ${max(all_costs):,.2f}')
            print(f'  Total invested: ${sum(all_costs):,.0f}')

    print(f'\n--- Top 10 Open by Value ---')
    for p in sorted(open_pos, key=lambda x: -float(x.get('currentValue',0) or 0))[:10]:
        t = p.get('title','')[:42]
        o = p.get('outcome','')
        v = float(p.get('currentValue',0) or 0)
        s = float(p.get('size',0))
        a = float(p.get('avgPrice',0))
        pnl = float(p.get('cashPnl',0) or 0)
        print(f'  ${v:>9,.0f} | {o:<5} | {s:>7,.0f}@{a:.3f} | PnL ${pnl:+,.0f} | {t}')

    # Avg price paid (detect cheap vs expensive entries)
    prices = [float(p.get('avgPrice',0)) for p in data if float(p.get('avgPrice',0)) > 0]
    if prices:
        print(f'\n--- Entry Prices ---')
        print(f'  Avg entry price: {sum(prices)/len(prices):.3f}')
        print(f'  Median entry price: {sorted(prices)[len(prices)//2]:.3f}')
        cheap = len([x for x in prices if x < 0.3])
        mid = len([x for x in prices if 0.3 <= x < 0.7])
        expensive = len([x for x in prices if x >= 0.7])
        print(f'  Cheap (<0.30): {cheap} | Mid (0.30-0.70): {mid} | Expensive (>0.70): {expensive}')

analyze('uncommon-oat', os.path.join(BASE, 'uo.json'))
analyze('square-guy', os.path.join(BASE, 'sg.json'))
analyze('swisstony', os.path.join(BASE, 'st.json'))
