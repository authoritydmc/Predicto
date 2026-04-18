import os
import datetime
import time
import requests
import asyncio
from firebase_admin import db
from dotenv import load_dotenv

from firebase_manager import setup_firebase
from scraper import scrape_cricbuzz_match, is_team_match
from scoring import calculate_innings1_points, calculate_innings2_points, calculate_match_finals

# Load environment variables
load_dotenv()

# App settings
ROOM = os.getenv("FIREBASE_ROOM", "ipl")
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
ENVIRONMENT = os.getenv("ENVIRONMENT", "prod") # 'prod' or 'test'

def get_timestamp():
    return datetime.datetime.now().strftime("%Y-%m-%d, %H:%M:%S")

def log(*args):
    prefix = "[DEBUG]" if DEBUG_MODE else "[INFO]"
    print(f"{prefix} [{get_timestamp()}]", *args)

def send_discord_notification(content, embed=None):
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        if DEBUG_MODE: log("[Discord] DISCORD_WEBHOOK_URL not set. Skipping notification.")
        return
    try:
        payload = {
            "content": content,
            "embeds": [embed] if embed else [],
            "allowed_mentions": {"parse": ["roles", "users", "everyone"]}
        }
        resp = requests.post(webhook_url, json=payload, timeout=10)
        if DEBUG_MODE: log(f"[Discord] Notification sent (HTTP {resp.status_code}).")
    except Exception as e:
        log(f"[Discord] Notification error: {e}")

def get_schedule():
    file_path = os.path.join(os.path.dirname(__file__), "..", "schedule_2026_ipl.csv")
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]
    matches = []
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) >= 6:
            matches.append({
                "matchNo": parts[0], "date": parts[1], "time": parts[2],
                "home": parts[3], "away": parts[4], "titleStr": parts[5].strip()
            })
    return matches

def parse_schedule_date(date_str, time_str):
    d, m, y = map(int, date_str.split('-'))
    time_part, modifier = time_str.split(' ')
    hours, minutes = map(int, time_part.split(':'))
    if modifier == 'PM' and hours < 12:
        hours += 12
    if modifier == 'AM' and hours == 12:
        hours = 0
    return datetime.datetime(y, m, d, hours, minutes)

async def sync_season_leaderboard(room):
    try:
        ref = db.reference(f"{DB_ROOT}/history/{room}")
        history = ref.get() or {}
        season_map = {}
        for key, match in history.items():
            if '-' not in key: continue
            standings = match.get("finalStandings", [])
            for r in standings:
                if not r.get("name"): continue
                name_key = r["name"].strip().lower()
                if name_key not in season_map:
                    season_map[name_key] = {"name": r["name"], "total": 0, "matchCount": 0}
                season_map[name_key]["total"] += r.get("total", 0)
                season_map[name_key]["matchCount"] += 1

        players = []
        for p in season_map.values():
            players.append({
                **p,
                "ppg": round(p["total"] / max(p["matchCount"], 1), 2)
            })

        players.sort(key=lambda x: x["total"], reverse=True)
        db.reference(f"{DB_ROOT}/season_leaderboard/{room}").set(players)
        log(f"[Leaderboard] Successfully synced stats for {len(players)} players.")
    except Exception as e:
        log(f"[Leaderboard Error] Failed to sync: {e}")

