import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Job {
    id: string;
    type: 'Import' | 'Export' | 'Backup' | 'Restore';
    status: 'Running' | 'Completed' | 'Failed' | 'Pending';
    progress: number;
    startedAt: string;
}

@Component({
    selector: 'app-jobs',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './jobs.component.html',
    styleUrls: ['./jobs.component.scss']
})
export class JobsComponent {
    jobs: Job[] = [
        { id: 'JOB-1001', type: 'Import', status: 'Completed', progress: 100, startedAt: new Date(Date.now() - 3600000).toISOString() },
        { id: 'JOB-1002', type: 'Backup', status: 'Running', progress: 45, startedAt: new Date().toISOString() },
        { id: 'JOB-1003', type: 'Export', status: 'Pending', progress: 0, startedAt: new Date().toISOString() },
        { id: 'JOB-1004', type: 'Restore', status: 'Failed', progress: 12, startedAt: new Date(Date.now() - 7200000).toISOString() }
    ];

    showCreateModal = false;
    newJobType = 'Import';

    openCreateModal() {
        this.showCreateModal = true;
    }

    closeCreateModal() {
        this.showCreateModal = false;
    }

    createJob() {
        const newJob: Job = {
            id: 'JOB-' + (Math.floor(Math.random() * 9000) + 1000),
            type: this.newJobType as any,
            status: 'Pending',
            progress: 0,
            startedAt: new Date().toISOString()
        };

        this.jobs.unshift(newJob);
        this.closeCreateModal();

        // Simulate progress
        setTimeout(() => {
            newJob.status = 'Running';
            const interval = setInterval(() => {
                newJob.progress += 10;
                if (newJob.progress >= 100) {
                    newJob.progress = 100;
                    newJob.status = 'Completed';
                    clearInterval(interval);
                }
            }, 1000);
        }, 1000);
    }

    deleteJob(index: number) {
        if (confirm('Are you sure you want to delete this job?')) {
            this.jobs.splice(index, 1);
        }
    }

    getStatusClass(status: string): string {
        switch (status) {
            case 'Running': return 'status-running';
            case 'Completed': return 'status-completed';
            case 'Failed': return 'status-failed';
            default: return 'status-pending';
        }
    }
}
