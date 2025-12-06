import { Component, HostListener, OnInit, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, Dashboard, DashboardListItem } from '../../services/dashboard.service';

interface Node {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  groupId?: string;
  dragOffsetX?: number;
  dragOffsetY?: number;
}

interface Edge {
  id: string;
  from: string;
  fromAnchor: string;
  to: string;
  toAnchor: string;
  arrowType: string;
  label?: string;
}

interface NodeType {
  value: string;
  label: string;
  icon: string;
  iconType?: 'emoji' | 'url' | 'base64';
  color?: string;
}

interface NodeRole {
  id: string;
  name: string;
  count: number;
  cpu: string;
  ram: string;
  disk: string;
  gpu?: string;
  vram?: string;
}

interface NodeGroup {
  id: string;
  name: string;
  type: 'cluster' | 'vm' | 'zone';
  nodeIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  icon?: string;
  iconType?: 'emoji' | 'url' | 'base64';
  specs: {
    cpu: string;
    ram: string;
    disk: string;
  };
  nodeRoles?: NodeRole[];
}

@Component({
  selector: 'app-architecture',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './architecture.component.html',
  styleUrls: ['./architecture.component.scss'],
})
export class ArchitectureComponent implements OnInit {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef;
  @ViewChild('importFileInput') importFileInput!: ElementRef<HTMLInputElement>;

  private dashboardService = inject(DashboardService);

  currentVersion = '1.0.0';
  isLoading = false;

  // Canvas State
  canvasTransform = { x: 0, y: 0, scale: 1 };
  isPanning = false;
  panStart = { x: 0, y: 0 };
  minZoom = 0.25;
  maxZoom = 2;

  // Resource Management Data
  vms: any[] = [];
  domains: any[] = [];
  showVMModal = false;
  showDomainModal = false;
  newVM: any = { name: '', ip: '', cpu: '', ram: '', services: '' };
  newDomain: any = { name: '', public_ip: '', lb_id: '' };

  // Dashboard Management
  dashboards: DashboardListItem[] = [];
  currentDashboardId: string | null = null;
  currentDashboard: Dashboard | null = null;
  showDashboardModal = false;
  newDashboardName = '';

  // Group Management
  groups: NodeGroup[] = [];
  selectedGroup: NodeGroup | null = null;
  showGroupModal = false;
  showGroupManageModal = false;
  groupSearchQuery = '';
  isCreatingGroup = false;
  groupSelectionMode = false;
  selectedNodesForGroup: string[] = [];
  isDraggingGroup = false;
  draggingGroup: NodeGroup | null = null;
  groupDragOffset: { x: number; y: number } | null = null;
  showAddNodeToGroupModal = false;
  addingToGroup: NodeGroup | null = null;
  // Group Resize
  isResizingGroup = false;
  resizingGroup: NodeGroup | null = null;
  resizeHandle: string = '';
  resizeStartPos: { x: number; y: number; width: number; height: number; mouseX: number; mouseY: number } | null = null;
  minGroupWidth = 200;
  minGroupHeight = 150;
  newGroup: NodeGroup = {
    id: '',
    name: '',
    type: 'vm',
    nodeIds: [],
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    color: '#3b82f6',
    icon: '',
    iconType: 'emoji',
    specs: { cpu: '', ram: '', disk: '' },
    nodeRoles: []
  };
  groupTypes: { value: 'vm' | 'cluster' | 'zone'; label: string; icon: string }[] = [
    { value: 'vm', label: 'Virtual Machine', icon: '🖥️' },
    { value: 'cluster', label: 'Cluster', icon: '🔷' },
    { value: 'zone', label: 'Zone/Region', icon: '🌐' }
  ];
  commonRolePresets = ['Master', 'Worker', 'Control Plane', 'Data Node', 'Ingress', 'Storage'];

  // Group Icon Presets
  groupIconCategories = [
    {
      name: 'Cloud Providers',
      icons: [
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg', label: 'AWS' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/googlecloud/googlecloud-original.svg', label: 'GCP' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azure/azure-original.svg', label: 'Azure' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/digitalocean/digitalocean-original.svg', label: 'DigitalOcean' },
      ]
    },
    {
      name: 'Container & K8s',
      icons: [
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kubernetes/kubernetes-original.svg', label: 'Kubernetes' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg', label: 'Docker' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/podman/podman-original.svg', label: 'Podman' },
      ]
    },
    {
      name: 'Infrastructure',
      icons: [
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/terraform/terraform-original.svg', label: 'Terraform' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ansible/ansible-original.svg', label: 'Ansible' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg', label: 'Linux' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ubuntu/ubuntu-original.svg', label: 'Ubuntu' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/centos/centos-original.svg', label: 'CentOS' },
        { icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/debian/debian-original.svg', label: 'Debian' },
      ]
    }
  ];
  showGroupIconPicker = false;

  // Theme Management
  themes = [
    { id: 'minimalism', name: 'Minimalism', description: 'Clean & Swiss' },
    { id: 'neumorphism', name: 'Neumorphism', description: 'Soft UI' },
    { id: 'glassmorphism', name: 'Glassmorphism', description: 'Frosted Glass' },
    { id: 'brutalism', name: 'Brutalism', description: 'Raw & Bold' },
    { id: 'hyperrealism', name: '3D Realism', description: 'Depth & Texture' },
    { id: 'vibrant', name: 'Vibrant Blocks', description: 'Bold & Energetic' },
    { id: 'dark-oled', name: 'Dark OLED', description: 'Deep Black' },
    { id: 'accessible', name: 'Accessible', description: 'WCAG AAA' },
    { id: 'claymorphism', name: 'Claymorphism', description: 'Chunky 3D' },
    { id: 'aurora', name: 'Aurora UI', description: 'Vibrant Gradients' },
    { id: 'retro', name: 'Retro-Futurism', description: '80s Cyberpunk' },
  ];
  currentTheme = 'minimalism';
  showThemeMenu = false;

