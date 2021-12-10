import * as vscode from "vscode";
const fs = require("fs");
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
      // if (!settings.get("isEnabled")) return;

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

  const getKeys = (obj: Object) => {
    const keys: string[] = [];

    const walk = (o: Object, parent?: Object) => {
      for (const k in o) {
        const current = parent ? parent + "." + k : k;
        keys.push(current);

        // This checks if the current value is an Object
        if (
          Object.prototype.toString.call((o as any)[k]) === "[object Object]"
        ) {
          walk((o as any)[k], current);
        }
      }
    };

    walk(obj);

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
    /* 
      TODO Bug
      When there is two child keys, it marks on the first parent
      event when actually second is missing
      "a": {
        "c": "asd" //marked
      },
      "b": {
        "c": "fgh" //real missing
      }
      */

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

    missingKeys.forEach((longKey) => {
      const tree = longKey.split(".");

      tree.forEach((key, index) => {
        let capturingGroup: string = text + "";
        if (index + 1 == tree.length) {
          const pattern = RegExp(`"${key}"`, "g");
          const match = pattern.exec(capturingGroup);
          if (match && editor) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(
              match.index + match[0].length
            );

            ranges.push(new vscode.Range(startPos, endPos));
          }
        } else {
          const pattern = RegExp(`"${key}": {([\s\S]*?)}`, "g");
          const match = pattern.exec(capturingGroup);
          if (match) {
            capturingGroup = match[0];
          }
        }
      });
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
