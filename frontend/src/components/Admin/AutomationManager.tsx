import { useState, useEffect } from 'react';
import './AutomationManager.css';

interface Job {
  id: string;
  name: string;
  script: string;
  schedule: string;
  enabled: boolean;
  description?: string;
  last_run?: string;
}

export default function AutomationManager() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all jobs
  const fetchJobs = async () => {
    try {
      const res = await fetch('http://localhost:4173/api/automation/jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('http://localhost:4173/api/automation/logs?lines=50');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Update job (enable/disable/schedule)
  const updateJob = async (jobId: string, updates: any) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:4173/api/automation/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (res.ok) {
        alert('Job updated successfully');
        fetchJobs();
      } else {
        alert('Failed to update job');
      }
    } catch (err) {
      alert('Error: ' + err);
    } finally {
      setLoading(false);
    }
  };

  // Run job manually
  const runJob = async (jobId: string) => {
    if (!confirm(`Run job "${jobId}" now?`)) return;
    
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:4173/api/automation/jobs/${jobId}/run`, {
        method: 'POST'
      });
      
      if (res.ok) {
        alert('Job triggered successfully! Check logs for output.');
        setTimeout(() => {
          fetchLogs();
        }, 2000);
      } else {
        alert('Failed to run job');
      }
    } catch (err) {
      alert('Error: ' + err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle job enabled/disabled
  const toggleJob = (job: Job) => {
    updateJob(job.id, { enabled: !job.enabled });
  };

  // Update schedule
  const updateSchedule = (job: Job) => {
    const newSchedule = prompt('Enter new cron schedule:', job.schedule);
    if (newSchedule) {
      updateJob(job.id, { schedule: newSchedule });
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchLogs();
    
    // Auto-refresh logs every 10 seconds
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="automation-manager">
      <h2>Automation Jobs</h2>
      
      <div className="jobs-section">
        <button onClick={fetchJobs}>Refresh Jobs</button>
        <button onClick={fetchLogs}>Refresh Logs</button>
        
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Script</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Last Run</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className={job.enabled ? 'enabled' : 'disabled'}>
                <td>
                  <strong>{job.name}</strong>
                  {job.description && <p className="desc">{job.description}</p>}
                </td>
                <td><code>{job.script}</code></td>
                <td>
                  <code>{job.schedule}</code>
                  <button onClick={() => updateSchedule(job)}>Edit</button>
                </td>
                <td>
                  <button 
                    className={job.enabled ? 'btn-enabled' : 'btn-disabled'}
                    onClick={() => toggleJob(job)}
                    disabled={loading}
                  >
                    {job.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
                <td>{job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}</td>
                <td>
                  <button onClick={() => runJob(job.id)} disabled={loading}>
                    Run Now
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="logs-section">
        <h3>Recent Logs (Last 50 lines)</h3>
        <pre className="logs-output">
          {logs.map((log, i) => (
            <div key={i} className="log-line">{log}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}
