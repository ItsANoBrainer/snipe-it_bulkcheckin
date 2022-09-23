# ItsANoBrainer

If you like or use this application, please consider supporting by starring the repo and checking out my other resources.

## _Snipe-IT Bulk Checkin_

[![N|Solid](https://i.imgur.com/sfDPQf9.png)](https://nodejs.org/)

Snipe-IT Bulk Checkin is an application created with Node.JS to easily and checkin a bulk list of assets via a CSV file using the Snipe-IT REST API. No longer do you need to manually checkin hundreds of assets. This tool does all that for you, and more with config file to tune it to your liking, as well as support for replacing all config file items with command line arguments for on the fly usage. Supports checkins using either asset_tag, serial_number, or id.

## Features
- Checkin a bulk list of assets via a CSV file using the Snipe-IT REST API
- Ability to use custom command line arguments to adjust install on a case by case basis

## Installation
Snipe-IT Bulk Checkin requires [Node.js](https://nodejs.org/) to run.

1. Install Node.JS. May require a computer restart.
3. Run `InstallDependencies.bat` or `npm install` in the install directory

## Usage
After installing the dependencies you can use the application.

1. Navigate to the `config.json` and input your `snipeitURL` and `apiKey`.
2. Setup the `checkin.csv` | Column headers must be setup like so:
```md
Column 1: id, asset_tag, serial_number | This is the identifier of the item you are checking out from. Pick one.
Column 2: note | An optional note attached to the checkout function
```
3. Run the `StartCheckin.bat` and follow the prompts

## Command Line Arguments
You can edit the `StartCheckin.bat` file and add as many command line arguments like below:
```
node index.js -allowPrompt false
```

This works for any and all keys in the `config.json`:
- snipeitURL `<url>` | URL to send API requests to
- apiKey `<key>` | Snipe-IT API key to use
- inputFile `<type>` | Which CSV file to use. Defaults to current directory.
- verbose `<true/false>` | Show more console logging
- allowPrompt `<true/false>` | Prompt the user for input before starting and doing important things

### Default `config.json`
```
{
    "snipeitURL": "",
    "apiKey": "",
    "inputFile": "checkin.csv",
    "verbose": true,
    "allowPrompt": true,

    "validTypes": ["id","asset_tag","serial_number"]
}
```

## Tech
- [Node.JS](https://nodejs.org/en/) - evented I/O for the backend
- [papaparse](https://www.papaparse.com/) - Node.JS module for reading CSV files
- [axios](https://axios-http.com/docs/intro) - Node.JS module to assist with web requests

### How it Works
This was a great personal project not only for my use case (needing to easily and quickly bulk checkin assest), but also to spend more time learning Javascript, API requests, and CSV parsing. Here is what it does:

1. Uses `papaparse` to read the the CSV and get the data we need into the script.
2. Uses `axios` to send the API requests to the Snipe-IT instance to checkin each asset individually

## Development
Want to contribute? Great!

This is an application for competant people who can follow directions. If you know what you're doing and are encountering issues, use the Issues and Pull Request section appropriately.
### Issues
Currently, the CSV files must be saved as `CSV (Comma delimited)` NOT `CSV UTF-8 (Comma delimited)` or there is some syntax errors that pop up caused by, what I assume to be, different linebreaks. I still have to look into the cause (possibly from papaparse).

## Change Log
### v1.0.0
* Initial Release

## Future ToDos
* Multi-thread api requests (no clue if this is a good idea or not)
* Support other CSV formats

## License
[GNU GPL v3](http://www.gnu.org/licenses/gpl-3.0.html)
