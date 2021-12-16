# Find Missing Keys

It finds missing keys inside a json file by comparing a reference json file.\
It highlights missing keys on reference json file.\
It is intended to use for translate files between source language and translated language. First created for use on ngx-translate i18n files.

[VSCode Marketplace Link](https://marketplace.visualstudio.com/items?itemName=berkayyildiz.find-missing-keys)

# Setup

You should set two path on vscode settings, paths should be relative to workspace root.

Compare File Path: for compared file. Example: /src/assets/i18n/en.json\
Reference File Path: for reference file. Example: /src/assets/i18n/tr.json

# Options

There is options to enable/disable highlighting. You can set it from settings "Is Enabled". Or you can use "Find Missing Keys: Toggle highlight" command.
