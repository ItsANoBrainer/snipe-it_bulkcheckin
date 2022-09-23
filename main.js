const Config = require("./config.json");
const doPrompt = require("prompt-sync")({ sigint: true });
const fs = require("fs");
const axios = require("axios").default;
const Papa = require("papaparse")

main()
async function main() {
    GrabArguments()

    logLine("=")
    log(`[Log] Starting Snipe-IT Bulk Checkin by ItsANoBrainer.`)
    prompt(`[Log] Press enter to begin. This will checkin everything inside '${Config.inputFile}': `)

    if (Config.snipeitURL.length == 0) return log("[Error] No Snipe-IT URL set in the config file.")
    if (Config.apiKey.length == 0) return log("[Error] No API Key set in the config file.")
    if (!fs.existsSync(Config.inputFile)) return log(`[Error] Input file '${Config.inputFile}' not found.`)

    let csvData = [];
    Papa.parse(fs.createReadStream(Config.inputFile), {
        header: true,
        dynamicTyping: true,
        step: function (result) {
            csvData.push(result.data)
        },
        complete: function () {
            const checkinType = Object.keys(csvData[0])[0].toLowerCase()
            if (Config.validTypes.includes(checkinType)) {
                log(`[Checkin] Found ${csvData.length} record(s) to checkin by ${checkinType}.`);
                logLine("-")
                if (csvData.length > 0) startCheckinProcess(csvData, checkinType)
            } else {
                log(`[Error] Invalid type in header row column 1. ${checkinType} ${Config.validTypes.includes(checkinType)} ${Config.validTypes}`)
            }
        }
    });

    prompt(`[Log] Press enter to finish...`)
    logLine("=")
}

function GrabArguments() {
    const myArgs = process.argv.slice(2);
    const boolArgs = ["verbose", "allowPrompt"]

    Object.keys(Config).forEach((key) => {
        if (myArgs.includes(`-${key}`)) {
            let newConfig = myArgs[myArgs.indexOf(`-${key}`) + 1]
            if (boolArgs.includes(key)) newConfig = (newConfig == "true")
            Config[key] = newConfig
        }
    })
}

function log(msg, verbose) { if (!verbose || (verbose && Config.verbose)) console.log(msg) }
function logLine(type) { log(type.repeat(100)) }
function prompt(msg) { if (Config.allowPrompt) doPrompt(msg) }

async function startCheckinProcess(csvData, checkinKey) {
    const startTime = new Date().getTime()

    let errors = {}
    for (let i = 0; i < csvData.length; i++) {
        const entry = csvData[i]

        let assetID;
        switch (checkinKey) {
            case "id":
                assetID = entry[checkinKey]
                break;
            case "asset_tag":
                assetID = await getAssetID(`bytag`, entry[checkinKey])
                break;
            case "serial_number":
                assetID = await getAssetID(`byserial`, entry[checkinKey])
                break;
        }

        let assetCheckin;
        if (assetID != "Not Found") assetCheckin = await checkinAssetID(parseInt(assetID), entry.note)
        else assetCheckin = { status: "error", message: `${checkinKey} not found` }

        if (assetCheckin.status == "error") {
            if (!errors[assetCheckin["message"]]) { errors[assetCheckin["message"]] = [] }
            errors[assetCheckin["message"]].push(entry[checkinKey])
        }
        log(`[Checkin] ${i + 1}/${csvData.length} | ID: ${assetCheckin["id"] || "Not Found"} | Asset Tag: ${assetCheckin["asset tag"] || "Not Found"} | Status: ${assetCheckin["status"]} | ${assetCheckin["message"]}`)
    }

    if(Object.entries(errors).length > 0) {
        logLine("-")
        log(`[Checkin] The follow items had errors:`)

        for (const [key] of Object.entries(errors)) {
            let errorString = `- ${key.replace(".", "")}: `;
            errors[key].forEach((item, index) => {
                errorString += item
                if (Object.entries(errors[key]).length - 1 != index) { errorString += ", " }
            })
            log(errorString);
        }
    }


    logLine("-")
    log(`[Log] Completed in ${msToTimeLength(new Date().getTime() - startTime)}`)
    logLine("=")
}

function checkinAssetID(id, note) {
    return new Promise((resolve, reject) => {
        let options = {
            method: "POST",
            url: `${Config.snipeitURL}/api/v1/hardware/${id}/checkin`,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Config.apiKey}` },
            data: { "note": note }
        };

        axios.request(options).then(function (response) {
            const data = response.data
            resolve({ "id": id, "asset tag": data.payload?.asset, "status": data.status, "message": data.messages })
        }).catch(function (error) {
            reject(error)
        });
    });
}

function getAssetID(type, identifier) {
    return new Promise((resolve, reject) => {
        let options = {
            method: "GET",
            url: `${Config.snipeitURL}/api/v1/hardware/${type}/${identifier}`,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Config.apiKey}` },
        };
        axios.request(options).then(function (response) {
            resolve(response.data.id || response.data?.rows?.[0]?.id || "Not Found")
        }).catch(function (error) {
            reject(error)
        });
    });
}

function msToTimeLength(ms) {
    // Hours, minutes and seconds
    let hrs = ~~(ms / 3600000);
    let mins = ~~((ms % 3600000) / 60000);
    let secs = ~~(((ms % 360000) % 60000) / 1000);

    // Output like "1:01" or "4:03:59" or "123:03:59"
    let ret = "";

    if (hrs > 0) ret += "" + hrs + ":" + (mins < 10 ? "0" : "");

    ret += "" + mins + ":" + (secs < 10 ? "0" : "");
    ret += "" + secs;
    return ret;
}