import * as vscode from "vscode";
const fs = require("fs");
const execWithIndices = require("regexp-match-indices");
const window = vscode.window;
const workspace = vscode.workspace;

export function activate(context: vscode.ExtensionContext) {
  let timeout: any = null;
  let activeEditor = window.activeTextEditor;
  let missingKeys: string[] = [];
  let referenceFilePath = "";
  let compareFilePath = "";

  const decorationType = window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("inputValidation.errorBackground"),
  });

  let settings = workspace.getConfiguration("find-missing-keys");

  init();

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "find-missing-keys.toggleHighlight",
      function () {
        settings
          .update("isEnable", !settings.get("isEnable"), true)
          .then(function () {
            triggerUpdateDecorations();
          });
      }
    )
  );

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  window.onDidChangeActiveTextEditor(
    function (editor) {
      activeEditor = editor;
      if (editor) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  workspace.onDidChangeTextDocument(
    function (event) {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  workspace.onDidChangeConfiguration(
    () => {
      settings = workspace.getConfiguration("find-missing-keys");

      //NOTE: if disabled, do not re-initialize the data or we will not be able to clear the style immediatly via 'toggle highlight' command
      if (!settings.get("isEnabled")) return;

      init();
      triggerUpdateDecorations();
    },
    null,
    context.subscriptions
  );

  function init() {
    referenceFilePath = settings.get("referenceFilePath") || "";
    compareFilePath = settings.get("compareFilePath") || "";
  }

  const getKeys = (refObj: Object) => {
    const keys: string[] = [];

    const walk = (obj: Object, parent?: Object) => {
      for (const k in obj) {
        const current = parent ? parent + "." + k : k;
        keys.push(current);

        // This checks if the current value is an Object
        if (
          Object.prototype.toString.call((obj as any)[k]) === "[object Object]"
        ) {
          walk((obj as any)[k], current);
        }
      }
    };

    walk(refObj);

    return keys;
  };

  const getKeysFromFile = (path: string, workspacePath: string) => {
    let rawData: any;
    const editor = vscode.window.visibleTextEditors.find((editor) =>
      editor.document.uri.path.includes(path)
    );
    if (editor) {
      rawData = editor.document.getText();
    } else {
      rawData = fs.readFileSync(workspacePath + path);
    }
    const refObject: Object = JSON.parse(rawData);
    return getKeys(refObject);
  };

  const updateKeys = () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders && referenceFilePath != "" && compareFilePath != "") {
      let workspacePath = workspaceFolders[0].uri.path;

      const refKeys = getKeysFromFile(referenceFilePath, workspacePath);
      const compKeys = getKeysFromFile(compareFilePath, workspacePath);

      missingKeys = [];
      refKeys.forEach((refKey) => {
        if (!compKeys.find((key) => key == refKey)) {
          missingKeys.push(refKey);
        }
      });
    }
  };

  function updateDecorations() {
    if (
      !(
        referenceFilePath != "" &&
        activeEditor?.document?.uri.path.includes(referenceFilePath)
      ) &&
      !(
        compareFilePath != "" &&
        activeEditor?.document?.uri.path.includes(compareFilePath)
      )
    ) {
      return;
    }
    const editor = vscode.window.visibleTextEditors.find((editor) =>
      editor.document.uri.path.includes(referenceFilePath)
    );
    if (!editor) return;

    updateKeys();

    const text = editor.document.getText();
    const ranges: vscode.Range[] = [];

    missingKeys.forEach((fullKey) => {
      const tree = fullKey.split(".");

      let regex = "";

      tree.forEach((key, index) => {
        if (index + 1 == tree.length) {
          regex += `"(${key})"`;
        } else {
          regex += `"${key}":[\\s\\S]*?{[\\s\\S]*?`;
        }
      });

      const pattern = RegExp(regex, "g");
      const match = execWithIndices(pattern, text);
      const capturingGroupPosition = match.indices[1];

      if (match && editor) {
        const startPos = editor.document.positionAt(capturingGroupPosition[0]);
        const endPos = editor.document.positionAt(capturingGroupPosition[1]);

        ranges.push(new vscode.Range(startPos, endPos));
      }
    });

    editor?.setDecorations(
      decorationType,
      settings.get("isEnabled") ? ranges : []
    );
  }

  function triggerUpdateDecorations() {
    timeout && clearTimeout(timeout);
    timeout = setTimeout(updateDecorations, 0);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}
