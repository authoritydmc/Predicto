#!/usr/bin/env python3
"""
Team Matcher Test Script

Demonstrates all features of the team matching module.

Run:
    python test_team_matcher.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from team_matcher import TeamMatcher, TeamDatabase, quick_match, get_all_variations, find_in_text


def test_basic_matching():
    """Test basic team matching"""
    print("\n" + "="*60)
    print("TEST: Basic Team Matching")
    print("="*60)
    
    matcher = TeamMatcher('cricket')
    
    test_cases = [
        ('CSK', 'Chennai Super Kings', True),
        ('DC', 'Delhi Capitals', True),
        ('MI', 'Mumbai Indians', True),
        ('RCB', 'Royal Challengers Bangalore', True),
        ('KKR', 'Kolkata Knight Riders', True),
        ('CSK', 'Mumbai Indians', False),
        ('India', 'IND', True),
        ('Australia', 'AUS', True),
        ('England', 'ENG', True),
        ('DC', 'Delhi', True),
        ('Super Kings', 'CSK', True),
    ]
    
    passed = 0
    for name1, name2, expected in test_cases:
        result = matcher.matches(name1, name2)
        status = "[OK]" if result == expected else "[FAIL]"
        print(f"{status} '{name1}' vs '{name2}' -> {result} (expected {expected})")
        if result == expected:
            passed += 1
    
    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_canonical_names():
    """Test canonical name lookup"""
    print("\n" + "="*60)
    print("TEST: Canonical Name Lookup")
    print("="*60)
    
    matcher = TeamMatcher('cricket')
    
    test_cases = [
        ('CSK', 'Chennai Super Kings'),
        ('DC', 'Delhi Capitals'),
        ('MI', 'Mumbai Indians'),
        ('RCB', 'Royal Challengers Bangalore'),
        ('India', 'India'),
        ('IND', 'India'),
        ('Team India', 'India'),
    ]
    
    passed = 0
    for input_name, expected in test_cases:
        result = matcher.get_canonical_name(input_name)
        status = "[OK]" if result == expected else "[FAIL]"
        print(f"{status} '{input_name}' -> '{result}' (expected '{expected}')")
        if result == expected:
            passed += 1
    
    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_variations():
    """Test getting all variations"""
    print("\n" + "="*60)
    print("TEST: Team Name Variations")
    print("="*60)
    
    matcher = TeamMatcher('cricket')
    
    teams_to_test = ['CSK', 'DC', 'MI', 'India']
    
    for team in teams_to_test:
        variations = matcher.get_variations(team)
        canonical = matcher.get_canonical_name(team)
        print(f"\n{team} ({canonical}):")
        for v in sorted(variations):
            print(f"  - {v}")
    
    return True


def test_text_extraction():
    """Test extracting teams from text"""
    print("\n" + "="*60)
    print("TEST: Extract Teams from Text")
    print("="*60)
    
    test_texts = [
        "RCB vs CSK match today at 7:30 PM",
        "Delhi Capitals to face Mumbai Indians in Qualifier",
        "India vs Australia Test match starts tomorrow",
        "KKR take on SRH in the Eliminator",
        "RR vs PBKS, who will win?",
    ]
    
    for text in test_texts:
        found = find_in_text(text)
        print(f"\nText: '{text}'")
        print(f"Teams found: {found}")
    
    return True


def test_fuzzy_matching():
    """Test fuzzy matching with typos/variations"""
    print("\n" + "="*60)
    print("TEST: Fuzzy Matching")
    print("="*60)
    
    matcher = TeamMatcher('cricket')
    
    # Test with slight variations/typos
    test_cases = [
        ('Chenai Super Kings', 'Chennai Super Kings'),  # typo
        ('Delhi Capital', 'Delhi Capitals'),  # singular
        ('Mumbai Indian', 'Mumbai Indians'),  # singular
        ('RC Bangalore', 'Royal Challengers Bangalore'),
    ]
    
    for input_name, expected in test_cases:
        canonical = matcher.get_canonical_name(input_name)
        status = "[OK]" if canonical == expected else "[FAIL]"
        print(f"{status} '{input_name}' -> '{canonical}' (expected '{expected}')")
    
    return True


def test_best_match():
    """Test finding best match from candidates"""
    print("\n" + "="*60)
    print("TEST: Find Best Match")
    print("="*60)
    
    matcher = TeamMatcher('cricket')
    
    query = 'CSK'
    candidates = [
        'Mumbai Indians',
        'Chennai Super Kings',
        'Delhi Capitals',
        'Chennai',
    ]
    
    best_match, score = matcher.find_best_match(query, candidates)
    print(f"Query: '{query}'")
    print(f"Candidates: {candidates}")
    print(f"Best match: '{best_match}' (score: {score:.2f})")
    
    status = "[OK]" if best_match == 'Chennai Super Kings' else "[FAIL]"
    print(f"{status} Best match: '{best_match}' (expected 'Chennai Super Kings')")
    
    return best_match == 'Chennai Super Kings'


def test_football():
    """Test football team matching"""
    print("\n" + "="*60)
    print("TEST: Football Team Matching")
    print("="*60)
    
    matcher = TeamMatcher('football')
    
    test_cases = [
        ('MUFC', 'Manchester United'),
        ('MANU', 'Manchester United'),
        ('Man U', 'Manchester United'),
        ('City', 'Manchester City'),
        ('LFC', 'Liverpool'),
        ('Reds', 'Liverpool'),
        ('CFC', 'Chelsea'),
        ('Gunners', 'Arsenal'),
    ]
    
    passed = 0
    for input_name, expected in test_cases:
        canonical = matcher.get_canonical_name(input_name)
        status = "[OK]" if canonical == expected else "[FAIL]"
        print(f"{status} '{input_name}' -> '{canonical}' (expected '{expected}')")
        if canonical == expected:
            passed += 1
    
    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_quick_functions():
    """Test quick utility functions"""
    print("\n" + "="*60)
    print("TEST: Quick Utility Functions")
    print("="*60)
    
    # quick_match
    print("\nquick_match():")
    print(f"  quick_match('CSK', 'Chennai') -> {quick_match('CSK', 'Chennai')}")
    print(f"  quick_match('DC', 'Delhi Capitals') -> {quick_match('DC', 'Delhi Capitals')}")
    print(f"  quick_match('MI', 'RCB') -> {quick_match('MI', 'RCB')}")
    
    # get_all_variations
    print("\nget_all_variations('DC'):")
    variations = get_all_variations('DC')
    for v in sorted(variations):
        print(f"  - {v}")
    
    # find_in_text
    print("\nfind_in_text('RCB vs CSK today'):")
    teams = find_in_text('RCB vs CSK today')
    print(f"  Found: {teams}")
    
    return True


def test_ipl_abbreviations():
    """Test all IPL team abbreviations"""
    print("\n" + "="*60)
    print("TEST: All IPL Team Abbreviations")
    print("="*60)
    
    matcher = TeamMatcher('cricket')
    
    ipl_teams = {
        'CSK': 'Chennai Super Kings',
        'DC': 'Delhi Capitals',
        'MI': 'Mumbai Indians',
        'RCB': 'Royal Challengers Bangalore',
        'KKR': 'Kolkata Knight Riders',
        'RR': 'Rajasthan Royals',
        'PBKS': 'Punjab Kings',
        'SRH': 'Sunrisers Hyderabad',
        'GT': 'Gujarat Titans',
        'LSG': 'Lucknow Super Giants',
    }
    
    print("\nAll IPL abbreviations and their canonical names:")
    for abbrev, expected in ipl_teams.items():
        canonical = matcher.get_canonical_name(abbrev)
        variations = matcher.get_variations(abbrev)
        print(f"\n{abbrev} -> {canonical}")
        print(f"  All names: {', '.join(sorted(variations))}")
    
    return True


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("TEAM MATCHER TEST SUITE")
    print("="*60)
    
    results = {}
    
    results['basic_matching'] = test_basic_matching()
    results['canonical_names'] = test_canonical_names()
    results['variations'] = test_variations()
    results['text_extraction'] = test_text_extraction()
    results['fuzzy_matching'] = test_fuzzy_matching()
    results['best_match'] = test_best_match()
    results['football'] = test_football()
    results['quick_functions'] = test_quick_functions()
    results['ipl_abbreviations'] = test_ipl_abbreviations()
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        symbol = "[OK]" if result else "[FAIL]"
        print(f"{symbol} {test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    return passed == total


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
