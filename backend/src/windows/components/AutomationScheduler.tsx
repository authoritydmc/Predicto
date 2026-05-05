import React from 'react';

interface AutomationStatus {
  total_tasks?: number;
  running_tasks?: number;
  error_tasks?: number;
  uptime?: number;
}

interface TaskInfo {
  task_id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  last_run?: number;
  next_run?: number;
}

interface AutomationSchedulerProps {
  schedulerRunning: boolean;
  wsConnection: WebSocket | null;
  automationStatus: AutomationStatus | null;
  automationTasks: Record<string, TaskInfo>;
  schedulerTasks: Record<string, any>;
  onTriggerTask: (taskType: 'live_scraping' | 'score_processing' | 'match_creation') => void;
}

const TaskStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    pending: '#8e8e93',
    running: '#34c759',
    completed: '#007aff',
    error: '#ff3b30',
  };
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        background: `${colors[status] || colors.pending}20`,
        color: colors[status] || colors.pending,
        textTransform: 'capitalize',
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
  schedulerTasks,
  onTriggerTask,
}) => {
  const taskButtons = [
    { type: 'live_scraping' as const, label: 'Trigger Scraping' },
    { type: 'score_processing' as const, label: 'Process Scores' },
    { type: 'match_creation' as const, label: 'Create Matches' },
  ];

  return (
    <div className="cp-glass-card">
      {/* Enhanced Automation Status */}
      <div
        style={{
          marginBottom: '16px',
          padding: '12px',
          background: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>
            Enhanced Automation Status
          </span>
          <span className={`cp-dot ${schedulerRunning ? 'active' : 'inactive'}`} />
        </div>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {schedulerRunning ? 'Running' : 'Offline'}
        </span>
        {wsConnection && (
          <span style={{ fontSize: '10px', color: '#34c759', marginLeft: '8px' }}>● Connected</span>
        )}
      </div>

      {/* Automation Tasks Summary */}
      {automationStatus && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
          }}
        >
          <div className="cp-section-header">
            <span>Active Tasks ({automationStatus.total_tasks || 0})</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '8px',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Running:</span>
              <span style={{ color: '#34c759' }}>{automationStatus.running_tasks || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Errors:</span>
              <span style={{ color: '#ff3b30' }}>{automationStatus.error_tasks || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Uptime:</span>
              <span>{Math.floor((automationStatus.uptime || 0) / 60000)}m</span>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {taskButtons.map(({ type, label }) => (
          <button
            key={type}
            className="cp-action-btn cp-small"
            onClick={() => onTriggerTask(type)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Legacy Scheduler Status */}
      <div
        style={{
          marginBottom: '16px',
          padding: '12px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
            Legacy Scheduler
          </span>
          <span className={`cp-dot ${schedulerRunning ? 'active' : 'inactive'}`} />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
          {schedulerRunning ? 'Running' : 'Stopped'}
        </span>
      </div>

      {/* Task List */}
      <div className="cp-section-header">
        <span>Scheduled Tasks</span>
      </div>
      {Object.keys(schedulerTasks).length === 0 && Object.keys(automationTasks).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '12px' }}>
          No active tasks
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(automationTasks).map(([id, task]) => (
            <div
              key={id}
              style={{
                padding: '10px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 500 }}>{task.name || id}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                  {task.last_run && `Last: ${new Date(task.last_run).toLocaleTimeString()}`}
                </div>
              </div>
              <TaskStatusBadge status={task.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
