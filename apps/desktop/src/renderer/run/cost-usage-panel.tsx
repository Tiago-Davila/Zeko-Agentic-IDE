import { useEffect, useState } from "react";
import { AgentUsageReadingSchema, type AgentId, type AgentUsageReading, type Run } from "@zeko/contracts";
import { ipc } from "../ipc/client.js";
import type { RunDetail } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface CostUsagePanelProps {
  projectId: string;
  runId: string;
  run: Run;
  nodeRun: RunDetail["nodeRuns"][number];
}

export function CostUsagePanel({ projectId, runId, run, nodeRun }: CostUsagePanelProps) {
  const t = useT();
  const [usage, setUsage] = useState<AgentUsageReading[]>([]);

  useEffect(() => {
    let active = true;
    void ipc.request("agents.status", { projectId }).then((result) => {
      if (active) setUsage(result.usage);
    }).catch(() => {
      if (active) setUsage([]);
    });
    const unsubscribe = ipc.onEvent((event) => {
      if (event.type !== "agent.usage" || event.runId !== runId) return;
      const reading = AgentUsageReadingSchema.safeParse(event.payload);
      if (!reading.success) return;
      setUsage((current) => [...current.filter((item) => item.agentId !== reading.data.agentId), reading.data]);
    });
    return () => { active = false; unsubscribe(); };
  }, [projectId, runId]);

  const agents = [...new Set(run.flowSnapshot.nodes.filter((node) => node.type === "agent").map((node) => node.agent))];
  return <section className="cost-usage-panel" aria-label={t("costUsage.title")}>
    <div className="cost-usage-group">
      <h3>{t("costUsage.nodeCost")}</h3>
      <strong>{nodeRun.cost ? formatUsd(nodeRun.cost.amountUsd) : t("costUsage.notAvailable")}</strong>
      {nodeRun.cost && <small>{nodeRun.cost.basis === "list_price_estimate" ? t("costUsage.estimated") : t(`costUsage.basis.${nodeRun.cost.basis}`)}</small>}
      {nodeRun.consumption && <small>{formatTokens(nodeRun.consumption.inputTokens)} {t("costUsage.inputTokens")}{t("costUsage.separator")}{formatTokens(nodeRun.consumption.outputTokens)} {t("costUsage.outputTokens")}</small>}
      {nodeRun.warnings.includes("COST_NOT_REPORTED") && <small>{t("COST_NOT_REPORTED")}</small>}
    </div>
    <div className="cost-usage-group">
      <h3>{t("costUsage.runTotal")}</h3>
      <strong>{run.totals.amountUsd === undefined ? t("costUsage.notAvailable") : formatUsd(run.totals.amountUsd)}</strong>
      <small>{run.totals.partial ? t("costUsage.partial") : t("costUsage.complete")}{run.totals.estimated ? t("costUsage.separator") + t("costUsage.estimated") : ""}</small>
      <small>{formatTokens(run.totals.consumption.inputTokens)} {t("costUsage.inputTokens")}{t("costUsage.separator")}{formatTokens(run.totals.consumption.outputTokens)} {t("costUsage.outputTokens")}</small>
    </div>
    {run.hold === "USAGE_NEAR_LIMIT" && <div className="cost-usage-hold">{t("status.usageHold")}</div>}
    {agents.map((agent) => <SubscriptionUsage key={agent} agent={agent} reading={usage.find((item) => item.agentId === agent)} t={t} />)}
  </section>;
}

function SubscriptionUsage({ agent, reading, t }: { agent: AgentId; reading: AgentUsageReading | undefined; t: ReturnType<typeof useT> }) {
  return <div className="cost-usage-group cost-usage-group--subscription">
    <h3>{t("costUsage.subscription", { agent: agent === "claude-code" ? t("agent.claudeCode") : agent === "codex" ? t("agent.codex") : t("agent.fake") })}</h3>
    {!reading ? <small>{agent === "codex" ? t("costUsage.notLive") : t("costUsage.noReading")}</small> : <>
      <small>{reading.live ? t("costUsage.live") : t("costUsage.notLive")}</small>
      <small>{t("costUsage.readAt", { time: new Date(reading.readAt).toLocaleString() })}</small>
      {reading.windows.map((window) => <div className="usage-window" key={window.name}>
        <span>{window.name}</span><strong>{t("costUsage.percent", { value: Math.round(window.utilization * 100) })}</strong>
        <div className="usage-meter"><i style={{ width: `${Math.min(100, Math.round(window.utilization * 100))}%` }} /></div>
        {window.resetsAt && <small>{t("costUsage.resetsAt", { time: new Date(window.resetsAt).toLocaleString() })}</small>}
      </div>)}
    </>}
  </div>;
}

function formatUsd(amount: number): string { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount); }
function formatTokens(value: number | undefined): string { return value === undefined ? "—" : new Intl.NumberFormat().format(value); }
