// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
const fs = require("fs");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  var window = vscode.window;
  var activeEditor = window.activeTextEditor;
  let missingKeys: string[] = [];
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "find-missing-keys" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "find-missing-keys.findMissingKeys",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      const getKeys = (obj: Object) => {
        const keys: string[] = [];

        const walk = (o: Object, parent?: Object) => {
          for (const k in o) {
            const current = parent ? parent + "." + k : k;
            keys.push(current);

            // This checks if the current value is an Object
            if (
              Object.prototype.toString.call((o as any)[k]) ===
              "[object Object]"
            ) {
              walk((o as any)[k], current);
            }
          }
        };

        walk(obj);

        return keys;
      };

      const getKeysFromFile = (langKey: string, workspacePath: string) => {
        const rawData = fs.readFileSync(
          workspacePath + `/src/assets/i18n/${langKey}.json`
        );
        const refObject: Object = JSON.parse(rawData);
        return getKeys(refObject);
      };

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

      if (workspaceFolders) {
        let workspacePath = workspaceFolders[0].uri.path;

        const ref = "en";
        const comp = "tr";

        const refKeys = getKeysFromFile(ref, workspacePath);
        const compKeys = getKeysFromFile(comp, workspacePath);

        missingKeys = [];
        refKeys.forEach((refKey) => {
          if (!compKeys.find((key) => key == refKey)) {
            missingKeys.push(refKey);
          }
        });

        updateDecorations();

        vscode.window.showInformationMessage(
          "New Command from Find Missing Keys!"
        );
      }
    }
  );

  const updateDecorations = () => {
    if (!activeEditor || !activeEditor.document) {
      return;
    }

    const text = activeEditor.document.getText();
    const ranges: vscode.Range[] = [];

    missingKeys.forEach((longKey) => {
      const tree = longKey.split(".");

      tree.forEach((key, index) => {
        let capturingGroup: string = text + "";
        if (index + 1 == tree.length) {
          const pattern = RegExp(`"${key}"`, "g");
          const match = pattern.exec(capturingGroup);
          if (match && activeEditor) {
            const startPos = activeEditor.document.positionAt(match.index);
            const endPos = activeEditor.document.positionAt(
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
      backgroundColor: "red",
    });

    activeEditor?.setDecorations(decorationType, ranges);
  };

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
