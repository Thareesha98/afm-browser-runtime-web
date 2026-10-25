import type { AgentMetadata, PlanIssue } from "@afm/engine";

export interface RunConfirmation {
  title: string;
  text: string;
}

export function runConfirmations(metadata: AgentMetadata, issues: PlanIssue[]): RunConfirmation[] {
  return issues.flatMap((issue) => {
    if (issue.severity !== "warning") return [];
    if (issue.code === "interface-unsupported") {
      const index = Number(/\[(\d+)\]/.exec(issue.path ?? "")?.[1]);
      const iface = metadata.interfaces?.[index];
      const label = iface?.type === "platformchat" ? `${iface.platform} platform chat` : iface?.type ?? "This interface";
      const detail = iface?.type === "platformchat" ? "Platform events will not be received."
        : iface?.type === "webhook" ? "Webhook requests will not be received."
        : "The terminal interface will not start.";
      return [{ title: `${label} cannot run here`, text: `Run a web chat preview instead? ${detail}` }];
    }
    if (issue.code === "stdio-transport-unsupported") {
      const index = Number(/\[(\d+)\]/.exec(issue.path ?? "")?.[1]);
      const name = metadata.tools?.mcp?.[index]?.name ?? "This local MCP server";
      return [{ title: `${name} cannot run here`, text: "This browser cannot start a local MCP process. Run without this tool server?" }];
    }
    if (issue.code === "local-skill-unsupported") {
      return [{ title: "Local skill unavailable", text: "This browser cannot read a local skill directory. Run without this skill?" }];
    }
    if (issue.code === "model-url-unsupported") {
      return [{ title: "Custom model URL unavailable", text: "This browser will use the model provider's default endpoint. Continue?" }];
    }
    if (issue.code === "structured-signature-unsupported") {
      return [{ title: "Structured chat unavailable", text: "This browser chat accepts and returns text. Run a text chat preview instead?" }];
    }
    return [{ title: "Browser limitation", text: `${issue.message} Continue with this browser preview?` }];
  });
}
