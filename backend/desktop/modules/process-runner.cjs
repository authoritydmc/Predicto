/**
 * Process Runner Module
 * Shared helpers for Python subprocess IPC handlers.
 */

const { spawn } = require("child_process");
const path = require("path");
const { getBackendRoot, getPythonEnv, getPythonPath } = require("./python-runtime.cjs");

const getBackendPath = (...segments) => path.join(getBackendRoot(), ...segments);

const runPython = (args, options = {}) => new Promise((resolve) => {
  const pythonProcess = spawn(getPythonPath(), args, {
    cwd: getBackendRoot(),
    env: getPythonEnv(options.env),
    windowsHide: true
  });

  let stdout = "";
  let stderr = "";

  pythonProcess.stdout.on("data", (data) => { stdout += data.toString(); });
  pythonProcess.stderr.on("data", (data) => { stderr += data.toString(); });

  pythonProcess.on("close", (code) => {
    resolve({ code, stdout, stderr, success: code === 0 });
  });

  pythonProcess.on("error", (error) => {
    resolve({
      code: null,
      stdout,
      stderr,
      success: false,
      error
    });
  });
});

const parseJsonResult = (stdout, fallbackError) => {
  try {
    return JSON.parse(stdout);
  } catch {
    return { success: false, error: fallbackError };
  }
};

const runPythonJson = async (args, options = {}) => {
  const result = await runPython(args, options);

  if (result.error) {
    return {
      success: false,
      error: options.startError || "Failed to start Python process",
      details: result.error.message
    };
  }

  if (!result.success) {
    return {
      success: false,
      error: options.exitError || `Python process failed with code ${result.code}`,
      stderr: result.stderr
    };
  }

  return parseJsonResult(result.stdout, options.parseError || "Failed to parse Python output");
};

module.exports = {
  getBackendPath,
  runPython,
  runPythonJson
};