def run_monitor():
    log(f"=== STARTING CRICBUZZ SCRAPER MONITOR ({ENVIRONMENT.upper()} MODE) ===")
    setup_firebase()
    log(f"[Firebase] Target Room: {ROOM}")

    schedule = get_schedule()
    now_str = os.getenv("TEST_DATE")
    now = datetime.datetime.fromisoformat(now_str) if now_str else datetime.datetime.now()

    ist_time = now + datetime.timedelta(hours=5, minutes=30)
    today_str = ist_time.strftime("%d-%m-%Y")

    todays_matches = [m for m in schedule if m['date'] == today_str]
    next_match = next((m for m in schedule if parse_schedule_date(m['date'], m['time']) > now), None)

    meta_ref = db.reference(f"{DB_ROOT}/meta/{active_match_id}")

    if next_match:
        current_meta = meta_ref.get() or {}
        has_toss = current_meta.get('tossWinner') and (is_team_match(current_meta['tossWinner'], current_meta.get('teamA', '')) or is_team_match(current_meta['tossWinner'], current_meta.get('teamB', '')))
        is_live = current_meta.get('teamA') and has_toss
        if not current_meta.get('teamA') or (not is_team_match(current_meta['teamA'], next_match['home']) and not current_meta.get('secondInnings')):
            log(f"[Setup] Pre-loading Next Match: {next_match['home']} vs {next_match['away']}")
            if not is_live:
                db.reference(f"{DB_ROOT}/innings_history/{active_match_id}").delete()
                db.reference(f"{DB_ROOT}/predictions/{active_match_id}").delete()
                meta_ref.update({
                    "matchTitle": next_match["titleStr"],
                    "teamA": next_match["home"], "teamB": next_match["away"],
                    "disableScoreA": False, "disableScoreB": False,
                    "secondInnings": False, "predictionsPaused": False,
                    "tossWinner": None, "tossChoice": None, "batting1st": None
                })
    
    if not todays_matches:
        log(f"No match found for today ({today_str}). Exiting.")
        return

    target_match_idx = 0
    if len(todays_matches) > 1:
        state0 = db.reference(f"{DB_ROOT}/monitor_state/{active_match_id}").get()
        meta0 = meta_ref.get()
        history0 = db.reference(f"{DB_ROOT}/history/{ROOM}/{todays_matches[0]['matchNo']}").get()
        is_match0_finished = state0 and state0.get('matchNo') == todays_matches[0]['matchNo'] and state0.get('finished')
        is_room_on_match2 = meta0 and is_team_match(meta0.get('teamA'), todays_matches[1]['home'])
        if is_match0_finished or is_room_on_match2 or history0:
            target_match_idx = 1

    initial_meta = meta_ref.get() or {}
    first_target = todays_matches[target_match_idx]
    if first_target and (not is_team_match(initial_meta.get('teamA'), first_target['home']) or not is_team_match(initial_meta.get('teamB'), first_target['away'])):
        db.reference(f"{DB_ROOT}/innings_history/{active_match_id}").delete()
        db.reference(f"{DB_ROOT}/predictions/{active_match_id}").delete()
        meta_ref.update({
            "matchTitle": first_target["titleStr"],
            "teamA": first_target["home"], "teamB": first_target["away"],
            "disableScoreA": False, "disableScoreB": False,
            "secondInnings": False, "predictionsPaused": False, "currentOver": "0.0"
        })

    while target_match_idx < len(todays_matches):
        target_match = todays_matches[target_match_idx]
        log(f"Target Match: {target_match['home']} vs {target_match['away']}")

        match_path = None
        while not match_path:
            res = scrape_cricbuzz_match(target_match['home'], target_match['away'])
            if res['status'] == 'success':
                match_path = res['data']['id']
            else:
                time.sleep(180)
        
        is_toss_confirmed = False
        batting_team_full = ""
        is_first_innings_locked = False
        is_second_innings_locked = False
        first_innings_resolved = False
        predictions_opened_at = None
        chasing_team = ""

        meta = meta_ref.get()
        toss_is_for_this_match = meta and meta.get('tossWinner') and (is_team_match(meta['tossWinner'], target_match['home']) or is_team_match(meta['tossWinner'], target_match['away']))
        if meta and is_team_match(meta.get('teamA'), target_match['home']) and is_team_match(meta.get('teamB'), target_match['away']) and toss_is_for_this_match:
            is_toss_confirmed = True
            first_innings_resolved = bool(meta.get('secondInnings'))
            is_first_innings_locked = bool(meta.get('predictionsPaused')) and not first_innings_resolved
            is_second_innings_locked = bool(meta.get('predictionsPaused')) and first_innings_resolved
            if meta.get('secondInnings'):
                batting_team_full = meta.get('teamB') if meta.get('disableScoreB') else meta.get('teamA')
            else:
                batting_team_full = meta.get('teamA') if meta.get('disableScoreB') else meta.get('teamB')
            chasing_team = target_match['away'] if is_team_match(target_match['home'], batting_team_full) else target_match['home']

        while True:
            try:
                res = scrape_cricbuzz_match(target_match['home'], target_match['away'], match_path)
                if res['status'] == 'failure': raise Exception(res['reason'])
                data = res['data']
                toss_winner, toss_choice, match_winner, score, status = data['tossWinner'], data['tossChoice'], data['matchWinner'], data['score'], data['status']
                is_innings_break = "innings break" in status.lower()

                valid_scores = [s for s in score if is_team_match(s['inning'], target_match['home']) or is_team_match(s['inning'], target_match['away'])]
                s1 = next((s for s in valid_scores if is_team_match(s['inning'], batting_team_full)), None)
                s2 = next((s for s in valid_scores if is_team_match(s['inning'], chasing_team)), None)

                raw_over = float(s2['o']) if s2 else (float(s1['o']) if s1 else 0)
                over_int, over_dec = int(raw_over), round((raw_over - int(raw_over)) * 10)
                normalized_over = over_int + 1.0 if over_dec >= 6 else raw_over
                current_over = f"{normalized_over:.1f}"

                meta_ref.update({"currentOver": current_over, "isInningsBreak": is_innings_break})

                if not is_toss_confirmed and toss_winner and toss_choice:
                    is_home_winner = is_team_match(toss_winner, target_match['home'])
                    if toss_choice.lower() == "bat": batting_team_full = target_match['home'] if is_home_winner else target_match['away']
                    else: batting_team_full = target_match['away'] if is_home_winner else target_match['home']
                    chasing_team = target_match['away'] if is_team_match(target_match['home'], batting_team_full) else target_match['home']
                    disable_score_a = not is_team_match(batting_team_full, target_match['home'])
                    disable_score_b = is_team_match(batting_team_full, target_match['home'])

                    meta_ref.update({
                        "matchTitle": target_match['titleStr'], "teamA": target_match['home'], "teamB": target_match['away'],
                        "disableScoreA": disable_score_a, "disableScoreB": disable_score_b,
                        "tossWinner": toss_winner, "tossChoice": toss_choice,
                        "secondInnings": False, "predictionsPaused": False
                    })
                    is_toss_confirmed = True
                    predictions_opened_at = time.time()
                    send_discord_notification(f"🏏 **Toss is in!** {toss_winner} won toss and opted to {toss_choice}. {batting_team_full} to bat.")

                if is_toss_confirmed and score:
                    if not first_innings_resolved:
                        grace_elapsed = (time.time() - predictions_opened_at) if predictions_opened_at else float('inf')
                        if not is_first_innings_locked and s1 and s1['o'] >= 3.0 and grace_elapsed >= 900:
                            db.reference(f"{DB_ROOT}/meta/{active_match_id}/predictionsPaused").set(True)
                            is_first_innings_locked = True
                        
                        is_innings_break = "innings break" in status.lower() or s2
                        if s1 and (s1['o'] >= 19.6 or s1['w'] >= 10 or is_innings_break):
                            preds = db.reference(f"{DB_ROOT}/predictions/{active_match_id}").get() or {}
                            meta = meta_ref.get() or {}
                            for pid, p in preds.items():
                                stats = calculate_innings1_points(p, s1['r'], meta)
                                preds[pid] = {**p, **stats, "points": stats["points"]}
                            db.reference(f"{DB_ROOT}/innings_history/{active_match_id}/1st").set(preds)
                            db.reference(f"{DB_ROOT}/predictions/{active_match_id}").delete()
                            meta_ref.update({"secondInnings": True, "currentOver": "0.0", "predictionsPaused": False, "disableScoreA": not meta.get("disableScoreA"), "disableScoreB": not meta.get("disableScoreB")})
                            first_innings_resolved = True
                    elif s2:
                        if not is_second_innings_locked and s2['o'] >= 3.0:
                            db.reference(f"{DB_ROOT}/meta/{active_match_id}/predictionsPaused").set(True)
                            is_second_innings_locked = True

                        if s2['o'] >= 19.6 or s2['w'] >= 10 or match_winner or (s1 and s2['r'] > s1['r']):
                            if not match_winner and s1 and s2['r'] > s1['r']: match_winner = chasing_team
                            is_chaser_winner = match_winner and not is_team_match(match_winner, batting_team_full)
                            resolved_actual_winner = target_match['home'] if is_team_match(match_winner, target_match['home']) else target_match['away']
                            
                            meta = meta_ref.get() or {}
                            preds = db.reference(f"{DB_ROOT}/predictions/{active_match_id}").get() or {}
                            actual_result = s2['o'] if is_chaser_winner else s2['r']
                            for pid, p in preds.items():
                                stats = calculate_innings2_points(p, resolved_actual_winner, actual_result, meta, is_chaser_winner)
                                preds[pid] = {**p, **stats, "points": stats["points"]}
                            db.reference(f"{DB_ROOT}/innings_history/{active_match_id}/2nd").set(preds)

                            h1 = db.reference(f"{DB_ROOT}/innings_history/{active_match_id}/1st").get() or {}
                            finals = calculate_match_finals(h1, preds)

                            date_key = f"{today_str.replace('-','')}_{int(time.time()*1000)}"
                            archive_payload = {
                                "archivedAt": int(time.time()*1000), "matchTitle": target_match['titleStr'],
                                "teamA": target_match['home'], "teamB": target_match['away'],
                                "innings1": h1, "innings2": preds, "finalStandings": finals,
                                "matchResults": {"actual1st": s1['r'] if s1 else 0, "actual2nd": actual_result, "actualWinner": resolved_actual_winner}
                            }
                            db.reference(f"{DB_ROOT}/history/{ROOM}/{date_key}").set(archive_payload)
                            
                            asyncio.run(sync_season_leaderboard(ROOM))

                            db.reference(f"{DB_ROOT}/predictions/{active_match_id}").delete()
                            db.reference(f"{DB_ROOT}/innings_history/{active_match_id}").delete()
                            db.reference(f"{DB_ROOT}/monitor_state/{active_match_id}").set({"matchNo": target_match['matchNo'], "finished": True})
                            break

                delay = 180
                if is_toss_confirmed:
                    if not first_innings_resolved and s1:
                        over_num = float(current_over)
                        delay = 180 if over_num < 0.1 else 60 if not is_first_innings_locked or over_num < 3.0 or over_num >= 18.0 else 600
                    elif first_innings_resolved and s2:
                        over_num = float(current_over)
                        target2 = s1['r'] + 1 if s1 else None
                        runs_needed = target2 - s2['r'] if target2 else float('inf')
                        delay = 180 if over_num < 0.1 else 60 if runs_needed <= 15 or over_num >= 18.0 or not is_second_innings_locked or over_num < 3.0 else 600
                time.sleep(delay)
            except Exception as e:
                log(f"Error in monitor loop: {e}")
                time.sleep(180)
        target_match_idx += 1

if __name__ == "__main__":
    run_monitor()
