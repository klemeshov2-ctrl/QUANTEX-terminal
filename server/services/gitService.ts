import { simpleGit, SimpleGit } from "simple-git";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface GitRepoStatus {
  success: boolean;
  isGitRepo: boolean;
  currentBranch?: string;
  remoteUrl?: string;
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: string;
  } | null;
  statusSummary?: string;
  hasUpdateScript: boolean;
  error?: string;
}

export interface GitPullResult {
  success: boolean;
  logs: string[];
  commit?: string;
  error?: string;
}

export class SafeGitService {
  private git: SimpleGit;
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.git = simpleGit({ baseDir: rootDir, maxConcurrentProcesses: 2 });
  }

  public async getStatus(): Promise<GitRepoStatus> {
    const gitDir = path.resolve(this.rootDir, ".git");
    const hasUpdateScript = fsSync.existsSync(path.resolve(this.rootDir, "update.sh"));
    const isGitRepo = fsSync.existsSync(gitDir);

    if (!isGitRepo) {
      return {
        success: true,
        isGitRepo: false,
        hasUpdateScript
      };
    }

    try {
      let currentBranch = "main";
      try {
        const branchSummary = await this.git.branch();
        currentBranch = branchSummary.current || "main";
      } catch {
        // Fallback
      }

      let remoteUrl = "";
      try {
        const remotes = await this.git.getRemotes(true);
        const origin = remotes.find(r => r.name === "origin") || remotes[0];
        if (origin && origin.refs && origin.refs.fetch) {
          remoteUrl = origin.refs.fetch;
        }
      } catch {
        // Ignore
      }

      let lastCommit = null;
      try {
        const log = await this.git.log({ maxCount: 1 });
        if (log.latest) {
          lastCommit = {
            hash: log.latest.hash.slice(0, 7),
            message: log.latest.message,
            author: log.latest.author_name,
            date: log.latest.date
          };
        }
      } catch {
        // Ignore
      }

      let statusSummary = "";
      try {
        const status = await this.git.status();
        statusSummary = status.isClean() ? "working tree clean" : `${status.files.length} changed files`;
      } catch {
        // Ignore
      }

      return {
        success: true,
        isGitRepo: true,
        currentBranch,
        remoteUrl,
        lastCommit,
        statusSummary,
        hasUpdateScript
      };
    } catch (err: any) {
      return {
        success: true,
        isGitRepo: true,
        error: err.message,
        hasUpdateScript
      };
    }
  }

  public async pullAndDeploy(options: {
    autoBuild?: boolean;
    autoInstall?: boolean;
    stashLocal?: boolean;
  } = {}): Promise<GitPullResult> {
    const { autoBuild = true, autoInstall = true, stashLocal = true } = options;
    const logs: string[] = [];
    const timestamp = () => new Date().toLocaleTimeString("ru-RU");

    const gitDir = path.resolve(this.rootDir, ".git");
    if (!fsSync.existsSync(gitDir)) {
      return {
        success: false,
        logs: [`[${timestamp()}] ❌ Папка .git не найдена`],
        error: "Папка .git не найдена. Убедитесь, что репозиторий клонирован корректно."
      };
    }

    try {
      logs.push(`[${timestamp()}] 🚀 Начало обновления проекта из GitHub...`);

      if (stashLocal) {
        try {
          logs.push(`[${timestamp()}] 📦 Сохранение локальных изменений (git stash)...`);
          const stashRes = await this.git.stash();
          if (stashRes) logs.push(`> ${stashRes}`);
        } catch (e: any) {
          logs.push(`Примечание stash: ${e.message}`);
        }
      }

      let branch = "main";
      try {
        const branchSummary = await this.git.branch();
        if (branchSummary.current) branch = branchSummary.current;
      } catch {}

      logs.push(`[${timestamp()}] 📥 Загрузка изменений (git pull origin ${branch})...`);
      try {
        const pullSummary = await this.git.pull("origin", branch);
        logs.push(`> Summary: files changed: ${pullSummary.files.length}, insertions: ${pullSummary.insertions}, deletions: ${pullSummary.deletions}`);
      } catch (pullErr: any) {
        logs.push(`Попытка pull master: ${pullErr.message}`);
        await this.git.pull("origin", "master");
      }

      if (autoInstall) {
        logs.push(`[${timestamp()}] 📦 Проверка и установка пакетов (npm install)...`);
        try {
          const { stdout: npmOut } = await execFileAsync("npm", ["install", "--prefer-offline", "--no-audit"], {
            cwd: this.rootDir
          });
          if (npmOut) logs.push(npmOut.slice(0, 500));
        } catch (npmErr: any) {
          logs.push(`Предупреждение npm install: ${npmErr.message}`);
        }
      }

      if (autoBuild) {
        logs.push(`[${timestamp()}] ⚙️ Пересборка фронтенда и сервера (npm run build)...`);
        try {
          const { stdout: buildOut } = await execFileAsync("npm", ["run", "build"], {
            cwd: this.rootDir
          });
          if (buildOut) logs.push(buildOut.slice(0, 500));
        } catch (buildErr: any) {
          logs.push(`Предупреждение сборки: ${buildErr.message}`);
        }
      }

      let newCommit = "";
      try {
        const log = await this.git.log({ maxCount: 1 });
        if (log.latest) {
          newCommit = `${log.latest.hash.slice(0, 7)} - ${log.latest.message} (${log.latest.date})`;
          logs.push(`[${timestamp()}] 🏷️ Текущий коммит: ${newCommit}`);
        }
      } catch {}

      logs.push(`[${timestamp()}] ✅ Обновление успешно завершено!`);
      return {
        success: true,
        logs,
        commit: newCommit
      };
    } catch (err: any) {
      logs.push(`[${timestamp()}] ❌ Сбой при обновлении: ${err.message}`);
      return {
        success: false,
        error: err.message,
        logs
      };
    }
  }

  public async initRepo(repoUrl: string): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];
    const timestamp = () => new Date().toLocaleTimeString("ru-RU");

    // Strictly validate repository URL format (HTTPS github repository)
    const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/;
    const trimmedUrl = repoUrl.trim();
    if (!githubRegex.test(trimmedUrl)) {
      return {
        success: false,
        logs: [`[${timestamp()}] ❌ Небезопасный или некорректный URL репозитория`],
        error: "Неверный формат URL. Разрешены только прямые HTTPS ссылки GitHub (например: https://github.com/user/repo.git)"
      };
    }

    try {
      logs.push(`[${timestamp()}] 🚀 Инициализация Git репозитория...`);
      await this.git.init();

      const remotes = await this.git.getRemotes();
      const hasOrigin = remotes.some(r => r.name === "origin");

      if (hasOrigin) {
        await this.git.remote(["set-url", "origin", trimmedUrl]);
      } else {
        await this.git.addRemote("origin", trimmedUrl);
      }

      logs.push(`[${timestamp()}] 🔗 Привязан remote origin: ${trimmedUrl}`);
      return { success: true, logs };
    } catch (err: any) {
      return { success: false, logs, error: err.message };
    }
  }
}

export const safeGitService = new SafeGitService();
