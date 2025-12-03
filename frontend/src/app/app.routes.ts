import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { ArchitectureComponent } from './pages/architecture/architecture.component';
import { JobsComponent } from './pages/jobs/jobs.component';

export const routes: Routes = [
    {
        path: '',
        component: LayoutComponent,
        children: [
            { path: '', redirectTo: 'architecture', pathMatch: 'full' },
            { path: 'architecture', component: ArchitectureComponent },
            { path: 'jobs', component: JobsComponent },
            { path: 'dashboard', component: ArchitectureComponent }, // Reuse for demo
            { path: 'settings', component: ArchitectureComponent }, // Reuse for demo
        ]
    }
];
