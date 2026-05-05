const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const backendRoot = path.join(__dirname, "../..");
const repoRoot = path.join(backendRoot, "..");

const canRunPython = (pythonPath) => {
  const result = spawnSync(pythonPath, ["--version"], {
    encoding: "utf8",
    windowsHide: true
  });
  return !result.error && result.status === 0;
};

const getPythonPath = () => {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;

  const venvPython = process.platform === "win32"
    ? path.join(repoRoot, "venv", "Scripts", "python.exe")
    : path.join(repoRoot, "venv", "bin", "python");

  if (fs.existsSync(venvPython) && canRunPython(venvPython)) return venvPython;

  const fallback = process.platform === "win32" ? "python" : "python3";
  return fallback;
};

const getBackendRoot = () => backendRoot;

const getPythonEnv = (extraEnv = {}) => ({
  ...process.env,
  PYTHONPATH: backendRoot,
  ...extraEnv
});

module.exports = {
  getBackendRoot,
  getPythonEnv,
  getPythonPath
};
