import React, { useState } from 'react';
import { Toggle } from './Toggle';

interface AutomationStatus {
  total_tasks?: number;
  running_tasks?: number;
  error_tasks?: number;
  uptime?: number;
}

interface TaskInfo {
  task_id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'idle';
  interval_seconds: number;
  cron_expression?: string;
  enabled: boolean;
  logging_enabled: boolean;
  is_adaptive?: boolean;
  last_run?: number;
  next_run?: number;
  error_message?: string;
  progress?: number;
}

interface JobLog {
  id: number;
  task_id: string;
  task_name: string;
  start_time: number;
  end_time?: number;
  status: string;
  error?: string;
  metadata?: any;
}

interface AutomationSchedulerProps {
  schedulerRunning: boolean;
  wsConnection: WebSocket | null;
  automationStatus: AutomationStatus | null;
  automationTasks: Record<string, TaskInfo>;
  onTriggerTask: (taskId: string) => void;
  onAddTask: (task: Partial<TaskInfo>) => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskInfo>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
}

const TaskStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    idle: '#8e8e93',
    pending: '#8e8e93',
    running: '#34c759',
    completed: '#007aff',
    error: '#ff3b30',
    disabled: '#8e8e93',
  };
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        background: `${colors[status] || colors.idle}20`,
        color: colors[status] || colors.idle,
        textTransform: 'capitalize',
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
};

