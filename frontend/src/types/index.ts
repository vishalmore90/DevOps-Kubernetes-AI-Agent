export interface PodProblem {
  name: string;
  namespace: string;
  status: string;
  phase: string;
}

export interface PodsReport {
  success: boolean;
  healthy: boolean;
  total_pods?: number;
  running_pods?: number;
  failed_pods?: number;
  problematic_pods?: PodProblem[];
  error?: string;
}

export interface PodLogReport {
  status: string;
  current_logs: string;
  previous_logs: string;
  critical_errors: string[];
}

export interface WarningEvent {
  namespace: string;
  kind: string;
  name: string;
  reason: string;
  message: string;
  count: number;
  first_timestamp: string;
  last_timestamp: string;
}

export interface EventsReport {
  success: boolean;
  warnings?: WarningEvent[];
  error?: string;
}

export interface UnhealthyDeployment {
  name: string;
  namespace: string;
  desired_replicas: number;
  ready_replicas: number;
  unavailable_replicas: number;
  reason: string;
}

export interface DeploymentsReport {
  success: boolean;
  healthy: boolean;
  unhealthy_deployments?: UnhealthyDeployment[];
  error?: string;
}

export interface UnhealthyService {
  name: string;
  namespace: string;
  type: string;
  selector: Record<string, string>;
  reason: string;
}

export interface NetworkReport {
  success: boolean;
  healthy: boolean;
  unhealthy_services?: UnhealthyService[];
  error?: string;
}

export interface InvestigationReport {
  pods: PodsReport;
  logs: Record<string, PodLogReport>;
  events: EventsReport;
  deployments: DeploymentsReport;
  network: NetworkReport;
}

export interface DiagnosisReport {
  root_cause: string;
  explanation: string;
  fix: string;
  kubectl_command: string;
  prevention: string;
  confidence: number;
  severity?: string;
}

export interface InvestigationResponse {
  status: string;
  investigation: InvestigationReport;
  diagnosis: DiagnosisReport;
}
