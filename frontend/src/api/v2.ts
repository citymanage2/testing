/** Типизированные функции для API v2 */
import client from './client';

// ─── Общие типы ───────────────────────────────────────────────────────────────

export interface EstimateV2 {
  id: string; project_id: string; name: string;
  status: string; version: number;
  parent_id?: string; branch_label?: string;
  created_at: string; updated_at: string;
}

export interface EstimatePosition {
  id: string; estimate_id: string;
  name: string; unit: string; quantity: number;
  catalog_item_id?: string; stage_id?: string;
  needs_review: boolean;
  client_price?: number; cost_price?: number;
  subcontract_price?: number; actual_price?: number;
  created_at: string;
}

export interface EstimateSummary {
  positions_count: number; needs_review_count: number;
  totals: {
    client: { work: number; material: number; total: number };
    cost:   { work: number; material: number; total: number };
    subcontract: { work: number; material: number; total: number };
    actual: { work: number; material: number; total: number };
  };
  margin_pct: number;
}

export interface CompareResult {
  only_in_a: EstimatePosition[];
  only_in_b: EstimatePosition[];
  changed: { a: EstimatePosition; b: EstimatePosition; diff_fields: string[] }[];
  unchanged_count: number;
}

export interface CatalogItemV2 {
  id: string; name: string; unit: string;
  work_price: number; material_price: number;
  section?: string; tags?: string[];
  source_id?: string; created_at: string;
}

export interface PriceSource {
  id: string; name: string; kind: string;
  url?: string; updated_at?: string; created_at: string;
}

export interface WorkStage {
  id: string; project_id: string; name: string;
  parent_id?: string; order_index: number;
  status: string; start_date?: string; end_date?: string;
  completion_pct: number;
  assigned_positions?: { position_id: string; position_name: string; quantity: number }[];
}

export interface Warehouse {
  id: string; project_id?: string; name: string;
  address?: string; created_at: string;
}

export interface StockItem {
  catalog_item_id: string; catalog_item_name: string; unit: string;
  quantity_on_hand: number; quantity_reserved: number; quantity_available: number;
}

export interface StockMovement {
  id: string; warehouse_id: string; catalog_item_id: string;
  catalog_item_name?: string; movement_type: string;
  quantity: number; note?: string; created_at: string;
}

export interface MaterialRequest {
  id: string; project_id: string; name: string;
  status: string; created_at: string; updated_at: string;
}

export interface MaterialRequestItem {
  id: string; request_id: string;
  catalog_item_id: string; catalog_item_name?: string; unit?: string;
  quantity_planned: number; quantity_delivered: number;
}

export interface ProjectPlanFact {
  project_id: string;
  revenue: { planned: number; actual: number; delta: number };
  cost:    { planned: number; actual: number; delta: number };
  margin:  { planned: number; actual: number; pct_planned: number; pct_actual: number };
  grp:     { stages_total: number; stages_done: number; completion_pct: number };
  warehouse: { items_count: number; movements_count: number };
}

export interface ProjectForecast {
  project_id: string;
  revenue_forecast: number; cost_forecast: number; margin_forecast: number;
  completion_pct: number; remaining_cost: number;
  on_schedule: boolean; risk_level: string;
}

export interface ProjectAlert {
  id: string; level: string; code: string; title: string; detail?: string;
}

export interface CompanyPL {
  projects: { project_id: string; project_name: string; revenue: number; cost: number; margin: number; margin_pct: number }[];
  totals: { revenue: number; cost: number; margin: number; margin_pct: number };
}

export interface AssistantResponse {
  answer: string; sources?: string[];
}

export interface BudgetEntry {
  id: string; project_id: string; category: string; subcategory?: string;
  planned_amount: number; actual_amount: number;
  note?: string; created_at: string;
}

// ─── Price Sources ─────────────────────────────────────────────────────────────

export const priceSources = {
  list: () => client.get<PriceSource[]>('/v2/price-sources').then(r => r.data),
  create: (data: { name: string; kind: string; url?: string }) =>
    client.post<PriceSource>('/v2/price-sources', data).then(r => r.data),
  update: (id: string, data: Partial<{ name: string; url: string }>) =>
    client.patch<PriceSource>(`/v2/price-sources/${id}`, data).then(r => r.data),
  remove: (id: string) => client.delete(`/v2/price-sources/${id}`),
};

