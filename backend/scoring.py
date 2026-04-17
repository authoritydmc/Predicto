import math

def overs_to_balls(overs_str):
    parts = str(overs_str).split(".")
    overs = int(parts[0]) if parts[0] else 0
    balls = int(parts[1]) if len(parts) > 1 and parts[1] else 0
    return abs(overs * 6 + balls)

def balls_to_overs_display(balls):
    overs = balls // 6
    rem = balls % 6
    return f"{overs}.{rem} ov"

def calculate_innings1_points(prediction, actual, meta):
    team_a = (meta.get("teamA", "Team A")).lower()
    team_b = (meta.get("teamB", "Team B")).lower()

    pred_score = 0
    if not meta.get("disableScoreA") and meta.get("disableScoreB"):
        pred_score = float(prediction.get("scoreA", 0) or 0)
    elif not meta.get("disableScoreB") and meta.get("disableScoreA"):
        pred_score = float(prediction.get("scoreB", 0) or 0)
    else:
        winner = (prediction.get("predictedWinner", "")).lower()
        if winner == team_a:
            pred_score = float(prediction.get("scoreA", 0) or 0)
        elif winner == team_b:
            pred_score = float(prediction.get("scoreB", 0) or 0)
        else:
            pred_score = max(float(prediction.get("scoreA", 0) or 0), float(prediction.get("scoreB", 0) or 0))

    diff = abs(actual - pred_score)
    if diff == 0:
        return {
            "points": 200, "diff": diff, "rawDiff": 0, "isExact": True,
            "isNear5": True, "isNear10": True, "guess": pred_score, "mode": "Score"
        }

    base = round(max(0, 120 - (diff * 1.2)))
    near5 = 20 if diff <= 5 else 0
    near10 = 10 if diff <= 10 else 0

    total_points = max(0, base + near5 + near10)

    return {
        "points": total_points, "diff": diff, "rawDiff": diff, "isExact": False,
        "isNear5": diff <= 5, "isNear10": diff <= 10, "guess": pred_score, "mode": "Score"
    }

def calculate_innings2_points(prediction, actual_winner, actual_result, meta, is_overs_override=None):
    actual_winner = (actual_winner or "").lower()
    pred_winner = (prediction.get("predictedWinner", "")).lower()
    team_a = (meta.get("teamA", "Team A")).lower()
    team_b = (meta.get("teamB", "Team B")).lower()

    chasing_team = team_b
    if meta.get("disableScoreA") and not meta.get("disableScoreB"):
        chasing_team = team_b
    elif meta.get("disableScoreB") and not meta.get("disableScoreA"):
        chasing_team = team_a

    is_chaser_winner = is_overs_override if is_overs_override is not None else "." in str(actual_result)

    pred_val = prediction.get("scoreA") if chasing_team == team_a else prediction.get("scoreB")

    if pred_winner != actual_winner:
        wrong_diff = 0
        if is_chaser_winner:
            wrong_diff = abs(overs_to_balls(actual_result) - overs_to_balls(pred_val or 0))
        else:
            wrong_diff = abs(float(actual_result) - float(pred_val or 0))
        return {
            "points": 0, "diff": "---", "rawDiff": wrong_diff,
            "guess": pred_val or "---", "isExact": False, "mode": "Wrong Winner"
        }

    points = 0
    if is_chaser_winner:
        diff = abs(overs_to_balls(actual_result) - overs_to_balls(pred_val or 0))
        accuracy = round(max(0, 120 - (diff * 1.8)))
        near3_bonus = 20 if diff <= 3 else 0
        range_bonus = 10 if diff <= 9 else 0
        exact_bonus = 70 if diff == 0 else 0

        points += accuracy + near3_bonus + range_bonus + exact_bonus
        return {
            "points": max(0, points), "diff": balls_to_overs_display(diff), "rawDiff": diff,
            "guess": pred_val, "isExact": diff == 0, "mode": "Overs"
        }
    else:
        diff = abs(float(actual_result) - float(pred_val or 0))
        base = round(max(0, 120 - (diff * 1.2)))
        range_bonus_tier1 = 20 if diff <= 5 else 0
        range_bonus_tier2 = 10 if diff <= 12 else 0
        exact_bonus = 70 if diff == 0 else 0

        points += base + range_bonus_tier1 + range_bonus_tier2 + exact_bonus
        return {
            "points": max(0, points), "diff": f"{diff} runs", "rawDiff": diff,
            "guess": pred_val, "isExact": diff == 0, "mode": "Score"
        }

def calculate_match_finals(h1, h2):
    combined_map = {}

    def merge_records(data, is_innings_1):
        if not data:
            return
        for cid, p in data.items():
            raw_name = str(p.get("name", "Anonymous")).strip()
            key = raw_name.lower()

            if key not in combined_map:
                combined_map[key] = {
                    "displayName": raw_name,
                    "p1": {"pts": 0, "winner": "", "guess": "---", "penalty": 0, "penaltyDetails": ""},
                    "p2": {"pts": 0, "winner": "", "guess": "---", "penalty": 0, "penaltyDetails": ""}
                }

            rec = combined_map[key]
            p_data = {
                "pts": p.get("points", 0),
                "winner": p.get("predictedWinner", ""),
                "guess": p.get("guess", "---"),
                "penalty": p.get("penalty", 0),
                "penaltyDetails": p.get("penaltyDetails", "")
            }
            if is_innings_1:
                rec["p1"] = p_data
            else:
                rec["p2"] = p_data

    merge_records(h1, True)
    merge_records(h2, False)

    results = []
    for key, rec in combined_map.items():
        match_penalty = float(rec["p2"]["penalty"] or rec["p1"]["penalty"] or 0)
        total_penalty = match_penalty

        results.append({
            "name": rec["displayName"],
            "p1Score": rec["p1"]["pts"],
            "p1Winner": rec["p1"]["winner"],
            "p1Guess": rec["p1"]["guess"],
            "p2Score": rec["p2"]["pts"],
            "p2Winner": rec["p2"]["winner"],
            "p2Guess": rec["p2"]["guess"],
            "penalty": total_penalty,
            "penaltyDetails": rec["p2"]["penaltyDetails"] or rec["p1"]["penaltyDetails"] or "",
            "total": max(0, rec["p1"]["pts"] + rec["p2"]["pts"] - total_penalty)
        })
    
    return results
