import re
import json
import time
import os
import datetime
import requests

def fetch_url(url):
    sep = '&' if '?' in url else '?'
    final_url = f"{url}{sep}t={int(time.time() * 1000)}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
    resp = requests.get(final_url, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.text

IPL_TEAM_MAP = {
    "MI": "Mumbai Indians", "CSK": "Chennai Super Kings", "RCB": "Royal Challengers Bengaluru",
    "KKR": "Kolkata Knight Riders", "SRH": "Sunrisers Hyderabad", "PBKS": "Punjab Kings",
    "DC": "Delhi Capitals", "RR": "Rajasthan Royals", "GT": "Gujarat Titans", "LSG": "Lucknow Super Giants"
}

def is_team_match(candidate, target):
    if not candidate or not target:
        return False
    c = candidate.upper().strip()
    t = target.upper().strip()

    if c == t or c in t or t in c:
        return True

    for abbr, full in IPL_TEAM_MAP.items():
        if (c == abbr and t == full.upper()) or (t == abbr and c == full.upper()):
            return True

    c_initials = "".join([w[0] for w in c.split()])
    t_initials = "".join([w[0] for w in t.split()])
    if c_initials == t or t_initials == c:
        return True

    if c.split()[0] == t.split()[0] and len(c.split()[0]) >= 3:
        return True

    return False

def scrape_cricbuzz_match(team_a, team_b, match_path=None):
    try:
        path = match_path
        if not path:
            live_html = fetch_url('https://www.cricbuzz.com/cricket-match/live-scores')
            lower_a = team_a.lower()
            lower_b = team_b.lower()

            next_f_chunks = []
            for match in re.finditer(r'self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)', live_html):
                try:
                    next_f_chunks.append(json.loads('"' + match.group(1) + '"'))
                except:
                    next_f_chunks.append(match.group(1))
            next_f_str = "".join(next_f_chunks)

            found_match_id = None
            for match in re.finditer(r'"matchId":(\d+)[\s\S]{0,1500}?"teamSName":"([A-Z]+)"[\s\S]{0,500}?"teamSName":"([A-Z]+)"', next_f_str):
                t1 = match.group(2).lower()
                t2 = match.group(3).lower()
                if (is_team_match(t1, team_a) and is_team_match(t2, team_b)) or \
                   (is_team_match(t1, team_b) and is_team_match(t2, team_a)):
                    found_match_id = match.group(1)
                    break
            
            if not found_match_id:
                escaped_a = re.escape(IPL_TEAM_MAP.get(team_a, team_a))
                escaped_b = re.escape(IPL_TEAM_MAP.get(team_b, team_b))
                name_match = re.search(f'"matchId":(\\d+)[\\s\\S]{{0,800}}?{escaped_a}[\\s\\S]{{0,400}}?{escaped_b}', next_f_str, re.IGNORECASE)
                if name_match:
                    found_match_id = name_match.group(1)

            if not found_match_id:
                for match in re.finditer(r'href="(\/live-cricket-scores\/(\d+)\/([^"]+))"', live_html):
                    if lower_a in match.group(3) or lower_b in match.group(3):
                        context = live_html[max(0, match.start() - 500):match.start() + 500]
                        if lower_a in context.lower() and lower_b in context.lower():
                            path = match.group(1)
                            break

            if not path and found_match_id:
                slug_a = lower_a.replace(' ', '-')
                slug_b = lower_b.replace(' ', '-')
                path = f"/live-cricket-scores/{found_match_id}/{slug_a}-vs-{slug_b}-ipl-2026"

        if not path:
            return {'status': 'failure', 'reason': 'Match not found'}

        html = fetch_url(f"https://www.cricbuzz.com{path}")
        title_match = re.search(r'<title[^>]*>([\s\S]*?)<\/title>', html, re.IGNORECASE)
        desc_match = re.search(r'<meta\s+name="description"\s+content="([\s\S]*?)"', html, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else ''
        desc = desc_match.group(1).strip() if desc_match else ''

        status = 'In Progress'
        body_search = re.sub(r'<script[\s\S]*?>[\s\S]*?<\/script>', '', html, flags=re.IGNORECASE)

        result_patterns = [
            r'class="[^"]*cb-text-complete[^"]*"[^>]*>\s*([^<]+)\s*<',
            r'class="[^"]*cb-text-inprogress[^"]*"[^>]*>\s*([^<]+)\s*<',
            r'class="[^"]*cb-text-live[^"]*"[^>]*>\s*([^<]+)\s*<',
            r'class="[^"]*cb-text-stts[^"]*"[^>]*>\s*([^<]+)\s*<',
            r'>\s*([^<]*(?:opted to|opt to) (?:bat|bowl)[^<]*)\s*<',
            r'>\s*([^<]*(?:won by|Match tied|Match abandoned|No result)[^<]*)\s*<'
        ]
        for pat in result_patterns:
            found = re.search(pat, body_search, re.IGNORECASE)
            if found and found.group(1).strip():
                raw = found.group(1).strip()
                if len(raw) < 150:
                    status = raw
                    break

        toss_winner = None
        toss_choice = None
        toss_patterns = [
            r'>\s*([^<.]+?)\s+won the toss and\s+(?:opted to|opt to)\s+(bat|bowl)',
            r'>\s*([^<.]+?)\s+(?:opted to|opt to)\s+(bat|bowl)',
            r'([A-Z]{2,5})\s+won the toss and\s+(?:opted to|opt to)\s+(bat|bowl)',
            r'([A-Z]{2,5})\s+(?:opted to|opt to)\s+(bat|bowl)'
        ]
        for pat in toss_patterns:
            tm = re.search(pat, body_search, re.IGNORECASE)
            if tm:
                candidate = tm.group(1).strip()
                if is_team_match(candidate, team_a) or is_team_match(candidate, team_b):
                    toss_winner = candidate
                    toss_choice = tm.group(2).strip()
                    break

        score_list = []
        team_score_patterns = [
            r'\\?\"teamName\\?\":\\?\"([A-Z]+)\\?\"[\s\S]{1,500}?\\?\"score\\?\":(\d+)[\s\S]{1,100}?\\?\"wickets\\?\":(\d+)[\s\S]{1,100}?\\?\"overs\\?\":([\d.]+)',
            r'\"teamName\":\"([A-Z]+)\"[\s\S]{1,500}?\"score\":(\d+)[\s\S]{1,100}?\"wickets\":(\d+)[\s\S]{1,100}?\"overs\":([\d.]+)'
        ]
        for pat in team_score_patterns:
            for jm in re.finditer(pat, html):
                score_list.append({
                    "inning": jm.group(1).upper(), "r": int(jm.group(2)), "w": int(jm.group(3)), "o": float(jm.group(4))
                })

        clean_html = re.sub(r'<!--[\s\S]*?-->', '', html)
        clean_html = re.sub(r'<span[^>]*>', '', clean_html)
        clean_html = clean_html.replace('</span>', '')
        for sm in re.finditer(r'>([A-Z]{3,4})\s*<\/div>\s*<div[^>]*>\s*([\d\/]+)\s*\(([\d.]+)\)', clean_html):
            parts = sm.group(2).split('/')
            score_list.append({
                "inning": sm.group(1),
                "r": int(parts[0]),
                "w": int(parts[1]) if len(parts) > 1 else 0,
                "o": float(sm.group(3))
            })

        if not score_list:
            for sm in re.finditer(r'([A-Z]{2,10})\s+([\d\/]+)(?:\s*\(([\d\.]+)\))?', desc, re.IGNORECASE):
                team = sm.group(1).upper()
                if team in ['MILLER', 'SMITH', 'WARNER', 'KOHLI', 'KHAN']: continue
                parts = re.split(r'[\/-]', sm.group(2).strip())
                score_list.append({
                    "inning": team,
                    "r": int(parts[0]),
                    "w": int(parts[1]) if len(parts) > 1 else 0,
                    "o": float(sm.group(3) or '0')
                })

        filtered_scores = [s for s in score_list if is_team_match(s["inning"], team_a) or is_team_match(s["inning"], team_b)]

        def get_abbr(name):
            for abbr, full in IPL_TEAM_MAP.items():
                if is_team_match(name, full): return abbr
            return name[:3].upper()

        teams = [{"shortname": get_abbr(team_a), "name": team_a}, {"shortname": get_abbr(team_b), "name": team_b}]
        match_winner = None
        if 'won by' in status.lower():
            match_winner = re.split(r'\s+won by', status, flags=re.IGNORECASE)[0].strip()

        return {
            'status': 'success',
            'data': {
                'id': path,
                'status': status,
                'tossWinner': toss_winner,
                'tossChoice': toss_choice,
                'matchWinner': match_winner,
                'score': filtered_scores,
                'teamInfo': teams,
                'name': title
            }
        }
    except Exception as e:
        return {'status': 'failure', 'reason': str(e)}
