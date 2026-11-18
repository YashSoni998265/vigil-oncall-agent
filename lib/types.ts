// Shared types for a Vigil sandbox: one visitor's private copy of Thali's production.

export type ScenarioId = 'bad_deploy' | 'upi_provider' | 'db_overload';
export type IncidentStatus = 'investigating' | 'identified' | 'mitigating' | 'monitoring' | 'resolved';
export type StatusPageState = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type CallStatus = 'investigating' | 'ringing' | 'active' | 'missed' | 'declined' | 'ended';
export type ActionKind = 'read' | 'change' | 'blocked' | 'failed' | 'comms' | 'system';
export type RemediationAction =
  | 'rollback_deploy'
  | 'disable_feature_flag'
  | 'failover_provider'
  | 'pause_job'
  | 'cancel_query'
  | 'scale_service'
  | 'restart_service';

export interface ActionEntry {
  id: string;
  at: string;
  tool: string;
  title: string;
  detail?: string;
  kind: ActionKind;
  phase: 'before' | 'call' | 'after';
  /** The engineer's words that approved a production change. */
  approval?: string;
}

export interface ChannelMessage {
  id: string;
  at: string;
  author: string;
  role: 'vigil' | 'human' | 'bot';
  text: string;
}

export interface StatusUpdate {
  at: string;
  status: StatusPageState;
  text: string;
}

export interface FollowUp {
  key: string;
  title: string;
  owner: string;
  priority: 'P1' | 'P2' | 'P3';
  createdAt: string;
  /** Set when the follow-up was also opened as a real GitHub issue. */
  url?: string;
}

export interface Remediation {
  action: RemediationAction;
  target: string;
  at: string;
  outcome: 'success' | 'failed' | 'refused';
  effective: boolean;
  note: string;
}

export interface Incident {
  id: string;
  scenario: ScenarioId;
  severity: 'SEV-1' | 'SEV-2';
  title: string;
  faultAt: string;
  alertAt: string;
  status: IncidentStatus;
  /** When an effective fix landed (metrics start recovering from here). */
  mitigatedAt: string | null;
  /** When live metrics were confirmed back at baseline. */
  recoveredAt: string | null;
  recoveryAnnounced: boolean;
  resolvedAt: string | null;
  rootCause: string | null;
  summary: string | null;
  remediations: Remediation[];
  statusUpdates: StatusUpdate[];
  followUps: FollowUp[];
}

export interface CaptionLine {
  at: string;
  who: 'agent' | 'engineer' | 'teammate';
  text: string;
  typed?: boolean;
  /** Set once this approval has authorised a production change (one yes = one change). */
  usedFor?: string;
}

export interface CallState {
  status: CallStatus;
  kind: 'page' | 'callback';
  attempt: number;
  /** The phone starts ringing at this moment (after the investigation finishes). */
  ringAt: string | null;
  retryAt: string | null;
  agentId: string | null;
  channel: string | null;
  engineerUid: string | null;
  startedAt: string | null;
  lastSeenAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  teammatePaged: { name: string; at: string } | null;
  teammateJoinedAt: string | null;
  teammateAnnounced: boolean;
}

export interface Sandbox {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  engineer: string;
  incident: Incident | null;
  call: CallState | null;
  actions: ActionEntry[];
  channel: ChannelMessage[];
  transcript: CaptionLine[];
  callsUsed: number;
  escalatedTo: string | null;
  incidentCount: number;
  /** Created by the owner's device (owner key): real integrations may run for it. */
  owner?: boolean;
}

/** What GET /api/sandbox returns. */
export interface SandboxView {
  sandbox: Sandbox;
  now: number;
  limits: { callsLeft: number; maxCallSeconds: number; owner: boolean };
}