export const AutomationScheduler: React.FC<AutomationSchedulerProps> = ({
  schedulerRunning,
  wsConnection,
  automationStatus,
  automationTasks,
  onTriggerTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTask, setHistoryTask] = useState<TaskInfo | null>(null);
  const [jobHistory, setJobHistory] = useState<JobLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [editingTask, setEditingTask] = useState<TaskInfo | null>(null);
  const [formData, setFormData] = useState<Partial<TaskInfo>>({
    task_id: '',
    name: '',
    type: 'scraping',
    interval_seconds: 60,
    cron_expression: '',
    enabled: true,
    logging_enabled: true,
    is_adaptive: false,
  });

  const generateTaskId = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      task_id: prev.task_id || !editingTask ? generateTaskId(name) : prev.task_id
    }));
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setFormData({
      task_id: '',
      name: '',
      type: 'scraping',
      interval_seconds: 60,
      enabled: true,
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (task: TaskInfo) => {
    setEditingTask(task);
    setFormData(task);
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = { ...formData };
    if (!dataToSubmit.task_id && dataToSubmit.name) {
      dataToSubmit.task_id = generateTaskId(dataToSubmit.name);
    }
    
    if (editingTask) {
      onUpdateTask(editingTask.task_id, dataToSubmit);
    } else {
      onAddTask(dataToSubmit);
    }
    setShowAddModal(false);
  };

  const fetchHistory = (task: TaskInfo) => {
    if (!wsConnection) return;
    
    setHistoryTask(task);
    setLoadingHistory(true);
    setShowHistoryModal(true);
    setJobHistory([]);

    // Send request via WebSocket
    wsConnection.send(JSON.stringify({
      type: 'get_job_history',
      task_id: task.task_id,
      limit: 50
    }));

    // Listener for history response is usually handled in the parent component
    // but for simplicity, we'll assume the parent updates automationTasks or a similar mechanism
    // In this specific implementation, we might need to handle the response in the parent and pass it down.
    // However, since we are inside the component, we can add a one-time listener if needed or rely on parent.
    // Given the current architecture, I'll add a temporary listener for the response.
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'get_job_history_response' && data.data.success) {
          setJobHistory(data.data.history);
          setLoadingHistory(false);
          wsConnection.removeEventListener('message', handleMessage);
        }
      } catch (err) {
        console.error("Error parsing history response", err);
      }
    };
    
    wsConnection.addEventListener('message', handleMessage);
    
    // Timeout to stop loading if no response
    setTimeout(() => {
      setLoadingHistory(false);
      wsConnection.removeEventListener('message', handleMessage);
    }, 5000);
  };

  const formatTime = (timestamp: number | undefined | null) => {
    if (!timestamp) return 'Never';
    return new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      month: 'short', day: 'numeric'
    }).format(new Date(timestamp));
  };

  return (
    <div className="automation-scheduler-container">
      {/* Status Header */}
      <div className="cp-glass-card" style={{ marginBottom: '16px', borderLeft: `4px solid ${schedulerRunning ? '#34c759' : '#ff3b30'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
              Automation System
              {wsConnection && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#34c759' }}>● Connected</span>}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {schedulerRunning ? 'Orchestrator active and running tasks' : 'Orchestrator offline'}
            </span>
          </div>
          <div className={`cp-dot ${schedulerRunning ? 'active' : 'inactive'}`} />
        </div>

        {automationStatus && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Tasks</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{automationStatus.total_tasks || 0}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Running</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#34c759' }}>{automationStatus.running_tasks || 0}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Errors</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#ff3b30' }}>{automationStatus.error_tasks || 0}</div>
            </div>
          </div>
        )}
      </div>

      {/* Task List Section */}
      <div className="cp-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span>Scheduled Tasks</span>
        <button 
          className="cp-action-btn cp-small" 
          onClick={handleOpenAdd}
          style={{ background: 'rgba(52, 199, 89, 0.1)', color: '#34c759', borderColor: 'rgba(52, 199, 89, 0.2)' }}
        >
          + Add Task
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {Object.keys(automationTasks).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>No tasks configured in orchestrator</span>
          </div>
        ) : (
          Object.values(automationTasks).map((task) => (
            <div 
              key={task.task_id} 
              className="cp-glass-card"
              style={{ 
                padding: '12px', 
                opacity: task.enabled ? 1 : 0.6,
                transition: 'opacity 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{task.name}</span>
                    <TaskStatusBadge status={task.enabled ? task.status : 'disabled'} />
                    {task.is_adaptive && (
                      <span style={{ fontSize: '9px', background: 'rgba(52, 199, 89, 0.1)', color: '#34c759', padding: '1px 4px', borderRadius: '3px', marginLeft: '4px' }}>
                        Adaptive
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    ID: <span style={{ fontFamily: 'monospace' }}>{task.task_id}</span> • Type: {task.type}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                    <span><span style={{opacity: 0.6}}>Last Run:</span> <span style={{color: 'var(--text)'}}>{formatTime(task.last_run)}</span></span>
                    <span><span style={{opacity: 0.6}}>Next Run:</span> <span style={{color: '#34c759'}}>{formatTime(task.next_run)}</span></span>
                  </div>
                </div>
                <div style={{ transform: 'scale(0.8)' }}>
                  <Toggle 
                    checked={task.enabled} 
                    onChange={() => onToggleTask(task.task_id)}
                  />
                </div>
              </div>

              {task.status === 'running' && task.progress !== undefined && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${task.progress}%`, background: '#34c759', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11px' }}>
                <div style={{ color: 'var(--muted)' }}>
                  Interval: <strong>{task.interval_seconds}s</strong>
                  {task.next_run && (
                    <span style={{ marginLeft: '12px' }}>
                      Next: <strong>{Math.max(0, Math.floor((task.next_run - Date.now()) / 1000))}s</strong>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    className="cp-action-btn cp-small" 
                    onClick={() => onTriggerTask(task.task_id)}
                    title="Run Now"
                    disabled={task.status === 'running'}
                  >
                    ▶
                  </button>
                  {task.logging_enabled && (
                    <button 
                      className="cp-action-btn cp-small" 
                      onClick={() => fetchHistory(task)}
                      title="View History"
                    >
                      📋
                    </button>
                  )}
                  <button 
                    className="cp-action-btn cp-small" 
                    onClick={() => handleOpenEdit(task)}
                    title="Edit"
                  >
                    ✎
                  </button>
                  {/* Don't allow deleting core tasks */}
                  {!['match_creation', 'live_scraping', 'match_reconciliation'].includes(task.task_id) && (
                    <button 
                      className="cp-action-btn cp-small cp-danger" 
                      onClick={() => onDeleteTask(task.task_id)}
                      title="Delete"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              
              {task.error_message && (
                <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(255, 59, 48, 0.1)', borderRadius: '4px', fontSize: '10px', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.2)' }}>
                  Error: {task.error_message}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="cp-overlay" style={{ zIndex: 1000 }}>
          <div className="cp-glass-card" style={{ width: '400px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>{editingTask ? 'Edit Task' : 'Add New Task'}</h3>
              <button onClick={() => setShowAddModal(false)} className="cp-close-btn">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="cp-form-row">
                <label>Task Name *</label>
                <input 
                  value={formData.name} 
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Daily Data Sync"
                  required
                />
              </div>
              <div className="cp-form-row">
                <label>Task ID (Optional)</label>
                <input 
                  value={formData.task_id} 
                  onChange={e => setFormData({ ...formData, task_id: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                  disabled={!!editingTask}
                />
                {!editingTask && formData.name && (
                  <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                    Preview: {generateTaskId(formData.name || '')}
                  </span>
                )}
              </div>
              <div className="cp-form-row">
                <label>Task Type *</label>
                <select 
                  value={formData.type} 
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="scraping">Scraping</option>
                  <option value="match_creation">Match Creation</option>
                  <option value="reconciliation">Reconciliation</option>
                </select>
              </div>
              <div className="cp-form-row">
                <label>Cron Expression (Optional)</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input 
                    value={formData.cron_expression || ''} 
                    onChange={e => setFormData({ ...formData, cron_expression: e.target.value })}
                    placeholder="e.g. */5 * * * *"
                    style={{ flex: 1 }}
                  />
                  <select 
                    onChange={e => setFormData({ ...formData, cron_expression: e.target.value })}
                    style={{ width: '120px' }}
                    value=""
                  >
                    <option value="" disabled>Presets</option>
                    <option value="* * * * *">Every Min</option>
                    <option value="*/5 * * * *">Every 5m</option>
                    <option value="0 19 * * 1-5">IPL Weekdays (7PM)</option>
                    <option value="30 15,19 * * 6,0">IPL Weekends (Double)</option>
                    <option value="0 0 * * *">Daily @ Midnight</option>
                  </select>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,165,0,0.05)', borderRadius: '4px', border: '1px solid rgba(255,165,0,0.1)', fontSize: '10px' }}>
                  <strong style={{ color: 'orange' }}>IPL Tip:</strong> Weekday matches start at 7:30 PM IST (19:30). Weekend double-headers usually start at 3:30 PM and 7:30 PM.
                </div>
                <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                  If set, takes precedence over interval. Use <a href="https://crontab.guru" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }}>crontab.guru</a> for help.
                </span>
              </div>
              <div className="cp-form-row">
                <label>Interval (seconds) *</label>
                <input 
                  type="number" 
                  value={formData.interval_seconds} 
                  onChange={e => setFormData({ ...formData, interval_seconds: parseInt(e.target.value) })}
                  min="5"
                  required
                  disabled={!!formData.cron_expression}
                />
              </div>
              <div className="cp-form-row">
                <label className="cp-toggle-row">
                  <span>Adaptive Frequency</span>
                  <Toggle 
                    checked={formData.is_adaptive || false} 
                    onChange={v => setFormData({ ...formData, is_adaptive: v })}
                  />
                </label>
                <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                  Slows down in middle overs, speeds up in first 5 and last 5.
                </span>
              </div>
              <div className="cp-form-row">
                <label className="cp-toggle-row">
                  <span>Enable Job Logging</span>
                  <Toggle 
                    checked={formData.logging_enabled || false} 
                    onChange={v => setFormData({ ...formData, logging_enabled: v })}
                  />
                </label>
              </div>
              <div className="cp-form-row">
                <label className="cp-toggle-row">
                  <span>Enabled</span>
                  <Toggle 
                    checked={formData.enabled || false} 
                    onChange={v => setFormData({ ...formData, enabled: v })}
                  />
                </label>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="cp-secondary-btn" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="cp-primary-btn" style={{ flex: 1 }}>{editingTask ? 'Save Changes' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyTask && (
        <div className="cp-overlay" style={{ zIndex: 1001 }}>
          <div className="cp-glass-card" style={{ width: '600px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <h3 style={{ margin: 0 }}>Job History: {historyTask.name}</h3>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Last 50 executions (SQLite)</span>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="cp-close-btn">&times;</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading history...</div>
              ) : jobHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No history found for this task.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '8px' }}>Time</th>
                      <th style={{ padding: '8px' }}>Duration</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobHistory.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '8px' }}>
                          {new Date(log.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px' }}>
                          {log.end_time ? `${Math.round((log.end_time - log.start_time) / 1000)}s` : 'N/A'}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <TaskStatusBadge status={log.status} />
                        </td>
                        <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.error || (log.metadata ? JSON.stringify(log.metadata) : '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
              <button onClick={() => setShowHistoryModal(false)} className="cp-secondary-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .automation-scheduler-container {
          display: flex;
          flex-direction: column;
        }
        .cp-active {
          border-color: var(--accent-blue) !important;
          background: rgba(0, 122, 255, 0.1) !important;
          color: var(--accent-blue) !important;
        }
      `}} />
    </div>
  );
};
