import { TestBed } from '@angular/core/testing'
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { firstValueFrom } from 'rxjs'
import { ArchitectureComponent } from './architecture.component'
import { DashboardService, Dashboard } from '../../services/dashboard.service'

describe('ArchitectureComponent import/export flow', () => {
  let httpMock: HttpTestingController
  let service: DashboardService

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, ArchitectureComponent]
    }).compileComponents()
    httpMock = TestBed.inject(HttpTestingController)
    service = TestBed.inject(DashboardService)
  })

  it('should export current dashboard', () => {
    const comp = TestBed.createComponent(ArchitectureComponent).componentInstance
    comp.currentDashboardId = 'dash-x'
    comp.currentDashboard = { id: 'dash-x', name: 'X', data: { nodes: [], edges: [], nodeTypes: [], groups: [], vms: [], domains: [] }, createdAt: new Date().toISOString() }
    const original = document.createElement
    ;(document as any).createElement = (tag: any) => original.call(document, tag)
    comp.exportDashboard()
    ;(document as any).createElement = original as any
  })
})
