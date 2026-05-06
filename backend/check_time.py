import time

current_time = int(time.time() * 1000)
print(f'Current time: {current_time}')
print(f'Current time readable: {time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(current_time/1000))}')

# Check task times
tasks = [
    ('ipl_live_scraping', 1778020087163),
    ('ipl_match_discovery', 1778020200000),
    ('ipl_reconciliation', 1778020200000)
]

for task_id, next_run in tasks:
    print(f'{task_id}: next_run={next_run}, readable={time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(next_run/1000))}')
    print(f'  Should run now: {current_time >= next_run}')
