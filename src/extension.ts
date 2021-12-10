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

  let settings = workspace.getConfiguration("find-missing-keys");

  init();

  if (activeEditor) {
    console.log("first init");
    triggerUpdateDecorations();
  }

  window.onDidChangeActiveTextEditor(
    function (editor) {
      activeEditor = editor;
      if (editor) {
        console.log("active editor changed");
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  workspace.onDidChangeTextDocument(
    function (event) {
      if (activeEditor && event.document === activeEditor.document) {
        console.log("document updated");

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

      init(); //no need
      console.log("configuration changed");
      triggerUpdateDecorations();
    },
    null,
    context.subscriptions
  );

  function init() {
    referenceFilePath = settings.get("referenceFilePath") || "";
    compareFilePath = settings.get("compareFilePath") || "";
  }

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "find-missing-keys.findMissingKeys",
    () => {
      vscode.window.showInformationMessage("Find Missing Keys init done");
    }
  );

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
    const rawData = fs.readFileSync(workspacePath + path);
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

    const decorationType = window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("inputValidation.errorBackground"),
    });

    editor?.setDecorations(decorationType, ranges);
  }

  function triggerUpdateDecorations() {
    timeout && clearTimeout(timeout);
    timeout = setTimeout(updateDecorations, 0);
  }

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
