import * as vscode from "vscode";
const fs = require("fs");
// const yaml = require("js-yaml");
const execWithIndices = require("regexp-match-indices");
const window = vscode.window;
const workspace = vscode.workspace;

type FileType = "json" | "yaml";
type YamlFormat = "get-values-of-special-key";
type CompareMode = "two-files" | "files-with-the-same-name-in-two-folders";

export function activate(context: vscode.ExtensionContext) {
  let timeout: any = null;
  let activeEditor = window.activeTextEditor;
  let missingKeys: string[] = [];

  // Inputs
  let referencePath = "";
  let comparePath = "";
  let fileType: FileType = "json";
  let usePathRelativeToWorkspace = true;
  let yamlFormat: YamlFormat = "get-values-of-special-key";
  let yamlSpecialKey: string = "key";
  let compareMode: CompareMode = "two-files";

  /* 
  Decoration settings
  backgroundColor got from ThemeColor to adapt existing theme
  This should be constant to be able to remove highlight with [] ranges array
  */
  const decorationType = window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("inputValidation.errorBackground"),
  });

  let settings = workspace.getConfiguration("find-missing-keys");

  /* Get reference file paths */
  function init() {
    // Future config options can placed here
    referencePath = settings.get("referencePath") || "";
    comparePath = settings.get("comparePath") || "";
    fileType = <FileType>settings.get("fileType");
    usePathRelativeToWorkspace =
      settings.get("usePathRelativeToWorkspace") ?? usePathRelativeToWorkspace;
    yamlFormat = settings.get("yamlFormat") ?? yamlFormat;
    yamlSpecialKey = settings.get("yamlSpecialKey") ?? yamlSpecialKey;
    compareMode = settings.get("compareMode") ?? compareMode;
  }

  /* Register toggle highlight command */
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

  /* Init with settings and start if an active editor exist */
  init();

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  /* Trigger when active editor change */
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

  /* Trigger when active document change */
  workspace.onDidChangeTextDocument(
    function (event) {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  /* Trigger when extension configuration change */
  workspace.onDidChangeConfiguration(
    () => {
      settings = workspace.getConfiguration("find-missing-keys");

      if (!settings.get("isEnabled")) return;

      init();
      triggerUpdateDecorations();
    },
    null,
    context.subscriptions
  );

  /* 
  This function create dot merged key array from a nested object
  making really easy to find missing keys by comparing two arrays
  
  Example
  const input = {
    "bear": {
      "polar": "white",
      "regular": "brown"
    },
    "bird": {
      "no-fly": "brown"
    },
    "human": "mixed"
  }

  output = [
    "bear.polar",
    "bear.regular",
    "bird.no-fly",
    "human"
  ]
  */
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

  const convertYamlDataToKeys = (rawData: string, yamlFormat: YamlFormat) => {
    if (yamlFormat == "get-values-of-special-key") {
      /* 
      For this format we parse text with regex
      */
      let regex = `${yamlSpecialKey}: (.*)`;
      const pattern = RegExp(regex, "g");
      const matches = [...rawData.matchAll(pattern)];

      const keys: string[] = [];
      matches.forEach((match) => {
        const key = match[1];
        if (key) {
          keys.push(key);
        }
      });

      return keys;
    }

    return [];
  };

  /* 
  This method gets file and gives it to getKeys method
  If file is visible it gets document from there to get unsaved changes
  else it gets with regular file system method
  */
  const getKeysFromFile = (path: string, workspacePath: string) => {
    let rawData: any;
    const editor = vscode.window.visibleTextEditors.find((editor) =>
      editor.document.uri.path.includes(path)
    );
    const fullPath = usePathRelativeToWorkspace ? workspacePath + path : path;
    if (editor) {
      rawData = editor.document.getText();
    } else {
      const rawDataBuffer: Buffer = fs.readFileSync(fullPath);
      rawData = rawDataBuffer.toString();
    }

    if (fileType == "json") {
      const refObject: Object = JSON.parse(rawData);
      return getKeys(refObject);
    } else if (fileType == "yaml") {
      return convertYamlDataToKeys(rawData, yamlFormat);
    } else {
      // Unsupported type
      const refObject: Object = {};
      return getKeys(refObject);
    }
  };

  /* 
  This method get array of merged keys and just compare to find missing ones
  Saves for decoration update
  */
  const updateKeys = (refFilePath: string, compFilePath: string) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders && refFilePath != "" && compFilePath != "") {
      let workspacePath = workspaceFolders[0].uri.path;

      const refKeys = getKeysFromFile(refFilePath, workspacePath);
      const compKeys = getKeysFromFile(compFilePath, workspacePath);

      missingKeys = [];
      refKeys.forEach((refKey) => {
        if (!compKeys.find((key) => key == refKey)) {
          missingKeys.push(refKey);
        }
      });
    }
  };

  /* 
  This method updates decoration to highlight missing keys
  */
  function updateDecorationsForFile(refFilePath: string, compFilePath: string) {
    // If reference or compare file not active not runs it
    if (
      !(
        refFilePath != "" &&
        activeEditor?.document?.uri.path.includes(refFilePath)
      ) &&
      !(
        compFilePath != "" &&
        activeEditor?.document?.uri.path.includes(compFilePath)
      )
    ) {
      return;
    }

    // Gets reference editor to highlight, if it is not visible it not continue
    const editor = vscode.window.visibleTextEditors.find((editor) =>
      editor.document.uri.path.includes(refFilePath)
    );
    if (!editor) return;

    // Updates keys
    updateKeys(refFilePath, compFilePath);

    // Gets reference documents text and create array to put highlighted ranges
    const text = editor.document.getText();
    const ranges: vscode.Range[] = [];

    // Finds each keys position and puts to ranges array
    missingKeys.forEach((fullKey) => {
      if (fileType == "json") {
        const range = findRangeForJsonKey(fullKey, text, editor);
        if (range) {
          ranges.push(range);
        }
      } else if (fileType == "yaml") {
        const range = findRangeForYamlKey(fullKey, text, editor, yamlFormat);
        if (range) {
          ranges.push(range);
        }
      }
    });

    // If is enabled it highlights else it removes it
    editor?.setDecorations(
      decorationType,
      settings.get("isEnabled") ? ranges : []
    );
  }

  function updateDecorations() {
    if (compareMode == "two-files") {
      updateDecorationsForFile(referencePath, comparePath);
    } else if (compareMode == "files-with-the-same-name-in-two-folders") {
      const refFolder: string[] = fs.readdirSync(referencePath);
      const compFolder: string[] = fs.readdirSync(comparePath);

      const matchingFiles: string[] = [];
      refFolder.forEach((fileName) => {
        if (compFolder.includes(fileName)) {
          matchingFiles.push(fileName);
        }
      });
      matchingFiles.forEach((file) => {
        updateDecorationsForFile(
          referencePath + "/" + file,
          comparePath + "/" + file
        );
      });
    }
  }

  const findRangeForJsonKey = (
    fullKey: string,
    documentText: string,
    editor: vscode.TextEditor
  ) => {
    // It split back keys to create regex
    const tree = fullKey.split(".");
    let regex = "";

    /* 
         It creates a regex to find key position
         It finds the key as first capturing group of match
         */
    tree.forEach((key, index) => {
      if (index + 1 == tree.length) {
        regex += `"(${key})"`;
      } else {
        regex += `"${key}":[\\s\\S]*?{[\\s\\S]*?`;
      }
    });

    const pattern = RegExp(regex, "g");
    /* 
          Finding index of capturing groups is not currently
          implemented to js, so it uses a polyfill library
          */
    const match = execWithIndices(pattern, documentText);
    const capturingGroupPosition = match.indices[1];

    // Adding range to ranges array
    if (match && editor) {
      const startPos = editor.document.positionAt(capturingGroupPosition[0]);
      const endPos = editor.document.positionAt(capturingGroupPosition[1]);

      return new vscode.Range(startPos, endPos);
    }
  };

  const findRangeForYamlKey = (
    fullKey: string,
    documentText: string,
    editor: vscode.TextEditor,
    yamlFormat: YamlFormat
  ) => {
    if (yamlFormat == "get-values-of-special-key") {
      let regex = `key: (${fullKey})`;
      const pattern = RegExp(regex, "g");
      /* 
      Finding index of capturing groups is not currently
      implemented to js, so it uses a polyfill library
      */
      const match = execWithIndices(pattern, documentText);
      const capturingGroupPosition = match.indices[1];

      // Adding range to ranges array
      if (match && editor) {
        const startPos = editor.document.positionAt(capturingGroupPosition[0]);
        const endPos = editor.document.positionAt(capturingGroupPosition[1]);

        return new vscode.Range(startPos, endPos);
      }
    }
  };

  /* 
  Triggers update of decorations
  Actually update logic copied from another library
  setTimeout this may not be needed but kept anyway
   */
  function triggerUpdateDecorations() {
    timeout && clearTimeout(timeout);
    timeout = setTimeout(updateDecorations, 0);
  }
}

/* Deactivate function if needed */
export function deactivate() {}
