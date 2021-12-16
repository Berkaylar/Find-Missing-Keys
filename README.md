# Find Missing Keys

It finds missing keys inside a file by comparing a reference file.\
It highlights missing keys on reference file.\
It is intended to use for translate files between source language and translated language. \
First created for use on ngx-translate i18n files.\
Yaml support added to use on "State of X" translations.

[VSCode Marketplace Link](https://marketplace.visualstudio.com/items?itemName=berkayyildiz.find-missing-keys)

# Guide

## Compare two files

Just set reference and compare path on settings.

## Compare two folders

Change compare mode to "files-with-the-same-name-in-two-folders", set reference and compare folder path on settings.

## Using YAML

Check file format to yaml. Update yaml format to needed format, and if exist update other variables that format needs.

## Working across workspaces

Uncheck use workspace relative path, give full path.

# Options

## Reference Path

This is file or folder that has all of wanted keys to compare. After compare this file or files in this folder will be marked for missing translations.

Default: src/assets/i18n/en.json\

## Compare Path

This is file or folder to compare with reference keys. File or files in this folder are not marked, changes will effect marking on the reference file/folder.

Default: src/assets/i18n/en.json\

## Compare Mode

Depending situation handling of files change, there is compare mode option for this.\

Default: two-files\

### two-files

It compares two given files

### files-with-the-same-name-in-two-folders

It collects all files on given folders, match same named files and compare their keys. It do not mark the files that is exist on reference folder but missing on the compare folder.

## Is Enabled

There is a setting option to enable/disable highlighting. You can set it from settings "Is Enabled". Or you can use "Find Missing Keys: Toggle highlight" command.\

Default: true\

## Use Path Relative To Workspace

For paths as default you give it relative to workspace folder but when you want to compare between workspaces you can make this option false and give full file path.\

Default: true\

## File Type

JSON and YAML is supported. JSON support is straight forward it checks all keys in json file.\
For YAML files structure can vary, so there is YAML Format option to parse it for wanted structure, if you choose YAML choose a format for parse too.

Default: json\

## YAML Format

YAML files structure can vary, so there is option to parse.\
Default: get-values-of-special-key

### get-values-of-special-key

This option gets a special key and gets values of that key as translation keys.\

#### Example:

```
 - key: resources.first_steps
    t: First Learning Methods
```

When special key is "key", it gets "resources.first_steps" as translation key.

## YAML Special Key

The special key for "get-values-of-special-key" yaml format.

Default: key\
