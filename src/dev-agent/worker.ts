import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { env } from "../config/env";
import type { DevAgentJob, DevAgentProvider } from "../domain/dev-agent/types";

interface ClaimResponse {
  job: DevAgentJob | null;
}

class DevAgentApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly workerId: string
  ) {}

  async claimNext(): Promise<DevAgentJob | null> {
    const response = await fetch(`${this.baseUrl}/api/dev-agent/jobs/claim`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ workerId: this.workerId })
    });
    const payload = await response.json() as ClaimResponse;
    return payload.job;
  }

  async appendEvent(jobId: string, kind: "status" | "stdout" | "stderr" | "summary", message: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/dev-agent/jobs/${jobId}/events`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ kind, message })
    });
  }

  async updateWorkspace(jobId: string, input: { repoPath?: string; branchName?: string; worktreePath?: string }): Promise<void> {
    await fetch(`${this.baseUrl}/api/dev-agent/jobs/${jobId}/workspace`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input)
    });
  }

  async complete(jobId: string, summary: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/dev-agent/jobs/${jobId}/complete`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ summary })
    });
  }

  async fail(jobId: string, errorMessage: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/dev-agent/jobs/${jobId}/fail`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ errorMessage })
    });
  }

  private headers(): HeadersInit {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.token}`
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function truncate(value: string, max = 500): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

async function spawnStreaming(
  command: string,
  args: string[],
  cwd: string,
  onStdout: (line: string) => Promise<void>,
  onStderr: (line: string) => Promise<void>
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    let stdoutBuffer = "";
    let stderrBuffer = "";

    const flush = async (buffer: string, sink: (line: string) => Promise<void>): Promise<string> => {
      const parts = buffer.split(/\r?\n/);
      const rest = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (line) {
          await sink(truncate(line));
        }
      }
      return rest;
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout += text;
      stdoutBuffer += text;
      void flush(stdoutBuffer, onStdout).then((rest) => {
        stdoutBuffer = rest;
      }).catch(rejectPromise);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderr += text;
      stderrBuffer += text;
      void flush(stderrBuffer, onStderr).then((rest) => {
        stderrBuffer = rest;
      }).catch(rejectPromise);
    });

    child.on("error", rejectPromise);
    child.on("close", async (code) => {
      if (stdoutBuffer.trim()) {
        await onStdout(truncate(stdoutBuffer.trim()));
      }
      if (stderrBuffer.trim()) {
        await onStderr(truncate(stderrBuffer.trim()));
      }
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function resolveGitRoot(repoPath: string): Promise<string> {
  const result = await spawnStreaming(
    "git",
    ["rev-parse", "--show-toplevel"],
    repoPath,
    async () => undefined,
    async () => undefined
  );

  if (result.code !== 0) {
    throw new Error("Impossible de resoudre le depot Git pour le worker.");
  }

  return result.stdout.trim();
}

async function createWorktree(repoRoot: string, jobId: string): Promise<{ branchName: string; worktreePath: string }> {
  const branchName = `davitus/job-${jobId.slice(0, 8)}`;
  const baseDir = join(repoRoot, ".davitus", "worktrees");
  await mkdir(baseDir, { recursive: true });
  const worktreePath = join(baseDir, jobId);

  const result = await spawnStreaming(
    "git",
    ["worktree", "add", "-b", branchName, worktreePath, "HEAD"],
    repoRoot,
    async () => undefined,
    async () => undefined
  );

  if (result.code !== 0) {
    throw new Error(`Creation du worktree impossible: ${result.stderr || result.stdout}`);
  }

  return { branchName, worktreePath };
}

function providerExecutable(provider: DevAgentProvider): string {
  const win = process.platform === "win32";
  if (provider === "claude") return win ? "claude.cmd" : "claude";
  return win ? "codex.cmd" : "codex";
}

function providerArgs(provider: DevAgentProvider, worktreePath: string, prompt: string, summaryFile: string): string[] {
  if (provider === "claude") {
    return [
      "-p",
      "--output-format",
      "stream-json",
      "--permission-mode",
      "acceptEdits",
      prompt
    ];
  }

  return [
    "exec",
    "--json",
    "--full-auto",
    "-C",
    worktreePath,
    "-o",
    summaryFile,
    prompt
  ];
}

async function runTestsJob(client: DevAgentApiClient, job: DevAgentJob, repoRoot: string): Promise<void> {
  await client.updateWorkspace(job.id, { repoPath: repoRoot });
  await client.appendEvent(job.id, "status", "Execution de npm test...");

  const result = await spawnStreaming(
    "npm.cmd",
    ["test"],
    repoRoot,
    async (line) => client.appendEvent(job.id, "stdout", line),
    async (line) => client.appendEvent(job.id, "stderr", line)
  );

  if (result.code !== 0) {
    await client.fail(job.id, `Tests en echec (code ${result.code}). Consulte les lignes ERR.`);
    return;
  }

  await client.complete(job.id, "Tests termines avec succes.");
}

async function runCodeJob(client: DevAgentApiClient, job: DevAgentJob, repoRoot: string): Promise<void> {
  const { branchName, worktreePath } = await createWorktree(repoRoot, job.id);
  await client.updateWorkspace(job.id, {
    repoPath: repoRoot,
    branchName,
    worktreePath
  });
  await client.appendEvent(job.id, "status", `Worktree cree: ${branchName}`);

  const tempDir = await mkdtemp(join(tmpdir(), "davitus-"));
  const summaryFile = join(tempDir, `${job.id}.txt`);
  const prompt = [
    "Tu travailles dans le projet Fusion.",
    "Execute la demande suivante dans le depot courant.",
    "Ne touche pas aux secrets ni au fichier .env.",
    "Laisse les modifications dans le worktree Git isole ; ne merge rien.",
    "A la fin, donne un resume concis des fichiers modifies et de la validation effectuee.",
    "",
    `Demande: ${job.requestText}`
  ].join("\n");

  await client.appendEvent(job.id, "status", `${job.provider} a pris le relais.`);
  const result = await spawnStreaming(
    providerExecutable(job.provider),
    providerArgs(job.provider, worktreePath, prompt, summaryFile),
    worktreePath,
    async (line) => client.appendEvent(job.id, "stdout", line),
    async (line) => client.appendEvent(job.id, "stderr", line)
  );

  const gitStatus = await spawnStreaming(
    "git",
    ["status", "--short"],
    worktreePath,
    async () => undefined,
    async () => undefined
  );

  let summary = "";
  try {
    summary = (await readFile(summaryFile, "utf8")).trim();
  } catch {
    summary = "";
  }

  await rm(tempDir, { recursive: true, force: true });

  const finalSummary = [
    summary || "Execution terminee.",
    gitStatus.stdout.trim() ? `Diff:\n${truncate(gitStatus.stdout.trim(), 1200)}` : "Aucun fichier modifie."
  ].join("\n\n");

  if (result.code !== 0) {
    throw new Error(finalSummary || "Le CLI codeur a echoue.");
  }

  await client.complete(job.id, truncate(finalSummary, 3000));
}

async function processJob(client: DevAgentApiClient, job: DevAgentJob, repoRoot: string): Promise<void> {
  if (job.jobType === "run_tests") {
    await runTestsJob(client, job, repoRoot);
    return;
  }

  await runCodeJob(client, job, repoRoot);
}

async function main(): Promise<void> {
  const token = env.devAgent.workerToken;
  if (!token) {
    throw new Error("DEV_AGENT_WORKER_TOKEN manquant pour le worker.");
  }

  const client = new DevAgentApiClient(
    env.devAgent.serverUrl,
    token,
    env.devAgent.workerId
  );
  const repoRoot = await resolveGitRoot(resolve(env.devAgent.repoPath ?? process.cwd()));

  console.log(`[DevWorker] repo: ${repoRoot}`);
  console.log(`[DevWorker] server: ${env.devAgent.serverUrl}`);

  while (true) {
    const job = await client.claimNext();
    if (!job) {
      await sleep(env.devAgent.pollIntervalMs);
      continue;
    }

    try {
      await processJob(client, job, repoRoot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await client.appendEvent(job.id, "stderr", truncate(message));
      await client.fail(job.id, truncate(message, 3000));
    }
  }
}

void main().catch((error) => {
  console.error("[DevWorker] erreur fatale:", error);
  process.exit(1);
});
