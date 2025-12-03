import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

export interface DashboardData {
  nodes: any[];
  edges: any[];
  nodeTypes: any[];
  groups: any[];
  vms: any[];
  domains: any[];
}

export interface Dashboard {
  id: string;
  name: string;
  data: DashboardData;
  createdAt: string;
  updatedAt?: string;
}

export interface DashboardListItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = 'http://localhost:8080/api/dashboards';

  constructor(private http: HttpClient) {}

  list(): Observable<DashboardListItem[]> {
    return this.http.get<DashboardListItem[]>(this.apiUrl).pipe(
      catchError(err => {
        console.error('Failed to list dashboards:', err);
        return of([]);
      })
    );
  }

  get(id: string): Observable<Dashboard | null> {
    return this.http.get<Dashboard>(`${this.apiUrl}/${id}`).pipe(
      catchError(err => {
        console.error('Failed to get dashboard:', err);
        return of(null);
      })
    );
  }

  create(name: string, data?: DashboardData): Observable<Dashboard | null> {
    return this.http.post<Dashboard>(this.apiUrl, { name, data }).pipe(
      catchError(err => {
        console.error('Failed to create dashboard:', err);
        return of(null);
      })
    );
  }

  update(id: string, name?: string, data?: DashboardData): Observable<Dashboard | null> {
    const body: any = {};
    if (name !== undefined) body.name = name;
    if (data !== undefined) body.data = data;

    return this.http.put<Dashboard>(`${this.apiUrl}/${id}`, body).pipe(
      catchError(err => {
        console.error('Failed to update dashboard:', err);
        return of(null);
      })
    );
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      map(() => true),
      catchError(err => {
        console.error('Failed to delete dashboard:', err);
        return of(false);
      })
    );
  }

  import(dashboard: Dashboard): Observable<Dashboard | null> {
    return this.http.post<Dashboard>(`${this.apiUrl}/import`, dashboard).pipe(
      catchError(err => {
        console.error('Failed to import dashboard:', err);
        return of(null);
      })
    );
  }

  exportToFile(dashboard: Dashboard): void {
    const dataStr = JSON.stringify(dashboard, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const filename = `${dashboard.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    const nav: any = window.navigator;
    if (nav && typeof nav.msSaveOrOpenBlob === 'function') {
      nav.msSaveOrOpenBlob(blob, filename);
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    try {
      link.click();
      link.dispatchEvent(new MouseEvent('click'));
    } finally {
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 0);
    }
  }

  importFromFile(file: File): Observable<Dashboard | null> {
    return new Observable(observer => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const raw = JSON.parse(content) as any;
          const sanitized: Dashboard = {
            id: typeof raw?.id === 'string' ? raw.id : '',
            name: typeof raw?.name === 'string' ? raw.name : 'Imported Dashboard',
            data: {
              nodes: Array.isArray(raw?.data?.nodes) ? raw.data.nodes : [],
              edges: Array.isArray(raw?.data?.edges) ? raw.data.edges : [],
              nodeTypes: Array.isArray(raw?.data?.nodeTypes) ? raw.data.nodeTypes : [],
              groups: Array.isArray(raw?.data?.groups) ? raw.data.groups : [],
              vms: Array.isArray(raw?.data?.vms) ? raw.data.vms : [],
              domains: Array.isArray(raw?.data?.domains) ? raw.data.domains : []
            },
            createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
            updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined
          };
          this.import(sanitized).subscribe({
            next: (result) => {
              observer.next(result);
              observer.complete();
            },
            error: (err) => observer.error(err)
          });
        } catch (err) {
          console.error('Failed to parse file:', err);
          observer.next(null);
          observer.complete();
        }
      };
      reader.onerror = () => {
        observer.next(null);
        observer.complete();
      };
      reader.readAsText(file);
    });
  }
}
