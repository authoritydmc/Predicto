"""Single entry point for automation system"""
import argparse
import logging
import sys
from typing import Optional

# Setup logging
from automation.logging_config import setup_logging
logger = setup_logging()

def main():
    parser = argparse.ArgumentParser(
        description='Predicto Automation System',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start the scheduler (runs all cron jobs)
  python -m automation.main scheduler start
  
  # Run a specific script manually
  python -m automation.main run score_calculator --sport cricket --tournament-id xxx --match-id yyy
  
  # CRUD for cron jobs
  python -m automation.main cron list
  python -m automation.main cron add <job_name> <schedule> <script>
  python -m automation.main cron remove <job_name>
  python -m automation.main cron enable <job_name>
  python -m automation.main cron disable <job_name>
  
  # Individual script commands
  python -m automation.main live-matches --sport cricket
  python -m automation.main run-scraper
  python -m automation.main match-status
  python -m automation.main auto-schedule --days 3
  python -m automation.main calculate-scores --sport cricket --tournament-id xxx --match-id yyy
  python -m automation.main update-leaderboard --sport cricket --tournament-id xxx
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Scheduler commands
    scheduler_parser = subparsers.add_parser('scheduler', help='Scheduler commands')
    scheduler_parser.add_argument('action', choices=['start', 'stop'], help='Start or stop scheduler')
    
    # Run command
    run_parser = subparsers.add_parser('run', help='Run a specific script')
    run_parser.add_argument('script', help='Script name to run')
    run_parser.add_argument('--sport', default='cricket', help='Sport type')
    run_parser.add_argument('--tournament-id', help='Tournament ID')
    run_parser.add_argument('--match-id', help='Match ID')
    
    # Cron management commands
    cron_parser = subparsers.add_parser('cron', help='Cron job management')
    cron_subparsers = cron_parser.add_subparsers(dest='cron_action')
    
    cron_list = cron_subparsers.add_parser('list', help='List all cron jobs')
    cron_add = cron_subparsers.add_parser('add', help='Add a cron job')
    cron_add.add_argument('job_name', help='Job name')
    cron_add.add_argument('schedule', help='Cron schedule')
    cron_add.add_argument('script', help='Script path')
    cron_add.add_argument('--enabled', action='store_true', default=True)
    
    cron_remove = cron_subparsers.add_parser('remove', help='Remove a cron job')
    cron_remove.add_argument('job_name', help='Job name')
    
    cron_enable = cron_subparsers.add_parser('enable', help='Enable a cron job')
    cron_enable.add_argument('job_name', help='Job name')
    
    cron_disable = cron_subparsers.add_parser('disable', help='Disable a cron job')
    cron_disable.add_argument('job_name', help='Job name')
    
    # Direct script commands
    live_matches_parser = subparsers.add_parser('live-matches', help='Get live matches')
    live_matches_parser.add_argument('--sport', default='cricket')
    
    run_scraper_parser = subparsers.add_parser('run-scraper', help='Run scraper for live matches')
    
    match_status_parser = subparsers.add_parser('match-status', help='Process match status')
    match_status_parser.add_argument('--sport', default='cricket')
    
    auto_schedule_parser = subparsers.add_parser('auto-schedule', help='Auto-schedule matches')
    auto_schedule_parser.add_argument('--sport', default='cricket')
    auto_schedule_parser.add_argument('--days', type=int, default=3)
    
    calc_scores_parser = subparsers.add_parser('calculate-scores', help='Calculate match scores')
    calc_scores_parser.add_argument('--sport', default='cricket')
    calc_scores_parser.add_argument('--tournament-id', required=True)
    calc_scores_parser.add_argument('--match-id', required=True)
    
    update_lb_parser = subparsers.add_parser('update-leaderboard', help='Update leaderboard')
    update_lb_parser.add_argument('--sport', default='cricket')
    update_lb_parser.add_argument('--tournament-id', required=True)
    update_lb_parser.add_argument('--all', action='store_true', help='Update all tournaments')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Initialize Firebase and other dependencies
    firebase_client = _init_firebase()
    
    if args.command == 'scheduler':
        _handle_scheduler(args, firebase_client)
    elif args.command == 'run':
        _handle_run(args, firebase_client)
    elif args.command == 'cron':
        _handle_cron(args, firebase_client)
    elif args.command == 'live-matches':
        _handle_live_matches(args, firebase_client)
    elif args.command == 'run-scraper':
        _handle_run_scraper(args, firebase_client)
    elif args.command == 'match-status':
        _handle_match_status(args, firebase_client)
    elif args.command == 'auto-schedule':
        _handle_auto_schedule(args, firebase_client)
    elif args.command == 'calculate-scores':
        _handle_calculate_scores(args, firebase_client)
    elif args.command == 'update-leaderboard':
        _handle_update_leaderboard(args, firebase_client)
    else:
        parser.print_help()

def _init_firebase():
    """Initialize Firebase client"""
    try:
        from backend.firebase_manager import FirebaseManager
        fm = FirebaseManager()
        return fm
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return None

def _handle_scheduler(args, firebase_client):
    """Handle scheduler commands"""
    from automation.cron.manager import CronManager
    from automation.cron.scheduler import Scheduler
    from automation.cron.tasks import registry
    
    if not firebase_client:
        logger.error("Firebase client required for scheduler")
        sys.exit(1)
    
    cron_manager = CronManager(firebase_client)
    scheduler = Scheduler(cron_manager, registry)
    
    if args.action == 'start':
        logger.info("Starting scheduler...")
        scheduler.start()
    elif args.action == 'stop':
        scheduler.stop()

def _handle_run(args, firebase_client):
    """Handle run command"""
    script = args.script
    logger.info(f"Running script: {script}")
    
    # Map script names to functions
    if script == 'get_live_matches':
        from automation.matches.live_matches import get_live_matches
        matches = get_live_matches(firebase_client, args.sport)
        print(f"Found {len(matches)} live matches")
        
    elif script == 'run_scraper':
        _handle_run_scraper(args, firebase_client)
        
    elif script == 'match_status':
        _handle_match_status(args, firebase_client)
        
    elif script == 'score_calculator':
        if not args.tournament_id or not args.match_id:
            logger.error("--tournament-id and --match-id required")
            sys.exit(1)
        _handle_calculate_scores(args, firebase_client)
        
    elif script == 'leaderboard_update':
        _handle_update_leaderboard(args, firebase_client)
        
    else:
        logger.error(f"Unknown script: {script}")
        sys.exit(1)

def _handle_cron(args, firebase_client):
    """Handle cron management commands"""
    from automation.cron.manager import CronManager
    
    if not firebase_client:
        logger.error("Firebase client required")
        sys.exit(1)
    
    cron_manager = CronManager(firebase_client)
    
    if args.cron_action == 'list':
        jobs = cron_manager.list_jobs()
        print(f"\n{'ID':<30} {'Name':<30} {'Schedule':<20} {'Enabled':<10}")
        print("-" * 90)
        for job in jobs:
            print(f"{job['id']:<30} {job.get('name', ''):<30} {job.get('schedule', ''):<20} {job.get('enabled', False):<10}")
    
    elif args.cron_action == 'add':
        config = {
            'name': args.job_name,
            'script': args.script,
            'schedule': args.schedule,
            'enabled': args.enabled,
            'description': f"Auto-generated job: {args.job_name}"
        }
        if cron_manager.add_job(args.job_name, config):
            print(f"Added job: {args.job_name}")
        else:
            print(f"Failed to add job: {args.job_name}")
    
    elif args.cron_action == 'remove':
        if cron_manager.remove_job(args.job_name):
            print(f"Removed job: {args.job_name}")
        else:
            print(f"Failed to remove job: {args.job_name}")
    
    elif args.cron_action == 'enable':
        if cron_manager.enable_job(args.job_name):
            print(f"Enabled job: {args.job_name}")
        else:
            print(f"Failed to enable job: {args.job_name}")
    
    elif args.cron_action == 'disable':
        if cron_manager.disable_job(args.job_name):
            print(f"Disabled job: {args.job_name}")
        else:
            print(f"Failed to disable job: {args.job_name}")

def _handle_live_matches(args, firebase_client):
    """Handle live-matches command"""
    from automation.matches.live_matches import get_live_matches
    
    matches = get_live_matches(firebase_client, args.sport)
    print(f"\nFound {len(matches)} live matches:\n")
    for m in matches:
        print(f"  - {m.get('team1')} vs {m.get('team2')} (Status: {m.get('status')})")

def _handle_run_scraper(args, firebase_client):
    """Handle run-scraper command"""
    from backend.scraper.manager import ScraperManager
    from automation.scraper.runner import run_scraper_for_live_matches
    
    scraper_manager = ScraperManager()
    updated = run_scraper_for_live_matches(firebase_client, scraper_manager)
    print(f"Updated {updated} matches with scraper data")

def _handle_match_status(args, firebase_client):
    """Handle match-status command"""
    from automation.matches.live_matches import get_live_matches, update_match_status
    from automation.matches.status_manager import MatchStatusManager
    
    status_mgr = MatchStatusManager(firebase_client)
    matches = get_live_matches(firebase_client, args.sport)
    
    updated = 0
    for match in matches:
        updates = status_mgr.process_match_status(match)
        if updates:
            update_match_status(
                firebase_client,
                match.get('sport'),
                match.get('tournament_id'),
                match.get('id'),
                updates
            )
            updated += 1
    
    print(f"Processed {updated} matches for status updates")

def _handle_auto_schedule(args, firebase_client):
    """Handle auto-schedule command"""
    from backend.scraper.manager import ScraperManager
    from automation.matches.scheduler import MatchScheduler
    
    scraper_manager = ScraperManager()
    scheduler = MatchScheduler(firebase_client, scraper_manager)
    
    scheduled = scheduler.discover_and_schedule(args.sport, args.days)
    print(f"Scheduled {scheduled} new matches")

def _handle_calculate_scores(args, firebase_client):
    """Handle calculate-scores command"""
    from automation.scoring.calculator import ScoreCalculator
    
    calculator = ScoreCalculator(firebase_client)
    if calculator.calculate_match_scores(args.sport, args.tournament_id, args.match_id):
        print(f"Calculated scores for match {args.match_id}")
    else:
        print(f"Failed to calculate scores")

def _handle_update_leaderboard(args, firebase_client):
    """Handle update-leaderboard command"""
    from automation.scoring.leaderboard import LeaderboardManager
    
    lb_manager = LeaderboardManager(firebase_client)
    
    if args.all:
        updated = lb_manager.update_all_tournament_leaderboards(args.sport)
        print(f"Updated {updated} tournament leaderboards")
    else:
        if lb_manager.update_tournament_leaderboard(args.sport, args.tournament_id):
            print(f"Updated leaderboard for tournament {args.tournament_id}")
        else:
            print(f"Failed to update leaderboard")

if __name__ == '__main__':
    main()
