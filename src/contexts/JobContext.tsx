import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'copy' | 'move' | 'scan' | 'search' | 'export' | 'other';

export interface Job {
  id: string;
  type: JobType;
  name: string;
  status: JobStatus;
  progress: number; // 0 to 100
  total?: number;
  processed?: number;
  message?: string;
  startTime: Date;
  endTime?: Date;
  
  // Callback handlers
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  
  // Custom data
  metadata?: any;
}

interface JobContextType {
  jobs: Job[];
  activeJobs: Job[];
  completedJobs: Job[];
  
  // Actions
  registerJob: (job: Omit<Job, 'id' | 'status' | 'startTime' | 'progress'>) => string;
  updateJob: (id: string, updates: Partial<Job>) => void;
  completeJob: (id: string, status?: 'completed' | 'failed' | 'cancelled', message?: string) => void;
  removeJob: (id: string) => void;
  clearCompletedJobs: () => void;
  
  // Controls
  cancelJob: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  
  // Bulk Controls
  cancelAll: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
}

const JobContext = createContext<JobContextType | null>(null);

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  
  // Helper to safely call job handlers
  const getJob = useCallback((id: string) => jobs.find(j => j.id === id), [jobs]);

  const registerJob = useCallback((jobData: Omit<Job, 'id' | 'status' | 'startTime' | 'progress'>) => {
    const id = uuidv4();
    const newJob: Job = {
      ...jobData,
      id,
      status: 'pending', // Starts pending, consumer should update to running
      progress: 0,
      startTime: new Date(),
    };
    
    setJobs(prev => [...prev, newJob]);
    return id;
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { ...job, ...updates } : job
    ));
  }, []);

  const completeJob = useCallback((id: string, status: 'completed' | 'failed' | 'cancelled' = 'completed', message?: string) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { 
        ...job, 
        status, 
        progress: status === 'completed' ? 100 : job.progress, 
        endTime: new Date(),
        message: message || job.message 
      } : job
    ));
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(job => job.id !== id));
  }, []);

  const clearCompletedJobs = useCallback(() => {
    setJobs(prev => prev.filter(job => ['pending', 'running', 'paused'].includes(job.status)));
  }, []);

  // Individual Actions
  const cancelJob = useCallback((id: string) => {
    setJobs(prev => {
        const job = prev.find(j => j.id === id);
        if (job && job.onCancel && job.status !== 'cancelled' && job.status !== 'completed' && job.status !== 'failed') {
            job.onCancel();
            // We optimistically mark as cancelling? Or wait for updateJob?
            // Usually best to wait, but UI responsiveness is nice.
            // Let's mark as cancelling/cancelled.
            return prev.map(j => j.id === id ? { ...j, status: 'cancelled' } : j);
        }
        return prev;
    });
  }, []);

  const pauseJob = useCallback((id: string) => {
    setJobs(prev => {
        const job = prev.find(j => j.id === id);
        if (job && job.onPause && job.status === 'running') {
            job.onPause();
            return prev.map(j => j.id === id ? { ...j, status: 'paused' } : j);
        }
        return prev;
    });
  }, []);

  const resumeJob = useCallback((id: string) => {
    setJobs(prev => {
        const job = prev.find(j => j.id === id);
        if (job && job.onResume && job.status === 'paused') {
            job.onResume();
            return prev.map(j => j.id === id ? { ...j, status: 'running' } : j);
        }
        return prev;
    });
  }, []);

  // Bulk Actions
  const cancelAll = useCallback(() => {
    setJobs(prev => {
        prev.forEach(job => {
            if (['pending', 'running', 'paused'].includes(job.status) && job.onCancel) {
                job.onCancel();
            }
        });
        return prev.map(job => 
             ['pending', 'running', 'paused'].includes(job.status) ? { ...job, status: 'cancelled' } : job
        );
    });
  }, []);

  const pauseAll = useCallback(() => {
    setJobs(prev => {
        prev.forEach(job => {
            if (job.status === 'running' && job.onPause) {
                job.onPause();
            }
        });
        return prev.map(job => 
             job.status === 'running' && job.onPause ? { ...job, status: 'paused' } : job
        );
    });
  }, []);

  const resumeAll = useCallback(() => {
     setJobs(prev => {
        prev.forEach(job => {
            if (job.status === 'paused' && job.onResume) {
                job.onResume();
            }
        });
        return prev.map(job => 
             job.status === 'paused' && job.onResume ? { ...job, status: 'running' } : job
        );
    });
  }, []);

  const activeJobs = jobs.filter(j => ['pending', 'running', 'paused'].includes(j.status));
  const completedJobs = jobs.filter(j => ['completed', 'failed', 'cancelled'].includes(j.status));

  return (
    <JobContext.Provider value={{
      jobs,
      activeJobs,
      completedJobs,
      registerJob,
      updateJob,
      completeJob,
      removeJob,
      clearCompletedJobs,
      cancelJob,
      pauseJob,
      resumeJob,
      cancelAll,
      pauseAll,
      resumeAll
    }}>
      {children}
    </JobContext.Provider>
  );
};