// ─── Catalog v2 ───────────────────────────────────────────────────────────────

export const catalogV2 = {
  list: (params?: { search?: string; section?: string; source_id?: string; skip?: number; limit?: number }) =>
    client.get<CatalogItemV2[]>('/v2/catalog', { params }).then(r => r.data),
  get: (id: string) => client.get<CatalogItemV2>(`/v2/catalog/${id}`).then(r => r.data),
  create: (data: { name: string; unit: string; work_price: number; material_price: number; section?: string; source_id?: string }) =>
    client.post<CatalogItemV2>('/v2/catalog', data).then(r => r.data),
  update: (id: string, data: Partial<CatalogItemV2>) =>
    client.patch<CatalogItemV2>(`/v2/catalog/${id}`, data).then(r => r.data),
  remove: (id: string) => client.delete(`/v2/catalog/${id}`),
};

// ─── Estimates v2 ─────────────────────────────────────────────────────────────

export const estimatesV2 = {
  list: (params?: { project_id?: string; status?: string; skip?: number; limit?: number }) =>
    client.get<EstimateV2[]>('/v2/estimates', { params }).then(r => r.data),
  get: (id: string) => client.get<EstimateV2>(`/v2/estimates/${id}`).then(r => r.data),
  create: (data: { project_id: string; name: string }) =>
    client.post<EstimateV2>('/v2/estimates', data).then(r => r.data),
  importFile: (projectId: string, file: File, estimateName: string, useAi = true) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', projectId);
    fd.append('estimate_name', estimateName);
    fd.append('use_ai', String(useAi));
    // Don't set Content-Type manually — browser adds boundary automatically
    return client.post<EstimateV2>('/v2/estimates/import', fd).then(r => r.data);
  },
  summary: (id: string) => client.get<EstimateSummary>(`/v2/estimates/${id}/summary`).then(r => r.data),
  setStatus: (id: string, status: string) =>
    client.patch<EstimateV2>(`/v2/estimates/${id}/status`, { status }).then(r => r.data),
  calculateCost: (id: string, opts?: { overhead_pct?: number; profit_pct?: number }) =>
    client.post(`/v2/estimates/${id}/calculate-cost`, opts ?? {}).then(r => r.data),
  branch: (id: string, label?: string) =>
    client.post<EstimateV2>(`/v2/estimates/${id}/branch`, { branch_label: label }).then(r => r.data),
  compare: (id: string, branchId: string) =>
    client.get<CompareResult>(`/v2/estimates/${id}/compare/${branchId}`).then(r => r.data),
  // Positions
  positions: (id: string) =>
    client.get<EstimatePosition[]>(`/v2/estimates/${id}/positions`).then(r => r.data),
  addPosition: (id: string, data: Partial<EstimatePosition>) =>
    client.post<EstimatePosition>(`/v2/estimates/${id}/positions`, data).then(r => r.data),
  updatePosition: (id: string, posId: string, data: Partial<EstimatePosition>) =>
    client.patch<EstimatePosition>(`/v2/estimates/${id}/positions/${posId}`, data).then(r => r.data),
  deletePosition: (id: string, posId: string) =>
    client.delete(`/v2/estimates/${id}/positions/${posId}`),
};

// ─── Work Stages (ГПР) ────────────────────────────────────────────────────────

export const workStages = {
  list: (projectId: string) =>
    client.get<WorkStage[]>('/v2/work-stages', { params: { project_id: projectId } }).then(r => r.data),
  withPositions: (projectId: string) =>
    client.get<WorkStage[]>('/v2/work-stages/with-positions', { params: { project_id: projectId } }).then(r => r.data),
  create: (data: { project_id: string; name: string; parent_id?: string; order_index?: number; start_date?: string; end_date?: string }) =>
    client.post<WorkStage>('/v2/work-stages', data).then(r => r.data),
  update: (id: string, data: Partial<WorkStage>) =>
    client.patch<WorkStage>(`/v2/work-stages/${id}`, data).then(r => r.data),
  remove: (id: string) => client.delete(`/v2/work-stages/${id}`),
  assignPosition: (stageId: string, positionId: string, detach = false) =>
    client.patch(`/v2/work-stages/${stageId}/assign-position`, { position_id: positionId, detach }).then(r => r.data),
};

