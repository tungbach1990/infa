import { TestBed } from '@angular/core/testing'
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { firstValueFrom } from 'rxjs'
import { DashboardService, Dashboard } from './dashboard.service'

describe('DashboardService', () => {
  let service: DashboardService
  let httpMock: HttpTestingController

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] })
    service = TestBed.inject(DashboardService)
    httpMock = TestBed.inject(HttpTestingController)
  })

  it('import should POST to backend', () => {
    const dash: Dashboard = { id: '', name: 'X', data: { nodes: [], edges: [], nodeTypes: [], groups: [], vms: [], domains: [] }, createdAt: new Date().toISOString() }
    service.import(dash).subscribe()
    const req = httpMock.expectOne('http://localhost:8080/api/dashboards/import')
    expect(req.request.method).toBe('POST')
    req.flush({ ...dash, id: 'dash-1' })
  })

  it('exportToFile should trigger download', () => {
    const original = document.createElement
    let clicked = false
    ;(document as any).createElement = (tag: any) => {
      const el = original.call(document, tag)
      if (tag === 'a') {
        ;(el as any).click = () => { clicked = true }
      }
      return el
    }
    const d: Dashboard = { id: 'd', name: 'N', data: { nodes: [], edges: [], nodeTypes: [], groups: [], vms: [], domains: [] }, createdAt: new Date().toISOString() }
    service.exportToFile(d)
    expect(clicked).toBe(true)
    ;(document as any).createElement = original as any
  })
})