  ngOnInit() {
    this.initializeDashboards();

    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme) {
      this.currentTheme = savedTheme;
      document.body.className = `theme-${savedTheme}`;
    }
  }

  private initializeDashboards() {
    this.isLoading = true;
    // Clear old localStorage data from browser-only storage
    localStorage.removeItem('architecture_dashboards');
    
    this.dashboardService.list().subscribe({
      next: (dashboards) => {
        this.dashboards = dashboards;
        const lastDashboardId = localStorage.getItem('last_dashboard_id');
        
        // Check if lastDashboardId exists in the list
        const existsInList = lastDashboardId && dashboards.find(d => d.id === lastDashboardId);
        
        if (existsInList) {
          this.loadDashboard(lastDashboardId);
        } else if (dashboards.length > 0) {
          // Clear invalid last_dashboard_id
          localStorage.removeItem('last_dashboard_id');
          this.loadDashboard(dashboards[0].id);
        } else {
          localStorage.removeItem('last_dashboard_id');
          this.createNewDashboard('Default Dashboard');
        }
      },
      error: () => {
        this.isLoading = false;
        localStorage.removeItem('last_dashboard_id');
        this.createNewDashboard('Default Dashboard');
      }
    });
  }

  constructor() {}

  // Type Dropdown for Edit Panel
  typeDropdownOpen = false;
  editTypeDropdownOpen = false;

  toggleTypeDropdown() {
    this.typeDropdownOpen = !this.typeDropdownOpen;
  }

  toggleEditTypeDropdown() {
    this.editTypeDropdownOpen = !this.editTypeDropdownOpen;
  }

  getNodeTypeByValue(value: string): NodeType | undefined {
    return this.nodeTypes.find(t => t.value === value);
  }

  selectNodeType(value: string) {
    if (this.selectedNode) {
      this.selectedNode.type = value;
    }
    this.typeDropdownOpen = false;
  }

  selectEditNodeType(value: string) {
    if (this.editingNode) {
      this.editingNode.type = value;
    }
    this.editTypeDropdownOpen = false;
  }

  // Auto-save on node/edge changes
  private saveTimeout: any = null;
  
  onNodeChange() {
    this.debouncedSave();
  }

  onEdgeChange() {
    // Update the original edge in edges array
    if (this.selectedEdge) {
      const originalEdge = this.edges.find(e => e.id === this.selectedEdge!.id);
      if (originalEdge) {
        originalEdge.label = this.selectedEdge.label;
        originalEdge.arrowType = this.selectedEdge.arrowType;
      }
    }
    this.debouncedSave();
  }

  private debouncedSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentDashboard();
    }, 500);
  }

  // Theme Methods
  toggleThemeMenu() {
    this.showThemeMenu = !this.showThemeMenu;
  }

  switchTheme(themeId: string) {
    this.currentTheme = themeId;
    document.body.className = `theme-${themeId}`;
    localStorage.setItem('app_theme', themeId);
    this.showThemeMenu = false;
  }

  // Group Methods
  startGroupCreation() {
    // Directly open modal to create empty group
    this.selectedGroup = null;
    this.selectedNodesForGroup = [];
    this.isCreatingGroup = true;
    this.groupSelectionMode = false;
    
    // Set default position for new group (center of visible canvas)
    const container = document.querySelector('.canvas-viewport');
    let x = 100, y = 100;
    if (container) {
      const rect = container.getBoundingClientRect();
      x = (rect.width / 2 - this.canvasTransform.x) / this.canvasTransform.scale - 150;
      y = (rect.height / 2 - this.canvasTransform.y) / this.canvasTransform.scale - 100;
    }
    
    this.newGroup = {
      id: 'group-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name: '',
      type: 'vm',
      nodeIds: [],
      x: Math.round(x / 20) * 20,
      y: Math.round(y / 20) * 20,
      width: 300,
      height: 200,
      color: '#3b82f6',
      icon: '',
      iconType: 'emoji',
      specs: { cpu: '', ram: '', disk: '' },
      nodeRoles: []
    };
    this.showGroupModal = true;
  }

  cancelGroupCreation() {
    this.groupSelectionMode = false;
    this.selectedNodesForGroup = [];
    this.isCreatingGroup = false;
    this.showGroupModal = false;
    this.showGroupIconPicker = false;
    this.selectedGroup = null;
    this.resetNewGroup();
  }

  toggleNodeForGroup(nodeId: string) {
    const index = this.selectedNodesForGroup.indexOf(nodeId);
    if (index > -1) {
      this.selectedNodesForGroup.splice(index, 1);
    } else {
      this.selectedNodesForGroup.push(nodeId);
    }
  }

  isNodeSelectedForGroup(nodeId: string): boolean {
    return this.selectedNodesForGroup.includes(nodeId);
  }

  confirmGroupSelection() {
    // This method is no longer needed but kept for compatibility
    if (this.selectedNodesForGroup.length < 1) {
      this.startGroupCreation();
      return;
    }

    const selectedNodes = this.nodes.filter(n => this.selectedNodesForGroup.includes(n.id));
    const minX = Math.min(...selectedNodes.map(n => n.x)) - 40;
    const minY = Math.min(...selectedNodes.map(n => n.y)) - 60;
    const maxX = Math.max(...selectedNodes.map(n => n.x)) + 140;
    const maxY = Math.max(...selectedNodes.map(n => n.y)) + 100;

    this.newGroup = {
      id: 'group-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name: '',
      type: 'vm',
      nodeIds: [...this.selectedNodesForGroup],
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      color: '#3b82f6',
      icon: '',
      iconType: 'emoji',
      specs: { cpu: '4 vCPU', ram: '16 GB', disk: '100 GB' },
      nodeRoles: []
    };
    this.groupSelectionMode = false;
    this.showGroupModal = true;
  }

  saveGroup() {
    if (!this.newGroup.name) return;

    // Generate unique ID for new groups
    const groupId = this.selectedGroup ? this.newGroup.id : 'group-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // Deep copy to avoid reference issues
    const groupToSave: NodeGroup = {
      id: groupId,
      name: this.newGroup.name,
      type: this.newGroup.type,
      nodeIds: [...(this.newGroup.nodeIds || [])],
      x: this.newGroup.x,
      y: this.newGroup.y,
      width: this.newGroup.width,
      height: this.newGroup.height,
      color: this.newGroup.color,
      icon: this.newGroup.icon || '',
      iconType: this.newGroup.iconType || 'emoji',
      specs: {
        cpu: this.newGroup.specs?.cpu || '',
        ram: this.newGroup.specs?.ram || '',
        disk: this.newGroup.specs?.disk || ''
      },
      nodeRoles: this.newGroup.nodeRoles ? this.newGroup.nodeRoles.map(r => ({ ...r })) : []
    };

    if (this.selectedGroup) {
      const index = this.groups.findIndex(g => g.id === this.selectedGroup!.id);
      if (index > -1) {
        this.groups[index] = groupToSave;
      }
    } else {
      this.groups.push(groupToSave);
      // Assign groupId to selected nodes
      this.selectedNodesForGroup.forEach(nodeId => {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
          node.groupId = groupToSave.id;
        }
      });
    }

    this.showGroupModal = false;
    this.showGroupIconPicker = false;
    this.selectedGroup = null;
    this.selectedNodesForGroup = [];
    this.isCreatingGroup = false;
    this.resetNewGroup();
    this.saveCurrentDashboard();
  }

  resetNewGroup() {
    this.newGroup = {
      id: '',
      name: '',
      type: 'vm',
      nodeIds: [],
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      color: '#3b82f6',
      icon: '',
      iconType: 'emoji',
      specs: { cpu: '', ram: '', disk: '' },
      nodeRoles: []
    };
  }

  editGroup(group: NodeGroup) {
    this.selectedGroup = group;
    this.showGroupIconPicker = false;
    // Deep copy to avoid modifying original
    this.newGroup = {
      id: group.id,
      name: group.name,
      type: group.type,
      nodeIds: [...(group.nodeIds || [])],
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      color: group.color,
      icon: group.icon || '',
      iconType: group.iconType || 'emoji',
      specs: { 
        cpu: group.specs?.cpu || '', 
        ram: group.specs?.ram || '', 
        disk: group.specs?.disk || '' 
      },
      nodeRoles: group.nodeRoles ? group.nodeRoles.map(r => ({ ...r, id: r.id || 'role-' + Date.now() + Math.random() })) : []
    };
    this.showGroupModal = true;
  }

  // Node Role Management
  addNodeRole() {
    if (!this.newGroup.nodeRoles) {
      this.newGroup.nodeRoles = [];
    }
    this.newGroup.nodeRoles.push({
      id: 'role-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name: '',
      count: 1,
      cpu: '2 vCPU',
      ram: '4 GB',
      disk: '50 GB',
      gpu: '',
      vram: ''
    });
  }

  removeNodeRole(index: number) {
    if (this.newGroup.nodeRoles) {
      this.newGroup.nodeRoles.splice(index, 1);
    }
  }

  getTotalNodes(group: NodeGroup): number {
    if (!group.nodeRoles || group.nodeRoles.length === 0) return 0;
    return group.nodeRoles.reduce((sum, role) => sum + role.count, 0);
  }

  deleteGroup(group: NodeGroup) {
    // Remove groupId from all nodes in this group (nodes are NOT deleted)
    this.nodes.filter(n => n.groupId === group.id).forEach(n => {
      n.groupId = undefined;
    });
    const index = this.groups.findIndex(g => g.id === group.id);
    if (index > -1) {
      this.groups.splice(index, 1);
      this.saveCurrentDashboard();
    }
  }

  selectGroup(group: NodeGroup) {
    this.selectedGroup = group;
    this.selectedNode = null;
    this.selectedEdge = null;
  }

  // Group Manage Modal
  openGroupManageModal() {
    this.showGroupManageModal = true;
    this.groupSearchQuery = '';
  }

  closeGroupManageModal() {
    this.showGroupManageModal = false;
  }

  get filteredGroups(): NodeGroup[] {
    if (!this.groupSearchQuery) return this.groups;
    const query = this.groupSearchQuery.toLowerCase();
    return this.groups.filter(g =>
      g.name.toLowerCase().includes(query) ||
      g.type.toLowerCase().includes(query)
    );
  }

  getNodeCountInGroup(groupId: string): number {
    return this.nodes.filter(n => n.groupId === groupId).length;
  }

  focusGroup(group: NodeGroup) {
    const centerX = group.x + group.width / 2;
    const centerY = group.y + group.height / 2;
    const container = document.querySelector('.canvas-viewport');
    if (container) {
      const rect = container.getBoundingClientRect();
      this.canvasTransform.x = rect.width / 2 - centerX * this.canvasTransform.scale;
      this.canvasTransform.y = rect.height / 2 - centerY * this.canvasTransform.scale;
    }
    this.selectGroup(group);
    this.closeGroupManageModal();
  }

  duplicateGroup(group: NodeGroup) {
    const newId = 'group-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const newGroup: NodeGroup = {
      id: newId,
      name: group.name + ' (Copy)',
      type: group.type,
      nodeIds: [], // Don't copy nodeIds - duplicated group starts empty
      x: group.x + 50,
      y: group.y + 50,
      width: group.width,
      height: group.height,
      color: group.color,
      icon: group.icon || '',
      iconType: group.iconType || 'emoji',
      specs: { 
        cpu: group.specs?.cpu || '', 
        ram: group.specs?.ram || '', 
        disk: group.specs?.disk || '' 
      },
      nodeRoles: group.nodeRoles ? group.nodeRoles.map(r => ({ 
        ...r, 
        id: 'role-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) 
      })) : []
    };
    this.groups.push(newGroup);
    this.saveCurrentDashboard();
  }

  deleteGroupFromModal(group: NodeGroup) {
    this.deleteGroup(group);
  }

  // Group Icon Methods
  toggleGroupIconPicker() {
    this.showGroupIconPicker = !this.showGroupIconPicker;
  }

  selectGroupIcon(iconUrl: string) {
    this.newGroup.icon = iconUrl;
    this.newGroup.iconType = 'url';
    this.showGroupIconPicker = false;
  }

  clearGroupIcon() {
    this.newGroup.icon = '';
    this.newGroup.iconType = 'emoji';
  }

  getGroupDisplayIcon(group: NodeGroup): string {
    if (group.icon && group.icon.length > 0) {
      return group.icon;
    }
    return this.getGroupTypeIcon(group.type);
  }

  isGroupIconUrl(group: NodeGroup): boolean {
    if (!group.icon) return false;
    return group.iconType === 'url' || group.icon.startsWith('http') || group.icon.startsWith('data:image');
  }

  startDragGroup(group: NodeGroup, event: MouseEvent) {
    event.stopPropagation();
    this.isDraggingGroup = true;
    this.draggingGroup = group;
    const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
    if (container) {
      const mouseX = (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale;
      const mouseY = (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale;
      this.groupDragOffset = {
        x: mouseX - group.x,
        y: mouseY - group.y
      };
    }
  }

  // Add/Remove nodes from group
  openAddNodeToGroupModal(group: NodeGroup) {
    this.addingToGroup = group;
    this.showAddNodeToGroupModal = true;
  }

  closeAddNodeToGroupModal() {
    this.addingToGroup = null;
    this.showAddNodeToGroupModal = false;
  }

  getNodesInGroup(groupId: string): Node[] {
    return this.nodes.filter(n => n.groupId === groupId);
  }

  getNodesNotInAnyGroup(): Node[] {
    return this.nodes.filter(n => !n.groupId);
  }

  addNodeToGroup(node: Node, group: NodeGroup) {
    node.groupId = group.id;
    // Position node inside group if outside
    const padding = 60;
    const nodeWidth = 140;
    const nodeHeight = 60;
    if (node.x < group.x + 10 || node.x > group.x + group.width - nodeWidth - 10 ||
        node.y < group.y + padding || node.y > group.y + group.height - nodeHeight - 10) {
      node.x = group.x + 20;
      node.y = group.y + padding + 10;
    }
    this.saveCurrentDashboard();
  }

  removeNodeFromGroup(node: Node) {
    node.groupId = undefined;
    this.saveCurrentDashboard();
  }

  getGroupById(groupId: string): NodeGroup | undefined {
    return this.groups.find(g => g.id === groupId);
  }

  removeNodeFromCurrentGroup(node: Node) {
    node.groupId = undefined;
    this.saveCurrentDashboard();
  }

  changeNodeGroup(node: Node, groupId: string) {
    if (groupId === '' || groupId === null) {
      node.groupId = undefined;
    } else {
      node.groupId = groupId;
      const group = this.getGroupById(groupId);
      if (group) {
        const padding = 60;
        const nodeWidth = 140;
        const nodeHeight = 60;
        if (node.x < group.x + 10 || node.x > group.x + group.width - nodeWidth - 10 ||
            node.y < group.y + padding || node.y > group.y + group.height - nodeHeight - 10) {
          node.x = group.x + 20;
          node.y = group.y + padding + 10;
        }
      }
    }
    this.saveCurrentDashboard();
  }

  getGroupTypeLabel(type: string): string {
    const t = this.groupTypes.find(gt => gt.value === type);
    return t ? t.label : type;
  }

  getGroupTypeIcon(type: string): string {
    const t = this.groupTypes.find(gt => gt.value === type);
    return t ? t.icon : '📦';
  }

  getGroupAnchorPosition(group: NodeGroup, anchor: string): { x: number; y: number } {
    switch (anchor) {
      case 'top':
        return { x: group.x + group.width / 2, y: group.y };
      case 'bottom':
        return { x: group.x + group.width / 2, y: group.y + group.height };
      case 'left':
        return { x: group.x, y: group.y + group.height / 2 };
      case 'right':
        return { x: group.x + group.width, y: group.y + group.height / 2 };
      default:
        return { x: group.x + group.width / 2, y: group.y + group.height };
    }
  }

  // Group Resize Methods
  startResizeGroup(group: NodeGroup, handle: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.isResizingGroup = true;
    this.resizingGroup = group;
    this.resizeHandle = handle;
    const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
    if (container) {
      const mouseX = (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale;
      const mouseY = (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale;
      this.resizeStartPos = {
        x: group.x,
        y: group.y,
        width: group.width,
        height: group.height,
        mouseX,
        mouseY
      };
    }
  }

  // Dashboard Methods
  createNewDashboard(name: string) {
    this.isLoading = true;
    const data = {
      nodes: this.nodeTypes.length > 0 ? [] : [],
      edges: [],
      nodeTypes: this.nodeTypes,
      groups: [],
      vms: [],
      domains: [],
    };

    this.dashboardService.create(name, data).subscribe({
      next: (dashboard) => {
        if (dashboard) {
          this.dashboards.unshift({
            id: dashboard.id,
            name: dashboard.name,
            createdAt: dashboard.createdAt,
            updatedAt: dashboard.updatedAt
          });
          this.loadDashboard(dashboard.id);
        }
        this.isLoading = false;
        this.showDashboardModal = false;
        this.newDashboardName = '';
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadDashboard(id: string) {
    this.isLoading = true;
    this.dashboardService.get(id).subscribe({
      next: (dashboard) => {
        if (dashboard) {
          this.currentDashboardId = id;
          this.currentDashboard = dashboard;
          localStorage.setItem('last_dashboard_id', id);

          const data = dashboard.data;
          this.nodes = data.nodes ? JSON.parse(JSON.stringify(data.nodes)) : [];
          this.edges = data.edges ? JSON.parse(JSON.stringify(data.edges)) : [];
          this.nodeTypes = data.nodeTypes?.length > 0 ? JSON.parse(JSON.stringify(data.nodeTypes)) : this.nodeTypes;
          this.groups = data.groups ? JSON.parse(JSON.stringify(data.groups)) : [];
          this.vms = data.vms ? JSON.parse(JSON.stringify(data.vms)) : [];
          this.domains = data.domains ? JSON.parse(JSON.stringify(data.domains)) : [];

          // Fix edge arrow types
          this.edges.forEach((edge) => {
            if (!edge.arrowType || edge.arrowType === 'none') {
              edge.arrowType = 'standard';
            }
          });
        }
        this.isLoading = false;
        this.showDashboardModal = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  saveDiagram() {
    if (!this.currentDashboardId) return;

    const data = {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      edges: JSON.parse(JSON.stringify(this.edges)),
      nodeTypes: JSON.parse(JSON.stringify(this.nodeTypes)),
      groups: JSON.parse(JSON.stringify(this.groups)),
      vms: JSON.parse(JSON.stringify(this.vms)),
      domains: JSON.parse(JSON.stringify(this.domains)),
    };

    this.dashboardService.update(this.currentDashboardId, undefined, data).subscribe({
      next: (dashboard) => {
        if (dashboard) {
          const index = this.dashboards.findIndex(d => d.id === dashboard.id);
          if (index > -1) {
            this.dashboards[index].updatedAt = dashboard.updatedAt;
          }
        }
      }
    });
  }

  saveCurrentDashboard() {
    this.saveDiagram();
  }

  deleteDashboard(dashboard: DashboardListItem) {
    if (dashboard.id === this.currentDashboardId) {
      return;
    }
    this.dashboardService.delete(dashboard.id).subscribe({
      next: (success) => {
        if (success) {
          this.dashboards = this.dashboards.filter(d => d.id !== dashboard.id);
        }
      }
    });
  }

  // Export current dashboard
  exportDashboard() {
    if (!this.currentDashboardId) return;

    // Get dashboard name from list if currentDashboard is not available
    const dashboardInfo = this.dashboards.find(d => d.id === this.currentDashboardId);
    const name = this.currentDashboard?.name || dashboardInfo?.name || 'Dashboard';
    const createdAt = this.currentDashboard?.createdAt || dashboardInfo?.createdAt || new Date().toISOString();

    const exportData: Dashboard = {
      id: this.currentDashboardId,
      name: name,
      data: {
        nodes: JSON.parse(JSON.stringify(this.nodes)),
        edges: JSON.parse(JSON.stringify(this.edges)),
        nodeTypes: JSON.parse(JSON.stringify(this.nodeTypes)),
        groups: JSON.parse(JSON.stringify(this.groups)),
        vms: JSON.parse(JSON.stringify(this.vms)),
        domains: JSON.parse(JSON.stringify(this.domains)),
      },
      createdAt: createdAt,
      updatedAt: new Date().toISOString()
    };

    this.dashboardService.exportToFile(exportData);
  }

  // Trigger file input for import
  triggerImport() {
    this.importFileInput?.nativeElement?.click();
  }

  // Handle file import
  onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.isLoading = true;
      this.dashboardService.importFromFile(input.files[0]).subscribe({
        next: (dashboard) => {
          if (dashboard) {
            this.dashboards.unshift({
              id: dashboard.id,
              name: dashboard.name,
              createdAt: dashboard.createdAt,
              updatedAt: dashboard.updatedAt
            });
            this.loadDashboard(dashboard.id);
          }
          this.isLoading = false;
          input.value = '';
        },
        error: () => {
          this.isLoading = false;
          input.value = '';
        }
      });
    }
  }

  openDashboardModal() {
    this.showDashboardModal = true;
  }

  closeDashboardModal() {
    this.showDashboardModal = false;
  }

  // VM Management
  openVMModal() {
    this.showVMModal = true;
  }
  closeVMModal() {
    this.showVMModal = false;
  }
  addVM() {
    this.vms.push({ ...this.newVM, id: 'vm-' + Date.now() });
    this.newVM = { name: '', ip: '', cpu: '', ram: '', services: '' };
  }
  deleteVM(index: number) {
    this.vms.splice(index, 1);
  }

  // Domain Management
  openDomainModal() {
    this.showDomainModal = true;
  }
  closeDomainModal() {
    this.showDomainModal = false;
  }
  addDomain() {
    this.domains.push({ ...this.newDomain, id: 'domain-' + Date.now() });
    this.newDomain = { name: '', public_ip: '', lb_id: '' };
  }
  deleteDomain(index: number) {
    this.domains.splice(index, 1);
  }

  nodeTypes: NodeType[] = [
    { value: 'lb', label: 'Load Balancer', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nginx/nginx-original.svg', iconType: 'url', color: '#10b981' },
    { value: 'gateway', label: 'API Gateway', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kong/kong-original.svg', iconType: 'url', color: '#8b5cf6' },
    { value: 'service', label: 'Service', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg', iconType: 'url', color: '#3b82f6' },
    { value: 'db', label: 'PostgreSQL', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg', iconType: 'url', color: '#336791' },
    { value: 'cache', label: 'Redis', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg', iconType: 'url', color: '#dc382d' },
    { value: 'storage', label: 'AWS S3', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg', iconType: 'url', color: '#ff9900' },
    { value: 'queue', label: 'Kafka', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apachekafka/apachekafka-original.svg', iconType: 'url', color: '#231f20' },
    { value: 'docker', label: 'Docker', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg', iconType: 'url', color: '#2496ed' },
    { value: 'k8s', label: 'Kubernetes', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kubernetes/kubernetes-original.svg', iconType: 'url', color: '#326ce5' },
    { value: 'mongodb', label: 'MongoDB', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg', iconType: 'url', color: '#47a248' },
    { value: 'mysql', label: 'MySQL', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg', iconType: 'url', color: '#4479a1' },
    { value: 'elasticsearch', label: 'Elasticsearch', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/elasticsearch/elasticsearch-original.svg', iconType: 'url', color: '#005571' },
  ];

  nodes: Node[] = [
    { id: '1', label: 'Load Balancer', type: 'lb', x: 400, y: 80 },
    { id: '2', label: 'API Gateway', type: 'gateway', x: 400, y: 220 },
    { id: '3', label: 'User Service', type: 'service', x: 180, y: 380 },
    { id: '4', label: 'Auth Service', type: 'service', x: 400, y: 380 },
    { id: '5', label: 'Payment Service', type: 'service', x: 620, y: 380 },
    { id: '6', label: 'Postgres', type: 'db', x: 290, y: 540 },
    { id: '7', label: 'Redis', type: 'cache', x: 510, y: 540 },
  ];

  edges: Edge[] = [
    { id: 'e1', from: '1', fromAnchor: 'bottom', to: '2', toAnchor: 'top', arrowType: 'standard', label: 'HTTPS' },
    { id: 'e2', from: '2', fromAnchor: 'bottom', to: '3', toAnchor: 'top', arrowType: 'standard' },
    { id: 'e3', from: '2', fromAnchor: 'bottom', to: '4', toAnchor: 'top', arrowType: 'standard' },
    { id: 'e4', from: '2', fromAnchor: 'bottom', to: '5', toAnchor: 'top', arrowType: 'standard' },
    { id: 'e5', from: '3', fromAnchor: 'bottom', to: '6', toAnchor: 'top', arrowType: 'standard' },
    { id: 'e6', from: '4', fromAnchor: 'bottom', to: '6', toAnchor: 'top', arrowType: 'standard' },
    { id: 'e7', from: '4', fromAnchor: 'bottom', to: '7', toAnchor: 'top', arrowType: 'standard' },
    { id: 'e8', from: '5', fromAnchor: 'bottom', to: '7', toAnchor: 'top', arrowType: 'standard' },
  ];

  selectedNodes: Node[] = [];
  selectedNode: Node | null = null;
  selectedEdges: Edge[] = [];
  selectedEdge: Edge | null = null;

  isDragging = false;
  dragOffset = { x: 0, y: 0 };

  // Area Selection
  isSelectingArea = false;
  selectionStart = { x: 0, y: 0 };
  selectionBox = { x: 0, y: 0, w: 0, h: 0 };

  // Connection State
  isConnecting = false;
  connectionStartNode: Node | null = null;
  connectionStartAnchor: string | null = null;
  tempConnectionEnd = { x: 0, y: 0 };

  // Context Menu State
  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextMenuClickPosition = { x: 0, y: 0 };

  // Node Types Management State
  showNodeTypesModal = false;
  newNodeType: NodeType = { label: '', value: '', icon: '', color: '#3b82f6' };
  editingNodeType: NodeType | null = null;
  editingNodeTypeIndex: number = -1;

  // Icon picker
  emojiCategories = [
    { name: 'Tech', icons: ['⚙️', '🔧', '🛠️', '💻', '🖥️', '📱', '🌐', '☁️', '🔌', '💾', '📡', '🛰️'] },
    { name: 'Data', icons: ['🗄️', '📊', '📈', '📉', '🗃️', '📁', '📂', '🔍', '📝', '📋', '🧮', '🔢'] },
    { name: 'Security', icons: ['🔒', '🔓', '🔐', '🛡️', '🔑', '🚨', '⚠️', '🚫', '✅', '❌', '🔏', '🔎'] },
    { name: 'Network', icons: ['🌍', '🌎', '🌏', '📶', '📤', '📥', '📨', '📩', '✉️', '📧', '🔗', '⛓️'] },
    { name: 'Services', icons: ['⚡', '🚀', '💡', '🎯', '📦', '🏷️', '🎨', '🧩', '🔮', '💎', '⭐', '🌟'] },
    { name: 'Status', icons: ['✅', '❌', '⏳', '⏰', '🔄', '▶️', '⏸️', '⏹️', '🔃', '♻️', '🔔', '🔕'] },
  ];

  // Professional infra icons - using only verified working URLs from devicons
  infraIconCategories = [
    {
      name: 'Load Balancer & Proxy',
      icons: [
        { name: 'Nginx', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nginx/nginx-original.svg' },
        { name: 'HAProxy', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/haproxy/haproxy-original.svg' },
        { name: 'Traefik', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/traefikproxy/traefikproxy-original.svg' },
        { name: 'Apache', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apache/apache-original.svg' },
      ]
    },
    {
      name: 'API Gateway',
      icons: [
        { name: 'Kong', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kong/kong-original.svg' },
        { name: 'Express', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/express/express-original.svg' },
        { name: 'FastAPI', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/fastapi/fastapi-original.svg' },
        { name: 'Spring', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/spring/spring-original.svg' },
        { name: 'GraphQL', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/graphql/graphql-plain.svg' },
      ]
    },
    {
      name: 'Database',
      icons: [
        { name: 'PostgreSQL', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg' },
        { name: 'MySQL', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg' },
        { name: 'MariaDB', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mariadb/mariadb-original.svg' },
        { name: 'MongoDB', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg' },
        { name: 'Oracle', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/oracle/oracle-original.svg' },
        { name: 'SQL Server', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/microsoftsqlserver/microsoftsqlserver-original.svg' },
        { name: 'SQLite', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg' },
        { name: 'Cassandra', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cassandra/cassandra-original.svg' },
        { name: 'CouchDB', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/couchdb/couchdb-original.svg' },
        { name: 'Neo4j', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/neo4j/neo4j-original.svg' },
        { name: 'DynamoDB', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/dynamodb/dynamodb-original.svg' },
        { name: 'Firebase', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/firebase/firebase-original.svg' },
      ]
    },
    {
      name: 'Database HA & Cluster',
      icons: [
        { name: 'Patroni', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg' },
        { name: 'PgPool', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg' },
        { name: 'PgBouncer', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg' },
        { name: 'MySQL Router', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg' },
        { name: 'ProxySQL', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg' },
        { name: 'Galera', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mariadb/mariadb-original.svg' },
        { name: 'Mongo Replica', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg' },
        { name: 'Redis Cluster', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg' },
        { name: 'Redis Sentinel', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg' },
      ]
    },
    {
      name: 'Message Queue',
      icons: [
        { name: 'Kafka', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apachekafka/apachekafka-original.svg' },
        { name: 'RabbitMQ', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rabbitmq/rabbitmq-original.svg' },
        { name: 'Redis Streams', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg' },
        { name: 'Pulsar', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apachekafka/apachekafka-original.svg' },
      ]
    },
    {
      name: 'MQTT & IoT',
      icons: [
        { name: 'Mosquitto', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mosquitto/mosquitto-original.svg' },
        { name: 'RabbitMQ MQTT', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rabbitmq/rabbitmq-original.svg' },
        { name: 'Azure IoT', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azure/azure-original.svg' },
        { name: 'AWS IoT', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg' },
      ]
    },
    {
      name: 'Caching',
      icons: [
        { name: 'Redis', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg' },
        { name: 'Memcached', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg' },
      ]
    },
    {
      name: 'Search & Analytics',
      icons: [
        { name: 'Elasticsearch', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/elasticsearch/elasticsearch-original.svg' },
        { name: 'OpenSearch', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/opensearch/opensearch-original.svg' },
        { name: 'Kibana', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kibana/kibana-original.svg' },
        { name: 'Logstash', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/logstash/logstash-original.svg' },
      ]
    },
    {
      name: 'Monitoring',
      icons: [
        { name: 'Prometheus', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/prometheus/prometheus-original.svg' },
        { name: 'Grafana', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/grafana/grafana-original.svg' },
        { name: 'Jaeger', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/jaegertracing/jaegertracing-original.svg' },
        { name: 'OpenTelemetry', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/opentelemetry/opentelemetry-original.svg' },
      ]
    },
    {
      name: 'Container & K8s',
      icons: [
        { name: 'Docker', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg' },
        { name: 'Kubernetes', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kubernetes/kubernetes-original.svg' },
        { name: 'Podman', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/podman/podman-original.svg' },
        { name: 'Rancher', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rancher/rancher-original.svg' },
        { name: 'Helm', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/helm/helm-original.svg' },
        { name: 'ArgoCD', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/argocd/argocd-original.svg' },
      ]
    },
    {
      name: 'Service Mesh',
      icons: [
        { name: 'Istio', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/istio/istio-original.svg' },
        { name: 'Consul', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/consul/consul-original.svg' },
      ]
    },
    {
      name: 'CI/CD',
      icons: [
        { name: 'Jenkins', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/jenkins/jenkins-original.svg' },
        { name: 'GitLab CI', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gitlab/gitlab-original.svg' },
        { name: 'GitHub Actions', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg' },
        { name: 'CircleCI', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/circleci/circleci-plain.svg' },
        { name: 'Azure DevOps', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azuredevops/azuredevops-original.svg' },
        { name: 'Bitbucket', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bitbucket/bitbucket-original.svg' },
      ]
    },
    {
      name: 'Cloud Providers',
      icons: [
        { name: 'AWS', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg' },
        { name: 'Azure', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azure/azure-original.svg' },
        { name: 'GCP', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/googlecloud/googlecloud-original.svg' },
        { name: 'DigitalOcean', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/digitalocean/digitalocean-original.svg' },
        { name: 'Heroku', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/heroku/heroku-original.svg' },
        { name: 'Vercel', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vercel/vercel-original.svg' },
        { name: 'Cloudflare', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cloudflare/cloudflare-original.svg' },
      ]
    },
    {
      name: 'IaC & Config',
      icons: [
        { name: 'Terraform', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/terraform/terraform-original.svg' },
        { name: 'Ansible', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ansible/ansible-original.svg' },
        { name: 'Pulumi', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/pulumi/pulumi-original.svg' },
        { name: 'Vagrant', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vagrant/vagrant-original.svg' },
        { name: 'Packer', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/packer/packer-original.svg' },
      ]
    },
    {
      name: 'Security',
      icons: [
        { name: 'Vault', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vault/vault-original.svg' },
        { name: 'OAuth', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/oauth/oauth-original.svg' },
      ]
    },
    {
      name: 'OS & Runtime',
      icons: [
        { name: 'Linux', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg' },
        { name: 'Ubuntu', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ubuntu/ubuntu-original.svg' },
        { name: 'Debian', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/debian/debian-original.svg' },
        { name: 'CentOS', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/centos/centos-original.svg' },
        { name: 'RHEL', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redhat/redhat-original.svg' },
        { name: 'Alpine', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/alpinelinux/alpinelinux-original.svg' },
        { name: 'Windows', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/windows11/windows11-original.svg' },
      ]
    },
    {
      name: 'Languages',
      icons: [
        { name: 'Node.js', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg' },
        { name: 'Python', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg' },
        { name: 'Go', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg' },
        { name: 'Rust', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg' },
        { name: 'Java', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg' },
        { name: '.NET', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/dotnetcore/dotnetcore-original.svg' },
        { name: 'PHP', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg' },
        { name: 'Ruby', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ruby/ruby-original.svg' },
      ]
    },
  ];

  // Flatten for backward compatibility
  get infraIcons() {
    return this.infraIconCategories.flatMap(cat => cat.icons);
  }

  iconPickerMode: 'emoji' | 'infra' | 'url' | 'upload' = 'infra';
  customIconUrl = '';

  // Node Management State
  showNodeManageModal = false;
  editingNode: Node | null = null;
  nodeSearchQuery = '';

  // Node dimensions (n8n style)
  nodeWidth = 160;
  nodeHeight = 80;

  getNodeColor(type: string): string {
    const nodeType = this.nodeTypes.find((t) => t.value === type);
    return nodeType?.color || '#3b82f6';
  }

  getNodeIcon(type: string): string {
    const nodeType = this.nodeTypes.find((t) => t.value === type);
    return nodeType?.icon || '⚙️';
  }

  getNodeIconType(type: string): string {
    const nodeType = this.nodeTypes.find((t) => t.value === type);
    return nodeType?.iconType || 'emoji';
  }

  isImageIcon(icon: string, iconType?: string): boolean {
    if (iconType === 'url' || iconType === 'base64') return true;
    if (!icon) return false;
    return icon.startsWith('http') || icon.startsWith('data:image');
  }

  isIconUrl(icon: string, iconType?: string): boolean {
    if (iconType === 'url' || iconType === 'base64') return true;
    if (!icon) return false;
    return icon.startsWith('http') || icon.startsWith('data:image');
  }

  get connectedEdges() {
    return this.edges
      .map((edge) => {
        let sourcePos: { x: number; y: number } | null = null;
        let targetPos: { x: number; y: number } | null = null;
        let source: any = null;
        let target: any = null;

        // Check if source is a group
        if (edge.from.startsWith('group-')) {
          const groupId = edge.from.replace('group-', '');
          const group = this.groups.find(g => g.id === groupId);
          if (group) {
            sourcePos = this.getGroupAnchorPosition(group, edge.fromAnchor);
            source = { id: edge.from, label: group.name, type: 'group' };
          }
        } else {
          source = this.nodes.find((n) => n.id === edge.from);
          if (source) {
            sourcePos = this.getAnchorPosition(source, edge.fromAnchor);
          }
        }

        // Check if target is a group
        if (edge.to.startsWith('group-')) {
          const groupId = edge.to.replace('group-', '');
          const group = this.groups.find(g => g.id === groupId);
          if (group) {
            targetPos = this.getGroupAnchorPosition(group, edge.toAnchor);
            target = { id: edge.to, label: group.name, type: 'group' };
          }
        } else {
          target = this.nodes.find((n) => n.id === edge.to);
          if (target) {
            targetPos = this.getAnchorPosition(target, edge.toAnchor);
          }
        }

        if (!sourcePos || !targetPos) return null;

        const path = this.getBezierPath(sourcePos, targetPos, edge.fromAnchor, edge.toAnchor);
        const midPoint = this.getBezierMidPoint(sourcePos, targetPos, edge.fromAnchor, edge.toAnchor);

        return {
          ...edge,
          path: path,
          midPoint: midPoint,
          source: source,
          target: target,
        };
      })
      .filter((e) => e !== null);
  }

  getBezierMidPoint(start: any, end: any, startAnchor: string, endAnchor: string) {
    const offset = 80;
    let cp1 = { x: start.x, y: start.y };
    let cp2 = { x: end.x, y: end.y };

    switch (startAnchor) {
      case 'top':
        cp1.y -= offset;
        break;
      case 'bottom':
        cp1.y += offset;
        break;
      case 'left':
        cp1.x -= offset;
        break;
      case 'right':
        cp1.x += offset;
        break;
    }

    switch (endAnchor) {
      case 'top':
        cp2.y -= offset;
        break;
      case 'bottom':
        cp2.y += offset;
        break;
      case 'left':
        cp2.x -= offset;
        break;
      case 'right':
        cp2.x += offset;
        break;
    }

    const t = 0.5;
    const x =
      Math.pow(1 - t, 3) * start.x +
      3 * Math.pow(1 - t, 2) * t * cp1.x +
      3 * (1 - t) * Math.pow(t, 2) * cp2.x +
      Math.pow(t, 3) * end.x;
    const y =
      Math.pow(1 - t, 3) * start.y +
      3 * Math.pow(1 - t, 2) * t * cp1.y +
      3 * (1 - t) * Math.pow(t, 2) * cp2.y +
      Math.pow(t, 3) * end.y;

    return { x, y };
  }

  selectEdge(edge: any, event: MouseEvent) {
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      if (this.selectedEdges.find((e) => e.id === edge.id)) {
        this.selectedEdges = this.selectedEdges.filter((e) => e.id !== edge.id);
      } else {
        this.selectedEdges.push(edge);
      }
    } else {
      this.selectedEdges = [edge];
      this.selectedNodes = [];
      this.selectedNode = null;
    }

    this.selectedEdge = this.selectedEdges.length > 0 ? this.selectedEdges[this.selectedEdges.length - 1] : null;
  }

  deleteEdge() {
    if (this.selectedEdges.length > 0) {
      this.edges = this.edges.filter((e) => !this.selectedEdges.find((se) => se.id === e.id));
      this.selectedEdges = [];
      this.selectedEdge = null;
      this.saveCurrentDashboard();
    }
  }

  deleteSelectedNodes() {
    if (this.selectedNodes.length > 0) {
      const nodeIds = this.selectedNodes.map((n) => n.id);
      this.nodes = this.nodes.filter((n) => !nodeIds.includes(n.id));
      this.edges = this.edges.filter((e) => !nodeIds.includes(e.from) && !nodeIds.includes(e.to));
      this.selectedNodes = [];
      this.selectedNode = null;
      this.saveCurrentDashboard();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (this.selectedEdges.length > 0) {
        this.deleteEdge();
      } else if (this.selectedNodes.length > 0) {
        this.deleteSelectedNodes();
      }
    }
  }

  trackByEdgeId(index: number, edge: any): string {
    return edge.id;
  }

  trackByNodeId(index: number, node: any): string {
    return node.id;
  }

  getBezierPath(start: any, end: any, startAnchor: string, endAnchor: string): string {
    const offset = 80;
    let cp1 = { x: start.x, y: start.y };
    let cp2 = { x: end.x, y: end.y };

    switch (startAnchor) {
      case 'top':
        cp1.y -= offset;
        break;
      case 'bottom':
        cp1.y += offset;
        break;
      case 'left':
        cp1.x -= offset;
        break;
      case 'right':
        cp1.x += offset;
        break;
    }

    switch (endAnchor) {
      case 'top':
        cp2.y -= offset;
        break;
      case 'bottom':
        cp2.y += offset;
        break;
      case 'left':
        cp2.x -= offset;
        break;
      case 'right':
        cp2.x += offset;
        break;
    }

    return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
  }

  getAnchorPosition(node: Node, anchor: string) {
    const w = this.nodeWidth;
    const h = this.nodeHeight;
    switch (anchor) {
      case 'top':
        return { x: node.x + w / 2, y: node.y };
      case 'right':
        return { x: node.x + w, y: node.y + h / 2 };
      case 'bottom':
        return { x: node.x + w / 2, y: node.y + h };
      case 'left':
        return { x: node.x, y: node.y + h / 2 };
      default:
        return { x: node.x + w / 2, y: node.y + h / 2 };
    }
  }

  // Canvas zoom/pan
  onWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(this.minZoom, Math.min(this.maxZoom, this.canvasTransform.scale + delta));

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const scaleRatio = newScale / this.canvasTransform.scale;
    this.canvasTransform.x = mouseX - (mouseX - this.canvasTransform.x) * scaleRatio;
    this.canvasTransform.y = mouseY - (mouseY - this.canvasTransform.y) * scaleRatio;
    this.canvasTransform.scale = newScale;
  }

  startPan(event: MouseEvent) {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      this.isPanning = true;
      this.panStart = { x: event.clientX - this.canvasTransform.x, y: event.clientY - this.canvasTransform.y };
      event.preventDefault();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    // Panning
    if (this.isPanning) {
      this.canvasTransform.x = event.clientX - this.panStart.x;
      this.canvasTransform.y = event.clientY - this.panStart.y;
      return;
    }

    // Resizing Groups
    if (this.isResizingGroup && this.resizingGroup && this.resizeStartPos) {
      const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
      if (container) {
        const mouseX = (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale;
        const mouseY = (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale;
        const deltaX = mouseX - this.resizeStartPos.mouseX;
        const deltaY = mouseY - this.resizeStartPos.mouseY;

        let newX = this.resizeStartPos.x;
        let newY = this.resizeStartPos.y;
        let newWidth = this.resizeStartPos.width;
        let newHeight = this.resizeStartPos.height;

        // Handle resize based on which handle is being dragged
        if (this.resizeHandle.includes('e')) {
          newWidth = Math.max(this.minGroupWidth, this.resizeStartPos.width + deltaX);
        }
        if (this.resizeHandle.includes('w')) {
          const maxDeltaX = this.resizeStartPos.width - this.minGroupWidth;
          const actualDeltaX = Math.min(deltaX, maxDeltaX);
          newX = this.resizeStartPos.x + actualDeltaX;
          newWidth = this.resizeStartPos.width - actualDeltaX;
        }
        if (this.resizeHandle.includes('s')) {
          newHeight = Math.max(this.minGroupHeight, this.resizeStartPos.height + deltaY);
        }
        if (this.resizeHandle.includes('n')) {
          const maxDeltaY = this.resizeStartPos.height - this.minGroupHeight;
          const actualDeltaY = Math.min(deltaY, maxDeltaY);
          newY = this.resizeStartPos.y + actualDeltaY;
          newHeight = this.resizeStartPos.height - actualDeltaY;
        }

        this.resizingGroup.x = Math.round(newX / 20) * 20;
        this.resizingGroup.y = Math.round(newY / 20) * 20;
        this.resizingGroup.width = Math.round(newWidth / 20) * 20;
        this.resizingGroup.height = Math.round(newHeight / 20) * 20;
      }
      return;
    }

    // Dragging Groups
    if (this.isDraggingGroup && this.draggingGroup) {
      const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
      if (container) {
        const newX =
          (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale -
          (this.groupDragOffset?.x || 0);
        const newY =
          (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale -
          (this.groupDragOffset?.y || 0);

        const deltaX = Math.round(newX / 20) * 20 - this.draggingGroup.x;
        const deltaY = Math.round(newY / 20) * 20 - this.draggingGroup.y;

        this.draggingGroup.x += deltaX;
        this.draggingGroup.y += deltaY;

        // Move all nodes inside the group
        this.nodes.filter(n => n.groupId === this.draggingGroup!.id).forEach(node => {
          node.x += deltaX;
          node.y += deltaY;
        });
      }
      return;
    }

    // Dragging Nodes
    if (this.isDragging && this.selectedNodes.length > 0) {
      const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
      if (container) {
        this.selectedNodes.forEach((node) => {
          let newX =
            (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale -
            (node.dragOffsetX || 0);
          let newY =
            (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale -
            (node.dragOffsetY || 0);

          newX = Math.round(newX / 20) * 20;
          newY = Math.round(newY / 20) * 20;

          // Constrain within group bounds if node is in a group
          if (node.groupId) {
            const group = this.groups.find(g => g.id === node.groupId);
            if (group) {
              const padding = 60; // Header height + some padding
              const nodeWidth = 140;
              const nodeHeight = 60;
              newX = Math.max(group.x + 10, Math.min(newX, group.x + group.width - nodeWidth - 10));
              newY = Math.max(group.y + padding, Math.min(newY, group.y + group.height - nodeHeight - 10));
            }
          }

          node.x = newX;
          node.y = newY;
        });
      }
    }

    // Area Selection
    if (this.isSelectingArea) {
      const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
      if (container) {
        const currentX = (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale;
        const currentY = (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale;
        const startX = this.selectionStart.x;
        const startY = this.selectionStart.y;

        this.selectionBox = {
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          w: Math.abs(currentX - startX),
          h: Math.abs(currentY - startY),
        };
      }
    }

    // Connection Line
    if (this.isConnecting) {
      const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
      if (container) {
        this.tempConnectionEnd = {
          x: (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale,
          y: (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale,
        };
      }
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.isSelectingArea) {
      this.finishAreaSelection();
    }
    if (this.isDraggingGroup) {
      this.isDraggingGroup = false;
      this.draggingGroup = null;
      this.groupDragOffset = null;
      this.saveCurrentDashboard();
    }
    if (this.isResizingGroup) {
      this.isResizingGroup = false;
      this.resizingGroup = null;
      this.resizeHandle = '';
      this.resizeStartPos = null;
      this.saveCurrentDashboard();
    }
    this.isDragging = false;
    this.isSelectingArea = false;
    this.isPanning = false;
  }

  onCanvasClick(event: MouseEvent) {
    this.contextMenuVisible = false;
    if (this.isConnecting) {
      this.cancelConnection();
      return;
    }

    const target = event.target as HTMLElement;
    if (target.classList.contains('canvas-grid') || target.classList.contains('canvas-viewport')) {
      if (event.shiftKey) {
        this.startPan(event);
        return;
      }

      // Start Area Selection
      const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
      if (container) {
        this.isSelectingArea = true;
        this.selectionStart = {
          x: (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale,
          y: (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale,
        };
        this.selectionBox = { x: 0, y: 0, w: 0, h: 0 };
      }
    }
  }

  finishAreaSelection() {
    const box = this.selectionBox;
    if (box.w < 5 && box.h < 5) {
      this.selectedNodes = [];
      this.selectedNode = null;
      this.selectedEdges = [];
      this.selectedEdge = null;
      return;
    }

    this.nodes.forEach((node) => {
      if (
        node.x < box.x + box.w &&
        node.x + this.nodeWidth > box.x &&
        node.y < box.y + box.h &&
        node.y + this.nodeHeight > box.y
      ) {
        if (!this.selectedNodes.includes(node)) {
          this.selectedNodes.push(node);
          node.dragOffsetX = 0;
          node.dragOffsetY = 0;
        }
      }
    });

    if (this.selectedNodes.length === 1) {
      this.selectedNode = this.selectedNodes[0];
    }

    this.selectionBox = { x: 0, y: 0, w: 0, h: 0 };
  }

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    this.contextMenuVisible = true;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };

    const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
    if (container) {
      this.contextMenuClickPosition = {
        x: (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale,
        y: (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale,
      };
    }
  }

  addNodeFromMenu(type: string = 'service') {
    const nodeType = this.nodeTypes.find((t) => t.value === type) || this.nodeTypes[2];
    const newNode: Node = {
      id: 'node-' + Date.now(),
      label: nodeType.label,
      type: type,
      x: Math.round(this.contextMenuClickPosition.x / 20) * 20,
      y: Math.round(this.contextMenuClickPosition.y / 20) * 20,
    };
    this.nodes.push(newNode);
    this.contextMenuVisible = false;
    this.saveCurrentDashboard();
  }

  selectNode(node: Node, event: MouseEvent) {
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      if (this.selectedNodes.includes(node)) {
        this.selectedNodes = this.selectedNodes.filter((n) => n !== node);
      } else {
        this.selectedNodes.push(node);
      }
      this.selectedNode = this.selectedNodes.length === 1 ? this.selectedNodes[0] : null;
    } else {
      if (!this.selectedNodes.includes(node)) {
        this.selectedNodes = [node];
        this.selectedNode = node;
      }
    }

    this.selectedEdge = null;
    this.selectedEdges = [];
    this.isDragging = true;

    const container = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
    if (container) {
      this.selectedNodes.forEach((n) => {
        n.dragOffsetX =
          (event.clientX - container.left - this.canvasTransform.x) / this.canvasTransform.scale - n.x;
        n.dragOffsetY =
          (event.clientY - container.top - this.canvasTransform.y) / this.canvasTransform.scale - n.y;
      });
    }

    this.contextMenuVisible = false;
  }

  startConnection(node: Node, anchor: string, event: MouseEvent) {
    this.isConnecting = true;
    this.connectionStartNode = node;
    this.connectionStartAnchor = anchor;

    const startPos = this.getAnchorPosition(node, anchor);
    this.tempConnectionEnd = { x: startPos.x, y: startPos.y };

    event.stopPropagation();
    event.preventDefault();
  }

  finishConnection(node: Node, anchor: string, event: MouseEvent) {
    if (this.connectionStartNode && this.connectionStartNode !== node) {
      const startAnchor = this.connectionStartAnchor || 'bottom';

      const existingEdge = this.edges.find((e) => e.from === this.connectionStartNode!.id && e.to === node.id);

      if (!existingEdge) {
        this.edges.push({
          id: 'edge-' + Date.now(),
          from: this.connectionStartNode.id,
          fromAnchor: startAnchor,
          to: node.id,
          toAnchor: anchor,
          arrowType: 'standard',
          label: '',
        });
        this.saveCurrentDashboard();
      }
    }
    this.cancelConnection();
    event.stopPropagation();
  }

  cancelConnection() {
    this.isConnecting = false;
    this.connectionStartNode = null;
    this.connectionStartAnchor = null;
  }

  openNodeTypesModal() {
    this.showNodeTypesModal = true;
    this.editingNodeType = null;
    this.editingNodeTypeIndex = -1;
  }

  closeNodeTypesModal() {
    this.showNodeTypesModal = false;
    this.newNodeType = { label: '', value: '', icon: '', color: '#3b82f6' };
    this.editingNodeType = null;
    this.editingNodeTypeIndex = -1;
  }

  addNodeType() {
    if (this.newNodeType.label && this.newNodeType.value && this.newNodeType.icon) {
      this.nodeTypes.push({ ...this.newNodeType });
      this.newNodeType = { label: '', value: '', icon: '', color: '#3b82f6' };
      this.saveCurrentDashboard();
    }
  }

  startEditNodeType(index: number) {
    this.editingNodeTypeIndex = index;
    this.editingNodeType = { ...this.nodeTypes[index] };
  }

  saveEditNodeType() {
    if (this.editingNodeType && this.editingNodeTypeIndex >= 0) {
      this.nodeTypes[this.editingNodeTypeIndex] = { ...this.editingNodeType };
      this.editingNodeType = null;
      this.editingNodeTypeIndex = -1;
      this.saveCurrentDashboard();
    }
  }

  cancelEditNodeType() {
    this.editingNodeType = null;
    this.editingNodeTypeIndex = -1;
  }

  deleteNodeType(index: number) {
    this.nodeTypes.splice(index, 1);
    this.saveCurrentDashboard();
  }

  selectIconForNewType(icon: string, iconType: 'emoji' | 'url' | 'base64' = 'emoji') {
    this.newNodeType.icon = icon;
    this.newNodeType.iconType = iconType;
  }

  selectIconForEditType(icon: string, iconType: 'emoji' | 'url' | 'base64' = 'emoji') {
    if (this.editingNodeType) {
      this.editingNodeType.icon = icon;
      this.editingNodeType.iconType = iconType;
    }
  }

  selectInfraIconForNew(iconUrl: string) {
    this.newNodeType.icon = iconUrl;
    this.newNodeType.iconType = 'url';
  }

  selectInfraIconForEdit(iconUrl: string) {
    if (this.editingNodeType) {
      this.editingNodeType.icon = iconUrl;
      this.editingNodeType.iconType = 'url';
    }
  }

  applyCustomUrlForNew() {
    if (this.customIconUrl) {
      this.newNodeType.icon = this.customIconUrl;
      this.newNodeType.iconType = 'url';
      this.customIconUrl = '';
    }
  }

  applyCustomUrlForEdit() {
    if (this.customIconUrl && this.editingNodeType) {
      this.editingNodeType.icon = this.customIconUrl;
      this.editingNodeType.iconType = 'url';
      this.customIconUrl = '';
    }
  }

  onFileSelected(event: Event, target: 'new' | 'edit') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (target === 'new') {
          this.newNodeType.icon = base64;
          this.newNodeType.iconType = 'base64';
        } else if (this.editingNodeType) {
          this.editingNodeType.icon = base64;
          this.editingNodeType.iconType = 'base64';
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Node Management Methods
  openNodeManageModal() {
    this.showNodeManageModal = true;
    this.editingNode = null;
    this.nodeSearchQuery = '';
  }

  closeNodeManageModal() {
    this.showNodeManageModal = false;
    this.editingNode = null;
  }

  get filteredNodes(): Node[] {
    if (!this.nodeSearchQuery.trim()) {
      return this.nodes;
    }
    const query = this.nodeSearchQuery.toLowerCase();
    return this.nodes.filter(
      (n) => n.label.toLowerCase().includes(query) || n.type.toLowerCase().includes(query)
    );
  }

  startEditNode(node: Node) {
    this.editingNode = { ...node };
  }

  saveEditNode() {
    if (!this.editingNode) return;
    const index = this.nodes.findIndex((n) => n.id === this.editingNode!.id);
    if (index !== -1) {
      this.nodes[index].label = this.editingNode.label;
      this.nodes[index].type = this.editingNode.type;
      this.saveCurrentDashboard();
    }
    this.editingNode = null;
  }

  cancelEditNode() {
    this.editingNode = null;
  }

  deleteNodeFromModal(node: Node) {
    const nodeIds = [node.id];
    this.nodes = this.nodes.filter((n) => !nodeIds.includes(n.id));
    this.edges = this.edges.filter((e) => !nodeIds.includes(e.from) && !nodeIds.includes(e.to));
    if (this.selectedNode?.id === node.id) {
      this.selectedNode = null;
      this.selectedNodes = [];
    }
    this.saveCurrentDashboard();
  }

  focusNode(node: Node) {
    this.closeNodeManageModal();
    this.selectedNodes = [node];
    this.selectedNode = node;

    const container = document.querySelector('.canvas-viewport');
    if (!container) return;
    const rect = container.getBoundingClientRect();

    this.canvasTransform.scale = 1;
    this.canvasTransform.x = rect.width / 2 - (node.x + this.nodeWidth / 2);
    this.canvasTransform.y = rect.height / 2 - (node.y + this.nodeHeight / 2);
  }

  duplicateNode(node: Node) {
    const newNode: Node = {
      id: 'node-' + Date.now(),
      label: node.label + ' (copy)',
      type: node.type,
      x: node.x + 40,
      y: node.y + 40,
    };
    this.nodes.push(newNode);
    this.saveCurrentDashboard();
  }

  resetZoom() {
    this.canvasTransform = { x: 0, y: 0, scale: 1 };
  }

  zoomIn() {
    this.canvasTransform.scale = Math.min(this.maxZoom, this.canvasTransform.scale + 0.1);
  }

  zoomOut() {
    this.canvasTransform.scale = Math.max(this.minZoom, this.canvasTransform.scale - 0.1);
  }

  fitToScreen() {
    if (this.nodes.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    this.nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + this.nodeWidth);
      maxY = Math.max(maxY, node.y + this.nodeHeight);
    });

    const container = document.querySelector('.canvas-viewport');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const padding = 80;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    this.canvasTransform.scale = scale;
    this.canvasTransform.x = rect.width / 2 - ((minX + maxX) / 2) * scale;
    this.canvasTransform.y = rect.height / 2 - ((minY + maxY) / 2) * scale;
  }

  getZoomPercent(): number {
    return Math.round(this.canvasTransform.scale * 100);
  }
}