// ─── Warehouse ────────────────────────────────────────────────────────────────

export const warehouseApi = {
  list: (params?: { project_id?: string }) =>
    client.get<Warehouse[]>('/v2/warehouses', { params }).then(r => r.data),
  create: (data: { name: string; project_id?: string; address?: string }) =>
    client.post<Warehouse>('/v2/warehouses', data).then(r => r.data),
  stock: (id: string) =>
    client.get<StockItem[]>(`/v2/warehouses/${id}/stock`).then(r => r.data),
  movements: (id: string) =>
    client.get<StockMovement[]>(`/v2/warehouses/${id}/movements`).then(r => r.data),
  addMovement: (id: string, data: { catalog_item_id: string; movement_type: string; quantity: number; note?: string }) =>
    client.post<StockMovement>(`/v2/warehouses/${id}/movements`, data).then(r => r.data),
};

// ─── Material Requests ────────────────────────────────────────────────────────

export const materialRequestsApi = {
  list: (params?: { project_id?: string; status?: string }) =>
    client.get<MaterialRequest[]>('/v2/material-requests', { params }).then(r => r.data),
  get: (id: string) => client.get<MaterialRequest>(`/v2/material-requests/${id}`).then(r => r.data),
  create: (data: { project_id: string; name: string }) =>
    client.post<MaterialRequest>('/v2/material-requests', data).then(r => r.data),
  update: (id: string, data: { name?: string }) =>
    client.patch<MaterialRequest>(`/v2/material-requests/${id}`, data).then(r => r.data),
  transition: (id: string, newStatus: string) =>
    client.post<MaterialRequest>(`/v2/material-requests/${id}/transition`, null, {
      params: { new_status: newStatus },
    }).then(r => r.data),
  items: (id: string) =>
    client.get<MaterialRequestItem[]>(`/v2/material-requests/${id}/items`).then(r => r.data),
  addItem: (id: string, data: { catalog_item_id: string; quantity_planned: number }) =>
    client.post<MaterialRequestItem>(`/v2/material-requests/${id}/items`, data).then(r => r.data),
  updateItem: (id: string, itemId: string, data: Partial<MaterialRequestItem>) =>
    client.patch<MaterialRequestItem>(`/v2/material-requests/${id}/items/${itemId}`, data).then(r => r.data),
};

// ─── Finance v2 ───────────────────────────────────────────────────────────────

export const financeV2Api = {
  planFact: (projectId: string) =>
    client.get<ProjectPlanFact>(`/v2/projects/${projectId}/plan-fact`).then(r => r.data),
  forecast: (projectId: string) =>
    client.get<ProjectForecast>(`/v2/projects/${projectId}/forecast`).then(r => r.data),
  alerts: (projectId: string) =>
    client.get<ProjectAlert[]>(`/v2/projects/${projectId}/alerts`).then(r => r.data),
  companyPL: () =>
    client.get<CompanyPL>('/v2/company/pl').then(r => r.data),
  budgetEntries: (projectId: string) =>
    client.get<BudgetEntry[]>(`/v2/projects/${projectId}/budget`).then(r => r.data),
  addBudgetEntry: (projectId: string, data: { category: string; subcategory?: string; planned_amount: number; actual_amount?: number; note?: string }) =>
    client.post<BudgetEntry>(`/v2/projects/${projectId}/budget`, data).then(r => r.data),
};

// ─── AI Assistant v2 ──────────────────────────────────────────────────────────

export const assistantV2Api = {
  ask: (projectId: string, question: string, module: string) => {
    // Non-streaming path
    return client.post<AssistantResponse>(`/v2/projects/${projectId}/assistant`, {
      question, module,
    }).then(r => r.data);
  },
};

// ─── Project Members ──────────────────────────────────────────────────────────

export interface ProjectMember {
  id: string; project_id: string; user_id: string;
  role: string; username?: string; added_at: string;
}

export const projectMembersApi = {
  list: (projectId: string) =>
    client.get<ProjectMember[]>(`/v2/projects/${projectId}/members`).then(r => r.data),
  add: (projectId: string, data: { user_id: string; role: string }) =>
    client.post<ProjectMember>(`/v2/projects/${projectId}/members`, data).then(r => r.data),
  remove: (projectId: string, memberId: string) =>
    client.delete(`/v2/projects/${projectId}/members/${memberId}`),
};
